import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

// UC-SYS-04 (SYS04-R03): 5 vai trò WMS hợp lệ khi gán.
const ALLOWED_ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"];
const ROLE_ERR =
  "Vai trò không hợp lệ. Chỉ nhận: Quản lý, Kế toán, Thủ kho, Xe nâng, Người kiểm kê.";

// PUT /api/users/[id] — Sửa user (tên, vai trò, khóa, email, SĐT, đổi mật khẩu)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requirePermission(req, "user", "write");
  } catch (err) {
    return apiErrorResponse(err);
  }
  try {
    const { id } = await params;
    const body = await req.json();
    const { full_name, role, is_locked, email, phone, password } = body;

    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, full_name: true, email: true, phone: true, role: true, is_locked: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, error: "Người dùng không tồn tại." }, { status: 404 });
    }

    const isSelf = id === ctx.user.id;
    const demotingFromQuanLy = current.role === "QUAN_LY" && role !== undefined && role !== "QUAN_LY";
    const lockingUser = is_locked === true && !current.is_locked;

    // SYS04-R01 (chống lockout): không tự đổi vai / tự khóa chính mình.
    if (isSelf && role !== undefined && role !== current.role) {
      return NextResponse.json({ success: false, error: "Không thể tự đổi vai trò của chính mình." }, { status: 400 });
    }
    if (isSelf && lockingUser) {
      return NextResponse.json({ success: false, error: "Không thể tự khóa tài khoản của mình." }, { status: 400 });
    }
    // SYS04-R01 (chống lockout): giữ tối thiểu 1 Quản lý còn hoạt động.
    if ((demotingFromQuanLy || lockingUser) && current.role === "QUAN_LY") {
      const activeQuanLy = await prisma.user.count({ where: { role: "QUAN_LY", is_locked: false } });
      if (activeQuanLy <= 1) {
        return NextResponse.json(
          { success: false, error: "Đây là tài khoản Quản lý duy nhất còn hoạt động — không thể hạ vai hoặc khóa." },
          { status: 400 }
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (full_name !== undefined) data.full_name = full_name.trim();
    // SYS04-R03: validate role trước khi ghi (tránh 500 do enum sai + chặn legacy).
    if (role !== undefined) {
      if (!ALLOWED_ROLES.includes(role)) {
        return NextResponse.json({ success: false, error: ROLE_ERR }, { status: 400 });
      }
      data.role = role;
    }
    if (is_locked !== undefined) data.is_locked = is_locked;

    // Sửa thông tin liên hệ — phải còn ÍT NHẤT email hoặc SĐT (giữ bất biến như lúc tạo)
    if (email !== undefined || phone !== undefined) {
      const e = (email ?? "").trim();
      const p = (phone ?? "").trim();
      if (!e && !p) {
        return NextResponse.json({ success: false, error: "Cần ít nhất email hoặc SĐT." }, { status: 400 });
      }
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
        return NextResponse.json({ success: false, error: "Email không đúng định dạng." }, { status: 400 });
      }
      if (p && !/^[0-9+\-\s]{7,15}$/.test(p)) {
        return NextResponse.json({ success: false, error: "Số điện thoại không hợp lệ." }, { status: 400 });
      }
      if (email !== undefined) data.email = e || null;
      if (phone !== undefined) data.phone = p || null;
    }

    // Đổi mật khẩu (chỉ khi gửi lên giá trị mới) — hash bcrypt như lúc tạo
    let passwordChanged = false;
    if (password !== undefined && String(password).trim()) {
      if (String(password).length < 6) {
        return NextResponse.json({ success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
      }
      data.password_hash = await bcrypt.hash(String(password), 10);
      passwordChanged = true;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, full_name: true, email: true, phone: true, role: true, is_locked: true },
    });

    // SYS04-R06: audit — phân biệt khóa/mở khóa vs sửa; KHÔNG ghi mật khẩu (chỉ cờ đã đổi).
    const onlyLockToggle =
      is_locked !== undefined && full_name === undefined && role === undefined &&
      email === undefined && phone === undefined && !passwordChanged;
    const action = onlyLockToggle ? (is_locked ? "LOCK_USER" : "UNLOCK_USER") : "UPDATE_USER";
    const changes: string[] = [];
    if (role !== undefined && role !== current.role) changes.push(`vai ${current.role}→${role}`);
    if (is_locked !== undefined && is_locked !== current.is_locked) changes.push(is_locked ? "khóa" : "mở khóa");
    if (passwordChanged) changes.push("đổi mật khẩu");
    await logAudit(req, {
      entity_type: "user",
      entity_id: user.id,
      action,
      old_value: { full_name: current.full_name, email: current.email, phone: current.phone, role: current.role, is_locked: current.is_locked },
      new_value: { full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, is_locked: user.is_locked, password_changed: passwordChanged },
      reason: `${ctx.user.full_name} cập nhật ${user.full_name}${changes.length ? " (" + changes.join(", ") + ")" : ""}`,
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ success: false, error: "Email hoặc SĐT đã tồn tại." }, { status: 400 });
    }
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// DELETE /api/users/[id] — Xóa user (hard-delete; có rào an toàn chống lockout)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await requirePermission(req, "user", "write");
  } catch (err) {
    return apiErrorResponse(err);
  }
  try {
    const { id } = await params;
    const current = await prisma.user.findUnique({
      where: { id },
      select: { id: true, full_name: true, email: true, phone: true, role: true, is_locked: true },
    });
    if (!current) {
      return NextResponse.json({ success: false, error: "Người dùng không tồn tại." }, { status: 404 });
    }
    // SYS04-R01 (chống lockout): không tự xóa mình; không xóa Quản lý cuối cùng.
    if (id === ctx.user.id) {
      return NextResponse.json({ success: false, error: "Không thể tự xóa tài khoản của mình." }, { status: 400 });
    }
    if (current.role === "QUAN_LY") {
      const totalQuanLy = await prisma.user.count({ where: { role: "QUAN_LY" } });
      if (totalQuanLy <= 1) {
        return NextResponse.json(
          { success: false, error: "Không thể xóa tài khoản Quản lý duy nhất của hệ thống." },
          { status: 400 }
        );
      }
    }

    await prisma.user.delete({ where: { id } });
    // SYS04-R06: audit xóa — lưu snapshot cũ (không có mật khẩu).
    await logAudit(req, {
      entity_type: "user",
      entity_id: current.id,
      action: "DELETE_USER",
      old_value: { full_name: current.full_name, email: current.email, phone: current.phone, role: current.role, is_locked: current.is_locked },
      new_value: null,
      reason: `${ctx.user.full_name} xóa người dùng ${current.full_name} (vai ${current.role})`,
    });
    return NextResponse.json({ success: true, message: "Đã xóa." });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { guardPermission, requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

// UC-SYS-04 (SYS04-R03): chỉ 5 vai trò WMS hợp lệ khi GÁN cho người dùng.
// Loại legacy ADMIN/MANAGER/STAFF (đã bị vô hiệu ở RBAC) + PENDING (nội bộ, không gán tay).
const ALLOWED_ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"];
const ROLE_ERR =
  "Vai trò không hợp lệ. Chỉ nhận: Quản lý, Kế toán, Thủ kho, Xe nâng, Người kiểm kê.";

// GET /api/users — Danh sách người dùng (chỉ QUẢN LÝ — user:read)
export async function GET(req: Request) {
  const denied = await guardPermission(req, "user", "read");
  if (denied) return denied;
  try {
    const users = await prisma.user.findMany({
      orderBy: { created_at: "desc" },
      select: { id: true, email: true, phone: true, full_name: true, role: true, is_locked: true, last_login_at: true, created_at: true },
    });
    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

// POST /api/users — Tạo user mới (chỉ QUẢN LÝ — user:write)
export async function POST(req: NextRequest) {
  let ctx;
  try {
    ctx = await requirePermission(req, "user", "write");
  } catch (err) {
    return apiErrorResponse(err);
  }
  try {
    const body = await req.json();
    const { full_name, email, phone, password, role } = body;
    if (!full_name?.trim() || !password?.trim()) {
      return NextResponse.json({ success: false, error: "Thiếu tên hoặc mật khẩu." }, { status: 400 });
    }
    if (!email && !phone) {
      return NextResponse.json({ success: false, error: "Cần ít nhất email hoặc SĐT." }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ success: false, error: "Email không đúng định dạng." }, { status: 400 });
    }
    if (phone && !/^[0-9+\-\s]{7,15}$/.test(phone.trim())) {
      return NextResponse.json({ success: false, error: "Số điện thoại không hợp lệ." }, { status: 400 });
    }
    // SYS04-R05: đồng bộ với FE + PUT — mật khẩu tối thiểu 6 ký tự.
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
    }
    // SYS04-R03: bắt buộc vai trò hợp lệ (bỏ default "STAFF" cũ — legacy 0 quyền).
    if (!role || !ALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ success: false, error: ROLE_ERR }, { status: 400 });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        full_name: full_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        password_hash,
        role,
      },
      select: { id: true, full_name: true, email: true, phone: true, role: true },
    });
    // SYS04-R06: audit tạo user — KHÔNG ghi mật khẩu/hash.
    await logAudit(req, {
      entity_type: "user",
      entity_id: user.id,
      action: "CREATE_USER",
      old_value: null,
      new_value: { full_name: user.full_name, email: user.email, phone: user.phone, role: user.role },
      reason: `${ctx.user.full_name} tạo người dùng ${user.full_name} (vai ${user.role})`,
    });
    return NextResponse.json({ success: true, data: user });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ success: false, error: "Email hoặc SĐT đã tồn tại." }, { status: 400 });
    }
    console.error("POST /api/users error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";

// PUT /api/users/[id] — Sửa user (tên, vai trò, khóa, email, SĐT, đổi mật khẩu)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { full_name, role, is_locked, email, phone, password } = body;
    const data: Record<string, unknown> = {};
    if (full_name !== undefined) data.full_name = full_name.trim();
    if (role !== undefined) data.role = role;
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
    if (password !== undefined && String(password).trim()) {
      if (String(password).length < 6) {
        return NextResponse.json({ success: false, error: "Mật khẩu phải có ít nhất 6 ký tự." }, { status: 400 });
      }
      data.password_hash = await bcrypt.hash(String(password), 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, full_name: true, email: true, phone: true, role: true, is_locked: true },
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

// DELETE /api/users/[id] — Xóa user
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Đã xóa." });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

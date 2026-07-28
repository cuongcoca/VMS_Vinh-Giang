import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { guardPermission } from "@/lib/auth-server";

// GET /api/users — Danh sách người dùng
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

// POST /api/users — Tạo user mới
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "user", "write");
  if (denied) return denied;
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
    const password_hash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        full_name: full_name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        password_hash,
        role: role || "STAFF",
      },
      select: { id: true, full_name: true, email: true, phone: true, role: true },
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

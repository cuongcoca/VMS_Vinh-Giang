import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

import { getJwtSecret } from "@/lib/jwt";

// DELETE /api/auth/sessions/[id] — Đăng xuất một phiên cụ thể
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    let decoded: { userId: string; sessionId?: string };
    try {
      decoded = jwt.verify(token, getJwtSecret()) as { userId: string; sessionId?: string };
    } catch {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id: sessionId } = await params;

    // Verify session belongs to this user
    const session = await prisma.session.findFirst({
      where: {
        id: sessionId,
        user_id: decoded.userId,
        is_active: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Phiên đăng nhập không tồn tại." },
        { status: 404 }
      );
    }

    // Don't allow revoking current session via this endpoint
    if (decoded.sessionId === sessionId) {
      return NextResponse.json(
        { success: false, error: "Không thể đăng xuất phiên hiện tại. Hãy sử dụng nút Đăng xuất." },
        { status: 400 }
      );
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { is_active: false },
    });

    return NextResponse.json({
      success: true,
      message: "Đã đăng xuất phiên đăng nhập thành công.",
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as jwt from "jsonwebtoken";

import { getJwtSecret } from "@/lib/jwt";

function verifyToken(req: Request): { userId: string; sessionId?: string } | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(authHeader.split(" ")[1], getJwtSecret()) as { userId: string; sessionId?: string };
  } catch {
    return null;
  }
}

// GET /api/auth/sessions — Lấy danh sách phiên đăng nhập
export async function GET(req: Request) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const sessions = await prisma.session.findMany({
      where: {
        user_id: decoded.userId,
        is_active: true,
      },
      orderBy: { last_active: "desc" },
      select: {
        id: true,
        device_info: true,
        ip_address: true,
        location: true,
        last_active: true,
        created_at: true,
      },
    });

    // Đánh dấu session hiện tại
    const sessionsWithCurrent = sessions.map((s: { id: string; device_info: string; ip_address: string | null; location: string | null; last_active: Date; created_at: Date }) => ({
      ...s,
      is_current: s.id === decoded.sessionId,
    }));

    return NextResponse.json({ success: true, sessions: sessionsWithCurrent });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

// DELETE /api/auth/sessions — Đăng xuất tất cả phiên (trừ hiện tại)
export async function DELETE(req: Request) {
  try {
    const decoded = verifyToken(req);
    if (!decoded) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Deactivate all sessions except current
    const result = await prisma.session.updateMany({
      where: {
        user_id: decoded.userId,
        is_active: true,
        ...(decoded.sessionId ? { id: { not: decoded.sessionId } } : {}),
      },
      data: { is_active: false },
    });

    return NextResponse.json({
      success: true,
      message: `Đã đăng xuất ${result.count} phiên đăng nhập.`,
      count: result.count,
    });
  } catch (error) {
    console.error("Delete all sessions error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

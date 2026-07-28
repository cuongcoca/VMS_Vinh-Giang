import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

// POST /api/notifications/[id]/read — đánh dấu 1 thông báo là đã đọc.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "notification", "write");
  if (denied) return denied;
  try {
    const actor = getRequestActor(req);
    if (!actor.userId) {
      return NextResponse.json(
        { success: false, error: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const { id } = await params;
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.user_id !== actor.userId) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy thông báo." },
        { status: 404 }
      );
    }

    if (!notif.read_at) {
      await prisma.notification.update({
        where: { id },
        data: { read_at: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/notifications/[id]/read error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi cập nhật." },
      { status: 500 }
    );
  }
}

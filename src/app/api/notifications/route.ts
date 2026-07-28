import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

// GET /api/notifications?unread=true&limit=20
// Phase 7.2 — TC_IN_REQ_028: trả về danh sách thông báo của user hiện tại
// (lấy từ JWT). Mặc định 20 mục mới nhất.
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "notification", "read");
  if (denied) return denied;
  try {
    const actor = getRequestActor(req);
    if (!actor.userId) {
      return NextResponse.json(
        { success: false, error: "Chưa đăng nhập." },
        { status: 401 }
      );
    }

    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "20"), 100);

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          user_id: actor.userId,
          ...(unreadOnly ? { read_at: null } : {}),
        },
        orderBy: { created_at: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: { user_id: actor.userId, read_at: null },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      unread_count: unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải thông báo." },
      { status: 500 }
    );
  }
}

// POST /api/notifications/mark-all-read — đánh dấu tất cả thông báo của user
// hiện tại là đã đọc.
export async function POST(req: NextRequest) {
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

    const result = await prisma.notification.updateMany({
      where: { user_id: actor.userId, read_at: null },
      data: { read_at: new Date() },
    });

    return NextResponse.json({ success: true, updated_count: result.count });
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật trạng thái đọc." },
      { status: 500 }
    );
  }
}

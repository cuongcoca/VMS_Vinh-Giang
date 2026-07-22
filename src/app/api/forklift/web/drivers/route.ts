import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ngưỡng (phút) coi tài xế là "đang làm việc" nếu có hoạt động gần đây
const ACTIVE_WINDOW_MIN = 30;

// Chuyển số phút thành chữ tương đối tiếng Việt
function relTime(mins: number): string {
  if (!isFinite(mins)) return "Chưa có hoạt động";
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${Math.floor(mins)} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

// GET /api/forklift/web/drivers
// Trả về ĐỘI NGŨ TÀI XẾ XE NÂNG thật (role XE_NANG) + trạng thái làm việc thật
// suy ra từ lịch sử di chuyển (bảng movements). KHÔNG bịa pin/sạc/xe ảo.
export async function GET() {
  try {
    const drivers = await prisma.user.findMany({
      where: { role: "XE_NANG", is_locked: false },
      orderBy: { full_name: "asc" },
      select: { id: true, full_name: true, phone: true },
    });

    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const team = await Promise.all(
      drivers.map(async (d) => {
        // Số việc đã thực hiện hôm nay + lần di chuyển gần nhất (vị trí + thời điểm)
        const [tasksToday, last] = await Promise.all([
          prisma.movement.count({
            where: { performed_by: d.id, performed_at: { gte: todayStart } },
          }),
          prisma.movement.findFirst({
            where: { performed_by: d.id },
            orderBy: { performed_at: "desc" },
            include: { to_location: { select: { code: true } } },
          }),
        ]);

        const lastActiveAt = last?.performed_at ?? null;
        const minsSince = lastActiveAt
          ? (now.getTime() - new Date(lastActiveAt).getTime()) / 60000
          : Infinity;
        const status = minsSince <= ACTIVE_WINDOW_MIN ? "WORKING" : "IDLE";

        return {
          id: d.id,
          name: d.full_name,
          phone: d.phone || "—",
          status,
          tasksToday,
          lastLocation: last?.to_location?.code ?? null,
          lastActiveAt: lastActiveAt ? lastActiveAt.toISOString() : null,
          lastActiveText: relTime(minsSince),
        };
      })
    );

    const working = team.filter((t) => t.status === "WORKING").length;

    return NextResponse.json({
      success: true,
      data: {
        team,
        // giữ danh sách thô cho modal "Giao việc"
        drivers,
        summary: {
          working,
          idle: team.length - working,
          total: team.length,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/forklift/web/drivers error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống khi tải danh sách tài xế." },
      { status: 500 }
    );
  }
}

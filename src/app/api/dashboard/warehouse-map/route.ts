import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LocationType } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

// Các loại vị trí hiển thị trên sơ đồ kho dashboard (khớp cách tính Tỷ lệ lấp đầy ở KPI)
const MAP_TYPES: LocationType[] = [
  LocationType.STORAGE,
  LocationType.INBOUND_STAGING,
  LocationType.OUTBOUND_STAGING,
];
// Giới hạn số ô vẽ trên dashboard để giữ giao diện gọn + nhanh
const MAX_CELLS = 120;

// GET /api/dashboard/warehouse-map
// Trả về danh sách vị trí kho (rút gọn) + thống kê trạng thái để vẽ sơ đồ kho thật trên Dashboard.
export async function GET(req: Request) {
  const denied = await guardPermission(req, "dashboard", "read");
  if (denied) return denied;
  try {
    const where = { is_active: true, type: { in: MAP_TYPES } };

    const [locations, total, byStatus] = await Promise.all([
      prisma.location.findMany({
        where,
        orderBy: [{ zone: "asc" }, { rack: "asc" }, { level: "asc" }],
        select: { id: true, code: true, type: true, status: true },
        take: MAX_CELLS,
      }),
      prisma.location.count({ where }),
      prisma.location.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
    ]);

    // Gom số lượng theo trạng thái để hiển thị chú thích (legend)
    const counts: Record<string, number> = {};
    for (const row of byStatus) {
      counts[row.status] = row._count._all;
    }

    return NextResponse.json({
      success: true,
      data: {
        locations,
        total,
        shown: locations.length,
        counts,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/warehouse-map error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

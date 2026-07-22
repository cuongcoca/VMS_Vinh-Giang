import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/inbound-temp/summary — Tổng hợp tồn tạm
export async function GET() {
  try {
    const statusGroups = await prisma.inboundTemp.groupBy({
      by: ["status"],
      _count: true,
    });

    const counts: Record<string, number> = { PENDING: 0, STANDARDIZED: 0, REJECTED: 0 };
    for (const g of statusGroups) {
      counts[g.status] = g._count;
    }

    // Tổng SL thùng đang chờ (PENDING)
    const pendingTemps = await prisma.inboundTemp.findMany({
      where: { status: "PENDING" },
      select: { id: true },
    });
    const pendingIds = pendingTemps.map((t) => t.id);

    let totalQtyPending = 0;
    if (pendingIds.length > 0) {
      const sum = await prisma.inboundTempLine.aggregate({
        where: { inbound_temp_id: { in: pendingIds } },
        _sum: { qty_box: true },
      });
      totalQtyPending = Number(sum._sum.qty_box || 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        pending_count: counts.PENDING,
        standardized_count: counts.STANDARDIZED,
        rejected_count: counts.REJECTED,
        total_qty_pending: totalQtyPending,
      },
    });
  } catch (error) {
    console.error("GET /api/inbound-temp/summary error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải tổng hợp." }, { status: 500 });
  }
}

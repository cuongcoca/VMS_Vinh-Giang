import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";

// GET /api/dashboard/kpi?period=7d|30d|90d
export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") || "30d";
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 86400000);
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 86400000);
    const d30 = new Date(now.getTime() + 30 * 86400000);

    // Tổng tồn kho
    const stockAgg = await prisma.palletLine.aggregate({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      _sum: { qty_box: true },
    });
    const totalStockItems = Number(stockAgg._sum.qty_box || 0);

    // Tổng KG
    const weightAgg = await prisma.pallet.aggregate({
      where: { status: { in: STOCK_PALLET_STATUSES } },
      _sum: { total_weight_kg: true },
    });
    const totalStockWeightKg = Number(weightAgg._sum.total_weight_kg || 0);

    // Nhập kỳ (movements PUT_AWAY)
    const inboundCount = await prisma.movement.count({
      where: { movement_type: "PUT_AWAY", performed_at: { gte: since } },
    });

    // Xuất kỳ (movements STAGE_OUT)
    const outboundCount = await prisma.movement.count({
      where: { movement_type: "STAGE_OUT", performed_at: { gte: since } },
    });

    // Tỷ lệ lấp đầy
    const totalLocations = await prisma.location.count({ where: { is_active: true, type: { in: ["STORAGE", "INBOUND_STAGING", "OUTBOUND_STAGING"] } } });
    const usedLocations = await prisma.location.count({ where: { is_active: true, status: "USING" } });
    const locationUsagePercent = totalLocations > 0 ? Math.round((usedLocations / totalLocations) * 1000) / 10 : 0;

    // HSD cảnh báo
    const expiring7d = await prisma.palletLine.count({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, expiry_date: { lte: d7 } },
    });
    const expiring30d = await prisma.palletLine.count({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, expiry_date: { lte: d30, gt: d7 } },
    });

    // Việc xe nâng hôm nay
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const forkliftTasksToday = await prisma.movement.count({
      where: { performed_at: { gte: todayStart } },
    });

    // Pallet chờ xếp
    const palletQueueCount = await prisma.pallet.count({ where: { status: "CONFIRMED" } });

    // Phiên kiểm kê mở
    const openStocktakes = await prisma.stocktakeSession.count({ where: { status: { in: ["OPEN", "COUNTING"] } } });

    return NextResponse.json({
      success: true,
      data: {
        total_stock_items: totalStockItems,
        total_stock_weight_kg: Math.round(totalStockWeightKg * 10) / 10,
        inbound_this_period: inboundCount,
        outbound_this_period: outboundCount,
        location_usage_percent: locationUsagePercent,
        expiring_items_7d: expiring7d,
        expiring_items_30d: expiring30d,
        forklift_tasks_today: forkliftTasksToday,
        pallet_queue_count: palletQueueCount,
        open_stocktakes: openStocktakes,
        period,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/kpi error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

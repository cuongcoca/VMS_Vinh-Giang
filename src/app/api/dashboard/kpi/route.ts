import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { expiredLineWhere, expiryCutoff } from "@/lib/inventory-expiry";
import { guardPermission } from "@/lib/auth-server";

// GET /api/dashboard/kpi?period=7d|30d|90d
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "dashboard", "read");
  if (denied) return denied;
  try {
    const period = req.nextUrl.searchParams.get("period") || "30d";
    const days = parseInt(period) || 30;
    const since = new Date(Date.now() - days * 86400000);
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 86400000);
    const d30 = new Date(now.getTime() + 30 * 86400000);
    const cutoff = expiryCutoff(now); // WVG-239: mốc hết hạn (GMT+7)

    // Tổng tồn kho — WVG-239: tách phần HẾT HẠN (bị chặn) khỏi tồn khả dụng.
    const stockAgg = await prisma.palletLine.aggregate({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      _sum: { qty_box: true },
    });
    const blockedAgg = await prisma.palletLine.aggregate({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, ...expiredLineWhere(cutoff) },
      _sum: { qty_box: true },
    });
    const physicalStockItems = Number(stockAgg._sum.qty_box || 0);
    const blockedStockItems = Number(blockedAgg._sum.qty_box || 0);
    const totalStockItems = physicalStockItems - blockedStockItems; // tồn khả dụng

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

    // HSD cảnh báo — WVG-239: "sắp hết hạn" chỉ tính lô CÒN hạn (>= hôm nay);
    // lô đã hết hạn đếm riêng ở expired_items.
    const expiring7d = await prisma.palletLine.count({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, expiry_date: { gte: cutoff, lte: d7 } },
    });
    const expiring30d = await prisma.palletLine.count({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, expiry_date: { lte: d30, gt: d7 } },
    });
    const expiredItems = await prisma.palletLine.count({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, ...expiredLineWhere(cutoff) },
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
        blocked_stock_items: blockedStockItems,
        physical_stock_items: physicalStockItems,
        total_stock_weight_kg: Math.round(totalStockWeightKg * 10) / 10,
        inbound_this_period: inboundCount,
        outbound_this_period: outboundCount,
        location_usage_percent: locationUsagePercent,
        expiring_items_7d: expiring7d,
        expiring_items_30d: expiring30d,
        expired_items: expiredItems,
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

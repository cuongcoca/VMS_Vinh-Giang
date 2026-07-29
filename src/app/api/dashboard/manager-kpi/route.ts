import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { expiredLineWhere, expiryCutoff, isExpired } from "@/lib/inventory-expiry";
import { guardPermission } from "@/lib/auth-server";

/**
 * UC-DASH-02: KPI tổng quan cho Quản lý.
 *
 * GET /api/dashboard/manager-kpi?period=month|week|day
 *
 * Trả về:
 *   - total_sku, total_stock, pallets_used, total_locations, alerts
 *   - by_group: tồn theo nhóm hàng (top 6)
 *   - top_outbound: top 5 SKU xuất nhiều nhất trong period
 *   - expiring: { d7, d30, safe }
 *   - pending: { inbound, inbound_temp, pallets_waiting, pallets_moving, adjustments }
 */
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "dashboard", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "month";

    // Tính khoảng thời gian
    const now = new Date();
    const from = new Date(now);
    if (period === "day") from.setUTCHours(0, 0, 0, 0);
    else if (period === "week") from.setDate(now.getDate() - 7);
    else from.setMonth(now.getMonth() - 1);

    const cutoff = expiryCutoff(now); // WVG-239: mốc hết hạn (GMT+7)

    // 1. Total SKU + tồn tổng — WVG-239: tổng tồn = KHẢ DỤNG (loại hết hạn).
    const [skuCount, stockSum, blockedSum] = await Promise.all([
      prisma.product.count({ where: { is_active: true } }),
      prisma.palletLine.aggregate({
        where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
        _sum: { qty_box: true },
      }),
      prisma.palletLine.aggregate({
        where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, ...expiredLineWhere(cutoff) },
        _sum: { qty_box: true },
      }),
    ]);
    const physicalStock = Number(stockSum._sum.qty_box || 0);
    const blockedStock = Number(blockedSum._sum.qty_box || 0);
    const sellableStock = physicalStock - blockedStock;

    // 2. Pallets đang dùng + tổng location
    const [palletsUsed, totalLocations] = await Promise.all([
      prisma.pallet.count({
        where: { status: { in: STOCK_PALLET_STATUSES } },
      }),
      prisma.location.count({ where: { is_active: true, type: "STORAGE" } }),
    ]);

    // 3. Cảnh báo (alerts) — tồn theo HSD
    const expiringRows = await prisma.palletLine.findMany({
      where: {
        pallet: { status: { in: STOCK_PALLET_STATUSES } },
        expiry_date: { not: null },
      },
      select: { expiry_date: true, qty_box: true },
    });
    let expiredLots = 0, expiredQty = 0;
    let d7Lots = 0, d7Qty = 0;
    let d30Lots = 0, d30Qty = 0;
    let safeLots = 0, safeQty = 0;
    for (const r of expiringRows) {
      if (!r.expiry_date) continue;
      const qty = Number(r.qty_box || 0);
      // WVG-239: lô ĐÃ hết hạn tách riêng, không dồn vào bucket "≤7 ngày".
      if (isExpired(r.expiry_date, cutoff)) { expiredLots++; expiredQty += qty; continue; }
      const days = Math.ceil((new Date(r.expiry_date).getTime() - Date.now()) / 86400000);
      if (days <= 7) { d7Lots++; d7Qty += qty; }
      else if (days <= 30) { d30Lots++; d30Qty += qty; }
      else { safeLots++; safeQty += qty; }
    }
    const alertCount = expiredLots + d7Lots + d30Lots;

    // 4. Tồn theo nhóm hàng (top 6)
    const stockByGroup = await prisma.palletLine.findMany({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      select: {
        qty_box: true,
        item_code: { select: { group: { select: { id: true, code: true, name: true } } } },
      },
    });
    const groupMap = new Map<string, { code: string; name: string; qty: number }>();
    for (const r of stockByGroup) {
      const g = r.item_code?.group;
      if (!g) continue;
      const cur = groupMap.get(g.id) || { code: g.code || g.id, name: g.name, qty: 0 };
      cur.qty += Number(r.qty_box || 0);
      groupMap.set(g.id, cur);
    }
    const byGroup = Array.from(groupMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);
    const maxGroupQty = byGroup[0]?.qty || 1;

    // 5. Top mã xuất tương đối trong period (Movement loại STAGE_OUT)
    const movementGroups = await prisma.movement.groupBy({
      by: ["item_code_id"],
      where: {
        movement_type: "STAGE_OUT",
        performed_at: { gte: from },
      },
      _sum: { qty_box: true },
      orderBy: { _sum: { qty_box: "desc" } },
      take: 5,
    });
    const topItemIds = movementGroups.map((m) => m.item_code_id).filter(Boolean) as string[];
    const topItems = await prisma.itemCode.findMany({
      where: { id: { in: topItemIds } },
      select: { id: true, code: true, short_name: true },
    });
    const topItemsMap = Object.fromEntries(topItems.map((i) => [i.id, i]));
    const topOutbound = movementGroups.map((m, idx) => ({
      rank: idx + 1,
      item_code: topItemsMap[m.item_code_id || ""]?.code || "—",
      item_name: topItemsMap[m.item_code_id || ""]?.short_name || "—",
      qty: Number(m._sum?.qty_box || 0),
    }));

    // 6. Phiếu chờ xử lý
    const [pendingInbound, pendingTemp, pendingPalletsWaiting, pendingPalletsMoving, pendingAdjustments] = await Promise.all([
      prisma.inboundRequest.count({
        where: { status: { in: ["DRAFT", "PENDING", "RECEIVING", "RECONCILING"] } },
      }),
      prisma.inboundTemp.count({ where: { status: "PENDING" } }),
      prisma.pallet.count({ where: { status: "CONFIRMED" } }),
      // Sprint A · D2-001: "Pallet đang di chuyển" = pallet đang ở khu chờ xuất (IN_STAGING).
      // Trước fix: count TẤT CẢ Movement type RELOCATE/STAGE_OUT lịch sử (lifetime, tăng đơn điệu) — sai nghiệp vụ.
      prisma.pallet.count({ where: { status: "IN_STAGING" } }),
      prisma.adjustmentVoucher.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        period,
        total_sku: skuCount,
        total_stock: sellableStock,
        blocked_stock: blockedStock,
        physical_stock: physicalStock,
        pallets_used: palletsUsed,
        total_locations: totalLocations,
        alerts: alertCount,
        by_group: byGroup.map((g) => ({
          code: g.code,
          name: g.name,
          qty: g.qty,
          pct: maxGroupQty > 0 ? Math.round((g.qty / maxGroupQty) * 100) : 0,
        })),
        top_outbound: topOutbound,
        expiring: {
          expired_lots: expiredLots, expired_qty: expiredQty,
          d7_lots: d7Lots, d7_qty: d7Qty,
          d30_lots: d30Lots, d30_qty: d30Qty,
          safe_lots: safeLots, safe_qty: safeQty,
        },
        pending: {
          inbound: pendingInbound,
          inbound_temp: pendingTemp,
          pallets_waiting: pendingPalletsWaiting,
          pallets_moving: pendingPalletsMoving,
          adjustments: pendingAdjustments,
        },
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/manager-kpi error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải KPI quản lý." },
      { status: 500 }
    );
  }
}

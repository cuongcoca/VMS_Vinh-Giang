import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { expiredLineWhere, expiryCutoff } from "@/lib/inventory-expiry";
import { guardPermission } from "@/lib/auth-server";

/**
 * GET /api/dashboard/accountant-kpi
 * 4 KPI cho dashboard Kế toán + cảnh báo HSD/tồn thấp + phiếu vừa cập nhật.
 *
 * UC-DASH-01 (mockup):
 *   - Phiếu nhập đang xử lý  (PENDING + RECEIVING + RECONCILING) — sub: số RECONCILING
 *   - Tồn tạm chờ chuẩn hóa  (InboundTemp PENDING) — sub: tổng dòng
 *   - Phiếu lệch SL          (phiếu có line qty_received != qty_expected, chưa COMPLETED)
 *   - Phiếu điều chỉnh chờ duyệt (AdjustmentVoucher PENDING)
 * + Cảnh báo: HSD ≤7d, ≤30d, low_stock (tạm 0 — schema chưa có min_stock)
 * + Recent: 5 phiếu vừa cập nhật (mix Inbound + Adjustment, sort updated_at desc)
 */
export async function GET(req: Request) {
  const denied = await guardPermission(req, "dashboard", "read");
  if (denied) return denied;
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 86400000);
    const d30 = new Date(now.getTime() + 30 * 86400000);
    const cutoff = expiryCutoff(now); // WVG-239: mốc hết hạn (GMT+7)

    const [
      inboundProcessing,
      inboundReconciling,
      tempCount,
      tempLinesAgg,
      discrepancyRequests,
      pendingAdjustments,
      expiring7d,
      expiring30d,
      expiredItems,
      recentInbounds,
      recentAdjustments,
    ] = await Promise.all([
      // 1. Phiếu nhập đang xử lý
      prisma.inboundRequest.count({
        where: { status: { in: ["PENDING", "RECEIVING", "RECONCILING"] } },
      }),
      // 1b. Chờ đối chiếu
      prisma.inboundRequest.count({ where: { status: "RECONCILING" } }),
      // 2. Tồn tạm chờ chuẩn hóa
      prisma.inboundTemp.count({ where: { status: "PENDING" } }),
      // 2b. Tổng dòng tồn tạm
      prisma.inboundTempLine.count({
        where: { inbound_temp: { status: "PENDING" } },
      }),
      // 3. Phiếu lệch SL — distinct request có ít nhất 1 line lệch, chưa COMPLETED
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT il.inbound_request_id)::bigint AS count
        FROM inbound_lines il
        JOIN inbound_requests ir ON ir.id = il.inbound_request_id
        WHERE il.qty_received IS NOT NULL
          AND il.qty_received <> il.qty_expected
          AND ir.status NOT IN ('COMPLETED', 'CANCELLED')
      `,
      // 4. Phiếu điều chỉnh chờ duyệt
      prisma.adjustmentVoucher.count({ where: { status: "PENDING" } }),
      // Cảnh báo HSD — WVG-239: "sắp hết hạn" chỉ tính lô CÒN hạn (>= hôm nay).
      prisma.palletLine.count({
        where: {
          pallet: { status: { in: STOCK_PALLET_STATUSES } },
          expiry_date: { gte: cutoff, lte: d7 },
        },
      }),
      prisma.palletLine.count({
        where: {
          pallet: { status: { in: STOCK_PALLET_STATUSES } },
          expiry_date: { lte: d30, gt: d7 },
        },
      }),
      // Đã hết hạn (bị chặn xuất)
      prisma.palletLine.count({
        where: {
          pallet: { status: { in: STOCK_PALLET_STATUSES } },
          ...expiredLineWhere(cutoff),
        },
      }),
      // Recent: 5 phiếu nhập vừa cập nhật
      prisma.inboundRequest.findMany({
        orderBy: { updated_at: "desc" },
        take: 5,
        select: { id: true, code: true, status: true, updated_at: true },
      }),
      // Recent: 3 phiếu điều chỉnh vừa cập nhật
      prisma.adjustmentVoucher.findMany({
        orderBy: { created_at: "desc" },
        take: 3,
        select: { id: true, code: true, status: true, created_at: true },
      }),
    ]);

    const discrepancyCount = Number(discrepancyRequests[0]?.count || 0);

    // Tính số lượng SKU dưới tồn tối thiểu
    const currentStock = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      _sum: { qty_box: true },
    });
    const stockMap: Record<string, number> = {};
    for (const s of currentStock) {
      if (s.item_code_id) {
        stockMap[s.item_code_id] = Number(s._sum.qty_box || 0);
      }
    }
    // WVG-239: trừ phần hết hạn → tồn KHẢ DỤNG, để hàng hết hạn không "che" cảnh báo thiếu.
    const blockedStock = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } }, ...expiredLineWhere(cutoff) },
      _sum: { qty_box: true },
    });
    const sellableMap: Record<string, number> = { ...stockMap };
    for (const s of blockedStock) {
      if (s.item_code_id) {
        sellableMap[s.item_code_id] = (stockMap[s.item_code_id] || 0) - Number(s._sum.qty_box || 0);
      }
    }
    const itemCodes = await prisma.itemCode.findMany({
      where: { status: "standardized" },
      select: {
        id: true,
        product: { select: { min_stock: true } },
      },
    });
    const lowStockSkus = itemCodes.filter((ic) => {
      const minStock = Number(ic.product?.min_stock || 0);
      return minStock > 0 && (sellableMap[ic.id] || 0) < minStock;
    }).length;

    // Merge recent updates (5 inbound + 3 adjustment) — sort theo time desc, take 5
    type RecentItem = {
      id: string;
      code: string;
      status: string;
      kind: "INBOUND" | "ADJUSTMENT";
      at: string;
    };
    const merged: RecentItem[] = [
      ...recentInbounds.map((r) => ({
        id: r.id,
        code: r.code,
        status: r.status,
        kind: "INBOUND" as const,
        at: r.updated_at.toISOString(),
      })),
      ...recentAdjustments.map((r) => ({
        id: r.id,
        code: r.code,
        status: r.status,
        kind: "ADJUSTMENT" as const,
        at: r.created_at.toISOString(),
      })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      data: {
        inbound_processing: inboundProcessing,
        inbound_reconciling: inboundReconciling,
        temp_pending: tempCount,
        temp_lines: tempLinesAgg,
        discrepancy_count: discrepancyCount,
        pending_adjustments: pendingAdjustments,
        expiring_7d: expiring7d,
        expiring_30d: expiring30d,
        expired_items: expiredItems,
        low_stock_skus: lowStockSkus,
        recent_updates: merged,
      },
    });
  } catch (error) {
    console.error("GET /api/dashboard/accountant-kpi error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi tải KPI kế toán." },
      { status: 500 }
    );
  }
}

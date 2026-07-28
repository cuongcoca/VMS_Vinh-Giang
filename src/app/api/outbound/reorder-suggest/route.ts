import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/outbound/reorder-suggest — Gợi ý nhập hàng dựa trên forecast (UC-OUT-04)
// Query params:
//   - days: số ngày dự trữ mong muốn (default 14)
//   - lookback: số ngày lịch sử để tính BQ xuất/ngày (default 30)
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "outbound", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const daysReserve = Math.max(1, Math.min(180, Number(searchParams.get("days")) || 14));
    const lookback = Math.max(7, Math.min(365, Number(searchParams.get("lookback")) || 30));

    // Tồn hiện tại theo mã hàng (IN_STORAGE + IN_STAGING)
    const currentStock = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: { in: ["IN_STORAGE", "IN_STAGING"] } } },
      _sum: { qty_box: true },
    });
    const stockMap: Record<string, number> = {};
    for (const s of currentStock) stockMap[s.item_code_id] = Number(s._sum.qty_box || 0);

    // Lịch sử xuất N ngày qua (STAGE_OUT)
    const sinceDate = new Date(Date.now() - lookback * 86400000);
    const outMovements = await prisma.movement.findMany({
      where: { movement_type: "STAGE_OUT", performed_at: { gte: sinceDate } },
      include: { pallet: { include: { lines: { select: { item_code_id: true, qty_box: true } } } } },
    });

    // Tổng xuất + số lần xuất per item
    const outMap: Record<string, { totalQty: number; moveCount: number }> = {};
    for (const m of outMovements) {
      for (const line of m.pallet.lines) {
        if (!outMap[line.item_code_id]) outMap[line.item_code_id] = { totalQty: 0, moveCount: 0 };
        outMap[line.item_code_id].totalQty += Number(line.qty_box);
        outMap[line.item_code_id].moveCount += 1;
      }
    }

    // Lấy all item codes standardized
    const itemCodes = await prisma.itemCode.findMany({
      where: { status: "standardized" },
      select: {
        id: true, code: true, short_name: true,
        unit: { select: { name: true, symbol: true } },
        group: { select: { code: true, name: true } },
        product: { select: { min_stock: true, max_stock: true } },
      },
    });

    const suggestions = itemCodes.map((ic) => {
      const current = stockMap[ic.id] || 0;
      const stats = outMap[ic.id] || { totalQty: 0, moveCount: 0 };
      const avgPerDay = stats.totalQty / lookback;
      const demandNDays = Math.ceil(avgPerDay * daysReserve);
      const minStock = Number(ic.product?.min_stock || 0);
      const maxStock = Number(ic.product?.max_stock || 0);
      const shortage = Math.max(0, demandNDays - current);
      const daysLeft = avgPerDay > 0 ? Math.floor(current / avgPerDay) : 9999;

      // Phân loại theo mockup:
      // - "Thiếu nhiều": tồn < 50% nhu cầu N ngày
      // - "Sắp thiếu": tồn < nhu cầu N ngày
      // - "Đủ": tồn ≥ nhu cầu × 1.2
      // - "Bán chậm": có tồn nhưng 0 lượt xuất 30 ngày
      let category: "SHORT_SEVERE" | "SHORT_WARN" | "OK" | "SLOW" | "OUT_OF_STOCK";
      if (current === 0) category = "OUT_OF_STOCK";
      else if (avgPerDay === 0 && current > 0) category = "SLOW";
      else if (current < demandNDays * 0.5) category = "SHORT_SEVERE";
      else if (current < demandNDays) category = "SHORT_WARN";
      else category = "OK";

      return {
        item_code_id: ic.id,
        item_code: ic.code,
        item_name: ic.short_name,
        group_code: ic.group?.code || null,
        group_name: ic.group?.name || null,
        unit_name: ic.unit?.symbol || ic.unit?.name || null,
        current_stock: current,
        min_stock: minStock,
        max_stock: maxStock,
        avg_per_day: Math.round(avgPerDay * 100) / 100,
        demand_n_days: demandNDays,
        shortage,
        days_left: daysLeft >= 9999 ? null : daysLeft,
        category,
        history_qty: stats.totalQty,
        history_moves: stats.moveCount,
      };
    });

    // Sort: SHORT_SEVERE → SHORT_WARN → SLOW → OUT_OF_STOCK → OK
    const order = { SHORT_SEVERE: 0, SHORT_WARN: 1, OUT_OF_STOCK: 2, SLOW: 3, OK: 4 };
    suggestions.sort((a, b) => (order[a.category] - order[b.category]) || (b.shortage - a.shortage));

    return NextResponse.json({
      success: true,
      data: suggestions,
      meta: { daysReserve, lookback, totalItems: suggestions.length },
    });
  } catch (error) {
    console.error("GET /api/outbound/reorder-suggest error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải gợi ý." }, { status: 500 });
  }
}

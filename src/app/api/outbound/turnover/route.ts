import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/outbound/turnover — Tốc độ luân chuyển hàng hóa
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "outbound", "read");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const periodDays = parseInt(searchParams.get("period") || "30", 10);
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);

    // Tồn hiện tại: SL trong kho (IN_STORAGE + IN_STAGING)
    const currentStock = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: {
        pallet: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
      },
      _sum: { qty_box: true },
    });

    // SL xuất (STAGE_OUT movements) trong kỳ
    const stageOutMovements = await prisma.movement.findMany({
      where: {
        movement_type: "STAGE_OUT",
        performed_at: { gte: periodStart },
      },
      include: {
        pallet: { include: { lines: true } },
      },
    });

    // Aggregate xuất theo item_code
    const outMap: Record<string, number> = {};
    for (const m of stageOutMovements) {
      for (const line of m.pallet.lines) {
        outMap[line.item_code_id] = (outMap[line.item_code_id] || 0) + Number(line.qty_box);
      }
    }

    // Lấy info mã hàng
    const allItemIds = new Set<string>();
    currentStock.forEach(s => allItemIds.add(s.item_code_id));
    Object.keys(outMap).forEach(id => allItemIds.add(id));

    const itemCodes = await prisma.itemCode.findMany({
      where: { id: { in: Array.from(allItemIds) } },
      select: { id: true, code: true, short_name: true },
    });
    const itemCodeMap: Record<string, { code: string; short_name: string }> = {};
    for (const ic of itemCodes) { itemCodeMap[ic.id] = ic; }

    // Tính turnover
    const results = Array.from(allItemIds).map(itemId => {
      const stock = Number(currentStock.find(s => s.item_code_id === itemId)?._sum?.qty_box || 0);
      const outQty = outMap[itemId] || 0;
      const avgStock = stock > 0 ? stock : 1; // Tránh chia 0
      const turnoverRate = stock > 0 ? (outQty / avgStock) * 100 : 0;
      const ic = itemCodeMap[itemId];
      return {
        item_code_id: itemId,
        item_code: ic?.code || "?",
        item_name: ic?.short_name || "?",
        current_stock: stock,
        qty_out: outQty,
        turnover_rate: Math.round(turnoverRate * 10) / 10,
      };
    }).sort((a, b) => b.turnover_rate - a.turnover_rate);

    return NextResponse.json({
      success: true,
      data: results,
      period_days: periodDays,
    });
  } catch (error) {
    console.error("GET /api/outbound/turnover error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tính turnover." }, { status: 500 });
  }
}

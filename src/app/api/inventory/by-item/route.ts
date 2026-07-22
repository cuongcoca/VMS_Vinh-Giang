import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";

// GET /api/inventory/by-item — Tồn kho theo mã hàng
// Phase 1.1 (BUG_REPORT TC_CLOSE_IN_006/_010/_015): include CONFIRMED — pallet
// đã xác nhận sau chốt phiếu nhập phải tính tồn kho ngay, không đợi put-away.
export async function GET() {
  try {
    const stockData = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      _sum: { qty_box: true },
    });

    // Tách theo từng trạng thái pallet
    const storageData = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: "IN_STORAGE" } },
      _sum: { qty_box: true },
    });

    const stagingData = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: "IN_STAGING" } },
      _sum: { qty_box: true },
    });

    const confirmedData = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: "CONFIRMED" } },
      _sum: { qty_box: true },
    });

    // HSD gần nhất theo item
    const expiryData = await prisma.palletLine.findMany({
      where: {
        pallet: { status: { in: STOCK_PALLET_STATUSES } },
        expiry_date: { not: null },
      },
      select: { item_code_id: true, expiry_date: true },
      orderBy: { expiry_date: "asc" },
    });

    const expiryMap: Record<string, Date> = {};
    for (const e of expiryData) {
      if (e.expiry_date && !expiryMap[e.item_code_id]) {
        expiryMap[e.item_code_id] = e.expiry_date;
      }
    }

    const itemCodes = await prisma.itemCode.findMany({
      where: { status: "standardized" },
      select: {
        id: true, code: true, short_name: true,
        unit: { select: { id: true, name: true, symbol: true } },
        group: { select: { id: true, code: true, name: true } },
        product: { select: { min_stock: true, max_stock: true, group: { select: { code: true, name: true } } } },
      },
    });

    const totalMap: Record<string, number> = {};
    for (const s of stockData) totalMap[s.item_code_id] = Number(s._sum.qty_box || 0);
    const storageMap: Record<string, number> = {};
    for (const s of storageData) storageMap[s.item_code_id] = Number(s._sum.qty_box || 0);
    const stagingMap: Record<string, number> = {};
    for (const s of stagingData) stagingMap[s.item_code_id] = Number(s._sum.qty_box || 0);
    const confirmedMap: Record<string, number> = {};
    for (const s of confirmedData) confirmedMap[s.item_code_id] = Number(s._sum.qty_box || 0);

    const result = itemCodes.map(ic => {
      const total = totalMap[ic.id] || 0;
      const available = storageMap[ic.id] || 0;
      const staging = stagingMap[ic.id] || 0;
      const confirmed = confirmedMap[ic.id] || 0;
      const minStock = Number(ic?.product?.min_stock || 0);
      const maxStock = Number(ic?.product?.max_stock || 0);
      const nearestExpiry = expiryMap[ic.id] || null;
      const daysUntilExpiry = nearestExpiry ? Math.ceil((nearestExpiry.getTime() - Date.now()) / 86400000) : null;
      return {
        item_code_id: ic.id,
        item_code: ic?.code || "?",
        item_name: ic?.short_name || "?",
        group_code: ic?.group?.code || ic?.product?.group?.code || null,
        group_name: ic?.group?.name || ic?.product?.group?.name || null,
        unit_name: ic?.unit?.name || null,
        unit_symbol: ic?.unit?.symbol || null,
        available_qty: available,
        staging_qty: staging,
        confirmed_qty: confirmed,
        total_qty: total,
        min_stock: minStock,
        max_stock: maxStock,
        nearest_expiry: nearestExpiry,
        days_until_expiry: daysUntilExpiry,
        alert_low_stock: minStock > 0 && total < minStock,
        alert_over_max: maxStock > 0 && total > maxStock,
        alert_expiry: daysUntilExpiry !== null && daysUntilExpiry <= 30,
        alert_out_of_stock: total === 0 && !(minStock > 0 && total < minStock),
      };
    })
    .filter(r => r.total_qty > 0 || r.min_stock > 0 || r.max_stock > 0)
    .sort((a, b) => a.item_code.localeCompare(b.item_code));

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/inventory/by-item error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải tồn kho." }, { status: 500 });
  }
}

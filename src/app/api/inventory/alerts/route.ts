import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";

// GET /api/inventory/alerts — Trung tâm cảnh báo
// Trả 4 KPI + danh sách urgent/warning/low_stock/over_max + bảng "Tồn lâu theo vị trí"
export async function GET() {
  try {
    const now = new Date();
    const d7 = new Date(now.getTime() + 7 * 86400000);
    const d30 = new Date(now.getTime() + 30 * 86400000);

    // ===== 1. HSD cảnh báo (urgent + warning) =====
    const expiryAlerts = await prisma.palletLine.findMany({
      where: {
        pallet: { status: { in: STOCK_PALLET_STATUSES } },
        expiry_date: { lte: d30 },
      },
      select: {
        id: true,
        qty_box: true,
        qty_unit: true,
        lot: true,
        expiry_date: true,
        manufactured_date: true,
        weight_kg: true,
        item_code: { select: { id: true, code: true, short_name: true } },
        pallet: {
          select: {
            id: true,
            code: true,
            inbound_date: true,
            location: { select: { code: true } },
          },
        },
      },
      orderBy: { expiry_date: "asc" },
    });

    const urgentExpiry = expiryAlerts.filter((l) => l.expiry_date && l.expiry_date <= d7);
    const warningExpiry = expiryAlerts.filter((l) => l.expiry_date && l.expiry_date > d7);

    // Tổng SL đơn vị cho urgent / warning
    const urgentQtyUnit = urgentExpiry.reduce((s, l) => s + Number(l.qty_unit), 0);
    const warningQtyUnit = warningExpiry.reduce((s, l) => s + Number(l.qty_unit), 0);

    // ===== 1b. Danh sách lô có HSD (mọi mốc) cho bảng lọc theo mức cảnh báo =====
    // TC_INV04_004/005/006: cần đủ dữ liệu cho 3 mốc <7 / <30 / >30 ngày,
    // nên lấy tất cả lô còn HSD (không giới hạn ≤30 như KPI ở trên).
    const allExpiryLines = await prisma.palletLine.findMany({
      where: {
        pallet: { status: { in: STOCK_PALLET_STATUSES } },
        expiry_date: { not: null },
      },
      select: {
        id: true,
        qty_box: true,
        qty_unit: true,
        lot: true,
        expiry_date: true,
        manufactured_date: true,
        item_code: { select: { id: true, code: true, short_name: true } },
        pallet: { select: { id: true, code: true, location: { select: { code: true } } } },
      },
      orderBy: { expiry_date: "asc" },
    });

    const expiryList = allExpiryLines.map((l) => {
      const days =
        l.expiry_date != null
          ? Math.ceil((l.expiry_date.getTime() - now.getTime()) / 86400000)
          : null;
      let level: "urgent" | "warning" | "normal" = "normal";
      if (days !== null) {
        if (days < 7) level = "urgent";
        else if (days < 30) level = "warning";
      }
      return {
        id: l.id,
        item_code_id: l.item_code.id,
        item_code: l.item_code.code,
        item_name: l.item_code.short_name,
        lot: l.lot,
        manufactured_date: l.manufactured_date,
        expiry_date: l.expiry_date,
        days_until_expiry: days,
        qty_box: Number(l.qty_box),
        qty_unit: Number(l.qty_unit),
        pallet_id: l.pallet.id,
        pallet_code: l.pallet.code,
        location_code: l.pallet.location?.code || null,
        level,
      };
    });

    // ===== 2. Tồn dưới min + Tồn vượt max =====
    const currentStock = await prisma.palletLine.groupBy({
      by: ["item_code_id"],
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      _sum: { qty_box: true },
    });
    const stockMap: Record<string, number> = {};
    for (const s of currentStock) stockMap[s.item_code_id] = Number(s._sum.qty_box || 0);

    const itemCodes = await prisma.itemCode.findMany({
      where: { status: "standardized" },
      select: {
        id: true,
        code: true,
        short_name: true,
        product: { select: { min_stock: true, max_stock: true } },
      },
    });

    const lowStockAlerts = itemCodes
      .filter((ic) => {
        const minStock = Number(ic.product?.min_stock || 0);
        return minStock > 0 && (stockMap[ic.id] || 0) < minStock;
      })
      .map((ic) => ({
        item_code_id: ic.id,
        item_code: ic.code,
        item_name: ic.short_name,
        current_stock: stockMap[ic.id] || 0,
        min_stock: Number(ic.product?.min_stock || 0),
        shortage: Number(ic.product?.min_stock || 0) - (stockMap[ic.id] || 0),
      }))
      .sort((a, b) => b.shortage - a.shortage);

    const overMaxAlerts = itemCodes
      .filter((ic) => {
        const max = ic.product?.max_stock;
        return max != null && Number(max) > 0 && (stockMap[ic.id] || 0) > Number(max);
      })
      .map((ic) => ({
        item_code_id: ic.id,
        item_code: ic.code,
        item_name: ic.short_name,
        current_stock: stockMap[ic.id] || 0,
        max_stock: Number(ic.product?.max_stock || 0),
        excess: (stockMap[ic.id] || 0) - Number(ic.product?.max_stock || 0),
      }))
      .sort((a, b) => b.excess - a.excess);

    // ===== 3. Hàng tồn lâu theo vị trí =====
    // Logic: cho mỗi (item_code, location), tính MIN(expiry_date)
    // Filter: location có MIN(expiry) > overall MIN(expiry) của cùng SKU
    //         → location này có lô HSD muộn hơn các lô khác cùng SKU → cần ưu tiên xuất
    const allLines = await prisma.palletLine.findMany({
      where: {
        pallet: {
          status: { in: STOCK_PALLET_STATUSES },
          location_id: { not: null },
        },
        expiry_date: { not: null },
      },
      select: {
        item_code_id: true,
        qty_box: true,
        lot: true,
        expiry_date: true,
        manufactured_date: true,
        item_code: { select: { code: true, short_name: true } },
        pallet: {
          select: {
            id: true,
            code: true,
            inbound_date: true,
            location: { select: { id: true, code: true, zone: true, rack: true, level: true } },
          },
        },
      },
    });

    // Group by (item_code_id, location_id)
    type GroupKey = string; // `${item_code_id}|${location_id}`
    type GroupVal = {
      item_code_id: string;
      item_code: string;
      item_name: string;
      location_id: string;
      location_code: string;
      min_expiry: Date;
      lot: string | null;
      manufactured_date: Date | null;
      total_qty: number;
      oldest_inbound: Date | null;
    };
    const groups = new Map<GroupKey, GroupVal>();
    const overallMinByItem = new Map<string, Date>();

    for (const l of allLines) {
      if (!l.expiry_date || !l.pallet.location) continue;
      const key = `${l.item_code_id}|${l.pallet.location.id}`;
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, {
          item_code_id: l.item_code_id,
          item_code: l.item_code.code,
          item_name: l.item_code.short_name,
          location_id: l.pallet.location.id,
          location_code: l.pallet.location.code,
          min_expiry: l.expiry_date,
          lot: l.lot,
          manufactured_date: l.manufactured_date,
          total_qty: Number(l.qty_box),
          oldest_inbound: l.pallet.inbound_date,
        });
      } else {
        existing.total_qty += Number(l.qty_box);
        if (l.expiry_date < existing.min_expiry) {
          existing.min_expiry = l.expiry_date;
          existing.lot = l.lot;
          existing.manufactured_date = l.manufactured_date;
        }
        if (
          l.pallet.inbound_date &&
          (!existing.oldest_inbound || l.pallet.inbound_date < existing.oldest_inbound)
        ) {
          existing.oldest_inbound = l.pallet.inbound_date;
        }
      }
      const overallMin = overallMinByItem.get(l.item_code_id);
      if (!overallMin || l.expiry_date < overallMin) {
        overallMinByItem.set(l.item_code_id, l.expiry_date);
      }
    }

    // Filter: location có lô HSD muộn hơn overall_min của cùng SKU
    //         (vị trí này sẽ tồn lâu nhất nếu cứ xuất theo FEFO — cần ưu tiên đẩy hàng)
    // Logic "số ngày tồn lâu" = (HSD vị trí này) - (HSD overall sớm nhất cùng SKU)
    //   → HSD càng xa → tồn càng lâu → priority cao nhất
    const oldStockByLocation = Array.from(groups.values())
      .filter((g) => {
        const overallMin = overallMinByItem.get(g.item_code_id);
        return overallMin && g.min_expiry.getTime() > overallMin.getTime();
      })
      .map((g) => {
        const overallMin = overallMinByItem.get(g.item_code_id)!;
        const daysLater = Math.floor(
          (g.min_expiry.getTime() - overallMin.getTime()) / 86400000
        );
        return {
          item_code_id: g.item_code_id,
          item_code: g.item_code,
          item_name: g.item_name,
          location_code: g.location_code,
          lot: g.lot,
          manufactured_date: g.manufactured_date,
          expiry_date: g.min_expiry,
          qty_box: g.total_qty,
          // days_later_than_oldest: chênh lệch ngày so với lô sớm nhất cùng SKU
          days_later_than_oldest: daysLater,
          // Vẫn giữ days_in_stock để FE có nhiều info
          days_in_stock: g.oldest_inbound
            ? Math.floor((now.getTime() - g.oldest_inbound.getTime()) / 86400000)
            : null,
        };
      })
      // Sort theo HSD desc (HSD xa nhất lên đầu — vị trí tồn lâu nhất)
      .sort((a, b) => b.expiry_date.getTime() - a.expiry_date.getTime())
      .slice(0, 50);

    const oldStockLocationCount = new Set(oldStockByLocation.map((o) => o.location_code)).size;

    return NextResponse.json({
      success: true,
      data: {
        expiry: {
          urgent: urgentExpiry.map((l) => ({ ...l, level: "urgent" as const })),
          warning: warningExpiry.map((l) => ({ ...l, level: "warning" as const })),
          total: expiryAlerts.length,
        },
        low_stock: { items: lowStockAlerts, total: lowStockAlerts.length },
        over_max: { items: overMaxAlerts, total: overMaxAlerts.length },
        old_stock_by_location: oldStockByLocation,
        expiry_list: expiryList,
      },
      summary: {
        urgent_expiry: urgentExpiry.length,
        urgent_qty_unit: Math.round(urgentQtyUnit),
        warning_expiry: warningExpiry.length,
        warning_qty_unit: Math.round(warningQtyUnit),
        low_stock: lowStockAlerts.length,
        over_max: overMaxAlerts.length,
        old_stock_locations: oldStockLocationCount,
      },
    });
  } catch (error) {
    console.error("GET /api/inventory/alerts error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}

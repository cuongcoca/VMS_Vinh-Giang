import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";

// GET /api/inventory/by-lot — Tồn kho theo lô/HSD (FEFO)
export async function GET() {
  try {
    const lines = await prisma.palletLine.findMany({
      where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
      select: {
        id: true, qty_box: true, qty_unit: true, lot: true, expiry_date: true,
        // UC-INV-04-TC002: kèm đơn vị tính + hệ số quy đổi để hiển thị SL theo ĐVT (chai/lon...)
        item_code: { select: { id: true, code: true, short_name: true, units_per_box: true, unit: { select: { name: true, symbol: true } } } },
        pallet: { select: { id: true, code: true, status: true, location: { select: { code: true, zone: true } } } },
      },
      orderBy: { expiry_date: "asc" },
    });

    const result = lines.map(l => {
      const daysUntilExpiry = l.expiry_date ? Math.ceil((l.expiry_date.getTime() - Date.now()) / 86400000) : null;
      let urgency: "critical" | "warning" | "normal" = "normal";
      if (daysUntilExpiry !== null) {
        if (daysUntilExpiry <= 7) urgency = "critical";
        else if (daysUntilExpiry <= 30) urgency = "warning";
      }
      return { ...l, days_until_expiry: daysUntilExpiry, urgency };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("GET /api/inventory/by-lot error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

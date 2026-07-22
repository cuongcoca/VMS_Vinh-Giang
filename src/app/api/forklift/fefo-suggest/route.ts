import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/forklift/fefo-suggest?item_code_id=xxx — Gợi ý pallet theo FEFO
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemCodeId = searchParams.get("item_code_id") || "";

    // Fix: bỏ điều kiện expiry_date NOT NULL — pallet không có HSD vẫn phải xuất hiện
    // (hàng không quản lý hạn). FEFO chỉ là gợi ý sort, không phải filter cứng.
    const whereClause: Record<string, unknown> = {
      pallet: { status: "IN_STORAGE" },
      qty_box: { gt: 0 }, // bỏ dòng đã rút sạch (qty=0) sau split — không gợi ý rút tiếp
    };
    if (itemCodeId) {
      whereClause.item_code_id = itemCodeId;
    }

    // Query PalletLine có item_code_id, pallet IN_STORAGE
    // Sort: HSD asc với null cuối cùng (Prisma "first" = nulls first, "last" = nulls last)
    const lines = await prisma.palletLine.findMany({
      where: whereClause,
      include: {
        pallet: {
          include: {
            supplier: { select: { id: true, code: true, name: true } },
            location: { select: { id: true, code: true, zone: true, rack: true, level: true } },
          },
        },
        item_code: { select: { id: true, code: true, short_name: true } },
      },
      orderBy: { expiry_date: { sort: "asc", nulls: "last" } },
    });

    const now = new Date();
    const suggestions = lines.map((line) => {
      const daysUntilExpiry = line.expiry_date
        ? Math.ceil((line.expiry_date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;
      let urgency: "critical" | "warning" | "normal" = "normal";
      if (daysUntilExpiry !== null) {
        if (daysUntilExpiry <= 7) urgency = "critical";
        else if (daysUntilExpiry <= 30) urgency = "warning";
      }
      return {
        pallet_line_id: line.id,
        pallet: line.pallet,
        item_code: line.item_code,
        qty_box: line.qty_box,
        lot: line.lot,
        expiry_date: line.expiry_date,
        days_until_expiry: daysUntilExpiry,
        urgency,
      };
    });

    return NextResponse.json({ success: true, data: suggestions });
  } catch (error) {
    console.error("GET /api/forklift/fefo-suggest error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải gợi ý." }, { status: 500 });
  }
}

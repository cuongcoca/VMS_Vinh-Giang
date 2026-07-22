import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/inventory/by-location
//   query: code (optional — lookup 1 vị trí cụ thể, trả luôn pallet detail + sơ đồ cùng kệ)
//          zone (optional — filter)
// Response:
//   data: LocationRow[] — list để vẽ grid theo zone
//   zones: ZoneSummary[]
//   detail: LocationDetail | null — khi query có `code`
export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim().toUpperCase();
    const zoneFilter = req.nextUrl.searchParams.get("zone") || undefined;

    const locations = await prisma.location.findMany({
      where: { is_active: true, ...(zoneFilter ? { zone: zoneFilter } : {}) },
      orderBy: [{ zone: "asc" }, { rack: "asc" }, { level: "asc" }],
      select: {
        id: true, code: true, zone: true, rack: true, level: true,
        type: true, status: true, max_pallets: true, max_weight_kg: true,
        pallets: {
          where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
          select: {
            id: true, code: true, status: true, total_weight_kg: true,
            lines: {
              select: {
                id: true,
                qty_box: true,
                lot: true,
                expiry_date: true,
                manufactured_date: true,
                weight_kg: true,
                item_code: { select: { id: true, code: true, short_name: true } },
              },
            },
          },
        },
      },
    });

    const result = locations.map((loc) => {
      const hasPallet = loc.pallets.length > 0;
      let totalQtyBox = 0;
      let totalWeightKg = 0;
      let hasExpiringSoon = false;
      const itemSet = new Set<string>();
      const now = new Date();
      const d30 = new Date(now.getTime() + 30 * 86400000);

      for (const p of loc.pallets) {
        totalWeightKg += Number(p.total_weight_kg);
        for (const l of p.lines) {
          totalQtyBox += Number(l.qty_box);
          itemSet.add(l.item_code.short_name);
          if (l.expiry_date && new Date(l.expiry_date) <= d30) hasExpiringSoon = true;
        }
      }

      return {
        id: loc.id,
        code: loc.code,
        zone: loc.zone,
        rack: loc.rack,
        level: loc.level,
        type: loc.type,
        status: loc.status,
        max_pallets: loc.max_pallets,
        max_weight_kg: loc.max_weight_kg ? Number(loc.max_weight_kg) : null,
        has_pallet: hasPallet,
        total_qty_box: totalQtyBox,
        total_weight_kg: Math.round(totalWeightKg * 100) / 100,
        item_names: Array.from(itemSet).join(", "),
        pallet_count: loc.pallets.length,
        has_expiring_soon: hasExpiringSoon,
        pallets: loc.pallets.map((p) => ({ id: p.id, code: p.code, status: p.status })),
      };
    });

    // Summary by zone
    const zoneSet = [...new Set(result.map((l) => l.zone))];
    const zoneSummary = zoneSet.map((z) => {
      const locs = result.filter((l) => l.zone === z);
      return {
        zone: z,
        total: locs.length,
        occupied: locs.filter((l) => l.has_pallet).length,
        empty: locs.filter((l) => !l.has_pallet && l.status === "EMPTY").length,
      };
    });

    // Detail lookup khi có code
    let detail = null;
    if (code) {
      const detailLoc = locations.find((l) => l.code === code);
      if (detailLoc) {
        // Pallet lines flatten cho bảng "Tồn theo vị trí"
        const lines = detailLoc.pallets.flatMap((p) =>
          p.lines.map((ln) => ({
            pallet_id: p.id,
            pallet_code: p.code,
            pallet_status: p.status,
            line_id: ln.id,
            item_code_id: ln.item_code.id,
            item_code: ln.item_code.code,
            item_name: ln.item_code.short_name,
            lot: ln.lot,
            manufactured_date: ln.manufactured_date,
            expiry_date: ln.expiry_date,
            qty_box: Number(ln.qty_box),
            weight_kg: Number(ln.weight_kg),
          }))
        );

        const currentWeight = detailLoc.pallets.reduce(
          (s, p) => s + Number(p.total_weight_kg),
          0
        );

        // Sơ đồ kệ: lấy các vị trí cùng (zone, rack)
        const rackmates = result
          .filter((l) => l.zone === detailLoc.zone && l.rack === detailLoc.rack)
          .map((l) => {
            // status hiển thị: HSD (cam) > Khóa (đỏ) > Có hàng (xanh lá) > Trống (xám)
            const s = String(l.status);
            let visual: "ACTIVE" | "EMPTY" | "LOCKED" | "EXPIRING" = "EMPTY";
            if (s === "MAINTENANCE" || s === "LOCKED") visual = "LOCKED";
            else if (l.has_expiring_soon) visual = "EXPIRING";
            else if (l.has_pallet) visual = "ACTIVE";
            return {
              code: l.code,
              level: l.level,
              has_pallet: l.has_pallet,
              pallet_count: l.pallet_count,
              max_pallets: l.max_pallets,
              visual,
              is_current: l.code === code,
            };
          });

        detail = {
          id: detailLoc.id,
          code: detailLoc.code,
          zone: detailLoc.zone,
          rack: detailLoc.rack,
          level: detailLoc.level,
          status: detailLoc.status,
          max_pallets: detailLoc.max_pallets,
          max_weight_kg: detailLoc.max_weight_kg ? Number(detailLoc.max_weight_kg) : null,
          current_pallets: detailLoc.pallets.length,
          current_weight_kg: Math.round(currentWeight * 100) / 100,
          lines,
          rackmates,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      zones: zoneSummary,
      detail,
    });
  } catch (error) {
    console.error("GET /api/inventory/by-location error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

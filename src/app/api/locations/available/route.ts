import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/locations/available — Vị trí còn nhận thêm pallet
 *
 * Định nghĩa "available":
 *   - is_active = true
 *   - type = STORAGE (loại trừ INBOUND_STAGING, OUTBOUND_STAGING, MAINTENANCE)
 *   - status ∉ {MAINTENANCE} (USING/EMPTY/PARTIAL đều OK nếu còn slot)
 *   - max_pallets == null OR current_pallets < max_pallets (còn slot pallet)
 *   - Nếu query có `pallet_weight_kg`: sau khi xếp, current_weight_kg + pallet_weight_kg <= max_weight_kg
 *
 * Query:
 *   - pallet_weight_kg (optional): cân của pallet sắp xếp → để pre-filter vị trí còn chứa được
 *   - zone (optional): filter theo khu
 *   - q (optional): search code
 *
 * Response: mỗi vị trí có thêm
 *   - current_pallets, current_weight_kg
 *   - remaining_pallets, remaining_weight_kg
 *   - can_fit (true/false khi có pallet_weight_kg)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const palletWeight = Number(sp.get("pallet_weight_kg") || 0);
    const zone = sp.get("zone") || undefined;
    const q = (sp.get("q") || "").trim().toUpperCase();

    const locations = await prisma.location.findMany({
      where: {
        is_active: true,
        type: "STORAGE",
        status: { not: "MAINTENANCE" },
        ...(zone ? { zone } : {}),
        ...(q ? { code: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ zone: "asc" }, { rack: "asc" }, { level: "asc" }],
      select: {
        id: true, code: true, zone: true, rack: true, level: true,
        status: true, max_pallets: true, max_weight_kg: true,
        pallets: {
          where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } },
          select: { id: true, total_weight_kg: true },
        },
      },
    });

    const enriched = locations
      .map((loc) => {
        const currentPallets = loc.pallets.length;
        const currentWeightKg = loc.pallets.reduce((s, p) => s + Number(p.total_weight_kg), 0);
        const maxPallets = loc.max_pallets;
        const maxWeightKg = loc.max_weight_kg ? Number(loc.max_weight_kg) : null;

        const palletSlotOk = maxPallets == null || currentPallets < maxPallets;
        const weightSlotOk = maxWeightKg == null || (currentWeightKg + palletWeight) <= maxWeightKg;
        const isAvailable = palletSlotOk && weightSlotOk;

        return {
          id: loc.id,
          code: loc.code,
          zone: loc.zone,
          rack: loc.rack,
          level: loc.level,
          status: loc.status,
          max_pallets: maxPallets,
          max_weight_kg: maxWeightKg,
          current_pallets: currentPallets,
          current_weight_kg: Math.round(currentWeightKg * 100) / 100,
          remaining_pallets: maxPallets != null ? Math.max(0, maxPallets - currentPallets) : null,
          remaining_weight_kg: maxWeightKg != null ? Math.max(0, Math.round((maxWeightKg - currentWeightKg) * 100) / 100) : null,
          is_available: isAvailable,
          // Lý do nếu không available
          reason: !palletSlotOk ? "FULL_PALLETS" : !weightSlotOk ? "OVERWEIGHT" : null,
        };
      })
      // Chỉ trả vị trí available
      .filter((l) => l.is_available);

    return NextResponse.json({
      success: true,
      data: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error("GET /api/locations/available error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}

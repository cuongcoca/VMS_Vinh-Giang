import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma, PalletStatus } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";
import { PALLET_SOURCE_LABEL, type PalletSourceType } from "@/lib/pallet-source";

// GET /api/inventory/by-pallet — UC-INV-03 Tồn theo Pallet
// Query:
//   q             : search pallet code | item code | item name
//   status        : status filter (comma-separated) — default = CONFIRMED + IN_STORAGE + IN_STAGING
//   date          : YYYY-MM-DD — filter theo created_at (cùng ngày)
//   limit         : default 200, max 500
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "inventory", "read");
  if (denied) return denied;
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") || "").trim();
    const statusParam = (sp.get("status") || "").trim();
    const date = sp.get("date") || "";
    const limit = Math.min(Number(sp.get("limit") || 200), 500);

    // Default: hiển thị các pallet có hàng hoặc đang di chuyển/khu chờ xuất
    let statusList: PalletStatus[] = [
      PalletStatus.CONFIRMED,
      PalletStatus.IN_STORAGE,
      PalletStatus.IN_STAGING,
    ];
    if (statusParam) {
      const list = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length > 0) statusList = list as PalletStatus[];
    }

    const where: Prisma.PalletWhereInput = { status: { in: statusList } };

    if (q) {
      where.OR = [
        { code: { contains: q, mode: "insensitive" } },
        { lines: { some: { item_code: { code: { contains: q, mode: "insensitive" } } } } },
        { lines: { some: { item_code: { short_name: { contains: q, mode: "insensitive" } } } } },
      ];
    }

    if (date) {
      const d = new Date(date + "T00:00:00");
      const dEnd = new Date(date + "T23:59:59");
      where.created_at = { gte: d, lte: dEnd };
    }

    const pallets = await prisma.pallet.findMany({
      where,
      orderBy: { created_at: "desc" },
      take: limit,
      select: {
        id: true,
        code: true,
        status: true,
        created_at: true,
        total_lines: true,
        total_weight_kg: true,
        location: { select: { id: true, code: true, zone: true } },
        supplier: { select: { id: true, name: true } },
        inbound_request: { select: { id: true, code: true } },
        // WVG-97: nguồn truy vết chuẩn + relations để resolve mã chứng từ.
        source_type: true,
        source_id: true,
        source_note: true,
        inbound_temp: { select: { id: true, code: true } },
        parent: { select: { id: true, code: true } },
        lines: { select: { qty_box: true } },
      },
    });

    // Tính SL đã xuất qua movements STAGE_OUT để tính SL gốc
    const palletIds = pallets.map((p) => p.id);
    const movementsAgg = palletIds.length
      ? await prisma.movement.groupBy({
          by: ["pallet_id"],
          where: {
            pallet_id: { in: palletIds },
            movement_type: { in: ["STAGE_OUT"] },
          },
          _sum: { qty_box: true },
        })
      : [];
    const outMap = new Map<string, number>();
    for (const m of movementsAgg) {
      outMap.set(m.pallet_id, Number(m._sum.qty_box || 0));
    }

    // WVG-97: resolve mã phiếu điều chỉnh cho pallet nguồn ADJUSTMENT (batch).
    const voucherIds = pallets
      .filter((p) => p.source_type === "ADJUSTMENT" && p.source_id)
      .map((p) => p.source_id as string);
    const voucherMap = new Map<string, string>();
    if (voucherIds.length) {
      const vouchers = await prisma.adjustmentVoucher.findMany({
        where: { id: { in: voucherIds } },
        select: { id: true, code: true },
      });
      for (const v of vouchers) voucherMap.set(v.id, v.code);
    }

    const data = pallets.map((p) => {
      const remaining = p.lines.reduce((s, l) => s + Number(l.qty_box), 0);
      const out = outMap.get(p.id) || 0;
      const original = remaining + out;
      return {
        id: p.id,
        code: p.code,
        status: p.status,
        created_at: p.created_at.toISOString(),
        line_count: p.total_lines || p.lines.length,
        qty_total_original: original,
        qty_total_remaining: remaining,
        weight_kg: Number(p.total_weight_kg),
        location_code: p.location?.code || null,
        location_zone: p.location?.zone || null,
        supplier_name: p.supplier?.name || null,
        source_inbound: p.inbound_request
          ? { id: p.inbound_request.id, code: p.inbound_request.code }
          : null,
        // WVG-97: nguồn truy vết đầy đủ cho mọi loại pallet.
        source: {
          type: p.source_type,
          label: PALLET_SOURCE_LABEL[p.source_type as PalletSourceType],
          id: p.source_id,
          ref_code:
            p.source_type === "INBOUND"
              ? p.inbound_request?.code ?? null
              : p.source_type === "INBOUND_TEMP"
                ? p.inbound_temp?.code ?? null
                : p.source_type === "SPLIT"
                  ? p.parent?.code ?? null
                  : p.source_type === "ADJUSTMENT"
                    ? voucherMap.get(p.source_id || "") ?? null
                    : null,
          note: p.source_note ?? null,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error("GET /api/inventory/by-pallet error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}

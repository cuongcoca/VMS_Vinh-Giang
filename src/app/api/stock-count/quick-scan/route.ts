import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRequestActor } from "@/lib/audit";
import { CODE_PREFIX, formatYearlyCode } from "@/lib/codegen";
import { guardPermission } from "@/lib/auth-server";

// POST /api/stock-count/quick-scan — Lưu kết quả "Quét & Đếm nhanh" từ mobile KIEM_KE
// UC-INV-06.
//
// Body:
//   location_id: string
//   items:         Array<{ item_code_id; actual_qty; system_qty?; note?; lot?; expiry? }>   (hàng hệ thống đã biết)
//   extra_pallets: Array<{ item_code_id; actual_qty; lot?; expiry?; found_pallet_code?; note? }>  (PALLET NGOÀI HỆ THỐNG)
//   session_id?: string  (nếu user đang trong session đã mở; nếu không, tạo mới)
//
// Logic:
//   - Tạo (hoặc dùng session_id) StocktakeSession type=BY_LOCATION, status=COUNTING
//   - items: upsert theo (session, location, item_code); LƯU CẢ lot_actual/expiry_actual (trước đây bị bỏ qua)
//   - extra_pallets: LUÔN tạo bản ghi riêng (KHÔNG gộp theo item_code — tránh R-07),
//     system_qty=0, discrepancy=+actual, is_outside_system=true. Pallet thật chỉ được
//     tạo khi Quản lý DUYỆT phiếu điều chỉnh (xem UC-INV-08/09) — KHÔNG cộng thẳng vào tồn ở đây.
type ItemInput = {
  item_code_id: string;
  actual_qty: number | string;
  system_qty?: number | string;
  note?: string;
  lot?: string;
  expiry?: string;
};
type ExtraInput = {
  item_code_id: string;
  actual_qty: number | string;
  lot?: string;
  expiry?: string;
  found_pallet_code?: string;
  note?: string;
};

function parseExpiry(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "stock_count", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { location_id, session_id } = body as { location_id: string; session_id?: string };
    const items: ItemInput[] = Array.isArray(body.items) ? body.items : [];
    const extraPallets: ExtraInput[] = Array.isArray(body.extra_pallets) ? body.extra_pallets : [];

    if (!location_id) {
      return NextResponse.json({ success: false, error: "Thiếu location_id." }, { status: 400 });
    }
    if (items.length === 0 && extraPallets.length === 0) {
      return NextResponse.json({ success: false, error: "Không có dòng nào để lưu." }, { status: 400 });
    }
    // Validate items (đếm hàng hệ thống biết — cho phép actual = 0 = đếm thấy 0)
    for (const it of items) {
      if (!it.item_code_id) {
        return NextResponse.json({ success: false, error: "Thiếu item_code_id ở 1 dòng." }, { status: 400 });
      }
      const a = Number(it.actual_qty);
      if (Number.isNaN(a) || a < 0) {
        return NextResponse.json({ success: false, error: "actual_qty phải là số >= 0." }, { status: 400 });
      }
    }
    // Validate extra_pallets (pallet ngoài HT — phải có SL > 0, mới có nghĩa "tìm thấy")
    for (const ex of extraPallets) {
      if (!ex.item_code_id) {
        return NextResponse.json({ success: false, error: "Pallet ngoài HT thiếu mã hàng." }, { status: 400 });
      }
      const a = Number(ex.actual_qty);
      if (Number.isNaN(a) || a <= 0) {
        return NextResponse.json({ success: false, error: "Số lượng pallet ngoài HT phải > 0." }, { status: 400 });
      }
    }

    const actor = getRequestActor(req);

    // Validate location
    const location = await prisma.location.findUnique({ where: { id: location_id } });
    if (!location) {
      return NextResponse.json({ success: false, error: "Vị trí không tồn tại." }, { status: 404 });
    }

    // Lấy snapshot system_qty thực tế từ DB (không tin từ client) — chỉ cho items đã biết
    const systemQtyByItem = new Map<string, number>();
    if (items.length > 0) {
      const palletLines = await prisma.palletLine.findMany({
        where: {
          pallet: { location_id, status: { in: ["IN_STORAGE", "IN_STAGING"] } },
          item_code_id: { in: items.map((i) => i.item_code_id) },
        },
        select: { item_code_id: true, qty_box: true },
      });
      for (const pl of palletLines) {
        systemQtyByItem.set(
          pl.item_code_id,
          (systemQtyByItem.get(pl.item_code_id) || 0) + Number(pl.qty_box)
        );
      }
    }

    // Build/load session
    const result = await prisma.$transaction(async (tx) => {
      let sessionId = session_id;

      if (!sessionId) {
        // Sinh mã: STK-YYYY-NNNN
        const year = new Date().getFullYear();
        const count = await tx.stocktakeSession.count({
          where: { code: { startsWith: `${CODE_PREFIX.STOCKTAKE_SESSION}-${year}` } },
        });
        const code = formatYearlyCode(CODE_PREFIX.STOCKTAKE_SESSION, year, count + 1);

        const newSession = await tx.stocktakeSession.create({
          data: {
            code,
            type: "BY_LOCATION",
            status: "COUNTING",
            started_at: new Date(),
            created_by: actor.userId ?? undefined,
            note: `Quét nhanh tại ${location.code} (${items.length} mã${extraPallets.length ? ` + ${extraPallets.length} pallet ngoài HT` : ""})`,
          },
        });
        sessionId = newSession.id;
      } else {
        // Verify session exists & open
        const existing = await tx.stocktakeSession.findUnique({ where: { id: sessionId } });
        if (!existing) throw new Error("Phiên không tồn tại.");
        if (existing.status === "CLOSED") throw new Error("Phiên đã đóng — không thể thêm count.");
      }

      const counts = [];

      // 1) Hàng hệ thống đã biết — upsert theo (session, location, item_code)
      for (const it of items) {
        const systemQty = systemQtyByItem.get(it.item_code_id) || 0;
        const actualNum = Number(it.actual_qty);
        const disc = actualNum - systemQty;
        const lotActual = it.lot?.trim() || null;
        const expiryActual = parseExpiry(it.expiry);

        const found = await tx.stocktakeCount.findFirst({
          where: { session_id: sessionId!, location_id, item_code_id: it.item_code_id, is_outside_system: false },
        });

        if (found) {
          const upd = await tx.stocktakeCount.update({
            where: { id: found.id },
            data: {
              system_qty: new Prisma.Decimal(systemQty),
              actual_qty: new Prisma.Decimal(actualNum),
              discrepancy: new Prisma.Decimal(disc),
              lot_actual: lotActual ?? found.lot_actual,
              expiry_actual: expiryActual ?? found.expiry_actual,
              note: it.note?.trim() || found.note,
              counted_by: actor.userId ?? undefined,
              counted_at: new Date(),
            },
          });
          counts.push(upd);
        } else {
          const c = await tx.stocktakeCount.create({
            data: {
              session_id: sessionId!,
              location_id,
              item_code_id: it.item_code_id,
              system_qty: new Prisma.Decimal(systemQty),
              actual_qty: new Prisma.Decimal(actualNum),
              discrepancy: new Prisma.Decimal(disc),
              lot_actual: lotActual,
              expiry_actual: expiryActual,
              note: it.note?.trim() || null,
              counted_by: actor.userId ?? undefined,
              counted_at: new Date(),
            },
          });
          counts.push(c);
        }
      }

      // 2) Pallet NGOÀI hệ thống — luôn tạo bản ghi riêng (không gộp), system_qty = 0
      for (const ex of extraPallets) {
        const actualNum = Number(ex.actual_qty);
        const c = await tx.stocktakeCount.create({
          data: {
            session_id: sessionId!,
            location_id,
            item_code_id: ex.item_code_id,
            system_qty: new Prisma.Decimal(0),
            actual_qty: new Prisma.Decimal(actualNum),
            discrepancy: new Prisma.Decimal(actualNum), // toàn bộ là chênh THỪA
            lot_actual: ex.lot?.trim() || null,
            expiry_actual: parseExpiry(ex.expiry),
            is_outside_system: true,
            found_pallet_code: ex.found_pallet_code?.trim() || null,
            note: ex.note?.trim() || null,
            counted_by: actor.userId ?? undefined,
            counted_at: new Date(),
          },
        });
        counts.push(c);
      }

      return { sessionId: sessionId!, counts };
    });

    // Stats
    const discrepancyCount = result.counts.filter((c) => Number(c.discrepancy) !== 0).length;
    const outsideCount = result.counts.filter((c) => c.is_outside_system).length;

    return NextResponse.json({
      success: true,
      session_id: result.sessionId,
      saved_count: result.counts.length,
      discrepancy_count: discrepancyCount,
      outside_count: outsideCount,
      message:
        `Đã lưu ${result.counts.length} dòng vào phiên kiểm kê.` +
        (outsideCount > 0 ? ` Trong đó ${outsideCount} pallet ngoài hệ thống — chờ Quản lý duyệt để tạo pallet.` : "") +
        (discrepancyCount > 0 ? ` Có ${discrepancyCount} dòng chênh lệch.` : " Không có chênh lệch."),
    });
  } catch (error) {
    console.error("POST /api/stock-count/quick-scan error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}

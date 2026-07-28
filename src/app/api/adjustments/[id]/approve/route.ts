import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/adjustments/[id]/approve — Phê duyệt phiếu điều chỉnh
//
// FIX (CP-08): khi duyệt phải ÁP qty_adjust vào tồn thực (pallet_lines), không chỉ
// ghi audit. Trước fix: duyệt xong tồn kho không đổi → sai lệch so với kiểm kê.
//   - qty_adjust < 0 (giảm): trừ dần trên các pallet_line khớp (ưu tiên HSD gần — FEFO).
//   - qty_adjust > 0 (tăng): cộng vào pallet_line khớp đầu tiên.
//   - Lọc theo item_code_id (+ pallet_id, + lot nếu phiếu có chỉ định).
//   - Cập nhật lại qty_unit, weight_kg của dòng và total_weight_kg của pallet.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // UC-INV-09-TC17: chỉ Quản lý (+ super-role ADMIN/MANAGER/STAFF) được phê duyệt
    const { user } = await requirePermission(req, "inventory", "special");
    const { id } = await params;
    const voucher = await prisma.adjustmentVoucher.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!voucher) return NextResponse.json({ success: false, error: "Không tìm thấy." }, { status: 404 });
    if (voucher.status !== "PENDING") {
      return NextResponse.json({ success: false, error: `Phiếu đã ${voucher.status}.` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const touchedPalletIds = new Set<string>();
      const applied: Array<{ item_code_id: string; qty_adjust: number; unmet: number }> = [];

      for (const line of voucher.lines) {
        const adj = Number(line.qty_adjust);

        // Audit từng dòng (giữ như cũ — truy vết)
        await tx.auditLog.create({
          data: {
            entity_type: "adjustment",
            entity_id: id,
            action: "APPROVE",
            old_value: { qty_before: Number(line.qty_before) },
            new_value: { qty_after: Number(line.qty_after), qty_adjust: adj },
            reason: voucher.reason,
            performed_by: user.id,           // UC-INV-09-TC11: ghi người thực hiện
            performed_by_role: user.role,
          },
        });

        if (!adj) continue;

        // ── UC-INV-06: dòng "PALLET NGOÀI HỆ THỐNG" → TẠO Pallet + PalletLine THẬT tại vị trí ──
        // Chỉ khi tăng tồn. Idempotent: nếu line đã gắn pallet_id (đã tạo) thì bỏ qua → tránh
        // tạo trùng khi bấm duyệt 2 lần / retry mạng.
        if (line.is_outside_system && adj > 0) {
          if (line.pallet_id) {
            applied.push({ item_code_id: line.item_code_id, qty_adjust: adj, unmet: 0 });
            continue;
          }
          if (!line.location_id) {
            // Không có vị trí để đặt pallet → không tạo được; ghi unmet để rà soát thủ công
            applied.push({ item_code_id: line.item_code_id, qty_adjust: adj, unmet: adj });
            continue;
          }

          const ic = await tx.itemCode.findUnique({
            where: { id: line.item_code_id },
            select: { units_per_box: true, weight_per_box: true },
          });
          const upb = ic?.units_per_box || 1;
          const wpb = ic?.weight_per_box ? Number(ic.weight_per_box) : 0;

          // Sinh mã pallet PLYYMMDD.NNN — race-safe (đồng bộ logic generatePalletCode ở /api/pallets)
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const yy = String(today.getUTCFullYear()).slice(-2);
          const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(today.getUTCDate()).padStart(2, "0");
          const dayKey = `pallet_seq_${yy}${mm}${dd}`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dayKey}))`;
          const maxSeq = await tx.pallet.aggregate({ where: { code_date: today }, _max: { code_seq: true } });
          const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
          const palletCode = `PL${yy}${mm}${dd}.${String(nextSeq).padStart(3, "0")}`;

          const qtyBox = adj;
          const weightKg = Number((qtyBox * wpb).toFixed(2));

          const newPallet = await tx.pallet.create({
            data: {
              code: palletCode,
              code_date: today,
              code_seq: nextSeq,
              status: "IN_STORAGE",
              location_id: line.location_id,
              total_lines: 1,
              total_weight_kg: new Prisma.Decimal(weightKg),
              created_by: user.id,
              note: `Pallet ngoài hệ thống — phát hiện khi kiểm kê (phiếu ${voucher.code})`,
            },
          });
          await tx.palletLine.create({
            data: {
              pallet_id: newPallet.id,
              item_code_id: line.item_code_id,
              qty_box: new Prisma.Decimal(qtyBox),
              qty_unit: new Prisma.Decimal(qtyBox * upb),
              lot: line.lot || null,
              expiry_date: line.expiry_date || null,
              weight_kg: new Prisma.Decimal(weightKg),
            },
          });
          // Cập nhật trạng thái vị trí (denormalized) nếu đang trống — đồng bộ với put-away
          await tx.location.updateMany({
            where: { id: line.location_id, status: "EMPTY" },
            data: { status: "USING" },
          });
          // Idempotency: lưu pallet_id ngược lại dòng phiếu để không tạo lại khi retry/duyệt 2 lần
          await tx.adjustmentLine.update({ where: { id: line.id }, data: { pallet_id: newPallet.id } });
          // Audit: tạo pallet từ kiểm kê
          await tx.auditLog.create({
            data: {
              entity_type: "pallet",
              entity_id: newPallet.id,
              action: "CREATE",
              new_value: {
                code: palletCode,
                location_id: line.location_id,
                item_code_id: line.item_code_id,
                qty_box: qtyBox,
                source: "STOCKTAKE_FOUND",
                found_pallet_code: line.found_pallet_code ?? null,
              },
              reason: `Pallet ngoài hệ thống (kiểm kê) — ${voucher.reason}`,
              performed_by: user.id,
              performed_by_role: user.role,
            },
          });
          touchedPalletIds.add(newPallet.id);
          applied.push({ item_code_id: line.item_code_id, qty_adjust: adj, unmet: 0 });
          continue;
        }

        // Tìm pallet_line đích để áp điều chỉnh
        const where: Prisma.PalletLineWhereInput = {
          item_code_id: line.item_code_id,
          pallet: { status: { in: STOCK_PALLET_STATUSES } },
        };
        if (line.pallet_id) where.pallet_id = line.pallet_id;
        if (line.lot) where.lot = line.lot;

        const candidates = await tx.palletLine.findMany({
          where,
          include: { item_code: { select: { weight_per_box: true, units_per_box: true } } },
          orderBy: { expiry_date: { sort: "asc", nulls: "last" } },
        });

        const setQty = async (pl: (typeof candidates)[number], newQty: number) => {
          const wpb = pl.item_code.weight_per_box ? Number(pl.item_code.weight_per_box) : 0;
          const upb = pl.item_code.units_per_box || 1;
          await tx.palletLine.update({
            where: { id: pl.id },
            data: {
              qty_box: new Prisma.Decimal(newQty),
              qty_unit: new Prisma.Decimal(newQty * upb),
              weight_kg: new Prisma.Decimal(Number((newQty * wpb).toFixed(2))),
            },
          });
          touchedPalletIds.add(pl.pallet_id);
        };

        if (adj < 0) {
          // Giảm tồn: trừ dần qua các dòng khớp (FEFO trước)
          let need = -adj;
          for (const pl of candidates) {
            if (need <= 0) break;
            const cur = Number(pl.qty_box);
            const take = Math.min(cur, need);
            if (take <= 0) continue;
            await setQty(pl, cur - take);
            need -= take;
          }
          applied.push({ item_code_id: line.item_code_id, qty_adjust: adj, unmet: need }); // need>0 = thiếu tồn để trừ
        } else {
          // Tăng tồn: cộng vào dòng khớp đầu tiên (nếu có)
          const pl = candidates[0];
          if (pl) await setQty(pl, Number(pl.qty_box) + adj);
          applied.push({ item_code_id: line.item_code_id, qty_adjust: adj, unmet: pl ? 0 : adj });
        }
      }

      // Cập nhật lại total_weight_kg cho các pallet bị ảnh hưởng
      for (const palletId of touchedPalletIds) {
        const agg = await tx.palletLine.aggregate({ where: { pallet_id: palletId }, _sum: { weight_kg: true } });
        await tx.pallet.update({
          where: { id: palletId },
          data: { total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0) },
        });
      }

      const updated = await tx.adjustmentVoucher.update({
        where: { id },
        data: { status: "APPROVED", approved_by: user.id, approved_at: new Date(), applied_at: new Date() },
      });

      if (voucher.stocktake_session_id) {
        await tx.stocktakeSession.update({
          where: { id: voucher.stocktake_session_id },
          data: { status: "CLOSED" },
        });
      }

      return { updated, applied, pallets_updated: touchedPalletIds.size };
    });

    // Notify THU_KHO khi phiếu điều chỉnh được phê duyệt (giữ tính năng Push của 42)
    notifyByRoles(["THU_KHO"], {
      type: "ADJUSTMENT_APPROVED",
      title: `Phiếu điều chỉnh được duyệt: ${voucher.code}`,
      body: `Phiếu ${voucher.code} đã được phê duyệt và áp vào tồn kho (${result.pallets_updated} pallet cập nhật).`,
      entity_type: "adjustment_voucher",
      entity_id: id,
      link_url: `/thukho/warehouse/movements`,
    }).catch((err) => console.error("notifyByRoles ADJUSTMENT_APPROVED:", err));

    return NextResponse.json({
      success: true,
      data: result.updated,
      applied: result.applied,
      message: `Phiếu điều chỉnh đã được phê duyệt và áp vào tồn (${result.pallets_updated} pallet cập nhật).`,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

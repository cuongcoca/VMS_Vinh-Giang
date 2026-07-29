import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// POST /api/forklift/return — Hoàn trả pallet (IN_STAGING → IN_STORAGE)
//
// UC-FK-05 (theo mockup):
//   - Đây là luồng DUY NHẤT cho phép sửa pallet_line khi pallet đã CONFIRMED
//     (status COUNTING/EMPTY mới sửa thẳng được qua PATCH lines).
//   - Mọi sửa đổi đều ghi audit log.
//
// Body:
//   pallet_id, location_id (target để trả về), reason (>= 5 ký tự)
//   line_updates: Array<{ line_id, qty_box?, lot?, expiry_date?, manufactured_date? }>
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { pallet_id, location_id, reason } = body;
    const lineUpdates: Array<{
      line_id: string;
      qty_box?: number | string;
      lot?: string | null;
      expiry_date?: string | null;
      manufactured_date?: string | null;
    }> = Array.isArray(body.line_updates) ? body.line_updates : [];

    if (!pallet_id || !location_id) {
      return NextResponse.json({ success: false, error: "Thiếu pallet_id hoặc location_id." }, { status: 400 });
    }
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ success: false, error: "Lý do phải có ít nhất 5 ký tự." }, { status: 400 });
    }

    // UC-FK-05_TC06/TC08: Lô + HSD mới hoàn trả bắt buộc — không cho để trống/xóa.
    for (const u of lineUpdates) {
      if (u.lot !== undefined && !String(u.lot ?? "").trim()) {
        return NextResponse.json({ success: false, error: "Cần nhập lô hàng hoàn trả." }, { status: 400 });
      }
      if (u.expiry_date !== undefined && !String(u.expiry_date ?? "").trim()) {
        return NextResponse.json({ success: false, error: "Cần nhập HSD mới." }, { status: 400 });
      }
    }

    const pallet = await prisma.pallet.findUnique({
      where: { id: pallet_id },
      include: { lines: { include: { item_code: { select: { code: true, short_name: true, weight_per_box: true, units_per_box: true } } } } },
    });
    if (!pallet) return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    if (pallet.status !== "IN_STAGING") {
      return NextResponse.json({ success: false, error: `Pallet phải ở khu chờ xuất. Hiện tại: "${pallet.status}".` }, { status: 400 });
    }

    const location = await prisma.location.findUnique({ where: { id: location_id } });
    if (!location) return NextResponse.json({ success: false, error: "Vị trí không tồn tại." }, { status: 404 });
    if (location.status !== "EMPTY") {
      return NextResponse.json({ success: false, error: `Vị trí "${location.code}" không trống.` }, { status: 400 });
    }

    // Validate line_updates trỏ đúng pallet này
    const lineMap = new Map(pallet.lines.map((l) => [l.id, l]));
    for (const u of lineUpdates) {
      if (!lineMap.has(u.line_id)) {
        return NextResponse.json(
          { success: false, error: `Line ${u.line_id} không thuộc pallet này.` },
          { status: 400 }
        );
      }
      const orig = lineMap.get(u.line_id)!;

      // UC-FK-05_TC11: Kiểm tra khi nhập sai số lô hàng
      if (u.lot !== undefined && u.lot !== null) {
        const newLot = String(u.lot).trim();
        if (newLot !== "" && newLot !== (orig.lot || "")) {
          const lotExistsInInbound = await prisma.inboundLine.findFirst({
            where: {
              item_code_id: orig.item_code_id,
              lot: newLot,
            },
          });
          const lotExistsInPallet = lotExistsInInbound || await prisma.palletLine.findFirst({
            where: {
              item_code_id: orig.item_code_id,
              lot: newLot,
            },
          });
          if (!lotExistsInPallet) {
            return NextResponse.json(
              { success: false, error: `Số lô "${newLot}" không tồn tại đối với mã hàng này.` },
              { status: 400 }
            );
          }
        }
      }

      if (u.qty_box !== undefined) {
        const n = Number(u.qty_box);
        if (Number.isNaN(n) || n <= 0) {
          return NextResponse.json(
            { success: false, error: "Số lượng phải > 0." },
            { status: 400 }
          );
        }
        // UC-FK-05_TC13: không cho trả vượt SL hiện có trên dòng pallet.
        const origQty = Number(orig.qty_box);
        if (n > origQty) {
          return NextResponse.json(
            { success: false, error: `Số lượng không hợp lệ — vượt SL hiện có (${origQty}) trên pallet.` },
            { status: 400 }
          );
        }
      }
    }

    const actor = getRequestActor(req);
    const oldLocationId = pallet.location_id;

    // Snapshot các thay đổi để audit
    type LineChange = {
      line_id: string;
      old: Record<string, unknown>;
      new: Record<string, unknown>;
    };
    const lineChanges: LineChange[] = [];
    let returnMovementId: string | null = null;

    await prisma.$transaction(async (tx) => {
      // 1. Apply line updates
      for (const u of lineUpdates) {
        const orig = lineMap.get(u.line_id)!;
        const data: Prisma.PalletLineUpdateInput = {};
        const oldSnap: Record<string, unknown> = {};
        const newSnap: Record<string, unknown> = {};
        let qtyChanged = false;
        let newQty: Prisma.Decimal | null = null;

        if (u.qty_box !== undefined && Number(u.qty_box) !== Number(orig.qty_box)) {
          newQty = new Prisma.Decimal(Number(u.qty_box));
          data.qty_box = newQty;
          oldSnap.qty_box = orig.qty_box;
          newSnap.qty_box = newQty;
          qtyChanged = true;
        }
        if (u.lot !== undefined && (u.lot || null) !== (orig.lot || null)) {
          data.lot = (u.lot || null) as string | null;
          oldSnap.lot = orig.lot;
          newSnap.lot = data.lot;
        }
        if (u.expiry_date !== undefined) {
          const newDate = u.expiry_date ? new Date(u.expiry_date) : null;
          const origDate = orig.expiry_date;
          const same =
            (newDate === null && origDate === null) ||
            (newDate && origDate && newDate.getTime() === origDate.getTime());
          if (!same) {
            data.expiry_date = newDate;
            oldSnap.expiry_date = origDate;
            newSnap.expiry_date = newDate;
          }
        }
        if (u.manufactured_date !== undefined) {
          const newDate = u.manufactured_date ? new Date(u.manufactured_date) : null;
          const origDate = orig.manufactured_date;
          const same =
            (newDate === null && origDate === null) ||
            (newDate && origDate && newDate.getTime() === origDate.getTime());
          if (!same) {
            data.manufactured_date = newDate;
            oldSnap.manufactured_date = origDate;
            newSnap.manufactured_date = newDate;
          }
        }

        // Recalc weight + qty_unit nếu qty đổi
        if (qtyChanged && newQty) {
          const wpb = orig.item_code.weight_per_box ? Number(orig.item_code.weight_per_box) : 0;
          data.weight_kg = new Prisma.Decimal(Number(newQty) * wpb);
          const upb = orig.item_code.units_per_box || 1;
          data.qty_unit = newQty.mul(new Prisma.Decimal(upb));
        }

        if (Object.keys(oldSnap).length > 0) {
          await tx.palletLine.update({ where: { id: orig.id }, data });
          lineChanges.push({ line_id: orig.id, old: oldSnap, new: newSnap });
        }
      }

      // 2. Recalc total_weight_kg pallet (nếu có line đổi qty)
      if (lineChanges.some((c) => "qty_box" in c.new)) {
        const agg = await tx.palletLine.aggregate({
          where: { pallet_id },
          _sum: { weight_kg: true },
        });
        await tx.pallet.update({
          where: { id: pallet_id },
          data: {
            total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0),
            status: "IN_STORAGE",
            location_id,
          },
        });
      } else {
        // Không đổi qty — chỉ update status + location
        await tx.pallet.update({
          where: { id: pallet_id },
          data: { status: "IN_STORAGE", location_id },
        });
      }

      // 3. Update location status
      if (oldLocationId) {
        await tx.location.update({ where: { id: oldLocationId }, data: { status: "EMPTY" } });
      }
      await tx.location.update({ where: { id: location_id }, data: { status: "USING" } });

      // 4. Movement record — giữ id để gắn audit_log_id (UC-FK-06_TC20).
      // WVG-179: bổ sung snapshot nội dung pallet (item/lot/qty/HSD) để ledger đủ
      // truy vết. Return giữ 1 movement (để gắn audit) → snapshot dòng chính; pallet
      // 1 dòng (phổ biến) là chính xác, nhiều dòng thì lấy dòng đầu làm đại diện.
      const rLines = await tx.palletLine.findMany({
        where: { pallet_id },
        select: { item_code_id: true, lot: true, expiry_date: true, qty_box: true, qty_unit: true },
      });
      const primary = rLines[0];
      const returnMv = await tx.movement.create({
        data: {
          pallet_id,
          movement_type: "RETURN",
          from_location_id: oldLocationId,
          to_location_id: location_id,
          item_code_id: primary?.item_code_id ?? null,
          qty_box: primary?.qty_box ?? null,
          qty_unit: primary?.qty_unit ?? null,
          lot: primary?.lot ?? null,
          expiry_date: primary?.expiry_date ?? null,
          reason: reason.trim(),
          performed_by: actor.userId ?? undefined,
        },
        select: { id: true },
      });
      returnMovementId = returnMv.id;
    });

    // 5. Audit logs (ngoài transaction để không rollback nếu helper fail)
    // 5a. Log riêng cho từng line đổi
    for (const ch of lineChanges) {
      await logAudit(req, {
        entity_type: "pallet_line",
        entity_id: ch.line_id,
        action: "EDIT_PALLET_LINE_VIA_RETURN",
        old_value: ch.old,
        new_value: ch.new,
        reason: reason.trim(),
      });
    }
    // 5b. Log tổng cho pallet — kèm chi tiết old→new từng dòng hàng (UC-FK-06_TC20)
    const palletAudit = await logAudit(req, {
      entity_type: "pallet",
      entity_id: pallet_id,
      action: "RETURN",
      old_value: {
        status: "IN_STAGING",
        location_id: oldLocationId,
        lines_changed: lineChanges.length,
      },
      new_value: {
        status: "IN_STORAGE",
        location_code: location.code,
        lines_changed: lineChanges.length,
        // Chi tiết thay đổi từng dòng để lịch sử hiển thị "cũ → mới" đầy đủ.
        line_changes: lineChanges.map((c) => ({
          item_code: lineMap.get(c.line_id)?.item_code?.code ?? null,
          old: c.old,
          new: c.new,
        })),
      },
      reason: reason.trim(),
    });

    // Gắn audit_log_id vào Movement RETURN để màn lịch sử luân chuyển đọc được old→new (UC-FK-06_TC20).
    if (returnMovementId && palletAudit?.id) {
      await prisma.movement.update({
        where: { id: returnMovementId },
        data: { audit_log_id: palletAudit.id },
      });
    }

    // Notify THU_KHO, KE_TOAN khi pallet hoàn trả (IN_STAGING → IN_STORAGE)
    notifyByRoles(["THU_KHO", "KE_TOAN"], {
      type: "PALLET_RETURNED",
      title: `Pallet hoàn trả: ${pallet.code}`,
      body: lineChanges.length > 0
        ? `Pallet ${pallet.code} đã hoàn trả vào ${location.code} (cập nhật ${lineChanges.length} dòng hàng).`
        : `Pallet ${pallet.code} đã hoàn trả vào ${location.code}.`,
      entity_type: "pallet",
      entity_id: pallet_id,
      link_url: `/thukho/pallet/${pallet_id}`,
    }).catch((err) => console.error("notifyByRoles PALLET_RETURNED:", err));

    return NextResponse.json({
      success: true,
      message: lineChanges.length > 0
        ? `Pallet ${pallet.code} đã hoàn trả vào ${location.code} (đã cập nhật ${lineChanges.length} dòng hàng).`
        : `Pallet ${pallet.code} đã hoàn trả vào ${location.code}.`,
      lines_changed: lineChanges.length,
    });
  } catch (error) {
    console.error("POST /api/forklift/return error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi: ${msg}` }, { status: 500 });
  }
}

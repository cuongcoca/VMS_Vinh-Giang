import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";
import { warehouseDateParts } from "@/lib/warehouse-date";

// POST /api/forklift/stage-out — UC-FK-04
// mode = "FULL"   : chuyển nguyên pallet IN_STORAGE → IN_STAGING
// mode = "PARTIAL": rút một phần theo TỪNG DÒNG (mã hàng) — chỉ định pallet_line_id.
//   - Pallet cha còn hàng sau khi rút → tách tạo pallet con cho phần rút.
//   - Pallet cha cạn sạch (tổng = 0) → chuyển nguyên pallet cha ra khu chờ
//     xuất (không tạo con rỗng). "Hàng rút cuối cùng đi bằng chính pallet cha."
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "forklift", "write");
  if (denied) return denied;
  try {
    const body = await req.json();
    const { pallet_id, staging_location_id, mode = "FULL", partial_qty, pallet_line_id } = body;

    if (!pallet_id) {
      return NextResponse.json({ success: false, error: "Thiếu pallet_id." }, { status: 400 });
    }
    // Bắt buộc chọn vị trí khu chờ xuất (không cho tạo pallet lơ lửng location_id=null)
    if (!staging_location_id) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn vị trí khu chờ xuất (staging_location_id là bắt buộc)." },
        { status: 400 }
      );
    }
    // Validate vị trí phải là OUTBOUND_STAGING
    const stagingLoc = await prisma.location.findUnique({
      where: { id: staging_location_id },
      select: { id: true, code: true, type: true, is_active: true },
    });
    if (!stagingLoc || stagingLoc.type !== "OUTBOUND_STAGING" || !stagingLoc.is_active) {
      return NextResponse.json(
        { success: false, error: `Vị trí "${staging_location_id}" không hợp lệ. Phải chọn vị trí thuộc khu chờ xuất (OUTBOUND_STAGING).` },
        { status: 400 }
      );
    }

    const pallet = await prisma.pallet.findUnique({
      where: { id: pallet_id },
      include: { lines: { include: { item_code: { select: { code: true } } } } },
    });
    if (!pallet) {
      return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    }
    if (pallet.status !== "IN_STORAGE") {
      return NextResponse.json(
        { success: false, error: `Pallet phải đang trong kho. Hiện tại: "${pallet.status}".` },
        { status: 400 }
      );
    }

    // Phase 6.1 — audit log + performed_by qua helper (RC-2)
    const actor = getRequestActor(req);

    const totalQty = pallet.lines.reduce((s, l) => s + Number(l.qty_box), 0);

    // ═══════════════════════════════════════════════════════
    // MODE PARTIAL: rút một phần theo từng dòng hàng (mã hàng)
    // ═══════════════════════════════════════════════════════
    if (mode === "PARTIAL") {
      const partialQtyNum = Number(partial_qty);
      if (!partialQtyNum || partialQtyNum <= 0) {
        return NextResponse.json(
          { success: false, error: "partial_qty phải > 0 khi mode=PARTIAL." },
          { status: 400 }
        );
      }

      // Xác định dòng cần rút: ưu tiên pallet_line_id; fallback dòng duy nhất
      const targetLineMaybe = pallet_line_id
        ? pallet.lines.find((l) => l.id === pallet_line_id)
        : pallet.lines.length === 1
          ? pallet.lines[0]
          : undefined;
      if (!targetLineMaybe) {
        return NextResponse.json(
          {
            success: false,
            error: pallet_line_id
              ? "Dòng hàng cần rút không thuộc pallet này."
              : "Pallet có nhiều dòng hàng — cần chỉ định pallet_line_id (dòng cần rút).",
          },
          { status: 400 }
        );
      }
      const line = targetLineMaybe;

      const lineQty = Number(line.qty_box);
      if (partialQtyNum > lineQty) {
        return NextResponse.json(
          { success: false, error: `SL rút (${partialQtyNum}) > SL mã hàng trong pallet (${lineQty}).` },
          { status: 400 }
        );
      }

      const itemCodeStr = line.item_code?.code ?? "";
      const newParentLineQty = lineQty - partialQtyNum;
      const remainingTotal = totalQty - partialQtyNum; // tổng pallet cha SAU khi rút

      // stagingLocId luôn là staging_location_id (đã validate ở trên, không còn auto-pick)
      const stagingLocId: string = staging_location_id;

      const oldLocationId = pallet.location_id;

      // ─────────────────────────────────────────────────────
      // RÚT HẾT: pallet cha cạn sạch → chuyển NGUYÊN pallet cha sang khu chờ
      // xuất (không tạo con). Pallet cha mang theo phần hàng còn lại.
      // ─────────────────────────────────────────────────────
      if (remainingTotal <= 0) {
        await prisma.$transaction(async (tx) => {
          await tx.pallet.update({
            where: { id: pallet_id },
            data: { status: "IN_STAGING", location_id: stagingLocId },
          });
          if (oldLocationId) {
            await tx.location.update({ where: { id: oldLocationId }, data: { status: "EMPTY" } });
          }
          if (stagingLocId) {
            await tx.location.update({ where: { id: stagingLocId }, data: { status: "USING" } });
          }
          await tx.movement.create({
            data: {
              pallet_id,
              movement_type: "STAGE_OUT",
              from_location_id: oldLocationId,
              to_location_id: stagingLocId,
              item_code_id: line.item_code_id,
              qty_box: new Prisma.Decimal(totalQty),
              lot: line.lot,
              expiry_date: line.expiry_date,
              mode: "FULL",
              reason: `Rút nốt ${partialQtyNum} thùng (mã ${itemCodeStr}) — chuyển nguyên pallet cha ra khu chờ xuất.`,
              performed_by: actor.userId ?? undefined,
            },
          });
        });

        await logAudit(req, {
          entity_type: "pallet",
          entity_id: pallet_id,
          action: "STAGE_OUT_FULL",
          old_value: { status: "IN_STORAGE", total_qty: totalQty },
          new_value: { status: "IN_STAGING", mode: "FULL", qty_box: totalQty, via: "PARTIAL_LAST" },
          reason: `Rút nốt phần còn lại → chuyển nguyên pallet ${pallet.code}.`,
        });

        // Notify THU_KHO, KE_TOAN khi rút nốt (chuyển nguyên pallet cha)
        notifyByRoles(["THU_KHO", "KE_TOAN"], {
          type: "PALLET_STAGED_OUT",
          title: `Pallet ra chờ xuất: ${pallet.code}`,
          body: `Pallet ${pallet.code} đã chuyển ra khu chờ xuất (${totalQty} thùng).`,
          entity_type: "pallet",
          entity_id: pallet_id,
          link_url: `/thukho/pallet/${pallet_id}`,
        }).catch((err) => console.error("notifyByRoles PALLET_STAGED_OUT:", err));

        return NextResponse.json({
          success: true,
          message: `Đã rút nốt ${partialQtyNum} thùng — chuyển nguyên pallet ${pallet.code} sang khu chờ xuất.`,
          partial: false,
          moved_parent: true,
        });
      }

      // ─────────────────────────────────────────────────────
      // TÁCH: pallet cha còn hàng → tạo pallet con cho phần rút
      // ─────────────────────────────────────────────────────

      // Tỷ lệ split tính theo DÒNG được rút (không theo tổng pallet) → hỗ trợ nhiều dòng
      const ratio = lineQty > 0 ? partialQtyNum / lineQty : 0;
      const parentLineWeight = Number(line.weight_kg);
      const childWeightNum = parentLineWeight * ratio;
      const childLineWeight = new Prisma.Decimal(childWeightNum.toFixed(2));
      const newParentLineWeight = new Prisma.Decimal((parentLineWeight - childWeightNum).toFixed(2));
      const parentLineUnit = Number(line.qty_unit);
      const childLineUnit = new Prisma.Decimal((parentLineUnit * ratio).toFixed(3));
      const newParentLineUnit = new Prisma.Decimal((parentLineUnit - parentLineUnit * ratio).toFixed(3));
      const parentTotalWeight = Number(pallet.total_weight_kg);
      const newParentWeight = new Prisma.Decimal((parentTotalWeight - childWeightNum).toFixed(2));

      // WVG-98: ngày kho GMT+7; seq race-safe bằng advisory lock TRONG transaction.
      const { codeDate, dayKey } = warehouseDateParts();

      // Transaction: tạo pallet con + line con + giảm qty/weight dòng cha + location + movement
      const child = await prisma.$transaction(async (tx) => {
        // Advisory lock theo ngày kho → chặn race code_seq/split_seq khi split đồng thời.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dayKey}))`;
        const [maxSplit, maxToday] = await Promise.all([
          tx.pallet.aggregate({ where: { parent_pallet_id: pallet_id }, _max: { split_seq: true } }),
          tx.pallet.aggregate({ where: { code_date: codeDate }, _max: { code_seq: true } }),
        ]);
        const nextSplitSeq = (maxSplit._max.split_seq || 0) + 1;
        const nextCodeSeq = (maxToday._max.code_seq || 0) + 1;
        const childCode = `${pallet.code}-P${nextSplitSeq}`;
        if (childCode.length > 20) {
          throw new Error(`Mã pallet con quá dài: ${childCode} (>20 ký tự).`);
        }
        const newChild = await tx.pallet.create({
          data: {
            code: childCode,
            code_date: codeDate,
            code_seq: nextCodeSeq,
            status: "IN_STAGING",
            supplier_id: pallet.supplier_id,
            location_id: stagingLocId,
            inbound_request_id: pallet.inbound_request_id,
            inbound_date: pallet.inbound_date,
            parent_pallet_id: pallet_id,
            split_seq: nextSplitSeq,
            // WVG-97: nguồn truy vết = tách từ pallet cha.
            source_type: "SPLIT",
            source_id: pallet_id,
            total_lines: 1,
            total_weight_kg: childLineWeight,
            note: `Split từ ${pallet.code} (${partialQtyNum}/${lineQty} thùng, mã ${itemCodeStr})`,
            lines: {
              create: {
                item_code_id: line.item_code_id,
                // Hướng A: dòng con giữ phiếu của dòng cha để đối chiếu không lệch.
                inbound_request_id: line.inbound_request_id,
                qty_box: new Prisma.Decimal(partialQtyNum),
                qty_unit: childLineUnit,
                lot: line.lot,
                expiry_date: line.expiry_date,
                manufactured_date: line.manufactured_date,
                weight_kg: childLineWeight,
                note: line.note,
              },
            },
          },
        });

        // Giảm dòng cha (giữ dòng kể cả khi về 0 — pallet còn dòng khác)
        await tx.palletLine.update({
          where: { id: line.id },
          data: {
            qty_box: new Prisma.Decimal(newParentLineQty),
            qty_unit: newParentLineUnit,
            weight_kg: newParentLineWeight,
          },
        });

        // Giảm tổng cân pallet cha (giữ status IN_STORAGE, vị trí cũ)
        await tx.pallet.update({
          where: { id: pallet_id },
          data: { total_weight_kg: newParentWeight },
        });

        if (stagingLocId) {
          await tx.location.update({
            where: { id: stagingLocId },
            data: { status: "USING" },
          });
        }

        await tx.movement.create({
          data: {
            pallet_id,
            movement_type: "STAGE_OUT",
            from_location_id: pallet.location_id,
            to_location_id: stagingLocId,
            item_code_id: line.item_code_id,
            qty_box: new Prisma.Decimal(partialQtyNum),
            lot: line.lot,
            expiry_date: line.expiry_date,
            mode: "PARTIAL",
            reason_code: "PALLET_SPLIT",
            reason: `Split ${partialQtyNum}/${lineQty} thùng (mã ${itemCodeStr}) → ${childCode}`,
            performed_by: actor.userId ?? undefined,
          },
        });

        return newChild;
      });

      await logAudit(req, {
        entity_type: "pallet",
        entity_id: pallet_id,
        action: "STAGE_OUT_PARTIAL",
        old_value: { status: "IN_STORAGE", line_qty: lineQty, pallet_line_id: line.id },
        new_value: {
          mode: "PARTIAL",
          partial_qty: partialQtyNum,
          remaining_line_qty: newParentLineQty,
          item_code_id: line.item_code_id,
          child_pallet_id: child.id,
          child_pallet_code: child.code,
        },
        reason: `Split ${partialQtyNum}/${lineQty} thùng (mã ${itemCodeStr}) → ${child.code}`,
      });

      // Notify THU_KHO, KE_TOAN khi rút 1 phần (PARTIAL split)
      notifyByRoles(["THU_KHO", "KE_TOAN"], {
        type: "PALLET_SPLIT_STAGED",
        title: `Tách pallet: ${pallet.code}`,
        body: `Rút ${partialQtyNum}/${lineQty} thùng mã ${itemCodeStr} từ ${pallet.code} → tạo ${child.code} ở khu chờ xuất.`,
        entity_type: "pallet",
        entity_id: pallet_id,
        link_url: `/thukho/pallet/${pallet_id}`,
      }).catch((err) => console.error("notifyByRoles PALLET_SPLIT_STAGED:", err));

      return NextResponse.json({
        success: true,
        message: `Đã rút ${partialQtyNum}/${lineQty} thùng mã ${itemCodeStr} từ ${pallet.code} → tạo pallet ${child.code} ở khu chờ xuất. Dòng còn ${newParentLineQty} thùng.`,
        partial: true,
        child_pallet: { id: child.id, code: child.code },
      });
    }

    // ═══════════════════════════════════════════════════════
    // MODE FULL (default): chuyển nguyên pallet
    // ═══════════════════════════════════════════════════════
    const oldLocationId = pallet.location_id;
    const txOps: Prisma.PrismaPromise<unknown>[] = [];

    txOps.push(
      prisma.pallet.update({
        where: { id: pallet_id },
        data: {
          status: "IN_STAGING",
          location_id: staging_location_id || null,
        },
      })
    );
    if (oldLocationId) {
      txOps.push(
        prisma.location.update({ where: { id: oldLocationId }, data: { status: "EMPTY" } })
      );
    }
    if (staging_location_id) {
      txOps.push(
        prisma.location.update({ where: { id: staging_location_id }, data: { status: "USING" } })
      );
    }
    txOps.push(
      prisma.movement.create({
        data: {
          pallet_id,
          movement_type: "STAGE_OUT",
          from_location_id: oldLocationId,
          to_location_id: staging_location_id || null,
          qty_box: new Prisma.Decimal(totalQty),
          mode: "FULL",
          performed_by: actor.userId ?? undefined,
        },
      })
    );

    await prisma.$transaction(txOps);

    await logAudit(req, {
      entity_type: "pallet",
      entity_id: pallet_id,
      action: "STAGE_OUT_FULL",
      old_value: { status: "IN_STORAGE" },
      new_value: { status: "IN_STAGING", mode: "FULL", qty_box: totalQty },
    });

    // Notify THU_KHO, KE_TOAN khi chuyển nguyên pallet ra chờ xuất (FULL)
    notifyByRoles(["THU_KHO", "KE_TOAN"], {
      type: "PALLET_STAGED_OUT",
      title: `Pallet ra chờ xuất: ${pallet.code}`,
      body: `Pallet ${pallet.code} đã chuyển sang khu chờ xuất (${totalQty} thùng).`,
      entity_type: "pallet",
      entity_id: pallet_id,
      link_url: `/thukho/pallet/${pallet_id}`,
    }).catch((err) => console.error("notifyByRoles PALLET_STAGED_OUT:", err));

    return NextResponse.json({
      success: true,
      message: `Pallet ${pallet.code} đã chuyển sang khu chờ xuất.`,
    });
  } catch (error) {
    console.error("POST /api/forklift/stage-out error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
    return NextResponse.json(
      { success: false, error: `Lỗi khi chuyển khu chờ xuất: ${msg}` },
      { status: 500 }
    );
  }
}

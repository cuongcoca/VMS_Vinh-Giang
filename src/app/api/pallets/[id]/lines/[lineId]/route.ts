import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

// PATCH /api/pallets/[id]/lines/[lineId] — Sửa dòng hàng (qty_box, lot, expiry_date, manufactured_date, note)
// L1 fix — chỉ cho phép khi pallet ở EMPTY hoặc COUNTING
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const denied = await guardPermission(req, "pallet", "write");
  if (denied) return denied;
  try {
    const { id, lineId } = await params;
    const body = await req.json();

    const pallet = await prisma.pallet.findUnique({ where: { id } });
    if (!pallet) {
      return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    }
    if (pallet.status !== "EMPTY" && pallet.status !== "COUNTING") {
      return NextResponse.json(
        { success: false, error: `Pallet đang ở trạng thái "${pallet.status}" — không thể sửa dòng hàng.` },
        { status: 400 }
      );
    }

    const line = await prisma.palletLine.findUnique({
      where: { id: lineId },
      include: { item_code: { select: { weight_per_box: true, units_per_box: true } } },
    });
    if (!line || line.pallet_id !== id) {
      return NextResponse.json({ success: false, error: "Dòng hàng không thuộc pallet này." }, { status: 404 });
    }

    // Build patch — chỉ những field được gửi
    const data: Prisma.PalletLineUpdateInput = {};
    let qtyChanged = false;
    let newQtyBox: Prisma.Decimal | null = null;

    if (body.qty_box !== undefined && body.qty_box !== null && body.qty_box !== "") {
      const n = Number(body.qty_box);
      if (Number.isNaN(n) || n <= 0) {
        return NextResponse.json({ success: false, error: "Số lượng thùng phải > 0." }, { status: 400 });
      }
      newQtyBox = new Prisma.Decimal(n);
      data.qty_box = newQtyBox;
      qtyChanged = !newQtyBox.equals(line.qty_box);
    }
    if (body.lot !== undefined) data.lot = (body.lot || null) as string | null;
    if (body.note !== undefined) data.note = (body.note || null) as string | null;
    if (body.expiry_date !== undefined) {
      data.expiry_date = body.expiry_date ? new Date(body.expiry_date) : null;
    }
    if (body.manufactured_date !== undefined) {
      data.manufactured_date = body.manufactured_date ? new Date(body.manufactured_date) : null;
    }

    // Recalc weight_kg + qty_unit nếu qty_box đổi
    if (qtyChanged && newQtyBox) {
      if (line.item_code.weight_per_box) {
        data.weight_kg = newQtyBox.mul(line.item_code.weight_per_box);
      }
      // L2 fix: recalc qty_unit = qty_box × units_per_box
      const unitsPerBox = line.item_code.units_per_box || 1;
      data.qty_unit = newQtyBox.mul(new Prisma.Decimal(unitsPerBox));
    }

    const updated = await prisma.palletLine.update({ where: { id: lineId }, data });

    // Đồng bộ sang InboundTempLine nếu pallet có liên kết
    if (pallet.inbound_temp_id) {
      const tempLine = await prisma.inboundTempLine.findFirst({
        where: {
          inbound_temp_id: pallet.inbound_temp_id,
          item_code_id: line.item_code_id,
          qty_box: line.qty_box,
          lot: line.lot,
          expiry_date: line.expiry_date,
        },
      });
      if (tempLine) {
        await prisma.inboundTempLine.update({
          where: { id: tempLine.id },
          data: {
            qty_box: updated.qty_box,
            lot: updated.lot,
            expiry_date: updated.expiry_date,
            note: updated.note || tempLine.note,
          },
        });
      }
    }

    // Recalc tổng weight của pallet
    const agg = await prisma.palletLine.aggregate({
      where: { pallet_id: id },
      _sum: { weight_kg: true },
    });
    await prisma.pallet.update({
      where: { id },
      data: { total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0) },
    });

    // Audit log
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "EDIT_PALLET_LINE",
      old_value: {
        line_id: lineId,
        qty_box: line.qty_box,
        lot: line.lot,
        expiry_date: line.expiry_date,
        manufactured_date: line.manufactured_date,
        weight_kg: line.weight_kg,
        note: line.note,
      },
      new_value: {
        qty_box: updated.qty_box,
        lot: updated.lot,
        expiry_date: updated.expiry_date,
        manufactured_date: updated.manufactured_date,
        weight_kg: updated.weight_kg,
        note: updated.note,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        qty_box: updated.qty_box,
        qty_unit: updated.qty_unit,
        lot: updated.lot,
        expiry_date: updated.expiry_date,
        manufactured_date: updated.manufactured_date,
        weight_kg: updated.weight_kg,
        note: updated.note,
      },
      pallet_total_weight_kg: agg._sum.weight_kg ?? 0,
    });
  } catch (error) {
    console.error("PATCH /api/pallets/[id]/lines/[lineId] error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: `Lỗi khi sửa dòng hàng: ${msg}` }, { status: 500 });
  }
}

// DELETE /api/pallets/[id]/lines/[lineId] — Xóa dòng hàng
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const denied = await guardPermission(req, "pallet", "write");
  if (denied) return denied;
  try {
    const { id, lineId } = await params;

    // Kiểm tra pallet
    const pallet = await prisma.pallet.findUnique({ where: { id } });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }
    if (pallet.status !== "EMPTY" && pallet.status !== "COUNTING") {
      return NextResponse.json(
        { success: false, error: `Pallet đang ở trạng thái "${pallet.status}" — không thể xóa dòng hàng.` },
        { status: 400 }
      );
    }

    // Kiểm tra dòng hàng
    const line = await prisma.palletLine.findUnique({ where: { id: lineId } });
    if (!line || line.pallet_id !== id) {
      return NextResponse.json(
        { success: false, error: "Dòng hàng không thuộc pallet này." },
        { status: 404 }
      );
    }

    // Xóa dòng
    await prisma.palletLine.delete({ where: { id: lineId } });

    // Đồng bộ sang InboundTempLine nếu pallet có liên kết
    if (pallet.inbound_temp_id) {
      const tempLine = await prisma.inboundTempLine.findFirst({
        where: {
          inbound_temp_id: pallet.inbound_temp_id,
          item_code_id: line.item_code_id,
          qty_box: line.qty_box,
          lot: line.lot,
          expiry_date: line.expiry_date,
        },
      });
      if (tempLine) {
        await prisma.inboundTempLine.delete({ where: { id: tempLine.id } });
      }
    }

    // Cập nhật totals
    const agg = await prisma.palletLine.aggregate({
      where: { pallet_id: id },
      _sum: { weight_kg: true },
      _count: true,
    });

    // Nếu hết dòng → revert status COUNTING → EMPTY
    const newStatus = agg._count === 0 && pallet.status === "COUNTING" ? "EMPTY" : pallet.status;
    await prisma.pallet.update({
      where: { id },
      data: {
        total_lines: agg._count,
        total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0),
        status: newStatus,
      },
    });

    // Phase 3.4: audit log xóa dòng hàng (RC-2)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "DELETE_PALLET_LINE",
      old_value: {
        line_id: lineId,
        item_code_id: line.item_code_id,
        qty_box: line.qty_box,
        lot: line.lot,
        expiry_date: line.expiry_date,
        weight_kg: line.weight_kg,
      },
      new_value: {
        pallet_total_lines: agg._count,
        pallet_status: newStatus,
      },
    });

    return NextResponse.json({ success: true, message: "Đã xóa dòng hàng.", newStatus });
  } catch (error) {
    console.error("DELETE /api/pallets/[id]/lines/[lineId] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa dòng hàng." },
      { status: 500 }
    );
  }
}

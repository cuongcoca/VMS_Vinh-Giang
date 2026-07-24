import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logAudit } from "@/lib/audit";

// GET /api/pallets/[id]/lines — Danh sách dòng hàng của pallet
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const pallet = await prisma.pallet.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        // BUG fix: trang chi tiết pallet đọc pallet.location từ endpoint này. Trước đây
        // thiếu include location → pallet đã xếp (location_id có) vẫn hiển thị "Chưa xếp vị trí".
        location: { select: { id: true, code: true, zone: true, rack: true, level: true, status: true } },
        lines: {
          orderBy: { created_at: "desc" },
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                full_name: true,
                specification: true,
                units_per_box: true,
                weight_per_box: true,
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
            // Hướng A: dòng thuộc phiếu nào — để hiển thị nhóm theo phiếu.
            inbound_request: { select: { id: true, code: true, invoice_no: true } },
          },
        },
      },
    });

    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: pallet });
  } catch (error) {
    console.error("GET /api/pallets/[id]/lines error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải dòng hàng." },
      { status: 500 }
    );
  }
}

// POST /api/pallets/[id]/lines — Thêm dòng hàng vào pallet
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    // Hướng A: `inbound_request_id` = phiếu mà DÒNG này thuộc về (có thể khác phiếu
    // gốc của pallet). Không truyền = hàng phát sinh (NULL).
    const { item_code_id, qty_box, lot, expiry_date, manufactured_date, note, inbound_request_id } = body;

    // Validate bắt buộc
    if (!item_code_id) {
      return NextResponse.json(
        { success: false, error: "Phải chọn mã hàng." },
        { status: 400 }
      );
    }
    if (!qty_box || Number(qty_box) <= 0) {
      return NextResponse.json(
        { success: false, error: "Số lượng thùng phải > 0." },
        { status: 400 }
      );
    }

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
        { success: false, error: `Pallet đang ở trạng thái "${pallet.status}" — không thể thêm hàng.` },
        { status: 400 }
      );
    }

    // Kiểm tra ItemCode
    const itemCode = await prisma.itemCode.findUnique({ where: { id: item_code_id } });
    if (!itemCode) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không tồn tại." },
        { status: 400 }
      );
    }

    // Hướng A: nếu gán dòng vào một PHN, mã hàng phải thực sự thuộc phiếu đó
    // (có ít nhất 1 InboundLine) — tránh gán nhầm hàng của phiếu khác.
    let lineInboundId: string | null = null;
    if (inbound_request_id) {
      const inLine = await prisma.inboundLine.findFirst({
        where: { inbound_request_id, item_code_id },
        select: { id: true },
      });
      if (!inLine) {
        return NextResponse.json(
          { success: false, error: "Mã hàng không thuộc phiếu nhập đã chọn." },
          { status: 400 }
        );
      }
      lineInboundId = inbound_request_id;
    }

    // Tính toán
    const qtyBoxNum = Number(qty_box);
    const weightPerBox = itemCode.weight_per_box ? Number(itemCode.weight_per_box) : 0;
    const weightKg = qtyBoxNum * weightPerBox;
    // L2 fix: quy đổi qty_unit = qty_box × units_per_box (số lẻ/thùng)
    const unitsPerBox = itemCode.units_per_box || 1;
    const qtyUnit = qtyBoxNum * unitsPerBox;

    // Tạo dòng hàng
    const line = await prisma.palletLine.create({
      data: {
        pallet_id: id,
        item_code_id,
        inbound_request_id: lineInboundId,
        qty_box: new Prisma.Decimal(qtyBoxNum),
        qty_unit: new Prisma.Decimal(qtyUnit),
        lot: lot?.trim() || null,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        manufactured_date: manufactured_date ? new Date(manufactured_date) : null,
        weight_kg: new Prisma.Decimal(weightKg),
        note: note?.trim() || null,
      },
      include: {
        item_code: {
          select: { id: true, code: true, short_name: true, full_name: true, weight_per_box: true },
        },
      },
    });

    // Đồng bộ sang InboundTempLine (Phiếu nhập tạm) nếu pallet có liên kết
    if (pallet.inbound_temp_id) {
      await prisma.inboundTempLine.create({
        data: {
          inbound_temp_id: pallet.inbound_temp_id,
          item_code_id,
          qty_box: new Prisma.Decimal(qtyBoxNum),
          lot: lot?.trim() || null,
          expiry_date: expiry_date ? new Date(expiry_date) : null,
          note: note?.trim() || `Từ pallet ${pallet.code}`,
        },
      });
    }

    // Cập nhật totals + status trên pallet
    const agg = await prisma.palletLine.aggregate({
      where: { pallet_id: id },
      _sum: { weight_kg: true },
      _count: true,
    });

    const newStatus = pallet.status === "EMPTY" ? "COUNTING" : pallet.status;
    await prisma.pallet.update({
      where: { id },
      data: {
        total_lines: agg._count,
        total_weight_kg: agg._sum.weight_kg ?? new Prisma.Decimal(0),
        status: newStatus,
      },
    });

    // Phase 3.4: audit log thêm dòng hàng (RC-2)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "ADD_PALLET_LINE",
      new_value: {
        line_id: line.id,
        item_code: itemCode.code,
        qty_box: qtyBoxNum,
        lot: line.lot,
        expiry_date: line.expiry_date,
        weight_kg: weightKg,
        pallet_total_lines: agg._count,
      },
    });

    return NextResponse.json({ success: true, data: line, newStatus });
  } catch (error) {
    console.error("POST /api/pallets/[id]/lines error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi thêm dòng hàng." },
      { status: 500 }
    );
  }
}

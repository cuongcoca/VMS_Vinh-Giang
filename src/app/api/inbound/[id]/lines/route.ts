import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// POST /api/inbound/[id]/lines — Thêm dòng hàng vào phiếu nhập
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { item_code_id, qty_expected, lot, expiry_date, note } = body;

    // Validate bắt buộc
    if (!item_code_id) {
      return NextResponse.json(
        { success: false, error: "Phải chọn mã hàng." },
        { status: 400 }
      );
    }
    if (!qty_expected || Number(qty_expected) <= 0) {
      return NextResponse.json(
        { success: false, error: "Số lượng dự kiến phải > 0." },
        { status: 400 }
      );
    }

    // Kiểm tra phiếu nhập
    const inbound = await prisma.inboundRequest.findUnique({ where: { id } });
    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }
    if (inbound.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ được thêm dòng khi DRAFT.` },
        { status: 400 }
      );
    }

    // Kiểm tra mã hàng tồn tại
    const itemCode = await prisma.itemCode.findUnique({ where: { id: item_code_id } });
    if (!itemCode) {
      return NextResponse.json(
        { success: false, error: "Mã hàng không tồn tại." },
        { status: 400 }
      );
    }

    // Tạo dòng hàng
    const line = await prisma.inboundLine.create({
      data: {
        inbound_request_id: id,
        item_code_id,
        qty_expected: new Prisma.Decimal(Number(qty_expected)),
        lot: lot?.trim() || null,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        note: note?.trim() || null,
      },
      include: {
        item_code: {
          select: {
            id: true,
            code: true,
            short_name: true,
            full_name: true,
            unit: { select: { id: true, name: true, symbol: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: line }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inbound/[id]/lines error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi thêm dòng hàng." },
      { status: 500 }
    );
  }
}

// DELETE /api/inbound/[id]/lines — Xóa dòng hàng khỏi phiếu nhập
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { line_id } = body;

    if (!line_id) {
      return NextResponse.json(
        { success: false, error: "Thiếu line_id." },
        { status: 400 }
      );
    }

    // Kiểm tra phiếu nhập
    const inbound = await prisma.inboundRequest.findUnique({ where: { id } });
    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }
    if (inbound.status !== "DRAFT") {
      return NextResponse.json(
        { success: false, error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ được xóa dòng khi DRAFT.` },
        { status: 400 }
      );
    }

    // Kiểm tra dòng hàng thuộc phiếu này
    const line = await prisma.inboundLine.findFirst({
      where: { id: line_id, inbound_request_id: id },
    });
    if (!line) {
      return NextResponse.json(
        { success: false, error: "Dòng hàng không tồn tại hoặc không thuộc phiếu này." },
        { status: 404 }
      );
    }

    // Xóa dòng hàng
    await prisma.inboundLine.delete({ where: { id: line_id } });

    return NextResponse.json({ success: true, data: { deleted_id: line_id } });
  } catch (error) {
    console.error("DELETE /api/inbound/[id]/lines error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xóa dòng hàng." },
      { status: 500 }
    );
  }
}

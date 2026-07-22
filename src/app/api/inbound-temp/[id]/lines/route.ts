import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// POST /api/inbound-temp/[id]/lines — Thêm dòng hàng
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({ where: { id } });
    if (!temp) return NextResponse.json({ success: false, error: "Không tìm thấy phiếu." }, { status: 404 });
    if (temp.status !== "PENDING") return NextResponse.json({ success: false, error: "Phiếu không ở trạng thái chờ." }, { status: 400 });

    const body = await req.json();
    const { item_code_id, qty_box, lot, expiry_date, note } = body;
    if (!item_code_id) return NextResponse.json({ success: false, error: "Phải chọn mã hàng." }, { status: 400 });
    if (!qty_box || Number(qty_box) <= 0) return NextResponse.json({ success: false, error: "SL thùng phải > 0." }, { status: 400 });

    const itemCode = await prisma.itemCode.findUnique({ where: { id: item_code_id } });
    if (!itemCode) return NextResponse.json({ success: false, error: "Mã hàng không tồn tại." }, { status: 400 });

    const line = await prisma.inboundTempLine.create({
      data: {
        inbound_temp_id: id,
        item_code_id,
        qty_box: new Prisma.Decimal(Number(qty_box)),
        lot: lot?.trim() || null,
        expiry_date: expiry_date ? new Date(expiry_date) : null,
        note: note?.trim() || null,
      },
      include: { item_code: { select: { id: true, code: true, short_name: true } } },
    });

    return NextResponse.json({ success: true, data: line }, { status: 201 });
  } catch (error) {
    console.error("POST /api/inbound-temp/[id]/lines error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi thêm dòng hàng." }, { status: 500 });
  }
}

// DELETE /api/inbound-temp/[id]/lines — Xóa dòng hàng
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({ where: { id } });
    if (!temp) return NextResponse.json({ success: false, error: "Không tìm thấy phiếu." }, { status: 404 });
    if (temp.status !== "PENDING") return NextResponse.json({ success: false, error: "Phiếu không ở trạng thái chờ." }, { status: 400 });

    const body = await req.json();
    const { line_id } = body;
    if (!line_id) return NextResponse.json({ success: false, error: "Thiếu line_id." }, { status: 400 });

    await prisma.inboundTempLine.delete({ where: { id: line_id } });
    return NextResponse.json({ success: true, message: "Đã xóa dòng hàng." });
  } catch (error) {
    console.error("DELETE /api/inbound-temp/[id]/lines error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi xóa dòng hàng." }, { status: 500 });
  }
}

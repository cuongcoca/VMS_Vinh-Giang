import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

// PUT /api/inbound/[id]/lines/[lineId]/receive — Nhập SL thực nhận cho 1 dòng hàng
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const { id, lineId } = await params;
    const body = await req.json();
    const { qty_received, note } = body;

    // Validate SL thực nhận
    if (qty_received === null || qty_received === undefined || Number(qty_received) < 0) {
      return NextResponse.json(
        { success: false, error: "Số lượng thực nhận phải ≥ 0." },
        { status: 400 }
      );
    }

    // Kiểm tra phiếu nhập tồn tại
    const inbound = await prisma.inboundRequest.findUnique({ where: { id } });
    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    // Chỉ cho phép nhập khi RECEIVING
    if (inbound.status !== "RECEIVING") {
      return NextResponse.json(
        {
          success: false,
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ nhập SL thực nhận khi đang RECEIVING.`,
        },
        { status: 400 }
      );
    }

    // Kiểm tra dòng hàng thuộc phiếu này
    const line = await prisma.inboundLine.findFirst({
      where: { id: lineId, inbound_request_id: id },
    });
    if (!line) {
      return NextResponse.json(
        { success: false, error: "Dòng hàng không tồn tại hoặc không thuộc phiếu này." },
        { status: 404 }
      );
    }

    // Tính chênh lệch để ghi discrepancy_note tự động nếu có
    const qtyReceivedNum = Number(qty_received);
    const qtyExpectedNum = Number(line.qty_expected);
    const diff = qtyReceivedNum - qtyExpectedNum;

    // discrepancy_note chỉ chứa CHÚ THÍCH HỆ THỐNG (auto) về số chênh lệch.
    // TC_RECEIVE_IN_008/_009/_014/_028: ghi chú thủ kho nhập tay lưu RIÊNG ở cột `note`
    // (không trộn vào discrepancy_note, không bị auto-string ghi đè → cho phép nhập tự do).
    let discrepancy_note: string | null = null;
    if (diff !== 0) {
      const diffSign = diff > 0 ? "+" : "";
      discrepancy_note = `Chênh lệch: ${diffSign}${diff} (Dự kiến: ${qtyExpectedNum}, Thực nhận: ${qtyReceivedNum})`;
    }

    // Cập nhật SL thực nhận
    const updateData: Record<string, unknown> = {
      qty_received: new Prisma.Decimal(qtyReceivedNum),
      discrepancy_note: discrepancy_note,
    };

    // Ghi chú do thủ kho nhập → lưu vào cột `note` (tách khỏi auto discrepancy_note).
    // Chỉ cập nhật khi client thực sự gửi field `note` (undefined = không đụng tới).
    if (note !== undefined) {
      const noteStr = note === null ? "" : String(note).trim();
      updateData.note = noteStr || null;
    }

    const updated = await prisma.inboundLine.update({
      where: { id: lineId },
      data: updateData,
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

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/inbound/[id]/lines/[lineId]/receive error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật SL thực nhận." },
      { status: 500 }
    );
  }
}

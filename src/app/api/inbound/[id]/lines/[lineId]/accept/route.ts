import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { guardPermission } from "@/lib/auth-server";

// PUT /api/inbound/[id]/lines/[lineId]/accept — Kế toán nhập SL chấp nhận
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const { id, lineId } = await params;
    const body = await req.json();
    const { qty_accepted, discrepancy_note } = body;

    // Validate SL chấp nhận
    if (qty_accepted === null || qty_accepted === undefined || Number(qty_accepted) < 0) {
      return NextResponse.json(
        { success: false, error: "Số lượng chấp nhận phải ≥ 0." },
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

    // Chỉ cho phép khi RECONCILING
    if (inbound.status !== "RECONCILING") {
      return NextResponse.json(
        {
          success: false,
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ nhập SL chấp nhận khi đang RECONCILING.`,
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

    // Cập nhật SL chấp nhận + ghi chú chênh lệch
    const updateData: Record<string, unknown> = {
      qty_accepted: new Prisma.Decimal(Number(qty_accepted)),
    };

    // Ghi chú chênh lệch (kế toán nhập)
    if (discrepancy_note !== undefined) {
      updateData.discrepancy_note = discrepancy_note?.trim() || line.discrepancy_note;
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
    console.error("PUT /api/inbound/[id]/lines/[lineId]/accept error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi cập nhật SL chấp nhận." },
      { status: 500 }
    );
  }
}

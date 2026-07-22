import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound/[id]/finish-receiving — Thủ kho gửi đối chiếu (RECEIVING → RECONCILING)
// Sau bước này, kế toán mở phiếu trên desktop, accept từng line + /complete để chốt.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const inbound = await prisma.inboundRequest.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    if (inbound.status !== "RECEIVING") {
      return NextResponse.json(
        {
          success: false,
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ phiếu RECEIVING mới gửi đối chiếu được.`,
        },
        { status: 400 }
      );
    }

    // Bắt buộc tất cả line đã được điền qty_received (>=0)
    const linesNotReceived = inbound.lines.filter(
      (l) => l.qty_received === null || l.qty_received === undefined
    );
    if (linesNotReceived.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${linesNotReceived.length} dòng chưa được điền SL thực nhận.`,
        },
        { status: 400 }
      );
    }

    // Tổng kết chênh lệch để log
    const totalExpected = inbound.lines.reduce((s, l) => s + Number(l.qty_expected), 0);
    const totalReceived = inbound.lines.reduce((s, l) => s + Number(l.qty_received || 0), 0);
    const totalDiff = totalReceived - totalExpected;

    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: {
        status: "RECONCILING",
        // Có thể ghi note kèm chênh lệch
      },
    });

    // Notify KE_TOAN khi thủ kho gửi đối chiếu (RECEIVING → RECONCILING)
    notifyByRoles(["KE_TOAN"], {
      type: "INBOUND_SENT_FOR_RECONCILIATION",
      title: `Cần đối chiếu: ${inbound.code}`,
      body: totalDiff !== 0
        ? `Phiếu ${inbound.code} có chênh lệch (${totalDiff > 0 ? "+" : ""}${totalDiff}). Vui lòng đối chiếu.`
        : `Phiếu ${inbound.code} đã nhận đủ. Vui lòng đối chiếu và chốt.`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/ketoan/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_SENT_FOR_RECONCILIATION:", err));

    return NextResponse.json({
      success: true,
      data: updated,
      summary: {
        total_expected: totalExpected,
        total_received: totalReceived,
        total_diff: totalDiff,
        has_discrepancy: totalDiff !== 0,
      },
    });
  } catch (error) {
    console.error("POST /api/inbound/[id]/finish-receiving error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi gửi đối chiếu." },
      { status: 500 }
    );
  }
}

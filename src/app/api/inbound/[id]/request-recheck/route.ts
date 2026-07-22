import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound/[id]/request-recheck — Kế toán yêu cầu thủ kho kiểm lại
// RECONCILING → RECEIVING (rollback). Lý do ghi vào InboundRequest.note (append).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = (body?.reason as string | undefined)?.trim() || "";

    const inbound = await prisma.inboundRequest.findUnique({ where: { id } });
    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    if (inbound.status !== "RECONCILING") {
      return NextResponse.json(
        {
          success: false,
          error: `Chỉ phiếu RECONCILING mới yêu cầu kiểm lại được. Hiện tại: "${inbound.status}".`,
        },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập lý do yêu cầu kiểm lại." },
        { status: 400 }
      );
    }

    // Append reason vào note
    const timestamp = new Date().toLocaleString("vi-VN");
    const recheckNote = `[${timestamp}] Kế toán yêu cầu kiểm lại: ${reason}`;
    const newNote = inbound.note ? `${inbound.note}\n${recheckNote}` : recheckNote;

    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: {
        status: "RECEIVING",
        note: newNote,
        // Reset reconciled_at vì đã rollback
        reconciled_at: null,
      },
    });

    // Notify THU_KHO khi kế toán yêu cầu kiểm lại (RECONCILING → RECEIVING)
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_RECHECK_REQUESTED",
      title: `Yêu cầu kiểm lại: ${inbound.code}`,
      body: `Kế toán yêu cầu kiểm lại phiếu ${inbound.code}. Lý do: ${reason}`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/thukho/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_RECHECK_REQUESTED:", err));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("POST /api/inbound/[id]/request-recheck error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi yêu cầu kiểm lại." },
      { status: 500 }
    );
  }
}

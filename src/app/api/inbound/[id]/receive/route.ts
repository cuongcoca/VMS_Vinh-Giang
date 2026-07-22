import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound/[id]/receive — Bắt đầu tiếp nhận (PENDING → RECEIVING)
export async function POST(
  req: NextRequest,
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

    if (inbound.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ phiếu PENDING mới bắt đầu tiếp nhận được.`,
        },
        { status: 400 }
      );
    }

    if (!inbound.lines || inbound.lines.length === 0) {
      return NextResponse.json(
        { success: false, error: "Phiếu chưa có dòng hàng nào." },
        { status: 400 }
      );
    }

    // Optional: nhận prep_zone_ready từ thủ kho (UC-IN-02)
    let prepZoneReady: boolean | undefined = undefined;
    try {
      const body = await req.json();
      if (typeof body?.prep_zone_ready === "boolean") prepZoneReady = body.prep_zone_ready;
    } catch { /* body optional */ }

    const actor = getRequestActor(req);
    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: {
        status: "RECEIVING",
        received_at: new Date(),
        received_by: actor.userId ?? undefined,
        ...(prepZoneReady !== undefined ? { prep_zone_ready: prepZoneReady } : {}),
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { created_at: "asc" },
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
        },
      },
    });

    await logAudit(req, {
      entity_type: "inbound_request",
      entity_id: id,
      action: "START_RECEIVING",
      old_value: { status: "PENDING" },
      new_value: {
        status: "RECEIVING",
        prep_zone_ready: prepZoneReady ?? null,
      },
    });

    // Notify KE_TOAN khi thủ kho bắt đầu tiếp nhận (PENDING → RECEIVING)
    notifyByRoles(["KE_TOAN"], {
      type: "INBOUND_RECEIVING_STARTED",
      title: `Đang nhận hàng: ${updated.code}`,
      body: `Thủ kho đã bắt đầu tiếp nhận phiếu ${updated.code} (${updated.lines.length} dòng hàng).`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/ketoan/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_RECEIVING_STARTED:", err));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("POST /api/inbound/[id]/receive error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi bắt đầu tiếp nhận." },
      { status: 500 }
    );
  }
}

// PUT /api/inbound/[id]/receive — Hoàn tất tiếp nhận (RECEIVING → RECONCILING)
export async function PUT(
  req: NextRequest,
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
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ phiếu RECEIVING mới hoàn tất tiếp nhận được.`,
        },
        { status: 400 }
      );
    }

    // Kiểm tra tất cả dòng đều có qty_received
    const linesWithoutReceived = inbound.lines.filter(
      (line) => line.qty_received === null || line.qty_received === undefined
    );
    if (linesWithoutReceived.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${linesWithoutReceived.length} dòng hàng chưa nhập số lượng thực nhận.`,
        },
        { status: 400 }
      );
    }

    const actor = getRequestActor(req);
    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: {
        status: "RECONCILING",
        reconciled_at: new Date(),
        reconciled_by: actor.userId ?? undefined,
      },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          orderBy: { created_at: "asc" },
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
        },
      },
    });

    await logAudit(req, {
      entity_type: "inbound_request",
      entity_id: id,
      action: "COMPLETE_RECEIVING",
      old_value: { status: "RECEIVING" },
      new_value: {
        status: "RECONCILING",
        total_expected: inbound.lines.reduce((s, l) => s + Number(l.qty_expected), 0),
        total_received: inbound.lines.reduce((s, l) => s + Number(l.qty_received || 0), 0),
      },
    });

    // Notify KE_TOAN khi thủ kho hoàn tất tiếp nhận (RECEIVING → RECONCILING)
    notifyByRoles(["KE_TOAN"], {
      type: "INBOUND_SENT_FOR_RECONCILIATION",
      title: `Cần đối chiếu: ${updated.code}`,
      body: `Thủ kho đã hoàn tất tiếp nhận phiếu ${updated.code}. Vui lòng đối chiếu SL thực nhận.`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/ketoan/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_SENT_FOR_RECONCILIATION:", err));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("PUT /api/inbound/[id]/receive error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi hoàn tất tiếp nhận." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound/[id]/complete — Chốt phiếu nhập (RECONCILING → COMPLETED)
//
// Phase 1.1 (BUG_REPORT TC_CLOSE_IN_006/_010/_015):
//   Trước fix: API chỉ update inbound_request.status = COMPLETED. Pallet thuộc
//   phiếu vẫn COUNTING/CONFIRMED → query tồn kho filter IN_STORAGE/IN_STAGING
//   không thấy → tồn kho không lên.
//   Sau fix:
//     1) Block chốt nếu còn pallet COUNTING/EMPTY (chưa xác nhận).
//     2) Mọi pallet ≥ CONFIRMED tự tính tồn kho (qua STOCK_PALLET_STATUSES).
//     3) Audit log đầy đủ qua helper (role/IP/UA — RC-2).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const closeNote = ((body?.close_note as string) || "").trim();
    // Sprint A · P4-005: nhận thêm `discrepancy_decision` để lưu quyết định xử lý chênh lệch.
    // Schema InboundRequest.discrepancy_decision: ACCEPT | REVIEW_AGAIN | CREATE_ADJUSTMENT.
    const validDecisions = ["ACCEPT", "REVIEW_AGAIN", "CREATE_ADJUSTMENT"] as const;
    type DiscrepancyDecision = (typeof validDecisions)[number];
    const rawDecision = body?.discrepancy_decision as string | null | undefined;
    let discrepancyDecision: DiscrepancyDecision | null = null;
    if (rawDecision) {
      if (!validDecisions.includes(rawDecision as DiscrepancyDecision)) {
        return NextResponse.json(
          {
            success: false,
            error: `Quyết định xử lý chênh lệch không hợp lệ. Chấp nhận: ${validDecisions.join(", ")}`,
          },
          { status: 400 }
        );
      }
      discrepancyDecision = rawDecision as DiscrepancyDecision;
    }
    const actor = getRequestActor(req);

    const inbound = await prisma.inboundRequest.findUnique({
      where: { id },
      include: {
        lines: true,
        pallets: {
          select: { id: true, code: true, status: true, total_lines: true },
        },
      },
    });

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
          error: `Phiếu đang ở trạng thái "${inbound.status}" — chỉ phiếu RECONCILING mới chốt được.`,
        },
        { status: 400 }
      );
    }

    // Kiểm tra tất cả dòng đều có qty_accepted
    const linesWithoutAccepted = inbound.lines.filter(
      (line) => line.qty_accepted === null || line.qty_accepted === undefined
    );
    if (linesWithoutAccepted.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${linesWithoutAccepted.length} dòng hàng chưa nhập SL chấp nhận. Vui lòng hoàn tất đối chiếu trước khi chốt.`,
        },
        { status: 400 }
      );
    }

    // UC-IN-04: Bắt buộc close_note nếu có chênh lệch giữa expected và accepted
    const hasDiscrepancy = inbound.lines.some(
      (l) => Number(l.qty_accepted || 0) !== Number(l.qty_expected)
    );
    if (hasDiscrepancy && !closeNote) {
      return NextResponse.json(
        {
          success: false,
          error: "Phiếu có chênh lệch — phải nhập 'Ghi chú khi chốt' để truy vết.",
        },
        { status: 400 }
      );
    }

    // Phase 1.1: chặn chốt nếu còn pallet COUNTING/EMPTY (chưa hoàn tất đếm/xác nhận)
    const unfinishedPallets = inbound.pallets.filter(
      (p) => p.status === "COUNTING" || p.status === "EMPTY"
    );
    if (unfinishedPallets.length > 0) {
      const codes = unfinishedPallets.map((p) => p.code).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: `Còn ${unfinishedPallets.length} pallet chưa xác nhận: ${codes}. Hoàn tất xác nhận pallet trước khi chốt phiếu.`,
          data: {
            unfinished_pallets: unfinishedPallets.map((p) => ({
              id: p.id,
              code: p.code,
              status: p.status,
            })),
          },
        },
        { status: 400 }
      );
    }

    const palletSummary = {
      total: inbound.pallets.length,
      confirmed: inbound.pallets.filter((p) => p.status === "CONFIRMED").length,
      in_storage: inbound.pallets.filter((p) => p.status === "IN_STORAGE").length,
      in_staging: inbound.pallets.filter((p) => p.status === "IN_STAGING").length,
    };

    // Cập nhật phiếu — wrap audit log trong transaction để rollback nếu lỗi
    const updated = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updated = await tx.inboundRequest.update({
        where: { id },
        data: {
          status: "COMPLETED",
          completed_at: now,
          closed_at: now,
          closed_by: actor.userId ?? undefined,
          close_note: closeNote || null,
          discrepancy_decision: discrepancyDecision,
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
          pallets: {
            select: { id: true, code: true, status: true, location_id: true },
          },
        },
      });

      await logAudit(
        req,
        {
          entity_type: "inbound_request",
          entity_id: id,
          action: "COMPLETE_INBOUND",
          old_value: { status: "RECONCILING" },
          new_value: {
            status: "COMPLETED",
            total_lines: inbound.lines.length,
            total_expected: inbound.lines.reduce(
              (s, l) => s + Number(l.qty_expected),
              0
            ),
            total_received: inbound.lines.reduce(
              (s, l) => s + Number(l.qty_received || 0),
              0
            ),
            total_accepted: inbound.lines.reduce(
              (s, l) => s + Number(l.qty_accepted || 0),
              0
            ),
            pallet_summary: palletSummary,
            discrepancy_decision: discrepancyDecision,
          },
          reason: closeNote || null,
        },
        tx
      );

      return updated;
    });

    // Notify THU_KHO khi kế toán chốt phiếu (RECONCILING → COMPLETED)
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_COMPLETED",
      title: `Phiếu nhập đã chốt: ${updated.code}`,
      body: `Kế toán đã chốt phiếu ${updated.code}. ${palletSummary.confirmed} pallet sẵn sàng vào tồn kho.`,
      entity_type: "inbound_request",
      entity_id: id,
      link_url: `/thukho/inbound/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_COMPLETED:", err));

    return NextResponse.json({
      success: true,
      data: updated,
      pallet_summary: palletSummary,
      message: `Phiếu ${updated.code} đã chốt. ${palletSummary.confirmed} pallet đã sẵn sàng vào tồn kho, ${palletSummary.in_storage} đã xếp vị trí.`,
    });
  } catch (error) {
    console.error("POST /api/inbound/[id]/complete error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi chốt phiếu nhập kho." },
      { status: 500 }
    );
  }
}

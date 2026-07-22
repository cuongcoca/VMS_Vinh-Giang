import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound-temp/[id]/standardize — Chuẩn hóa phiếu tạm
//
// Phase 4.2 — TC_STD_TMP_003: hỗ trợ 2 lựa chọn liên kết:
//   - mode="create" (default): tạo phiếu nhập chính thức mới (hồi tố)
//   - mode="link":   liên kết với phiếu YC nhập đang mở (PENDING/RECEIVING/
//                    RECONCILING), append lines từ phiếu tạm.
//
// Body:
//   { mode?: "create" | "link", inbound_request_id?: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const mode = (body?.mode as string) || "create";
    const targetInboundId = (body?.inbound_request_id as string) || "";
    const actor = getRequestActor(req);

    const temp = await prisma.inboundTemp.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!temp) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiếu tạm." }, { status: 404 });
    }
    if (temp.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Phiếu không ở trạng thái chờ chuẩn hóa." }, { status: 400 });
    }
    if (temp.lines.length === 0) {
      return NextResponse.json({ success: false, error: "Phiếu phải có ít nhất 1 dòng hàng." }, { status: 400 });
    }

    // ═══════════════════════════════════════════════
    // MODE = LINK: liên kết phiếu YC nhập đang mở
    // ═══════════════════════════════════════════════
    if (mode === "link") {
      if (!targetInboundId) {
        return NextResponse.json(
          { success: false, error: "Phải chọn phiếu YC nhập để liên kết (inbound_request_id)." },
          { status: 400 }
        );
      }

      const targetInbound = await prisma.inboundRequest.findUnique({
        where: { id: targetInboundId },
      });
      if (!targetInbound) {
        return NextResponse.json(
          { success: false, error: "Phiếu YC nhập không tồn tại." },
          { status: 404 }
        );
      }
      if (!["DRAFT", "PENDING", "RECEIVING", "RECONCILING"].includes(targetInbound.status)) {
        return NextResponse.json(
          {
            success: false,
            error: `Phiếu ${targetInbound.code} đang ở trạng thái "${targetInbound.status}" — chỉ phiếu chưa chốt mới link được.`,
          },
          { status: 400 }
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        await tx.inboundLine.createMany({
          data: temp.lines.map((line) => ({
            inbound_request_id: targetInboundId,
            item_code_id: line.item_code_id,
            qty_expected: line.qty_box,
            lot: line.lot,
            expiry_date: line.expiry_date,
            note: line.note,
          })),
        });

        // Tự động gán inbound_request_id cho các pallet thuộc phiếu tạm này
        await tx.pallet.updateMany({
          where: { inbound_temp_id: id },
          data: { inbound_request_id: targetInboundId },
        });

        const t = await tx.inboundTemp.update({
          where: { id },
          data: {
            status: "STANDARDIZED",
            standardized_at: new Date(),
            standardized_by: actor.userId ?? undefined,
            inbound_request_id: targetInboundId,
          },
        });
        return t;
      });

      const targetInboundWithLines = await prisma.inboundRequest.findUnique({
        where: { id: targetInboundId },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          lines: { include: { item_code: { select: { id: true, code: true, short_name: true } } } },
        },
      });

      await logAudit(req, {
        entity_type: "inbound_temp",
        entity_id: id,
        action: "STANDARDIZE_LINK_INBOUND",
        old_value: { status: "PENDING", code: temp.code },
        new_value: {
          status: "STANDARDIZED",
          mode: "link",
          inbound_request_id: targetInboundId,
          inbound_code: targetInbound.code,
          lines_appended: temp.lines.length,
        },
        reason: `Liên kết ${temp.code} → ${targetInbound.code} (append ${temp.lines.length} dòng)`,
      });

      // Notify THU_KHO khi kế toán chuẩn hóa phiếu tạm (mode=link)
      notifyByRoles(["THU_KHO"], {
        type: "INBOUND_TEMP_STANDARDIZED",
        title: `Phiếu tạm đã chuẩn hóa: ${temp.code}`,
        body: `Đã liên kết ${temp.code} với phiếu nhập ${targetInbound.code} (+${temp.lines.length} dòng hàng).`,
        entity_type: "inbound_temp",
        entity_id: id,
        link_url: `/thukho/inbound-temp/${id}`,
      }).catch((err) => console.error("notifyByRoles INBOUND_TEMP_STANDARDIZED:", err));

      return NextResponse.json({
        success: true,
        data: targetInboundWithLines,
        mode: "link",
        message: `Đã liên kết ${temp.code} với phiếu nhập ${targetInbound.code} (+${temp.lines.length} dòng hàng).`,
        temp_status: updated.status,
      });
    }

    // ═══════════════════════════════════════════════
    // MODE = CREATE (default): tạo phiếu nhập mới (hồi tố)
    // ═══════════════════════════════════════════════
    const year = new Date().getFullYear();
    const maxSeq = await prisma.inboundRequest.aggregate({
      where: { code_year: year },
      _max: { code_seq: true },
    });
    const nextSeq = (maxSeq._max.code_seq ?? 0) + 1;
    const pnkCode = `PHN-${year}-${String(nextSeq).padStart(4, "0")}`;

    const [newInbound] = await prisma.$transaction([
      prisma.inboundRequest.create({
        data: {
          code: pnkCode,
          code_year: year,
          code_seq: nextSeq,
          status: "DRAFT",
          supplier_id: temp.supplier_id,
          note: temp.note ? `[Từ PTT ${temp.code}] ${temp.note}` : `Chuẩn hóa từ phiếu tạm ${temp.code}`,
          lines: {
            create: temp.lines.map((line) => ({
              item_code_id: line.item_code_id,
              qty_expected: line.qty_box,
              lot: line.lot,
              expiry_date: line.expiry_date,
              note: line.note,
            })),
          },
        },
        include: {
          supplier: { select: { id: true, code: true, name: true } },
          lines: { include: { item_code: { select: { id: true, code: true, short_name: true } } } },
        },
      }),
      prisma.inboundTemp.update({
        where: { id },
        data: {
          status: "STANDARDIZED",
          standardized_at: new Date(),
          standardized_by: actor.userId ?? undefined,
        },
      }),
    ]);

    // Link inbound_request_id sau khi đã tạo và tự động liên kết các pallet
    await prisma.$transaction([
      prisma.inboundTemp.update({
        where: { id },
        data: { inbound_request_id: newInbound.id },
      }),
      prisma.pallet.updateMany({
        where: { inbound_temp_id: id },
        data: { inbound_request_id: newInbound.id },
      }),
    ]);

    await logAudit(req, {
      entity_type: "inbound_temp",
      entity_id: id,
      action: "STANDARDIZE_CREATE_INBOUND",
      old_value: { status: "PENDING", code: temp.code },
      new_value: {
        status: "STANDARDIZED",
        mode: "create",
        inbound_request_id: newInbound.id,
        inbound_code: pnkCode,
      },
      reason: `Chuẩn hóa ${temp.code} → tạo mới ${pnkCode} (${temp.lines.length} dòng)`,
    });

    // Notify THU_KHO khi kế toán chuẩn hóa phiếu tạm (mode=create)
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_TEMP_STANDARDIZED",
      title: `Phiếu tạm đã chuẩn hóa: ${temp.code}`,
      body: `Đã tạo phiếu nhập ${pnkCode} từ phiếu tạm ${temp.code} (${temp.lines.length} dòng hàng).`,
      entity_type: "inbound_temp",
      entity_id: id,
      link_url: `/thukho/inbound-temp/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_TEMP_STANDARDIZED:", err));

    return NextResponse.json({
      success: true,
      data: newInbound,
      mode: "create",
      message: `Đã tạo phiếu nhập ${pnkCode} từ phiếu tạm ${temp.code}.`,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("POST /api/inbound-temp/[id]/standardize Prisma error:", error.code, error.message);
    } else {
      console.error("POST /api/inbound-temp/[id]/standardize error:", error);
    }
    return NextResponse.json({ success: false, error: "Lỗi khi chuẩn hóa phiếu tạm." }, { status: 500 });
  }
}

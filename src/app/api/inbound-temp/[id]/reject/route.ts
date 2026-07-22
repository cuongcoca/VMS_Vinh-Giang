import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/inbound-temp/[id]/reject — Từ chối phiếu tạm
//
// Phase 4.2 — TC_STD_TMP_023: lưu lý do từ chối vào DB (column
// reject_reason mới) thay vì chỉ ghi audit log để truy vết lâu dài.
// Audit log qua helper Phase 2 (role/IP/UA).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({ where: { id } });
    if (!temp) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu tạm." },
        { status: 404 }
      );
    }
    if (temp.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Phiếu không ở trạng thái chờ." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const reason = (body.reason as string)?.trim() || "";
    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { success: false, error: "Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự)." },
        { status: 400 }
      );
    }

    const actor = getRequestActor(req);

    const updated = await prisma.inboundTemp.update({
      where: { id },
      data: {
        status: "REJECTED",
        reject_reason: reason,
        rejected_at: new Date(),
        rejected_by: actor.userId ?? undefined,
      },
    });

    await logAudit(req, {
      entity_type: "inbound_temp",
      entity_id: id,
      action: "REJECT_INBOUND_TEMP",
      old_value: { status: "PENDING" },
      new_value: { status: "REJECTED", reject_reason: reason },
      reason,
    });

    // Notify THU_KHO khi kế toán từ chối phiếu tạm
    notifyByRoles(["THU_KHO"], {
      type: "INBOUND_TEMP_REJECTED",
      title: `Phiếu tạm bị từ chối: ${temp.code}`,
      body: `Kế toán đã từ chối phiếu tạm ${temp.code}. Lý do: ${reason}`,
      entity_type: "inbound_temp",
      entity_id: id,
      link_url: `/thukho/inbound-temp/${id}`,
    }).catch((err) => console.error("notifyByRoles INBOUND_TEMP_REJECTED:", err));

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Đã từ chối phiếu ${temp.code}.`,
    });
  } catch (error) {
    console.error("POST /api/inbound-temp/[id]/reject error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi từ chối phiếu tạm." },
      { status: 500 }
    );
  }
}

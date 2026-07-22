import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/outbound/release — DEMO XUẤT KHO ĐƠN GIẢN (UC-OUT-05_TC09).
// Khách chưa chốt quy trình xuất kho chính thức → bản demo tối giản:
//   pallet đang ở Khu chờ xuất (IN_STAGING) → "Xuất kho" → RELEASED (đã rời kho)
//   → tồn kho (đếm IN_STORAGE + IN_STAGING) TỰ ĐỘNG giảm vì pallet không còn trong kho.
// Giải phóng vị trí (nếu có) + ghi Movement type=SHIP (UC-FK-06_TC19: hiện trong
// Lịch sử luân chuyển) + audit (kèm user).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pallet_id } = body;
    if (!pallet_id) {
      return NextResponse.json({ success: false, error: "Thiếu pallet_id." }, { status: 400 });
    }

    const pallet = await prisma.pallet.findUnique({
      where: { id: pallet_id },
      include: { lines: true },
    });
    if (!pallet) {
      return NextResponse.json({ success: false, error: "Không tìm thấy pallet." }, { status: 404 });
    }
    if (pallet.status !== "IN_STAGING") {
      return NextResponse.json(
        { success: false, error: `Chỉ xuất kho pallet đang ở Khu chờ xuất. Trạng thái hiện tại: "${pallet.status}".` },
        { status: 400 }
      );
    }

    // RC6/Q4: chặn xuất lẻ nếu pallet chứa mã hàng đang được GIỮ CHỖ cho một phiếu yêu cầu xuất đang mở (PICKING).
    const palletItemIds = [...new Set(pallet.lines.map((l) => l.item_code_id))];
    if (palletItemIds.length > 0) {
      const reservedLine = await prisma.outboundRequestLine.findFirst({
        where: { item_code_id: { in: palletItemIds }, qty_reserved: { gt: 0 }, outbound_request: { status: "PICKING" } },
        include: { outbound_request: { select: { code: true } }, item_code: { select: { code: true } } },
      });
      if (reservedLine) {
        return NextResponse.json(
          { success: false, error: `Pallet chứa mã ${reservedLine.item_code.code} đang được giữ chỗ cho phiếu ${reservedLine.outbound_request.code}. Hãy xuất qua phiếu PYX thay vì xuất lẻ.` },
          { status: 409 }
        );
      }
    }

    const totalQty = pallet.lines.reduce((s, l) => s + Number(l.qty_box), 0);
    const oldLocationId = pallet.location_id;
    const actor = getRequestActor(req);
    let shipMovementId: string | null = null;

    await prisma.$transaction(async (tx) => {
      await tx.pallet.update({
        where: { id: pallet_id },
        data: { status: "RELEASED" },
      });
      // Giải phóng vị trí nếu pallet đang chiếm 1 ô vật lý
      if (oldLocationId) {
        await tx.location.update({ where: { id: oldLocationId }, data: { status: "EMPTY" } });
      }
      // UC-FK-06_TC19: ghi Movement 'SHIP' để sự kiện xuất kho hiện trong Lịch sử luân chuyển.
      const shipMv = await tx.movement.create({
        data: {
          pallet_id,
          movement_type: "SHIP",
          from_location_id: oldLocationId,
          to_location_id: null,
          qty_box: new Prisma.Decimal(totalQty),
          mode: "FULL",
          reason: `Xuất kho ${pallet.code} (${totalQty} thùng) — rời kho.`,
          performed_by: actor.userId ?? undefined,
        },
        select: { id: true },
      });
      shipMovementId = shipMv.id;
    });

    const shipAudit = await logAudit(req, {
      entity_type: "pallet",
      entity_id: pallet_id,
      action: "SHIP",
      old_value: { status: "IN_STAGING", total_qty: totalQty },
      new_value: { status: "RELEASED", qty_box: totalQty },
      reason: `Xuất kho pallet ${pallet.code} (${totalQty} thùng) — tồn kho đã trừ.`,
    });
    // Gắn audit vào movement SHIP để truy vết (cùng pattern UC-FK-06_TC20).
    if (shipMovementId && shipAudit?.id) {
      await prisma.movement.update({
        where: { id: shipMovementId },
        data: { audit_log_id: shipAudit.id },
      });
    }

    // Notify THU_KHO, KE_TOAN khi xuất kho pallet
    notifyByRoles(["THU_KHO", "KE_TOAN"], {
      type: "PALLET_RELEASED",
      title: `Xuất kho: ${pallet.code}`,
      body: `Đã xuất kho pallet ${pallet.code} (${totalQty} thùng). Tồn kho đã trừ.`,
      entity_type: "pallet",
      entity_id: pallet_id,
    }).catch((err) => console.error("notifyByRoles PALLET_RELEASED:", err));

    return NextResponse.json({
      success: true,
      message: `Đã xuất kho pallet ${pallet.code}. Tồn kho đã trừ ${totalQty} thùng.`,
    });
  } catch (error) {
    console.error("POST /api/outbound/release error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi xuất kho." }, { status: 500 });
  }
}

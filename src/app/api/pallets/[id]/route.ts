import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// GET /api/pallets/[id] — Chi tiết pallet
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "read");
  if (denied) return denied;
  try {
    const { id } = await params;
    const pallet = await prisma.pallet.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, zone: true, rack: true, level: true, status: true } },
        inbound_request: { select: { id: true, code: true } },  // UC-PAL-01: link PHN
        lines: {
          include: {
            item_code: {
              select: {
                id: true, code: true, short_name: true, full_name: true, weight_per_box: true,
                unit: { select: { id: true, name: true, symbol: true } },
              },
            },
            // Hướng A: dòng thuộc phiếu nào — để hiển thị nhóm theo phiếu + biết PHN của pallet.
            inbound_request: { select: { id: true, code: true, invoice_no: true } },
          },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: pallet });
  } catch (error) {
    console.error("GET /api/pallets/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải pallet." },
      { status: 500 }
    );
  }
}

// DELETE /api/pallets/[id] — Hủy pallet (set status = CANCELLED)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "special");
  if (denied) return denied;
  try {
    const { id } = await params;
    const pallet = await prisma.pallet.findUnique({ where: { id } });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }
    if (pallet.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "Pallet đã bị hủy trước đó." },
        { status: 400 }
      );
    }
    if (pallet.status === "IN_STORAGE" || pallet.status === "IN_STAGING") {
      return NextResponse.json(
        { success: false, error: `Pallet đang ở trạng thái ${pallet.status} — không thể hủy.` },
        { status: 400 }
      );
    }

    const updated = await prisma.pallet.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Phase 3.4: audit log hủy pallet (RC-2)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "CANCEL_PALLET",
      old_value: { status: pallet.status, code: pallet.code },
      new_value: { status: "CANCELLED" },
    });

    // Notify XE_NANG khi pallet bị hủy
    notifyByRoles(["XE_NANG"], {
      type: "PALLET_CANCELLED",
      title: `Pallet đã hủy: ${pallet.code}`,
      body: `Pallet ${pallet.code} đã bị hủy.`,
      entity_type: "pallet",
      entity_id: id,
    }).catch((err) => console.error("notifyByRoles PALLET_CANCELLED:", err));

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error("DELETE /api/pallets/[id] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi hủy pallet." },
      { status: 500 }
    );
  }
}

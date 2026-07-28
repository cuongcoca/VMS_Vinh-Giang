import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission, apiErrorResponse } from "@/lib/auth-server";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/adjustments/[id]/reject — Từ chối phiếu điều chỉnh
// UC-INV-09-TC17: chỉ Quản lý (+ super-role) · TC12/TC18: bắt buộc nhập lý do từ chối · TC11: audit người thực hiện
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requirePermission(req, "inventory", "special");
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const rejected_reason = (body?.rejected_reason || "").trim();
    if (!rejected_reason) {
      return NextResponse.json({ success: false, error: "Vui lòng nhập lý do từ chối." }, { status: 400 });
    }

    const voucher = await prisma.adjustmentVoucher.findUnique({ where: { id } });
    if (!voucher) return NextResponse.json({ success: false, error: "Không tìm thấy." }, { status: 404 });
    if (voucher.status !== "PENDING") {
      return NextResponse.json({ success: false, error: `Phiếu đã ${voucher.status}.` }, { status: 400 });
    }

    const updated = await prisma.adjustmentVoucher.update({
      where: { id },
      data: { status: "REJECTED", rejected_reason },
    });

    await prisma.auditLog.create({
      data: {
        entity_type: "adjustment",
        entity_id: id,
        action: "REJECT",
        reason: rejected_reason,
        performed_by: user.id,
        performed_by_role: user.role,
      },
    });

    // Notify THU_KHO khi phiếu điều chỉnh bị từ chối (giữ tính năng Push của 42)
    notifyByRoles(["THU_KHO"], {
      type: "ADJUSTMENT_REJECTED",
      title: `Phiếu điều chỉnh bị từ chối: ${voucher.code}`,
      body: `Kế toán đã từ chối phiếu điều chỉnh ${voucher.code}. Lý do: ${rejected_reason}`,
      entity_type: "adjustment_voucher",
      entity_id: id,
      link_url: `/thukho/warehouse/movements`,
    }).catch((err) => console.error("notifyByRoles ADJUSTMENT_REJECTED:", err));

    return NextResponse.json({ success: true, data: updated, message: "Phiếu đã bị từ chối." });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

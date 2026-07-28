import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { guardPermission } from "@/lib/auth-server";

// POST /api/pallets/[id]/unlock — Mở lại pallet đã CONFIRMED (bắt buộc lý do)
//
// Phase 3.4 (BUG_REPORT TC_EDIT_PAL_008/_013/_014/_018/_020):
//   - Audit log ghi qua helper → có role/IP/UA + reason.
//   - Lưu old/new status + confirmed_by/at để truy vết đầy đủ.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    // Validate lý do bắt buộc
    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "Lý do mở lại phải có ít nhất 5 ký tự." },
        { status: 400 }
      );
    }

    // Lấy pallet
    const pallet = await prisma.pallet.findUnique({ where: { id } });
    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }

    // Chỉ CONFIRMED mới unlock được
    if (pallet.status !== "CONFIRMED") {
      return NextResponse.json(
        { success: false, error: `Chỉ pallet đã xác nhận mới có thể mở lại. Trạng thái hiện tại: "${pallet.status}".` },
        { status: 400 }
      );
    }

    const previousConfirmedAt = pallet.confirmed_at;
    const previousConfirmedBy = pallet.confirmed_by;

    // Cập nhật trạng thái
    const updated = await prisma.pallet.update({
      where: { id },
      data: {
        status: "COUNTING",
        confirmed_at: null,
        confirmed_by: null,
      },
    });

    // Phase 3.4: ghi audit log đầy đủ qua helper (RC-2 — role/IP/UA)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "UNLOCK_PALLET",
      old_value: {
        status: "CONFIRMED",
        confirmed_at: previousConfirmedAt,
        confirmed_by: previousConfirmedBy,
      },
      new_value: {
        status: "COUNTING",
        confirmed_at: null,
        confirmed_by: null,
      },
      reason: reason.trim(),
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Pallet ${pallet.code} đã mở lại để chỉnh sửa.`,
    });
  } catch (error) {
    console.error("POST /api/pallets/[id]/unlock error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi mở lại pallet." },
      { status: 500 }
    );
  }
}

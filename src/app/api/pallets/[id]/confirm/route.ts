import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestActor, logAudit } from "@/lib/audit";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// POST /api/pallets/[id]/confirm — Xác nhận pallet (COUNTING → CONFIRMED)
//
// Phase 3.4 — audit log đầy đủ qua helper, set confirmed_by từ JWT.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "pallet", "special");
  if (denied) return denied;
  try {
    const { id } = await params;
    const actor = getRequestActor(req);
    // TC_CONFIRM_PAL_006: cho phép nhập "Tổng trọng lượng ước tính" lúc xác nhận.
    const body = await req.json().catch(() => ({}));
    const rawWeight = (body as { total_weight_kg?: unknown }).total_weight_kg;

    // Lấy pallet + đếm lines
    const pallet = await prisma.pallet.findUnique({
      where: { id },
      include: { _count: { select: { lines: true } } },
    });

    if (!pallet) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy pallet." },
        { status: 404 }
      );
    }

    // Chỉ COUNTING mới confirm được
    if (pallet.status !== "COUNTING") {
      const msgMap: Record<string, string> = {
        EMPTY: "Pallet chưa có hàng, không thể xác nhận. Hãy thêm dòng hàng trước.",
        CONFIRMED: "Pallet đã được xác nhận rồi.",
        IN_STORAGE: "Pallet đã trong kho, không cần xác nhận lại.",
        IN_STAGING: "Pallet đang ở khu chờ xuất.",
        RELEASED: "Pallet đã xuất kho.",
        CANCELLED: "Pallet đã bị hủy.",
      };
      return NextResponse.json(
        { success: false, error: msgMap[pallet.status] || `Không thể xác nhận pallet ở trạng thái "${pallet.status}".` },
        { status: 400 }
      );
    }

    // Kiểm tra có ít nhất 1 dòng hàng
    if (pallet._count.lines === 0) {
      return NextResponse.json(
        { success: false, error: "Pallet phải có ít nhất 1 dòng hàng để xác nhận." },
        { status: 400 }
      );
    }

    // Cập nhật trạng thái + confirmed_by từ JWT
    const confirmData: Record<string, unknown> = {
      status: "CONFIRMED",
      confirmed_at: new Date(),
      confirmed_by: actor.userId ?? undefined,
    };
    // TC_CONFIRM_PAL_006: nếu thủ kho nhập Tổng trọng lượng ước tính → lưu (ghi đè auto-sum).
    if (rawWeight !== undefined && rawWeight !== null && rawWeight !== "") {
      const w = Number(rawWeight);
      if (isNaN(w) || w < 0) {
        return NextResponse.json(
          { success: false, error: "Tổng trọng lượng ước tính phải là số ≥ 0." },
          { status: 400 }
        );
      }
      confirmData.total_weight_kg = w;
    }

    const updated = await prisma.pallet.update({
      where: { id },
      data: confirmData,
    });

    // Phase 3.4: audit log đầy đủ qua helper (RC-2)
    await logAudit(req, {
      entity_type: "pallet",
      entity_id: id,
      action: "CONFIRM_PALLET",
      old_value: { status: "COUNTING" },
      new_value: {
        status: "CONFIRMED",
        total_lines: pallet._count.lines,
        total_weight_kg: pallet.total_weight_kg,
      },
      reason: `Xác nhận pallet ${pallet.code} — ${pallet._count.lines} dòng hàng, ${pallet.total_weight_kg} kg`,
    });

    // Notify XE_NANG khi pallet được xác nhận (COUNTING → CONFIRMED)
    notifyByRoles(["XE_NANG"], {
      type: "PALLET_CONFIRMED",
      title: `Pallet sẵn sàng: ${pallet.code}`,
      body: `Pallet ${pallet.code} đã xác nhận (${pallet._count.lines} dòng hàng). Sẵn sàng xếp vào kho.`,
      entity_type: "pallet",
      entity_id: id,
      link_url: `/xenang/tasks`,
    }).catch((err) => console.error("notifyByRoles PALLET_CONFIRMED:", err));

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Pallet ${pallet.code} đã xác nhận thành công. Sẵn sàng cho xe nâng.`,
    });
  } catch (error) {
    console.error("POST /api/pallets/[id]/confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi xác nhận pallet." },
      { status: 500 }
    );
  }
}

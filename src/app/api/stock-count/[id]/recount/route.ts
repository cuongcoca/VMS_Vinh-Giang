import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth-server";
import { notifyByRoles } from "@/lib/notifications";

// POST /api/stock-count/[id]/recount — Yêu cầu kiểm lại các dòng chênh lệch
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Xác thực người dùng (Quản lý/Kế toán có quyền xử lý chênh lệch)
    await requirePermission(req, "stock_count", "write");
    const body = await req.json();
    const { recounts } = body as { recounts: Array<{ count_id: string; note: string }> };

    if (!recounts || !Array.isArray(recounts) || recounts.length === 0) {
      return NextResponse.json({ success: false, error: "Thiếu danh sách dòng kiểm lại." }, { status: 400 });
    }

    const session = await prisma.stocktakeSession.findUnique({
      where: { id },
      include: { counts: true },
    });
    if (!session) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiên kiểm kê." }, { status: 404 });
    }

    // Reset các dòng chỉ định trong transaction
    await prisma.$transaction(async (tx) => {
      for (const item of recounts) {
        const current = session.counts.find((c) => c.id === item.count_id);
        if (!current) continue;

        // Giữ nguyên pallet prefix [Pallet: XXX] để không làm hỏng tính năng hiển thị pallet ở frontend
        const match = current.note?.match(/^(\[Pallet:\s*[^\]]+\])/);
        const palletPrefix = match ? match[1] : "";
        const cleanNote = item.note?.trim();
        const newNote = cleanNote
          ? palletPrefix
            ? `${palletPrefix} [Cần kiểm lại: ${cleanNote}]`
            : `[Cần kiểm lại: ${cleanNote}]`
          : current.note;

        await tx.stocktakeCount.update({
          where: { id: item.count_id },
          data: {
            actual_qty: null,
            discrepancy: null,
            note: newNote,
            counted_at: null,
            counted_by: null,
            lot_actual: null,
            expiry_actual: null,
          },
        });
      }

      // Đổi trạng thái phiên kiểm kê quay lại COUNTING để app di động tiếp tục hiển thị
      await tx.stocktakeSession.update({
        where: { id },
        data: { status: "COUNTING" },
      });
    });

    // Gửi thông báo đến Thủ kho đếm lại
    notifyByRoles(["THU_KHO"], {
      type: "STOCKTAKE_RECOUNT_REQUESTED",
      title: `Yêu cầu kiểm lại: ${session.code}`,
      body: `Phiên kiểm kê ${session.code} có ${recounts.length} dòng được yêu cầu kiểm lại.`,
      entity_type: "stocktake_session",
      entity_id: id,
      link_url: `/thukho/warehouse/stocktake`,
    }).catch((err) => console.error("notifyByRoles STOCKTAKE_RECOUNT_REQUESTED:", err));

    // Notify KIEM_KE — nguoi truc tiep dem lai
    notifyByRoles(["KIEM_KE"], {
      type: "STOCKTAKE_RECOUNT_REQUESTED",
      title: `Yêu cầu kiểm lại: ${session.code}`,
      body: `Phiên kiểm kê ${session.code} có ${recounts.length} dòng cần kiểm đếm lại.`,
      entity_type: "stocktake_session",
      entity_id: id,
      link_url: `/kiemke/tasks/${id}`,
    }).catch((err) => console.error("notifyByRoles KIEM_KE recount:", err));

    return NextResponse.json({
      success: true,
      message: `Đã yêu cầu kiểm lại thành công ${recounts.length} dòng.`,
    });
  } catch (error) {
    console.error("POST /api/stock-count/[id]/recount error:", error);
    const msg = error instanceof Error ? error.message : "Lỗi";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

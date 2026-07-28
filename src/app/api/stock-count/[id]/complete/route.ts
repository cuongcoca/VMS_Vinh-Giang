import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyByRoles } from "@/lib/notifications";
import { guardPermission } from "@/lib/auth-server";

// POST /api/stock-count/[id]/complete — Hoàn tất phiên kiểm kê
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardPermission(_req, "stock_count", "write");
  if (denied) return denied;
  try {
    const { id } = await params;
    const session = await prisma.stocktakeSession.findUnique({
      where: { id },
      include: { counts: true },
    });
    if (!session) return NextResponse.json({ success: false, error: "Không tìm thấy." }, { status: 404 });

    const uncounted = session.counts.filter(c => c.actual_qty === null);
    if (uncounted.length > 0) {
      return NextResponse.json({ success: false, error: `Còn ${uncounted.length} mục chưa đếm.` }, { status: 400 });
    }

    const hasDiscrepancy = session.counts.some(c => Number(c.discrepancy) !== 0);

    const updated = await prisma.stocktakeSession.update({
      where: { id },
      data: {
        status: hasDiscrepancy ? "RECONCILING" : "CLOSED",
        completed_at: new Date(),
      },
    });

    // Notify KE_TOAN khi có chênh lệch, THU_KHO khi đóng phiên
    if (hasDiscrepancy) {
      notifyByRoles(["KE_TOAN", "THU_KHO"], {
        type: "STOCKTAKE_DISCREPANCY",
        title: `Kiểm kê có chênh lệch: ${session.code}`,
        body: `Phiên ${session.code} có chênh lệch. Vui lòng đối chiếu và tạo phiếu điều chỉnh.`,
        entity_type: "stocktake_session",
        entity_id: id,
        link_url: `/ketoan/stock-count/${id}`,
      }).catch((err) => console.error("notifyByRoles STOCKTAKE_DISCREPANCY:", err));
    } else {
      notifyByRoles(["THU_KHO"], {
        type: "STOCKTAKE_CLOSED",
        title: `Kiểm kê khớp: ${session.code}`,
        body: `Phiên ${session.code} kiểm kê khớp, đã đóng.`,
        entity_type: "stocktake_session",
        entity_id: id,
        link_url: `/ketoan/stock-count/${id}`,
      }).catch((err) => console.error("notifyByRoles STOCKTAKE_CLOSED:", err));
    }

    return NextResponse.json({
      success: true,
      data: updated,
      message: hasDiscrepancy ? "Có chênh lệch, chuyển sang đối chiếu." : "Kiểm kê khớp, đã đóng phiên.",
    });
  } catch (error) {
    console.error("POST /api/stock-count/[id]/complete error:", error);
    return NextResponse.json({ success: false, error: "Lỗi." }, { status: 500 });
  }
}

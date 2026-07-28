import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// POST /api/inbound/[id]/send — Gửi phiếu nhập (DRAFT → PENDING)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await guardPermission(req, "inbound", "write");
  if (denied) return denied;
  try {
    const { id } = await params;

    // Lấy phiếu + đếm lines
    const inbound = await prisma.inboundRequest.findUnique({
      where: { id },
      include: { _count: { select: { lines: true } } },
    });

    if (!inbound) {
      return NextResponse.json(
        { success: false, error: "Không tìm thấy phiếu nhập kho." },
        { status: 404 }
      );
    }

    // Chỉ DRAFT mới gửi được
    if (inbound.status !== "DRAFT") {
      const msgMap: Record<string, string> = {
        PENDING: "Phiếu đã được gửi trước đó.",
        RECEIVING: "Phiếu đang trong quá trình nhập hàng.",
        RECONCILING: "Phiếu đang được đối chiếu.",
        COMPLETED: "Phiếu đã hoàn thành.",
        CANCELLED: "Phiếu đã bị hủy.",
      };
      return NextResponse.json(
        { success: false, error: msgMap[inbound.status] || `Không thể gửi phiếu ở trạng thái "${inbound.status}".` },
        { status: 400 }
      );
    }

    // Kiểm tra có ít nhất 1 dòng hàng
    if (inbound._count.lines === 0) {
      return NextResponse.json(
        { success: false, error: "Phiếu phải có ít nhất 1 dòng hàng để gửi." },
        { status: 400 }
      );
    }

    // Cập nhật trạng thái → PENDING
    const updated = await prisma.inboundRequest.update({
      where: { id },
      data: { status: "PENDING" },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item_code: {
              select: { id: true, code: true, short_name: true, full_name: true },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Phiếu ${inbound.code} đã được gửi thành công.`,
    });
  } catch (error) {
    console.error("POST /api/inbound/[id]/send error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi gửi phiếu nhập kho." },
      { status: 500 }
    );
  }
}

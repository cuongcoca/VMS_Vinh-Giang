import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/inbound-temp/[id] — Chi tiết phiếu tạm
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        // Phase 4.2 — TC_STD_TMP_029: trả về code phiếu PHN đã standardize
        // để UI hiển thị "Xem phiếu nhập PHN-YYYY-SSSS" khi reload.
        standardizedTo: { select: { id: true, code: true, status: true } },
        pallets: {
          select: {
            id: true,
            code: true,
            status: true,
            total_lines: true,
            total_weight_kg: true,
            created_at: true,
          },
          orderBy: { created_at: "desc" },
        },
        lines: {
          include: {
            item_code: {
              select: {
                id: true,
                code: true,
                short_name: true,
                full_name: true,
                product_id: true,
                product: { select: { id: true, sku: true, name: true } },
              },
            },
          },
          orderBy: { created_at: "asc" },
        },
      },
    });
    if (!temp) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiếu tạm." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: temp });
  } catch (error) {
    console.error("GET /api/inbound-temp/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải phiếu tạm." }, { status: 500 });
  }
}

// DELETE /api/inbound-temp/[id] — Xóa phiếu tạm (only PENDING)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const temp = await prisma.inboundTemp.findUnique({ where: { id } });
    if (!temp) {
      return NextResponse.json({ success: false, error: "Không tìm thấy phiếu tạm." }, { status: 404 });
    }
    if (temp.status !== "PENDING") {
      return NextResponse.json({ success: false, error: "Chỉ phiếu ở trạng thái 'Chờ chuẩn hóa' mới xóa được." }, { status: 400 });
    }
    await prisma.inboundTemp.delete({ where: { id } });
    return NextResponse.json({ success: true, message: `Đã xóa phiếu ${temp.code}.` });
  } catch (error) {
    console.error("DELETE /api/inbound-temp/[id] error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi xóa phiếu tạm." }, { status: 500 });
  }
}

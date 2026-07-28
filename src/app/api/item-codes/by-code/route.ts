import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

const INCLUDE = {
  unit: { select: { id: true, name: true, symbol: true } },
  group: { select: { id: true, name: true } },
  product: { select: { id: true, sku: true, name: true, barcode: true } },
} as const;

// GET /api/item-codes/by-code?code=VG-NM-001 — resolve mã hàng trực tiếp
// Tra (không phân biệt hoa/thường) theo thứ tự:
//   1) ItemCode.code   (mã hàng theo chứng từ NCC)
//   2) ItemCode.barcode (mã vạch)
//   3) Product.sku → ItemCode liên kết (người dùng quen nhập mã SKU)
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "item_code", "read");
  if (denied) return denied;
  try {
    const code = req.nextUrl.searchParams.get("code")?.trim();
    if (!code) {
      return NextResponse.json({ success: false, error: "Thiếu code." }, { status: 400 });
    }

    // 1) Theo mã hàng (ItemCode.code) — không phân biệt hoa/thường
    let ic = await prisma.itemCode.findFirst({
      where: { code: { equals: code, mode: "insensitive" } },
      include: INCLUDE,
    });

    // 2) Theo mã vạch (barcode)
    if (!ic) {
      ic = await prisma.itemCode.findFirst({
        where: { barcode: { equals: code, mode: "insensitive" } },
        include: INCLUDE,
      });
    }

    // 3) Theo mã SKU sản phẩm → lấy mã hàng đã liên kết
    if (!ic) {
      const product = await prisma.product.findFirst({
        where: { sku: { equals: code, mode: "insensitive" } },
        select: { id: true, sku: true },
      });
      if (product) {
        ic = await prisma.itemCode.findFirst({
          where: { product_id: product.id },
          include: INCLUDE,
          orderBy: { created_at: "asc" },
        });
        // SKU có thật nhưng chưa có mã hàng liên kết → báo rõ
        if (!ic) {
          return NextResponse.json(
            {
              success: false,
              error: `SKU "${product.sku}" tồn tại nhưng chưa có mã hàng liên kết. Vui lòng tạo/chuẩn hóa mã hàng cho SKU này trước.`,
            },
            { status: 404 }
          );
        }
      }
    }

    if (!ic) {
      return NextResponse.json(
        { success: false, error: `Mã hàng "${code}" không tồn tại.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: ic });
  } catch (error) {
    console.error("GET /api/item-codes/by-code error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tra cứu mã hàng." }, { status: 500 });
  }
}

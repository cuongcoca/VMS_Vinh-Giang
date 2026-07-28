import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// GET /api/item-codes/by-barcode?barcode=8938523103142 — resolve barcode EAN
// Thứ tự: Product.barcode (chuẩn) → ItemCode.code (mã NCC = barcode in vỏ thùng)
export async function GET(req: NextRequest) {
  const denied = await guardPermission(req, "item_code", "read");
  if (denied) return denied;
  try {
    const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
    if (!barcode) {
      return NextResponse.json({ success: false, error: "Thiếu barcode." }, { status: 400 });
    }

    const itemCodeInclude = {
      unit: { select: { id: true, name: true, symbol: true } },
      group: { select: { id: true, name: true } },
      product: { select: { id: true, sku: true, name: true, barcode: true } },
    };

    // 1) Match Product.barcode → tìm ItemCode standardized link với Product này
    const product = await prisma.product.findUnique({ where: { barcode } });
    if (product) {
      const ic = await prisma.itemCode.findFirst({
        where: { product_id: product.id, status: "standardized" },
        include: itemCodeInclude,
      });
      if (ic) {
        return NextResponse.json({ success: true, data: ic, via: "product_barcode" });
      }
    }

    // 2) Fallback: ItemCode.code == barcode (barcode in vỏ thùng có thể trùng mã SKU)
    const icDirect = await prisma.itemCode.findUnique({
      where: { code: barcode },
      include: itemCodeInclude,
    });
    if (icDirect) {
      return NextResponse.json({ success: true, data: icDirect, via: "item_code_code" });
    }

    return NextResponse.json(
      {
        success: false,
        error: `Không tìm thấy mã hàng cho barcode "${barcode}".`,
        scanned: barcode,
        suggest_create: true,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error("GET /api/item-codes/by-barcode error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tra cứu barcode." }, { status: 500 });
  }
}

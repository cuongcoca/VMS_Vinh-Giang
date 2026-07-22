import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Gợi ý mã hàng tương tự để gộp trùng (TC_STANDARD_004)
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q")?.trim() || "";
    const excludeId = url.searchParams.get("excludeId") || "";

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Tìm mã hàng đã chuẩn hóa có mã/tên tương tự
    const suggestions = await prisma.itemCode.findMany({
      where: {
        AND: [
          {
            OR: [
              { code: { contains: query, mode: "insensitive" } },
              { short_name: { contains: query, mode: "insensitive" } },
              { full_name: { contains: query, mode: "insensitive" } },
            ],
          },
          { status: "standardized" },
          ...(excludeId ? [{ id: { not: excludeId } }] : []),
        ],
      },
      include: {
        unit: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
      take: 10,
      orderBy: { code: "asc" },
    });

    // Tìm sản phẩm (UC-MD-01) tương tự để liên kết SKU
    const products = await prisma.product.findMany({
      where: {
        OR: [
          { sku: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
          { short_name: { contains: query, mode: "insensitive" } },
        ],
        is_active: true,
      },
      select: { id: true, sku: true, name: true, short_name: true },
      take: 10,
      orderBy: { sku: "asc" },
    });

    return NextResponse.json({
      success: true,
      data: { similarCodes: suggestions, matchingProducts: products },
    });
  } catch (error) {
    console.error("GET /api/item-codes/suggest-merge error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi hệ thống." },
      { status: 500 }
    );
  }
}

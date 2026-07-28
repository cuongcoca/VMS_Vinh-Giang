import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";

// UC-INT-01: Smart resolver — quét mã, hệ thống tự đoán mã đó là gì
// Thứ tự match: Location → Pallet → ItemCode.code → Product.barcode → InboundRequest.code
export async function POST(req: NextRequest) {
  const denied = await guardPermission(req, "scan", "write");
  if (denied) return denied;
  try {
    const { code } = await req.json();
    if (!code || typeof code !== "string" || !code.trim()) {
      return NextResponse.json(
        { success: false, error: "Thiếu code." },
        { status: 400 }
      );
    }
    const c = code.trim();

    // 1) Location.code
    const loc = await prisma.location.findUnique({
      where: { code: c },
      include: {
        pallets: { select: { id: true, code: true, status: true }, take: 5 },
      },
    });
    if (loc) {
      return NextResponse.json({
        success: true,
        type: "location",
        data: { ...loc, current_pallets_count: loc.pallets.length },
      });
    }

    // 2) Pallet.code
    const pal = await prisma.pallet.findUnique({
      where: { code: c },
      include: {
        location: { select: { id: true, code: true, zone: true } },
        supplier: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            item_code: { select: { id: true, code: true, short_name: true } },
          },
        },
        parent: { select: { id: true, code: true } },
      },
    });
    if (pal) return NextResponse.json({ success: true, type: "pallet", data: pal });

    // 3) ItemCode.code
    const ic = await prisma.itemCode.findUnique({
      where: { code: c },
      include: {
        unit: { select: { id: true, name: true, symbol: true } },
        group: { select: { id: true, name: true } },
        product: { select: { id: true, sku: true, name: true, barcode: true } },
      },
    });
    if (ic) return NextResponse.json({ success: true, type: "item_code", data: ic });

    // 4) Product.barcode
    const prod = await prisma.product.findUnique({ where: { barcode: c } });
    if (prod) {
      const linkedIc = await prisma.itemCode.findFirst({
        where: { product_id: prod.id, status: "standardized" },
        include: {
          unit: { select: { id: true, name: true, symbol: true } },
          group: { select: { id: true, name: true } },
          product: { select: { id: true, sku: true, name: true, barcode: true } },
        },
      });
      if (linkedIc) {
        return NextResponse.json({
          success: true,
          type: "item_code",
          data: linkedIc,
          via: "product_barcode",
        });
      }
      return NextResponse.json({
        success: true,
        type: "product",
        data: prod,
        note: "Product có barcode nhưng chưa link ItemCode standardized.",
      });
    }

    // 5) InboundRequest.code
    const inb = await prisma.inboundRequest.findUnique({
      where: { code: c },
      include: { supplier: { select: { id: true, code: true, name: true } } },
    });
    if (inb) return NextResponse.json({ success: true, type: "inbound_request", data: inb });

    return NextResponse.json({
      success: true,
      type: "unknown",
      data: null,
      scanned: c,
    });
  } catch (error) {
    console.error("POST /api/scan/resolve error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi resolve mã quét." },
      { status: 500 }
    );
  }
}

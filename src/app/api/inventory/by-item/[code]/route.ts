import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { STOCK_PALLET_STATUSES } from "@/lib/inventory-constants";
import { expiryCutoff, isExpired } from "@/lib/inventory-expiry";
import { guardPermission } from "@/lib/auth-server";

/**
 * UC-INV-01.B: Drill-down — DS các vị trí chứa mã hàng nhất định.
 *
 * GET /api/inventory/by-item/[code]?order=expiry_desc
 *   - code: ItemCode.code hoặc Product.sku
 *   - order: "expiry_desc" (Date xa nhất ở top — mặc định) | "expiry_asc"
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const denied = await guardPermission(req, "inventory", "read");
  if (denied) return denied;
  try {
    const { code: rawCode } = await params;
    const code = decodeURIComponent(rawCode);
    const { searchParams } = new URL(req.url);
    const order = searchParams.get("order") || "expiry_desc";

    // Resolve item by code (ItemCode hoặc Product SKU)
    const itemCode = await prisma.itemCode.findFirst({
      where: {
        OR: [
          { code: code },
          { product: { sku: code } },
        ],
      },
      include: {
        unit: { select: { id: true, name: true, symbol: true } },
        group: { select: { id: true, code: true, name: true } },
        product: { select: { id: true, sku: true, name: true, min_stock: true, max_stock: true } },
      },
    });

    if (!itemCode) {
      return NextResponse.json(
        { success: false, error: `Không tìm thấy mã hàng "${code}".` },
        { status: 404 }
      );
    }

    // Lấy tất cả pallet lines của itemCode đang trong tồn kho
    // (IN_STORAGE/IN_STAGING/CONFIRMED — Phase 1.1 RC-1)
    const lines = await prisma.palletLine.findMany({
      where: {
        item_code_id: itemCode.id,
        pallet: { status: { in: STOCK_PALLET_STATUSES } },
      },
      select: {
        id: true,
        qty_box: true,
        lot: true,
        expiry_date: true,
        pallet: {
          select: {
            id: true,
            code: true,
            status: true,
            location: { select: { id: true, code: true, zone: true } },
            inbound_request: { select: { code: true } },
          },
        },
      },
    });

    // Sort: HSD xa nhất → đẩy lên top (FEFO ngược, giúp xác định hàng tồn lâu)
    const sorted = lines.sort((a, b) => {
      const dA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
      const dB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
      return order === "expiry_asc" ? dA - dB : dB - dA;
    });

    // WVG-239: tách tổng tồn (vật lý) vs khả dụng (loại hết hạn) vs bị chặn (hết hạn).
    const cutoff = expiryCutoff();
    const totalQty = sorted.reduce((s, l) => s + Number(l.qty_box || 0), 0);
    const blockedQty = sorted.reduce(
      (s, l) => s + (isExpired(l.expiry_date, cutoff) ? Number(l.qty_box || 0) : 0),
      0
    );
    const sellableQty = totalQty - blockedQty;

    // Đếm số vị trí distinct
    const locationSet = new Set(sorted.map((l) => l.pallet?.location?.code || l.pallet?.code || ""));

    return NextResponse.json({
      success: true,
      data: {
        item: {
          id: itemCode.id,
          code: itemCode.code,
          short_name: itemCode.short_name,
          full_name: itemCode.full_name,
          unit: itemCode.unit,
          group: itemCode.group,
          product: itemCode.product,
        },
        total_qty: totalQty,
        sellable_qty: sellableQty,
        blocked_qty: blockedQty,
        location_count: locationSet.size,
        lines: sorted.map((l) => ({
          id: l.id,
          location_code: l.pallet?.location?.code || null,
          location_zone: l.pallet?.location?.zone || null,
          pallet_code: l.pallet?.code || null,
          pallet_status: l.pallet?.status || null,
          inbound_code: l.pallet?.inbound_request?.code || null,
          lot: l.lot,
          expiry_date: l.expiry_date,
          qty_box: Number(l.qty_box || 0),
          is_staging: l.pallet?.status === "IN_STAGING",
          is_expired: isExpired(l.expiry_date, cutoff),
        })),
      },
    });
  } catch (error) {
    console.error("GET /api/inventory/by-item/[code] error:", error);
    return NextResponse.json(
      { success: false, error: "Lỗi khi tải danh sách vị trí." },
      { status: 500 }
    );
  }
}

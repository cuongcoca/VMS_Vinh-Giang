import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/auth-server";
import { expiryCutoff, isExpired } from "@/lib/inventory-expiry";

// GET /api/outbound/staging — Danh sách pallet ở khu chờ xuất (IN_STAGING)
// Hiển thị cả pallet nguyên (FULL) và pallet con từ split (PARTIAL).
export async function GET(req: Request) {
  const denied = await guardPermission(req, "outbound", "read");
  if (denied) return denied;
  try {
    const pallets = await prisma.pallet.findMany({
      where: { status: "IN_STAGING" },
      orderBy: { updated_at: "asc" },
      include: {
        supplier: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, zone: true } },
        parent: { select: { id: true, code: true, location: { select: { code: true } } } },
        lines: {
          include: { item_code: { select: { id: true, code: true, short_name: true } } },
          orderBy: { expiry_date: "asc" },
        },
      },
    });

    // Tính thống kê — Phase 7.1 (BUG_REPORT UC-OUT-01_TC04):
    //   - Thêm: total_distinct_items (Tổng mã), overdue_24h_count (Quá 24H)
    //   - Bỏ: total_weight_kg, nearest_expiry khỏi dashboard chính
    //   - Giữ total_weight_kg + nearest_expiry trong response để FE cũ không
    //     vỡ; FE mới nên dùng total_distinct_items + overdue_24h_count.
    const totalPallets = pallets.length;
    let totalQtyBox = 0;
    let blockedQtyBox = 0; // WVG-239: SL hàng hết hạn nằm ở khu chờ (bị chặn xuất)
    let expiredPalletCount = 0;
    let totalWeightKg = 0;
    let nearestExpiry: Date | null = null;
    let splitCount = 0;
    let overdue24hCount = 0;
    const distinctItemCodes = new Set<string>();
    const now = Date.now();
    const cutoff = expiryCutoff();
    const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

    // WVG-239: gắn cờ hàng hết hạn lên từng dòng để FE hiển thị "Chặn xuất".
    const data = pallets.map((p) => {
      let palletHasExpired = false;
      const lines = p.lines.map((line) => {
        const expired = isExpired(line.expiry_date, cutoff);
        if (expired) palletHasExpired = true;
        return { ...line, is_expired: expired };
      });
      if (palletHasExpired) expiredPalletCount++;
      return { ...p, lines, has_expired: palletHasExpired };
    });

    for (const p of pallets) {
      totalWeightKg += Number(p.total_weight_kg);
      if (p.parent_pallet_id) splitCount++;
      // Quá 24H tính từ thời điểm pallet chuyển sang IN_STAGING (updated_at là
      // proxy gần nhất vì không có trường moved_to_staging_at riêng).
      const stagingAgeMs = now - new Date(p.updated_at).getTime();
      if (stagingAgeMs > TWENTY_FOUR_HOURS_MS) overdue24hCount++;
      for (const line of p.lines) {
        totalQtyBox += Number(line.qty_box);
        if (isExpired(line.expiry_date, cutoff)) blockedQtyBox += Number(line.qty_box);
        distinctItemCodes.add(line.item_code_id);
        if (line.expiry_date) {
          if (!nearestExpiry || line.expiry_date < nearestExpiry) {
            nearestExpiry = line.expiry_date;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data,
      summary: {
        total_pallets: totalPallets,
        total_distinct_items: distinctItemCodes.size,
        total_qty_box: totalQtyBox,
        blocked_qty_box: blockedQtyBox,
        sellable_qty_box: totalQtyBox - blockedQtyBox,
        expired_pallet_count: expiredPalletCount,
        overdue_24h_count: overdue24hCount,
        // Giữ lại cho backward-compat
        total_weight_kg: totalWeightKg,
        nearest_expiry: nearestExpiry,
        split_count: splitCount,
      },
    });
  } catch (error) {
    console.error("GET /api/outbound/staging error:", error);
    return NextResponse.json({ success: false, error: "Lỗi khi tải khu chờ xuất." }, { status: 500 });
  }
}

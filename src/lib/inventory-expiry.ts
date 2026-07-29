// WVG-239 / WMS-007 — Chính sách hàng HẾT HẠN (expired) trong tồn kho.
//
// Bug: hàng có HSD (`expiry_date`) đã qua vẫn cộng vào tồn KHẢ DỤNG (available),
// tổng tồn, và vẫn XUẤT THƯỜNG được. Chính sách: hàng hết hạn phải bị CHẶN
// (blocked/quarantine) — loại khỏi available + không pick/ship qua luồng outbound.
//
// Định nghĩa (thống nhất WVG-98 GMT+7): hết hạn khi
//   expiry_date != null  &&  expiry_date < codeDate(hôm nay theo giờ VN)
// HSD là NGÀY CUỐI dùng được → chặn kể từ NGÀY KẾ TIẾP. Lô expiry_date = null
// (hàng không HSD) KHÔNG bao giờ bị chặn.
//
// Cách tiếp cận: TÍNH ĐỘNG (không thêm cột/enum/migration). "blocked" suy ra
// realtime theo ngày, nên luôn đúng mà không cần job flip trạng thái hằng ngày.
// on_hand (vật lý) = available + blocked → reconcile được.

import { Prisma } from "@prisma/client";
import { warehouseDateParts } from "@/lib/warehouse-date";

/**
 * Mốc cắt hết hạn = nửa đêm NGÀY VN hôm nay (UTC-midnight), khớp cột @db.Date.
 * Lô có expiry_date < cutoff là đã hết hạn (hôm nay vẫn còn dùng được).
 */
export function expiryCutoff(asOf: Date = new Date()): Date {
  return warehouseDateParts(asOf).codeDate;
}

/** True nếu HSD đã qua (JS-side). null/undefined → false (không HSD, không chặn). */
export function isExpired(
  expiry: Date | string | null | undefined,
  asOf: Date = new Date()
): boolean {
  if (expiry == null) return false;
  const d = expiry instanceof Date ? expiry : new Date(expiry);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < expiryCutoff(asOf).getTime();
}

/**
 * Mảnh Prisma WHERE cho dòng hàng ĐÃ HẾT HẠN (bị chặn).
 * Dùng để tính blocked_qty.
 */
export function expiredLineWhere(cutoff: Date): Prisma.PalletLineWhereInput {
  return { expiry_date: { not: null, lt: cutoff } };
}

/**
 * Mảnh Prisma WHERE cho dòng hàng CÒN KHẢ DỤNG (chưa hết hạn hoặc không có HSD).
 * Dùng để tính available + chặn expired khỏi pick/ship.
 */
export function availableLineWhere(cutoff: Date): Prisma.PalletLineWhereInput {
  return { OR: [{ expiry_date: null }, { expiry_date: { gte: cutoff } }] };
}

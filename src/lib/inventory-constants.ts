import type { PalletStatus } from "@prisma/client";

/**
 * Phase 1.1 — Trạng thái pallet được tính vào tồn kho hiển thị.
 *
 * Ngữ cảnh (BUG_REPORT_QLY_2026-05-27 RC-1, TC_CLOSE_IN_006/_010/_015):
 * Trước fix, query tồn kho chỉ lấy IN_STORAGE + IN_STAGING — nghĩa là pallet
 * sau khi chốt phiếu nhập (CONFIRMED) phải đợi xe nâng put-away mới lên tồn.
 * Yêu cầu nghiệp vụ: pallet đã CONFIRMED là đã đếm + xác nhận hàng, phải tính
 * vào tồn kho ngay (kể cả chưa xếp vị trí cụ thể).
 *
 * Dùng cho:
 * - /api/inventory/* (dashboard tồn kho)
 * - /api/dashboard/* (KPI tồn kho)
 *
 * KHÔNG dùng cho:
 * - /api/outbound/* (xuất kho — chỉ pallet đã có vị trí)
 * - /api/forklift/* (xe nâng — flow theo trạng thái cụ thể)
 * - /api/stock-count/* (kiểm kê tách riêng)
 */
export const STOCK_PALLET_STATUSES: PalletStatus[] = [
  "IN_STORAGE",
  "IN_STAGING",
  "CONFIRMED",
];

/**
 * Trạng thái pallet đang trong kho (bao gồm cả COUNTING — đang đếm).
 * Dùng cho đếm tổng pallet hiện hữu trong kho (không tính trên dòng hàng).
 */
export const IN_WAREHOUSE_PALLET_STATUSES: PalletStatus[] = [
  "IN_STORAGE",
  "IN_STAGING",
  "CONFIRMED",
  "COUNTING",
];

/**
 * Trạng thái pallet được tính cho luồng outbound (xuất kho).
 * Phải đã có vị trí cụ thể (IN_STORAGE) hoặc đã chuyển ra staging.
 */
export const OUTBOUND_PICKABLE_PALLET_STATUSES: PalletStatus[] = [
  "IN_STORAGE",
  "IN_STAGING",
];

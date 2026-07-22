/**
 * Prefix codes cho các entity — single source of truth khớp mockup
 * `wms_mockups_4.html` v3.0. Mỗi lần đổi prefix PHẢI kèm migration đổi data cũ
 * (xem `prisma/migrations/2026-05-28_code_prefix_standardize.sql`).
 *
 * Định dạng hiện tại:
 *   PHN-YYYY-SSSS    Inbound có chứng từ (Phiếu Hàng Nhập)
 *   PNT-YYYY-SSSS    Inbound tạm — giữ format YYYY-SSSS (mockup mới PNT-YYMMDD-NNN
 *                    cần schema change `code_year → code_date`, defer Sprint B-2)
 *   STK-YYYY-NNNN    Phiên kiểm kê (4-digit seq)
 *   ADJ-YYYY-NNNN    Phiếu điều chỉnh tồn (4-digit seq)
 *   PL{YYMMDD}.NNN   Pallet — giữ nguyên format hiện tại
 *   RBL-YYYY-NNNN    OutboundRebalance — model có sẵn, chưa code dùng (TODO Sprint D)
 *
 * Race condition: các helper hiện tại không có advisory lock — race-condition
 * giữa preview `next-code` và POST create vẫn tồn tại (INB-001 trong báo cáo
 * logic review). Fix race ở Sprint 1 — cần đưa vào `$transaction` + `pg_advisory_xact_lock`.
 */
export const CODE_PREFIX = {
  INBOUND_REQUEST: "PHN",
  INBOUND_TEMP: "PNT",
  STOCKTAKE_SESSION: "STK",
  ADJUSTMENT_VOUCHER: "ADJ",
  PALLET: "PL",
  REBALANCE: "RBL",
} as const;

/**
 * Format mã yearly-sequential: `PREFIX-YYYY-NNNN` (mặc định 4-digit seq).
 */
export function formatYearlyCode(
  prefix: string,
  year: number,
  seq: number,
  padding = 4
): string {
  return `${prefix}-${year}-${String(seq).padStart(padding, "0")}`;
}

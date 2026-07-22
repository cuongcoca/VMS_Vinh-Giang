-- 2026-06-22: UC-INV-06 — "Thêm pallet ngoài hệ thống" khi kiểm kê
-- ADDITIVE — không phá dữ liệu cũ (mọi cột nullable / có default).
-- Mục đích:
--   1) stocktake_counts: đánh dấu dòng đếm là pallet phát hiện NGOÀI hệ thống + lưu vết
--      mã pallet hiện trường + pallet thật được tạo sau khi duyệt (idempotency).
--   2) adjustment_lines: cho phép dòng "tạo pallet mới" + lưu HSD để dựng PalletLine
--      khi Quản lý duyệt phiếu điều chỉnh.

BEGIN;

ALTER TABLE stocktake_counts
  ADD COLUMN IF NOT EXISTS is_outside_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS found_pallet_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pallet_id        UUID;

ALTER TABLE adjustment_lines
  ADD COLUMN IF NOT EXISTS is_outside_system BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS found_pallet_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS expiry_date       DATE;

COMMIT;

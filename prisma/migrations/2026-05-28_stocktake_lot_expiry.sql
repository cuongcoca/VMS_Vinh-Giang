-- 2026-05-28: Thêm lot_actual + expiry_actual vào stocktake_counts
-- ADDITIVE — cho phép người kiểm kê ghi lại lô + HSD họ thực sự thấy
-- (có thể khác với pallet line gốc nếu lô bị trộn / nhãn mờ / phát hiện sai)

BEGIN;

ALTER TABLE stocktake_counts
  ADD COLUMN IF NOT EXISTS lot_actual VARCHAR(40),
  ADD COLUMN IF NOT EXISTS expiry_actual DATE;

COMMIT;

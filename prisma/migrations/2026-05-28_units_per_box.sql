-- 2026-05-28: units_per_box (số đơn vị lẻ trong 1 thùng)
-- ADDITIVE ONLY — không UPDATE / DELETE data cũ.
-- Mặc định = 1: data cũ vẫn hoạt động đúng (qty_unit = qty_box × 1).
-- User sẽ chỉnh từng SP qua UI master-data sau.

BEGIN;

ALTER TABLE item_codes
  ADD COLUMN IF NOT EXISTS units_per_box INTEGER NOT NULL DEFAULT 1;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS units_per_box INTEGER NOT NULL DEFAULT 1;

-- Sanity check: phải >= 1 (idempotent — bỏ qua nếu đã tồn tại)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'item_codes_units_per_box_check'
  ) THEN
    ALTER TABLE item_codes
      ADD CONSTRAINT item_codes_units_per_box_check
      CHECK (units_per_box >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_units_per_box_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_units_per_box_check
      CHECK (units_per_box >= 1);
  END IF;
END $$;

COMMIT;

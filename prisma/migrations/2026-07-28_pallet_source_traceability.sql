-- WVG-97 / WMS-008 — Pallet có nguồn truy vết: discriminator + constraint.
-- Thêm source_type (enum) + source_id + source_note; backfill từ FK cũ; ràng buộc
-- mọi pallet phải có nguồn (hoặc EXCEPTION kèm lý do). Idempotent, chạy trong tx.
BEGIN;

-- 1) Enum PalletSource
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PalletSource') THEN
    CREATE TYPE "PalletSource" AS ENUM ('INBOUND','INBOUND_TEMP','SPLIT','ADJUSTMENT','EXCEPTION');
  END IF;
END $$;

-- 2) Cột nguồn (default EXCEPTION để an toàn với data cũ)
ALTER TABLE pallets
  ADD COLUMN IF NOT EXISTS source_type "PalletSource" NOT NULL DEFAULT 'EXCEPTION',
  ADD COLUMN IF NOT EXISTS source_id   uuid,
  ADD COLUMN IF NOT EXISTS source_note text;

-- 3) Backfill theo thứ tự ưu tiên nguồn
UPDATE pallets SET source_type='INBOUND', source_id=inbound_request_id
  WHERE inbound_request_id IS NOT NULL;

UPDATE pallets SET source_type='INBOUND_TEMP', source_id=inbound_temp_id
  WHERE inbound_request_id IS NULL AND inbound_temp_id IS NOT NULL;

UPDATE pallets SET source_type='SPLIT', source_id=parent_pallet_id
  WHERE inbound_request_id IS NULL AND inbound_temp_id IS NULL
    AND parent_pallet_id IS NOT NULL;

-- Pallet do kiểm kê/điều chỉnh tạo (có dòng adjustment_lines trỏ tới)
UPDATE pallets p SET source_type='ADJUSTMENT', source_id=al.voucher_id
  FROM adjustment_lines al
  WHERE al.pallet_id = p.id
    AND p.inbound_request_id IS NULL AND p.inbound_temp_id IS NULL
    AND p.parent_pallet_id IS NULL;

-- Còn lại thực sự không rõ nguồn → EXCEPTION + lý do (để QA rà, KHÔNG chặn)
UPDATE pallets SET source_note = COALESCE(source_note, 'Legacy chưa rõ nguồn — audit 2026-07-23, cần rà')
  WHERE source_type='EXCEPTION';

-- 4) Index
CREATE INDEX IF NOT EXISTS pallets_source_type_idx ON pallets (source_type);

-- 5) Ràng buộc: != EXCEPTION phải có source_id; EXCEPTION phải có source_note
ALTER TABLE pallets DROP CONSTRAINT IF EXISTS pallets_source_chk;
ALTER TABLE pallets ADD CONSTRAINT pallets_source_chk CHECK (
  (source_type = 'EXCEPTION' AND source_note IS NOT NULL)
  OR (source_type <> 'EXCEPTION' AND source_id IS NOT NULL)
);

COMMIT;

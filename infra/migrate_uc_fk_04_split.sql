-- UC-FK-04: Split pallet support
-- Cho phép rút 1 phần hàng từ pallet cha → tạo pallet con ở khu chờ xuất.
-- Bổ sung 2 cột: parent_pallet_id, split_seq + FK self-ref + index.

BEGIN;

ALTER TABLE pallets
  ADD COLUMN IF NOT EXISTS parent_pallet_id UUID NULL,
  ADD COLUMN IF NOT EXISTS split_seq SMALLINT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pallets_parent_pallet_id_fkey'
  ) THEN
    ALTER TABLE pallets
      ADD CONSTRAINT pallets_parent_pallet_id_fkey
      FOREIGN KEY (parent_pallet_id) REFERENCES pallets(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS pallets_parent_pallet_id_idx ON pallets(parent_pallet_id);

COMMIT;

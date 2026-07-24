-- 2026-07-24: pallet_line_inbound — gán phiếu nhập ở TỪNG DÒNG pallet (hướng A)
-- Cho phép 1 pallet vật lý chứa dòng hàng của nhiều PHN khác nhau.
-- ADDITIVE ONLY — không xóa/ghi đè dữ liệu cũ. Cột NULLABLE (NULL = hàng phát sinh).
-- Backfill an toàn: chỉ set cho dòng đang NULL, lấy phiếu gốc của pallet cha.

BEGIN;

ALTER TABLE pallet_lines
  ADD COLUMN IF NOT EXISTS inbound_request_id UUID;

-- FK về inbound_requests (chỉ thêm nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pallet_lines_inbound_request_fk'
  ) THEN
    ALTER TABLE pallet_lines
      ADD CONSTRAINT pallet_lines_inbound_request_fk
      FOREIGN KEY (inbound_request_id) REFERENCES inbound_requests(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pallet_lines_inbound ON pallet_lines(inbound_request_id);

-- Backfill: dòng cũ nhận phiếu GỐC của pallet chứa nó (nếu pallet có link PHN).
-- Dòng của pallet không-gắn-phiếu (hàng phát sinh cũ) giữ NULL — đúng nghĩa mới.
UPDATE pallet_lines pl
  SET inbound_request_id = p.inbound_request_id
  FROM pallets p
  WHERE pl.pallet_id = p.id
    AND p.inbound_request_id IS NOT NULL
    AND pl.inbound_request_id IS NULL;

COMMIT;

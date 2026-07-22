-- 2026-06-08: inbound_invoice_no (số hoá đơn của phiếu nhập)
-- ADDITIVE ONLY — không UPDATE / DELETE data cũ.
-- Cột NULLABLE để phiếu cũ vẫn hợp lệ; "bắt buộc" được enforce ở tầng app
-- (validate khi kế toán lập phiếu mới). UC-IN-01.

BEGIN;

ALTER TABLE inbound_requests
  ADD COLUMN IF NOT EXISTS invoice_no VARCHAR(50);

COMMIT;

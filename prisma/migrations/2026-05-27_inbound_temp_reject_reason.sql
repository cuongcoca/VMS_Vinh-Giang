-- Phase 4.2 — TC_STD_TMP_023: lưu lý do từ chối phiếu tạm vào DB
-- (trước fix chỉ ghi audit log → không truy vết lâu dài).
-- Additive only.

BEGIN;

ALTER TABLE inbound_temps
  ADD COLUMN IF NOT EXISTS reject_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS rejected_by UUID;

COMMIT;

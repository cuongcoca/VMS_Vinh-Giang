-- Phase 2.1 — Mở rộng audit_logs theo BUG_REPORT_QLY_2026-05-27 (RC-2)
-- TC ảnh hưởng: TC_EDIT_PAL_008/_013/_014/_018/_020 (MD03 UC-PAL-05)
-- Additive only — không drop / không rename / không thay đổi NOT NULL

BEGIN;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS performed_by_role VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ip_address        VARCHAR(45),
  ADD COLUMN IF NOT EXISTS user_agent        VARCHAR(255);

CREATE INDEX IF NOT EXISTS audit_logs_performed_by_idx
  ON audit_logs (performed_by);

COMMIT;

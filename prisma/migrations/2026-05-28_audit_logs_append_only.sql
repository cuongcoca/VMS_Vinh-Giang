-- Migration: audit_logs append-only enforcement (CP-05 / CP-07 / CP-08 yêu cầu)
-- Ngăn UPDATE/DELETE trên bảng audit_logs ở DB layer để không thể tampering qua
-- Prisma client, raw SQL, hay bất kỳ DB tool nào — kể cả admin trực tiếp.
-- Tham chiếu: docs/CRITICAL_PATHS.md:330, docs/REVIEW_LOGIC_ERRORS_2026-05-28.md (INV-003, OUT-001)

CREATE OR REPLACE FUNCTION audit_logs_no_modify() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (% blocked on row id=%)', TG_OP, OLD.id
    USING HINT = 'Audit logs cannot be modified or deleted. Insert a corrective record instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update ON audit_logs;
DROP TRIGGER IF EXISTS trg_audit_logs_no_delete ON audit_logs;

CREATE TRIGGER trg_audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_no_modify();

CREATE TRIGGER trg_audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_no_modify();

-- Defense-in-depth: revoke explicit DML quyền khỏi PUBLIC.
-- App role vẫn INSERT được nhưng UPDATE/DELETE bị trigger chặn dù có quyền.
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;

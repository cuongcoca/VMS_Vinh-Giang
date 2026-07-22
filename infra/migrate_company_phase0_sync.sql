-- ════════════════════════════════════════════════════════════════════
-- WMS Vĩnh Giang — Migration ADDITIVE-ONLY cho VPS công ty 42.96.16.197
-- Đồng bộ schema VPS (cũ, 567 dòng) → schema local mới (781 dòng)
-- ════════════════════════════════════════════════════════════════════
-- AN TOÀN: Chỉ ADD COLUMN, CREATE TABLE, ADD ENUM VALUE — KHÔNG DROP, KHÔNG RENAME, KHÔNG TRUNCATE.
-- Tất cả lệnh đều IF NOT EXISTS / ADD VALUE IF NOT EXISTS → idempotent (chạy lại không lỗi).
-- DỮ LIỆU HIỆN CÓ ĐƯỢC GIỮ NGUYÊN 100%.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. users: thêm 3 cột mới ──────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'users_username_key') THEN
    CREATE UNIQUE INDEX users_username_key ON users(username);
  END IF;
END $$;

-- ─── 2. product_groups: thêm code ──────────────────────────────────
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS code VARCHAR(20);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'product_groups_code_key') THEN
    CREATE UNIQUE INDEX product_groups_code_key ON product_groups(code);
  END IF;
END $$;

-- ─── 3. units_of_measure: thêm code ────────────────────────────────
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS code VARCHAR(20);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'units_of_measure_code_key') THEN
    CREATE UNIQUE INDEX units_of_measure_code_key ON units_of_measure(code);
  END IF;
END $$;

-- ─── 4. LocationStatus enum: thêm 2 value mới ─────────────────────
ALTER TYPE "LocationStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "LocationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHECK';

-- ─── 5. pallets: thêm inbound_request_id + created_by ─────────────
ALTER TABLE pallets ADD COLUMN IF NOT EXISTS inbound_request_id UUID;
ALTER TABLE pallets ADD COLUMN IF NOT EXISTS created_by UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pallets_inbound_request_id_idx') THEN
    CREATE INDEX pallets_inbound_request_id_idx ON pallets(inbound_request_id);
  END IF;
END $$;

-- ─── 6. movements: thêm 8 cột mới (item_code, qty, mode, audit) ────
ALTER TABLE movements ADD COLUMN IF NOT EXISTS item_code_id UUID;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS qty_box DECIMAL(10, 2);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS qty_unit DECIMAL(14, 3);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS lot VARCHAR(40);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE movements ADD COLUMN IF NOT EXISTS mode VARCHAR(10);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS reason_code VARCHAR(40);
ALTER TABLE movements ADD COLUMN IF NOT EXISTS audit_log_id UUID;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'movements_item_code_id_idx') THEN
    CREATE INDEX movements_item_code_id_idx ON movements(item_code_id);
  END IF;
END $$;

-- ─── 7. inbound_requests: thêm 11 cột mới ─────────────────────────
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS order_date DATE;
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS import_type VARCHAR(50);
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS warehouse VARCHAR(100);
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS source VARCHAR(20);
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS source_file_url TEXT;
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS source_file_name VARCHAR(255);
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS prep_zone_ready BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS discrepancy_decision VARCHAR(40);
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS close_note TEXT;
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS closed_by UUID;
ALTER TABLE inbound_requests ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP(3);

-- ─── 8. inbound_temps: thêm 6 cột mới (source_type, photo_urls, ...) ─
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS source_type VARCHAR(20);
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS delivered_by VARCHAR(120);
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS received_at TIMESTAMP(3);
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS reason VARCHAR(40);
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS reason_detail TEXT;
ALTER TABLE inbound_temps ADD COLUMN IF NOT EXISTS photo_urls TEXT[];

-- ─── 9. adjustment_vouchers: thêm 5 cột mới ────────────────────────
ALTER TABLE adjustment_vouchers ADD COLUMN IF NOT EXISTS type VARCHAR(20);
ALTER TABLE adjustment_vouchers ADD COLUMN IF NOT EXISTS reason_code VARCHAR(40);
ALTER TABLE adjustment_vouchers ADD COLUMN IF NOT EXISTS rejected_reason TEXT;
ALTER TABLE adjustment_vouchers ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP(3);
ALTER TABLE adjustment_vouchers ADD COLUMN IF NOT EXISTS audit_log_id UUID;

-- ─── 10. adjustment_lines: thêm pallet_id, lot, note ──────────────
ALTER TABLE adjustment_lines ADD COLUMN IF NOT EXISTS pallet_id UUID;
ALTER TABLE adjustment_lines ADD COLUMN IF NOT EXISTS lot VARCHAR(40);
ALTER TABLE adjustment_lines ADD COLUMN IF NOT EXISTS note TEXT;

COMMIT;

-- ════════════════════════════════════════════════════════════════════
-- ALTER TYPE ADD VALUE không chạy được trong transaction trên một số bản Postgres
-- → đã đưa vào BEGIN/COMMIT chính ở trên (Postgres 12+ hỗ trợ trong tx)
-- Phần tiếp theo (CREATE TYPE / CREATE TABLE) chạy trong tx riêng để cô lập.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 11. Tạo enum mới: OutboundRequestStatus + OutboundRebalanceStatus ─
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundRequestStatus') THEN
    CREATE TYPE "OutboundRequestStatus" AS ENUM ('PENDING', 'PICKING', 'SHIPPED', 'CANCELLED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundRebalanceStatus') THEN
    CREATE TYPE "OutboundRebalanceStatus" AS ENUM ('PARSED', 'PREVIEWED', 'APPLIED', 'REJECTED');
  END IF;
END $$;

-- ─── 12. Bảng mới: outbound_requests ───────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL UNIQUE,
  code_year       SMALLINT NOT NULL,
  code_seq        SMALLINT NOT NULL,
  customer        VARCHAR(255),
  ship_date       DATE,
  status          "OutboundRequestStatus" NOT NULL DEFAULT 'PENDING',
  created_by      UUID,
  shipped_by      UUID,
  shipped_at      TIMESTAMP(3),
  note            TEXT,
  audit_log_id    UUID,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT outbound_requests_year_seq_key UNIQUE (code_year, code_seq)
);
CREATE INDEX IF NOT EXISTS outbound_requests_status_idx ON outbound_requests(status);

-- ─── 13. Bảng mới: outbound_request_lines ──────────────────────────
CREATE TABLE IF NOT EXISTS outbound_request_lines (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_request_id  UUID NOT NULL,
  item_code_id         UUID NOT NULL,
  pallet_id            UUID,
  qty_requested        DECIMAL(14, 3) NOT NULL,
  qty_shipped          DECIMAL(14, 3),
  note                 TEXT
);
CREATE INDEX IF NOT EXISTS outbound_request_lines_request_idx ON outbound_request_lines(outbound_request_id);

-- ─── 14. Bảng mới: outbound_rebalances ─────────────────────────────
CREATE TABLE IF NOT EXISTS outbound_rebalances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(20) NOT NULL UNIQUE,
  code_year       SMALLINT NOT NULL,
  code_seq        SMALLINT NOT NULL,
  method          VARCHAR(30) NOT NULL,
  file_url        TEXT,
  file_name       VARCHAR(255),
  ship_date       DATE,
  status          "OutboundRebalanceStatus" NOT NULL DEFAULT 'PARSED',
  total_lines     INTEGER NOT NULL DEFAULT 0,
  matched_lines   INTEGER NOT NULL DEFAULT 0,
  warning_lines   INTEGER NOT NULL DEFAULT 0,
  applied_at      TIMESTAMP(3),
  applied_by      UUID,
  audit_log_id    UUID,
  note            TEXT,
  created_by      UUID,
  created_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT outbound_rebalances_year_seq_key UNIQUE (code_year, code_seq)
);
CREATE INDEX IF NOT EXISTS outbound_rebalances_status_idx ON outbound_rebalances(status);

-- ─── 15. Bảng mới: outbound_rebalance_lines ────────────────────────
CREATE TABLE IF NOT EXISTS outbound_rebalance_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebalance_id        UUID NOT NULL,
  item_code_id        UUID NOT NULL,
  pallet_id           UUID,
  qty_unit_before     DECIMAL(14, 3) NOT NULL,
  qty_unit_exported   DECIMAL(14, 3) NOT NULL,
  qty_unit_after      DECIMAL(14, 3) NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'MATCHED',
  note                TEXT
);
CREATE INDEX IF NOT EXISTS outbound_rebalance_lines_rebalance_idx ON outbound_rebalance_lines(rebalance_id);

-- ─── 16. Bảng mới: mail_settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS mail_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider              VARCHAR(20) NOT NULL,
  host                  VARCHAR(120),
  port                  INTEGER,
  security              VARCHAR(10) NOT NULL DEFAULT 'TLS',
  username              VARCHAR(255),
  password_enc          TEXT,
  api_key_enc           TEXT,
  from_email            VARCHAR(255) NOT NULL,
  from_name             VARCHAR(120) NOT NULL,
  reply_to_email        VARCHAR(255),
  rate_limit_per_hour   INTEGER DEFAULT 100,
  is_active             BOOLEAN NOT NULL DEFAULT false,
  last_tested_at        TIMESTAMP(3),
  last_test_result      TEXT,
  updated_at            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 17. Bảng mới: mail_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS mail_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email    VARCHAR(255) NOT NULL,
  subject     VARCHAR(255) NOT NULL,
  template    VARCHAR(60),
  status      VARCHAR(20) NOT NULL,
  error       TEXT,
  sent_at     TIMESTAMP(3),
  created_at  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS mail_logs_status_created_idx ON mail_logs(status, created_at);

-- ─── 18. Bảng mới: alert_settings ─────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type    VARCHAR(40) NOT NULL UNIQUE,
  frequency     VARCHAR(20) NOT NULL,
  recipients    TEXT[] NOT NULL DEFAULT '{}',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;

-- ════════════════════════════════════════════════════════════════════
-- HOÀN TẤT.
-- Bảng cũ + dữ liệu cũ → KHÔNG ĐỘNG.
-- Sau khi chạy SQL này, chạy `npx prisma generate` để regen client.
-- ════════════════════════════════════════════════════════════════════

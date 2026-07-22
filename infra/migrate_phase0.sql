-- ═══════════════════════════════════════════════════════════════
-- MIGRATION PHASE 0 — WMS Vĩnh Giang
-- Ngày: 2026-05-25
-- Mô tả: Bổ sung field & entity mới theo LO_TRINH_FIX_GAP_DETAILED.md
-- Idempotent: dùng IF NOT EXISTS / IF EXISTS để chạy lại an toàn
-- BACKUP DB TRƯỚC KHI CHẠY: pg_dump -U wms_user -d wms_vinhgiang | gzip > backup-pre-phase0-$(date +%Y%m%d-%H%M).sql.gz
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────
-- 1. USER: thêm username, must_change_password, avatar_url
-- ───────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username             VARCHAR(50),
  ADD COLUMN IF NOT EXISTS avatar_url           TEXT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- Unique constraint cho username (chỉ khi NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_username_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_username_key UNIQUE (username);
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────
-- 2. PRODUCT_GROUPS + UNITS_OF_MEASURE: thêm code
-- ───────────────────────────────────────────────────────────────
ALTER TABLE product_groups ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE units_of_measure ADD COLUMN IF NOT EXISTS code VARCHAR(20);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_groups_code_key') THEN
    ALTER TABLE product_groups ADD CONSTRAINT product_groups_code_key UNIQUE (code);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'units_of_measure_code_key') THEN
    ALTER TABLE units_of_measure ADD CONSTRAINT units_of_measure_code_key UNIQUE (code);
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────
-- 3. LOCATIONS: bổ sung enum LocationStatus (PARTIAL, NEEDS_CHECK)
-- ───────────────────────────────────────────────────────────────
ALTER TYPE "LocationStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';
ALTER TYPE "LocationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_CHECK';

-- ───────────────────────────────────────────────────────────────
-- 4. PALLETS: thêm inbound_request_id + created_by
-- ───────────────────────────────────────────────────────────────
ALTER TABLE pallets
  ADD COLUMN IF NOT EXISTS inbound_request_id UUID,
  ADD COLUMN IF NOT EXISTS created_by         UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pallets_inbound_request_id_fkey') THEN
    ALTER TABLE pallets ADD CONSTRAINT pallets_inbound_request_id_fkey
      FOREIGN KEY (inbound_request_id) REFERENCES inbound_requests(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pallets_created_by_fkey') THEN
    ALTER TABLE pallets ADD CONSTRAINT pallets_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS pallets_inbound_request_id_idx ON pallets(inbound_request_id);

-- ───────────────────────────────────────────────────────────────
-- 5. INBOUND_REQUESTS: thêm field UC-IN-02/04/06
-- ───────────────────────────────────────────────────────────────
ALTER TABLE inbound_requests
  ADD COLUMN IF NOT EXISTS import_type          VARCHAR(40) DEFAULT 'Nhập từ NCC',
  ADD COLUMN IF NOT EXISTS warehouse            VARCHAR(100),
  ADD COLUMN IF NOT EXISTS order_date           DATE,
  ADD COLUMN IF NOT EXISTS source               VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source_file_url      TEXT,
  ADD COLUMN IF NOT EXISTS source_file_name     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS prep_zone_ready      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discrepancy_decision VARCHAR(40),
  ADD COLUMN IF NOT EXISTS close_note           TEXT,
  ADD COLUMN IF NOT EXISTS closed_by            UUID,
  ADD COLUMN IF NOT EXISTS closed_at            TIMESTAMPTZ;

-- ───────────────────────────────────────────────────────────────
-- 6. INBOUND_TEMPS: thêm field UC-INTMP-01
-- ───────────────────────────────────────────────────────────────
ALTER TABLE inbound_temps
  ADD COLUMN IF NOT EXISTS source_type   VARCHAR(20),
  ADD COLUMN IF NOT EXISTS delivered_by  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS received_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reason        VARCHAR(40),
  ADD COLUMN IF NOT EXISTS reason_detail TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls    TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Tạo FK cho inbound_request_id (đã có cột, chưa có constraint)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inbound_temps_inbound_request_id_fkey') THEN
    ALTER TABLE inbound_temps ADD CONSTRAINT inbound_temps_inbound_request_id_fkey
      FOREIGN KEY (inbound_request_id) REFERENCES inbound_requests(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────
-- 7. MOVEMENTS: thêm chi tiết SL/lô/HSD/mode/audit_log
-- ───────────────────────────────────────────────────────────────
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS item_code_id  UUID,
  ADD COLUMN IF NOT EXISTS qty_box       DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS qty_unit      DECIMAL(14,3),
  ADD COLUMN IF NOT EXISTS lot           VARCHAR(40),
  ADD COLUMN IF NOT EXISTS expiry_date   DATE,
  ADD COLUMN IF NOT EXISTS mode          VARCHAR(10),
  ADD COLUMN IF NOT EXISTS reason_code   VARCHAR(40),
  ADD COLUMN IF NOT EXISTS audit_log_id  UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'movements_item_code_id_fkey') THEN
    ALTER TABLE movements ADD CONSTRAINT movements_item_code_id_fkey
      FOREIGN KEY (item_code_id) REFERENCES item_codes(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS movements_item_code_id_idx ON movements(item_code_id);

-- ───────────────────────────────────────────────────────────────
-- 8. ADJUSTMENT_VOUCHERS + LINES: thêm type/reason_code, pallet, lot
-- ───────────────────────────────────────────────────────────────
ALTER TABLE adjustment_vouchers
  ADD COLUMN IF NOT EXISTS type            VARCHAR(20),
  ADD COLUMN IF NOT EXISTS reason_code     VARCHAR(40),
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
  ADD COLUMN IF NOT EXISTS applied_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS audit_log_id    UUID;

ALTER TABLE adjustment_lines
  ADD COLUMN IF NOT EXISTS pallet_id UUID,
  ADD COLUMN IF NOT EXISTS lot       VARCHAR(40),
  ADD COLUMN IF NOT EXISTS note      TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'adjustment_lines_pallet_id_fkey') THEN
    ALTER TABLE adjustment_lines ADD CONSTRAINT adjustment_lines_pallet_id_fkey
      FOREIGN KEY (pallet_id) REFERENCES pallets(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ───────────────────────────────────────────────────────────────
-- 9. OUTBOUND_REQUESTS (PYX) — UC-OUT-05 cách 2
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundRequestStatus') THEN
    CREATE TYPE "OutboundRequestStatus" AS ENUM ('PENDING', 'PICKING', 'SHIPPED', 'CANCELLED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS outbound_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(20) NOT NULL UNIQUE,
  code_year    SMALLINT NOT NULL,
  code_seq     SMALLINT NOT NULL,
  customer     VARCHAR(255),
  ship_date    DATE,
  status       "OutboundRequestStatus" NOT NULL DEFAULT 'PENDING',
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shipped_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shipped_at   TIMESTAMPTZ,
  note         TEXT,
  audit_log_id UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_year, code_seq)
);
CREATE INDEX IF NOT EXISTS outbound_requests_status_idx ON outbound_requests(status);

CREATE TABLE IF NOT EXISTS outbound_request_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_request_id UUID NOT NULL REFERENCES outbound_requests(id) ON DELETE CASCADE,
  item_code_id        UUID NOT NULL REFERENCES item_codes(id),
  pallet_id           UUID REFERENCES pallets(id) ON DELETE SET NULL,
  qty_requested       DECIMAL(14,3) NOT NULL,
  qty_shipped         DECIMAL(14,3),
  note                TEXT
);
CREATE INDEX IF NOT EXISTS outbound_request_lines_outbound_request_id_idx ON outbound_request_lines(outbound_request_id);

-- ───────────────────────────────────────────────────────────────
-- 10. OUTBOUND_REBALANCES — UC-OUT-05 cách 1
-- ───────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OutboundRebalanceStatus') THEN
    CREATE TYPE "OutboundRebalanceStatus" AS ENUM ('PARSED', 'PREVIEWED', 'APPLIED', 'REJECTED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS outbound_rebalances (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          VARCHAR(20) NOT NULL UNIQUE,
  code_year     SMALLINT NOT NULL,
  code_seq      SMALLINT NOT NULL,
  method        VARCHAR(30) NOT NULL,
  file_url      TEXT,
  file_name     VARCHAR(255),
  ship_date     DATE,
  status        "OutboundRebalanceStatus" NOT NULL DEFAULT 'PARSED',
  total_lines   INT NOT NULL DEFAULT 0,
  matched_lines INT NOT NULL DEFAULT 0,
  warning_lines INT NOT NULL DEFAULT 0,
  applied_at    TIMESTAMPTZ,
  applied_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  audit_log_id  UUID,
  note          TEXT,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_year, code_seq)
);
CREATE INDEX IF NOT EXISTS outbound_rebalances_status_idx ON outbound_rebalances(status);

CREATE TABLE IF NOT EXISTS outbound_rebalance_lines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rebalance_id      UUID NOT NULL REFERENCES outbound_rebalances(id) ON DELETE CASCADE,
  item_code_id      UUID NOT NULL REFERENCES item_codes(id),
  pallet_id         UUID REFERENCES pallets(id) ON DELETE SET NULL,
  qty_unit_before   DECIMAL(14,3) NOT NULL,
  qty_unit_exported DECIMAL(14,3) NOT NULL,
  qty_unit_after    DECIMAL(14,3) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'MATCHED',
  note              TEXT
);
CREATE INDEX IF NOT EXISTS outbound_rebalance_lines_rebalance_id_idx ON outbound_rebalance_lines(rebalance_id);

-- ───────────────────────────────────────────────────────────────
-- 11. MAIL_SETTINGS + MAIL_LOGS — UC-SYS-02
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mail_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            VARCHAR(20) NOT NULL,
  host                VARCHAR(120),
  port                INT,
  security            VARCHAR(10) NOT NULL DEFAULT 'TLS',
  username            VARCHAR(255),
  password_enc        TEXT,
  api_key_enc         TEXT,
  from_email          VARCHAR(255) NOT NULL,
  from_name           VARCHAR(120) NOT NULL,
  reply_to_email      VARCHAR(255),
  rate_limit_per_hour INT DEFAULT 100,
  is_active           BOOLEAN NOT NULL DEFAULT false,
  last_tested_at      TIMESTAMPTZ,
  last_test_result    TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mail_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email   VARCHAR(255) NOT NULL,
  subject    VARCHAR(255) NOT NULL,
  template   VARCHAR(60),
  status     VARCHAR(20) NOT NULL,
  error      TEXT,
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS mail_logs_status_created_at_idx ON mail_logs(status, created_at);

-- ───────────────────────────────────────────────────────────────
-- 12. ALERT_SETTINGS — UC-INV-05
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type VARCHAR(40) NOT NULL UNIQUE,
  frequency  VARCHAR(20) NOT NULL,
  recipients TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active  BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- HẾT MIGRATION PHASE 0
-- Sau khi chạy xong: chạy `npx prisma generate` để cập nhật client
-- ═══════════════════════════════════════════════════════════════

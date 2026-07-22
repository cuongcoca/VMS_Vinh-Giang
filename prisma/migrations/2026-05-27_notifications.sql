-- Phase 7.2 — Notification Kế toán → Thủ kho
-- BUG_REPORT TC_IN_REQ_027/_028: tạo phiếu YC nhập cần thông báo cho Thủ kho.
-- Additive only.

BEGIN;

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" VARCHAR(50) NOT NULL,         -- INBOUND_REQUEST_CREATED | ...
  "title" VARCHAR(255) NOT NULL,
  "body" TEXT,
  "entity_type" VARCHAR(50),           -- inbound_request | pallet | ...
  "entity_id" UUID,
  "link_url" VARCHAR(500),             -- FE click navigates here
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_user_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "notifications_user_read_idx" ON "notifications" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications" ("created_at");
CREATE INDEX IF NOT EXISTS "notifications_entity_idx" ON "notifications" ("entity_type", "entity_id");

COMMIT;

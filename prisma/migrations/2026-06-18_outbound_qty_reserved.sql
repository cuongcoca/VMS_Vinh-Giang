-- RC6: Giữ chỗ tồn cho Phiếu yêu cầu xuất (PYX) — chống tranh chấp khi 2 phiếu cùng tranh 1 lượng tồn.
-- Thêm cột qty_reserved vào outbound_request_lines.
-- Idempotent: dùng IF NOT EXISTS để chạy lại an toàn.

ALTER TABLE "outbound_request_lines"
  ADD COLUMN IF NOT EXISTS "qty_reserved" DECIMAL(14,3) NOT NULL DEFAULT 0;

-- Backfill: các phiếu đang lấy hàng (PICKING) coi như đã giữ chỗ = số lượng yêu cầu
-- (best-effort cho các phiếu đang dở tại thời điểm nâng cấp).
UPDATE "outbound_request_lines" l
SET "qty_reserved" = l."qty_requested"
FROM "outbound_requests" r
WHERE l."outbound_request_id" = r."id"
  AND r."status" = 'PICKING';

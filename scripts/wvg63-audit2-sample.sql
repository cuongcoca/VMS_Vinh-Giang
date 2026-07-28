-- =============================================================================
-- WVG-63 / WMS-003 — ĐIỀU TRA VÒNG 2 (READ-ONLY): LẤY MẪU DỮ LIỆU THẬT
-- Vòng 1 báo 0 suspect nhưng có 370 item_codes 'pending' bất thường
-- => nhìn thẳng dữ liệu để hiểu "account xuất hiện như mã hàng" trông thế nào.
-- CÁCH CHẠY:
--   cd /var/www/wms-vinhgiang
--   docker exec -i wms-postgres psql -U wms -d wms -v ON_ERROR_STOP=1 \
--     < scripts/wvg63-audit2-sample.sql > wvg63-audit2.log 2>&1
-- =============================================================================
\echo '################ WVG-63 AUDIT#2 — SAMPLE (READ ONLY) ################'
BEGIN;
SET TRANSACTION READ ONLY;

\echo ''
\echo '===== B1 — 40 item_codes MỚI NHẤT (mọi cột text) =============================';
SELECT code, short_name, full_name, barcode, specification, note,
       status, created_by, created_at::timestamp(0) AS created_at
FROM item_codes
ORDER BY created_at DESC
LIMIT 40;

\echo ''
\echo '===== B2 — 20 item_codes CŨ NHẤT ============================================';
SELECT code, short_name, full_name, note, status, created_by,
       created_at::timestamp(0) AS created_at
FROM item_codes
ORDER BY created_at ASC
LIMIT 20;

\echo ''
\echo '===== B3 — TOÀN BỘ USERS (để đối chiếu account) =============================';
SELECT full_name, email, phone, username, role, created_at::date AS created_date
FROM users
ORDER BY created_at;

\echo ''
\echo '===== B4 — QUÉT "@" TRÊN MỌI CỘT TEXT của item_codes ========================';
SELECT code, short_name, full_name, barcode, specification, note, status
FROM item_codes
WHERE code ~ '@' OR short_name ~ '@' OR COALESCE(full_name,'') ~ '@'
   OR COALESCE(barcode,'') ~ '@' OR COALESCE(specification,'') ~ '@'
   OR COALESCE(note,'') ~ '@'
LIMIT 50;

\echo ''
\echo '===== B5 — PHÂN BỐ THEO NGÀY TẠO (tìm lô import lớn) ========================';
SELECT created_at::date AS created_date, count(*) AS so_dong,
       count(*) FILTER (WHERE status='pending') AS pending,
       count(*) FILTER (WHERE status='standardized') AS standardized
FROM item_codes
GROUP BY created_at::date
ORDER BY so_dong DESC;

\echo ''
\echo '===== B6 — PHÂN BỐ THEO NGƯỜI TẠO (created_by) ==============================';
SELECT ic.created_by, u.full_name AS creator_name, u.role AS creator_role,
       count(*) AS so_dong
FROM item_codes ic
LEFT JOIN users u ON u.id = ic.created_by
GROUP BY ic.created_by, u.full_name, u.role
ORDER BY so_dong DESC;

\echo ''
\echo '===== B7 — MÃ TỰ SINH "TEMP-*" (luồng tạo nhanh Thủ kho) ====================';
SELECT count(*) AS temp_codes,
       count(*) FILTER (WHERE status='pending') AS temp_pending
FROM item_codes
WHERE code LIKE 'TEMP-%';

\echo ''
\echo '===== B8 — ĐỐI CHIẾU MỜ: short_name CHỨA tên 1 user (hoặc ngược lại) ========';
SELECT DISTINCT ic.code, ic.short_name, ic.status,
       u.full_name AS matched_user, u.role
FROM item_codes ic
JOIN users u
  ON ic.short_name ILIKE '%'||u.full_name||'%'
  OR u.full_name  ILIKE '%'||ic.short_name||'%'
  OR ic.code       = u.username
  OR ic.code       = u.phone
LIMIT 50;

ROLLBACK;
\echo ''
\echo '################ HẾT — đã ROLLBACK ################'

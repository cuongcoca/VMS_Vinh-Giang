-- WVG-16 / WMS-002 (review gate 4) — Bịt lỗ phân quyền còn sót:
--   1) Thêm vai "PENDING" (0 quyền) làm DEFAULT an toàn cho user mới
--      (thay @default(STAFF) — STAFF là legacy, trước đây được allSpecial).
--   2) Di trú mọi user legacy còn sót (ADMIN/MANAGER/STAFF) → QUAN_LY.
--   3) Đổi default cột role sang PENDING.
--
-- ⚠ CHẠY BẰNG: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>
--   KHÔNG bọc trong BEGIN/COMMIT: PostgreSQL không cho dùng giá trị enum mới trong
--   cùng transaction vừa thêm nó. psql -f tự autocommit từng câu nên an toàn.
-- Idempotent: chạy lại vô hại.

-- 1) Thêm giá trị enum PENDING (tự commit ngay)
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'PENDING';

-- 2) Di trú legacy còn sót → QUAN_LY (gộp UC di trú cũ, idempotent)
UPDATE users
   SET role = 'QUAN_LY', updated_at = now()
 WHERE role IN ('ADMIN', 'MANAGER', 'STAFF');

-- 3) Đổi default cột role sang PENDING (an toàn: user mới 0 quyền tới khi được gán vai)
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'PENDING';

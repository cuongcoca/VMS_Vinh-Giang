-- WVG-16 / WMS-002 — Di trú vai trò legacy sang baseline (bỏ super-role).
-- ADMIN / MANAGER / STAFF → QUAN_LY (baseline quản lý, toàn quyền nghiệp vụ).
-- An toàn: CHỈ đổi cột role, không đụng dữ liệu khác. Idempotent (chạy lại vô hại).
-- LƯU Ý: backup DB trước khi chạy trên production.
UPDATE users
   SET role = 'QUAN_LY', updated_at = now()
 WHERE role IN ('ADMIN', 'MANAGER', 'STAFF');

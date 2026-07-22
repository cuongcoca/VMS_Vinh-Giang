-- 2026-06-04: thêm giá trị enum 'SHIP' cho MovementType (UC-FK-06_TC19 / UC-OUT-05).
-- ADDITIVE ONLY — chỉ thêm giá trị enum, không sửa/xóa data cũ.
-- Mục đích: sự kiện "Xuất kho" thực tế (IN_STAGING → RELEASED) ghi 1 Movement type=SHIP
-- để hiện trong Lịch sử luân chuyển. Trước đây release chỉ ghi audit → vô hình trong lịch sử.
--
-- LƯU Ý: ALTER TYPE ... ADD VALUE KHÔNG bọc trong BEGIN/COMMIT để tương thích mọi
-- phiên bản Postgres (chạy ở chế độ autocommit). IF NOT EXISTS → idempotent.

ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'SHIP';

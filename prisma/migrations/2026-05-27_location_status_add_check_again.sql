-- Phase 5.1 — Thêm enum value CHECK_AGAIN cho LocationStatus
-- BUG_REPORT MD02 UC-MD-05: mockup yêu cầu phân biệt "Chờ kiểm kê" (NEEDS_CHECK)
-- và "Cần kiểm tra lại" (CHECK_AGAIN) là 2 trạng thái khác nhau.
-- Additive only — chỉ thêm enum value, không drop / không rename.

BEGIN;

ALTER TYPE "LocationStatus" ADD VALUE IF NOT EXISTS 'CHECK_AGAIN';

COMMIT;

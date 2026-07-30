# WVG-16 / WMS-002 — Runbook triển khai (cho DevOps · gate #3)

Áp bản fix RBAC (deny-by-default + vô hiệu legacy + default PENDING) an toàn lên
Test rồi Production. Có backup, verify, rollback, smoke, release note.

## 0. Tiền đề & hiện trạng
- Code fix đã ở nhánh `cuongdd_web` (permissions.ts legacy→deny; schema default `PENDING`; migrate gộp).
- Migration: `prisma/migrations/2026-07-30_rbac_pending_default_legacy_deny.sql` (thêm enum `PENDING`, promote ADMIN/MANAGER/STAFF→QUAN_LY, đổi default cột role).
- ⚠ **Test hiện còn 4 user legacy** (ADMIN×2, MANAGER×1, STAFF×1) → đang là super-admin cho tới khi chạy migration. Cần kiểm tra tương tự trên Prod.
- ⚠ Migration này **CHẠY BẰNG `psql -f`** (không bọc transaction — enum ADD VALUE + dùng ngay). KHÔNG dùng `prisma db execute` (bọc tx → lỗi enum).

## 1. Pre-check (đếm user legacy trước khi đổi)
```bash
DBU=$(grep '^DATABASE_URL' .env | head -1 | cut -d= -f2- | tr -d '"' | sed 's/?.*//')
psql "$DBU" -tAc "SELECT role, count(*) FROM users GROUP BY role ORDER BY role;"
psql "$DBU" -tAc "SELECT count(*) AS legacy FROM users WHERE role IN ('ADMIN','MANAGER','STAFF');"
```
Ghi lại con số legacy (Test = 4). Rà: các user legacy này là ai — sau migration họ thành **QUAN_LY** (toàn quyền). Nếu có user không nên là QUAN_LY, BA/Owner quyết vai đúng TRƯỚC khi chạy.

## 2. Backup (bắt buộc)
```bash
TS=$(date +%Y%m%d-%H%M%S)
pg_dump "$DBU" > /root/wvg16-db-$TS.sql && echo "backup OK: /root/wvg16-db-$TS.sql"
```
(Test/Prod đều PG16 native → `pg_dump` 16 khớp. Prod Docker: `docker exec wms-postgres pg_dump ...`.)

## 3. Deploy code + migration
Migration đã được nhúng vào deploy script (Pha 3.6). Chạy như thường:
```bash
nohup bash /root/deploy-test-latest.sh > /root/deploy.log 2>&1 & tail -f /root/deploy.log
```
Script tự: git reset → migration WVG-97 (Pha 3.5) → **migration RBAC WVG-16 (Pha 3.6)** → build 4 → restart 4 → health.
(Chạy thủ công nếu cần: `psql "$DBU" -v ON_ERROR_STOP=1 -f prisma/migrations/2026-07-30_rbac_pending_default_legacy_deny.sql`.)

## 4. Verify sau migration
```bash
# 4a. 0 user legacy còn lại
psql "$DBU" -tAc "SELECT count(*) FROM users WHERE role IN ('ADMIN','MANAGER','STAFF');"   # kỳ vọng 0
# 4b. default cột role = PENDING
psql "$DBU" -tAc "SELECT column_default FROM information_schema.columns WHERE table_name='users' AND column_name='role';"  # 'PENDING'::\"Role\"
# 4c. enum có PENDING
psql "$DBU" -tAc "SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='Role' AND e.enumlabel='PENDING';"
```

## 5. Smoke test (bằng chứng negative-API sau deploy)
```bash
export $(grep '^DATABASE_URL=' .env | xargs)
npx tsx scripts/rbac-live-matrix.ts     # kỳ vọng: 36 PASS
```
**Điểm mấu chốt:** dòng cuối "Legacy ADMIN GET pallets" phải chuyển từ `200 ✗` (trước) → **không còn user ADMIN** (đã promote) hoặc **403** nếu còn sót → xác nhận lỗ đã bịt.

## 6. Rollback (nếu hỏng)
- Code: `git reset --hard <commit-trước>` + build + pm2 restart (hoặc bung backup source tar).
- DB: `psql "$DBU" < /root/wvg16-db-$TS.sql` (restore toàn bộ).
- Lưu ý: migration **additive + idempotent**; đổi default và promote role không phá dữ liệu khác. Rollback DB chỉ cần khi thực sự có sự cố.

## 7. Release note (dán khi lên Prod)
> **WVG-16 — Siết phân quyền (RBAC).** Backend enforce deny-by-default (không còn super-role/wildcard). Vai legacy ADMIN/MANAGER/STAFF đã di trú sang QUAN_LY và bị vô hiệu hoá trong ma trận. User mới mặc định `PENDING` (0 quyền) tới khi Quản lý gán vai. Không đổi dữ liệu nghiệp vụ. Cần: backup DB trước, verify 0 legacy sau, smoke `rbac-live-matrix` = 36 PASS.

## 8. Checklist bàn giao (để Remove Redflag)
- [ ] Pre-check + backup xong (số liệu ghi lại).
- [ ] Migration chạy, verify 4a/4b/4c đạt.
- [ ] Smoke `rbac-live-matrix` = 36 PASS; legacy không còn quyền.
- [ ] QA retest độc lập UI + API 5 vai (dựa harness).
- [ ] BA xác nhận ma trận (`BAO_CAO_WVG16_RBAC_MATRIX_BA.md`) + chọn disposition sàn đọc.
- [ ] Owner xác nhận vai đúng cho các user legacy đã promote.

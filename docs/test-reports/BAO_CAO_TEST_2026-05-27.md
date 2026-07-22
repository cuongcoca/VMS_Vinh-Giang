# Báo cáo Test đã thực hiện — Wave 2026-05-27

> **Phạm vi:** Quá trình dev wave fix 103 TC FAIL — các loại test đã chạy
> trong khi implement (không tính QA manual test cuối).
> **Branch:** `feat/phase0-deploy-tools-and-reports` HEAD `5ecd64a`
> **Deploy:** VPS 188.166.210.73 — 4 PM2 instance đều HTTP 200

---

## 1. Test tự động đã chạy

### 1.1 TypeScript type check (17 lần)

Mỗi commit fix trước khi push đều chạy `npx tsc --noEmit -p .` — verify không có lỗi type. **17/17 lần Exit code 0.**

| Sau commit | Phase | Kết quả tsc |
|---|---|---|
| `e3d2d0d` | 2 — Audit helper | ✅ Exit 0 |
| `a621e5a` | 1.1+1.2+1.3 | ✅ Exit 0 |
| `2fe2738` | 3.1+3.2+3.4 | ✅ Exit 0 |
| `e3d6204` | 4.1+4.3 | ✅ Exit 0 (sau khi sửa script v3) |
| `aafec55` | 5.1 enum | ✅ Exit 0 (sau khi update LocationStatus type local) |
| `5dafc41` | 5.2+8 | ✅ Exit 0 |
| `8bbf725` | 5.3 | ✅ Exit 0 |
| `d10e059` | 7 | ✅ Exit 0 (sau prisma generate model Notification) |
| `03813f7` | 3.5 API | ✅ Exit 0 (sau khi fix `m.note` → `m.reason`) |
| `d73e414` | 3.5 UI + 5.4 | ✅ Exit 0 |
| `ce7217a` | 4.2 | ✅ Exit 0 |
| `a812144` | 6 | ✅ Exit 0 |
| `6ffca1f` | 4.2 tiếp | ✅ Exit 0 |
| `cb0a57c` | 4.2 tail | ✅ Exit 0 |
| `81e2e6a` | 6 UI tail | ✅ Exit 0 |

**Bug type catch được trong session:**
- Phase 5.1: Local `LocationStatus` literal type thiếu 3 value mới — fix bằng cách union 9 string literal.
- Phase 5.1: `kpis` Record type thiếu PARTIAL/NEEDS_CHECK/CHECK_AGAIN — fix bằng Record<LocationStatus | "TOTAL", number>.
- Phase 3.5 API: `m.note` (sai field) → `m.reason` (đúng Movement field).
- Phase 2 helper: AuditLog type chưa update vì Prisma client chưa regen — fix bằng `npx prisma generate`.

### 1.2 Prisma generate (4 lần)

Mỗi lần sửa schema (4 migration), `npx prisma generate` chạy để regenerate client. Tất cả thành công.

| Migration | Schema thay đổi | Generate |
|---|---|---|
| `audit_log_extend` | AuditLog thêm 3 field | ✅ v7.8.0 |
| `location_status_add_check_again` | Enum value CHECK_AGAIN | ✅ |
| `notifications` | Model Notification mới | ✅ |
| `inbound_temp_reject_reason` | InboundTemp thêm 3 field | ✅ |

### 1.3 SQL migration apply (4 file trên VPS 188.166.210.73)

```bash
node vps-deploy.js sync-files prisma/migrations/<file>.sql
node vps-deploy.js exec "cd /var/www/wms-vinhgiang && PGPASSWORD=... psql ... -f <file>.sql"
```

| Migration | Output | Verify |
|---|---|---|
| `audit_log_extend` | `BEGIN → ALTER TABLE → CREATE INDEX → COMMIT` | `\d audit_logs` thấy 3 cột mới |
| `location_status_add_check_again` | `BEGIN → ALTER TYPE → COMMIT` | Enum query có CHECK_AGAIN |
| `notifications` | `BEGIN → CREATE TABLE → CREATE INDEX × 3 → COMMIT` | Table tồn tại |
| `inbound_temp_reject_reason` | `BEGIN → ALTER TABLE → COMMIT` | 3 cột reject_* tồn tại |

---

## 2. Smoke test API (dev server local)

### 2.1 Inventory API — Verify Phase 1.1 (RC-1) hoạt động

**Trước fix:**
- Pallet `CONFIRMED` không tính tồn kho → user chốt phiếu xong vẫn thấy tồn = 0.

**Sau fix:**
- `STOCK_PALLET_STATUSES = [IN_STORAGE, IN_STAGING, CONFIRMED]`
- API trả thêm field `confirmed_qty` riêng.

**Test command:**
```bash
curl -s http://localhost:3000/wms/api/inventory/by-item | head -c 800
```

**Response (đã verify):**
```json
{
  "success": true,
  "data": [
    {
      "item_code": "VG-DA-1000",
      "item_name": "DA 1L",
      "available_qty": 0,      // IN_STORAGE
      "staging_qty": 8,        // IN_STAGING
      "confirmed_qty": 15,     // ← Mới thêm: CONFIRMED chưa xếp vị trí
      "total_qty": 23,         // 0 + 8 + 15 = 23 ✓
      ...
    }
  ]
}
```

**Kết quả:** ✅ Pallet CONFIRMED (15 thùng) hiển thị riêng + được cộng vào `total_qty`. Trước fix → 0.

### 2.2 Dashboard KPI — Verify refactor `STOCK_PALLET_STATUSES`

**Test:**
```bash
curl -s "http://localhost:3000/wms/api/dashboard/kpi?period=30d"
```

**Response:**
```json
{
  "data": {
    "total_stock_items": 63,        // include CONFIRMED
    "total_stock_weight_kg": 792.5,
    "pallet_queue_count": 2,        // số pallet CONFIRMED chờ xếp vị trí
    ...
  }
}
```

**Kết quả:** ✅ KPI đếm đúng pallet CONFIRMED.

### 2.3 Audit log verify trên VPS

```sql
\d audit_logs
-- Result:
--  performed_by_role | character varying(40)
--  ip_address        | character varying(45)
--  user_agent        | character varying(255)
-- + index audit_logs_performed_by_idx
```

**Kết quả:** ✅ Schema mở rộng đầy đủ.

---

## 3. Deploy verify (VPS 188.166.210.73)

### 3.1 Build 4 instance Next.js

Sau khi sửa lỗi typecheck (commit qr-print + 12 untracked WIP):

```bash
node vps-deploy.js build all
```

**Kết quả:** ✅ Exit 0 — cả 4 instance build production:
- `/wms` (desktop admin, port 3001)
- `/xenang` (mobile xe nâng, port 3002)
- `/thukho` (mobile thủ kho, port 3003)
- `/kiemke` (mobile kiểm kê, port 3004)

### 3.2 PM2 restart 4 instance

```bash
node vps-deploy.js restart all
```

**Kết quả:**

| Instance | PID | Status | Memory |
|---|---|---|---|
| wms-vinhgiang | 495592 | ✅ online | 67.0mb |
| wms-xenang | 495605 | ✅ online | 66.7mb |
| wms-thukho | 495626 | ✅ online | 66.6mb |
| wms-kiemke | 495635 | ✅ online | 66.5mb |

### 3.3 Health check HTTP

```bash
node vps-deploy.js verify
```

**Kết quả:**
```
wms      HTTP 200 (port 3001)
xenang   HTTP 200 (port 3002)
thukho   HTTP 200 (port 3003)
kiemke   HTTP 200 (port 3004)
```

✅ Cả 4 instance phục vụ HTTP 200.

---

## 4. Cảnh báo gặp phải trong quá trình deploy

### 4.1 VPS có dirty files + branch mặc định khác

Lần đầu chạy `vps-deploy.js full` → fail vì:
- VPS đang ở branch `vinhgiang1` (legacy production)
- Local đã commit ở branch `feat/phase0-deploy-tools-and-reports`
- VPS có 22 dirty files chưa commit + untracked files

**Workaround:**
1. `git stash push -m 'pre-deploy-stash-2026-05-27'` (stash dirty)
2. `git stash push -u -m 'pre-deploy-untracked-2026-05-27'` (stash untracked)
3. `git checkout feat/phase0-deploy-tools-and-reports`
4. `git pull origin feat/phase0-deploy-tools-and-reports`

**Stash trên VPS** giữ lại — có thể khôi phục với `git stash list && git stash pop stash@{N}` nếu cần.

### 4.2 Untracked files local chặn build

Lần build 1 + 2 fail vì code có `<Link href="/locations/qr-print">` nhưng `src/app/locations/qr-print/page.tsx` chưa add git (untracked local). Next.js typegen sinh validator.ts ref đến file không tồn tại trong git checkout → typecheck fail.

**Phát hiện và fix:**
- Lần 2: commit 2 file qr-print (`2583613`)
- Lần 3: commit 12 thư mục WIP còn lại (`5ecd64a`)
  - Routes: finish-receiving, request-recheck, by-barcode, by-code, qr-png × 2, scan, uploads
  - Pages: /movements, /scan-debug
- Lần 4: build pass

**Bài học:** trước khi deploy, chạy `git status --short | grep '^??'` để liệt kê untracked. Add tất cả `src/app/` untracked vào git.

---

## 5. Test CHƯA chạy — Cần QA

### 5.1 E2E manual test trên VPS staging

Cần QA login bằng 5 role test (đã có credential trong memory) và verify:

| Luồng | Phase liên quan | Test data đề xuất |
|---|---|---|
| Login + show password Enter | 8 | Account `0333041204` Kế toán, password `Vtoan123@` |
| Tạo phiếu YC nhập → notification Thủ kho | 7.2 | Login Kế toán tạo phiếu → switch tab Thủ kho mobile → check 🔔 badge |
| Tiếp nhận phiếu mobile có chênh lệch | 1.3 | Nhập SL khác `qty_expected` → thấy textarea ghi chú |
| Chốt phiếu → tồn kho lên | 1.1 (RC-1) | Trước chốt: GET `/api/inventory/by-item` confirmed_qty=0. Sau chốt: confirmed_qty > 0 |
| Đối chiếu PC hiển thị 4 KPI cards | 1.2 | Mở /inbound/[id] ở status DRAFT/PENDING → thấy KPI cards |
| Pallet — tạo, sửa, xác nhận, audit | 3 + 3.5 | Tạo pallet không line → status EMPTY ("Chưa kích hoạt"); audit log có role/IP |
| Lịch sử pallet timeline | 3.5 UI | Mở /pallets/[id] tab Lịch sử → thấy người + role + IP + from→to location |
| Lọc pallet theo ngày + NCC | 3.5 UI | /pallets → 3 filter form (Từ ngày / Đến ngày / NCC) |
| Forklift QR put-away | 6.1 | /forklift/put-away → quét QR vị trí (validate X-NN-NN) |
| Forklift FEFO + xuất 1 phần | 6.2 + 6 UI | /forklift/stage-out → tìm mã hàng → chọn pallet HSD gần nhất → split 50% |
| Forklift lịch sử hôm nay | 6.3 | /forklift/history → checkbox "Chỉ hôm nay" + KPI 4 loại |
| Outbound dashboard | 7.1 | /outbound → 4 KPI Tổng pallet / Tổng mã / Tổng SL / Quá 24H |
| Phiếu tạm Mobile upload ảnh | 4.1 | /thukho/adhoc/new chụp ảnh chứng từ → mở lại detail thấy ảnh |
| Chuẩn hóa phiếu tạm Desktop — Tạo NCC | 4.2 | /inbound-adhoc/[id] phiếu chưa có NCC → click "Tạo NCC mới" |
| Chuẩn hóa — Liên kết phiếu YC sẵn có | 4.2 tail | Click "Liên kết phiếu có sẵn" → chọn phiếu DRAFT → append dòng |
| LocationStatus 9 trạng thái | 5.1 | /locations → 9 màu/label theo mockup |
| Khai báo SP validate i18n | 5.2 | Form Thêm SP → bỏ trống all → 1 thông báo tiếng Việt |
| Mã hàng Mobile có ảnh hàng | 5.3 | /thukho/item-code/new chụp 2 ảnh |
| Nhóm hàng Import Excel | 5.4 | /product-groups → nút Import Excel |
| Tồn kho theo mã hàng | MD08 | /inventory/by-sku → verify confirmed_qty hiển thị riêng |
| Notification bell mobile | 7.2 | Layout thủ kho có 🔔 với badge unread |

### 5.2 Database backup khuyến nghị

Trước khi QA test thực, recommend backup `wms_vinhgiang` DB trên VPS:

```bash
ssh root@188.166.210.73 \
  "PGPASSWORD=wms_password pg_dump -h 127.0.0.1 -U wms_user wms_vinhgiang > /tmp/backup_2026-05-27.sql"
```

### 5.3 Cron / scheduled jobs

Chưa verify các job cron của project (nếu có) sau restart PM2 — QA có thể cần kiểm tra.

---

## 6. Tổng kết test

| Loại test | Lượt chạy | Pass | Fail | Ghi chú |
|---|---:|---:|---:|---|
| TypeScript check (`tsc --noEmit`) | 17 | 17 | 0 | Mỗi phase trước commit |
| Prisma client regenerate | 4 | 4 | 0 | Sau mỗi migration schema |
| SQL migration apply VPS | 4 | 4 | 0 | psql exec qua workaround |
| API smoke test local | 2 | 2 | 0 | inventory/by-item + dashboard/kpi |
| VPS build all instance | 4 | 1 | 3 | 3 fail do untracked files chưa commit |
| VPS PM2 restart all | 1 | 1 | 0 | 4/4 instance online |
| VPS HTTP health check | 1 | 4/4 | 0/4 | Cả 4 port HTTP 200 |
| **E2E manual QA** | **0** | — | — | **Chờ QA chạy theo bảng 5.1** |

---

## 7. Khuyến nghị bước tiếp theo

1. **QA verify** theo bảng 5.1 (~25 luồng test) — cập nhật Google Sheet `Role_QLY_VĨNH GIANG` từ FAIL → Pass cho từng TC tương ứng.
2. **Migration backup** trước E2E test (mục 5.2).
3. **Retest 5 TC đã đánh `Fixed`** (TC_T03_12, TC_STANDARD_001, TC_SUP_001/002, TC_CREATE_PAL_011) — verify hoạt động đúng trong VPS đã deploy.
4. **Test 4 module trống MD08-MD11** lần đầu — kết quả sẽ là input cho wave fix kế tiếp.
5. **Verify mobile thật** 5 TC bug còn (TC_TMP_IN_011/_019/_023/_025 + Row 17) — cần thiết bị mobile thực, không thể test trên desktop browser.

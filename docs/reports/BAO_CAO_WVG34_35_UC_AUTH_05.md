# BÁO CÁO WVG-34 [BE] + WVG-35 [FE] — UC-AUTH-05 Phân quyền theo vai trò (RBAC)

**Story:** WVG-32 · **Subtask:** WVG-34 (BE) + WVG-35 (FE) · **Requirement:** UC-AUTH-05
**Phạm vi:** LOCAL (chưa deploy) · nhánh `cuongdd_web` · **Ngày:** 2026-07-30
**Audit gốc:** "Có một phần; RBAC sai mô hình — Frontend cho ADMIN/MANAGER/STAFF wildcard toàn quyền; ma trận RBAC mới chỉ bật/tắt cấp module và chưa kiểm thử backend với đủ 5 vai trò."

---

## 1. Bối cảnh: repo có HAI hệ RBAC song song

| | **Hệ A — Ma trận quyền server (enforce thật)** | **Hệ B — Toggle menu client (legacy)** |
|---|---|---|
| Nguồn | `src/lib/permissions.ts` + `auth-server.ts` | `src/lib/rbac.ts` (localStorage) |
| API | `/api/system/permissions` | `/api/system/rbac` |
| Màn | `/wms/system/permissions` | `/wms/system/rbac` |
| Cấp | **action-level** (none/read/full/special ×19 resource ×5 vai) | bật/tắt module (boolean) |
| Cưỡng chế | Backend deny-by-default, **không bypass** | Client-only, **bypass được** |

Nền tảng Hệ A đã dựng ở **WVG-16 (WMS-002)**. Audit finding mô tả đúng **Hệ B** (module toggle + tiêm ADMIN "toàn quyền"). Đợt này hoàn thiện AC UC-AUTH-05 và **gỡ nhập nhằng** giữa 2 hệ.

## 2. WVG-34 [BE] — API, data, authorization, audit

### B1 — Enforcement 5 vai (dùng nền Hệ A)
- Guard phủ **112/123 route** (`requirePermission`/`guardPermission`); 11 route còn lại đều hợp lệ (login/me/sessions/forgot-password/uploads/404) — **không route nghiệp vụ nào hở**.
- Chạy `scripts/rbac-live-matrix.ts` **trên local** với 5 vai + no-token.

### B2 — Siết validate `PUT /api/system/permissions` (không ghi một phần)
- Thêm `validatePermissionMatrix()` (`permissions.ts`): chỉ chấp nhận **baseline role + resource + level hợp lệ**; sai bất kỳ → **400 `{error, errors[]}`, KHÔNG ghi**.
- Đảm bảo audit `UPDATE_PERMISSION_MATRIX` sau khi lưu.

### B3 — Vá Hệ B để hết nhập nhằng
- **Bỏ tiêm `ADMIN` full-access** (`roleFeatures.ADMIN=allFeatures`, `roleRoutes.ADMIN=["*"]`) trong `GET /api/system/rbac` — nguồn gây hiển thị "toàn quyền" sai lệch (đúng điều Audit nêu).
- **Thêm endpoint còn thiếu `POST /api/system/rbac/reset`** (system:special, reset về `DEFAULT_ROLE_FEATURES`, audit `RESET_RBAC_MATRIX`) — trước đây UI gọi nhưng route không tồn tại.

### B4 (phát sinh) — Sửa BUG audit hỏng thầm lặng (quan trọng cho AC #4)
- Phát hiện: `audit_logs.entity_id` là cột **`@db.Uuid`**, nhưng code WVG-16 truyền `entity_id: saved.key` = `"rbac_permission_matrix"` (chuỗi) → Postgres **P2007** "invalid input syntax for type uuid" → audit ma trận quyền **chưa từng ghi được**.
- Sửa (KHÔNG đổi schema): thêm `keyToUuid()` (`audit.ts`) ánh xạ config-key → **UUID v5 tất định**; áp cho cả 3 route audit config (permissions PUT, rbac PUT, rbac/reset). Khoá gốc vẫn lưu ở `reason`/`new_value`.

## 3. WVG-35 [FE] — UI, route guard, states

### F1 — Route guard trang cấu hình
- AppLayout đã chặn client (`canAccess`: chỉ QUAN_LY có route `/system`) + API enforce 403. Bổ sung màn `/system/permissions` **trạng thái 403 "Không có quyền" tường minh** (khi backend từ chối), không chỉ ẩn menu.

### F2 — Màn ma trận action-level là nơi cấu hình chi tiết
- Thêm **hộp confirm khi Lưu** (AC #5): đếm số ô đổi → "Xác nhận cập nhật ma trận quyền: N ô thay đổi… Tiếp tục?"; **huỷ → không gọi PUT**.
- Sửa footnote sai: "legacy cố định toàn quyền" → **"đã di trú sang Quản lý và không còn quyền (deny-by-default)"**.
- Hiển thị `errors[]` từ 400 khi lưu thất bại.

### F3 — Relabel màn legacy `/system/rbac`
- Đổi tiêu đề → **"Hiển thị menu theo vai trò"**; thêm **banner cảnh báo**: *"chỉ điều khiển hiển thị menu, KHÔNG phải hàng rào bảo mật; quyền thật do ma trận quyền API enforce"* + **link sang `/system/permissions`**.
- Bỏ nút **"Tạo vai trò"** stub (`window.alert` gây hiểu nhầm) + bỏ câu "ADMIN/MANAGER/STAFF luôn toàn quyền". Nút Khôi phục nay gọi endpoint thật (B3).

## 4. Bằng chứng (chạy LOCAL, port 3000)

### 4.1 Enforcement 5 vai — `rbac-live-matrix.ts`: **36/36 PASS**
```
Endpoint              QUAN_LY  KE_TOAN  THU_KHO  XE_NANG  KIEM_KE  no-tok
GET  pallets          200✓     200✓     200✓     200✓     200✓     401✓
DEL  pallets/{fake}   404✓     404✓     404✓     404✓     403✓·D   401✓
GET  inventory/by-item 200✓    200✓     200✓     200✓     200✓     401✓
GET  movements        200✓     200✓     200✓     200✓     200✓     401✓
GET  users (admin)    200✓     403✓·D   403✓·D   403✓·D   403✓·D   401✓
POST forklift/put-away 400✓    403✓·D   403✓·D   400✓     403✓·D   401✓
Kết quả: 36 PASS · 0 FAIL
```
(·D = trường hợp bị deny, kỳ vọng 403 — đúng. Backend chặn thật, không chỉ ẩn menu.)

### 4.2 B2 — validate & không ghi một phần (test qua API token QUAN_LY)
| Case | Kết quả |
|---|---|
| PUT level sai `QUAN_LY.pallet="superuser"` | **400** — "Mức quyền không hợp lệ ở QUAN_LY.pallet… (chỉ nhận none, read, full, special)" |
| PUT role lạ `HACKER` | **400** — "Vai trò không hợp lệ: HACKER (chỉ nhận QUAN_LY, KE_TOAN, THU_KHO, XE_NANG, KIEM_KE)" |
| GET lại sau 400 | `QUAN_LY.pallet` vẫn `special` → **KHÔNG ghi một phần** |
| PUT hợp lệ | **200** "Đã cập nhật ma trận quyền." |
| **Negative role** KE_TOAN PUT | **403** (deny-by-default ở backend) |

### 4.3 B3 — bỏ ADMIN + reset (test qua API)
- `GET /api/system/rbac`: roleFeatures chỉ còn **5 vai baseline**, `has_ADMIN=false`, không còn route `"*"`.
- `POST /api/system/rbac/reset` → **200** "Đã khôi phục ma trận hiển thị menu về mặc định."

### 4.4 B4 — audit nay GHI ĐƯỢC (AC #4)
```
✓ UPDATE_PERMISSION_MATRIX: entity_id=ccd3d23b-…-620963b2 role=QUAN_LY ip=::1 @ 2026-07-30T09:16:14Z
✓ RESET_RBAC_MATRIX:        entity_id=74faf047-…-946644a4 role=QUAN_LY ip=::1 @ 2026-07-30T09:16:15Z
```
(Trước khi sửa B4: cả 2 action đều thiếu bản ghi dù systemConfig đã đổi.)

### 4.5 F2/F3 — UI (test DOM thật)
- Confirm dialog: đổi 1 ô → message "**1 ô thay đổi…**"; **huỷ → put_called=false** (không lưu).
- Màn /system/rbac: banner "chỉ hiển thị menu / KHÔNG phải bảo mật"=✓, link /permissions=✓, tiêu đề "Hiển thị menu theo vai trò"=✓, stub "Tạo vai trò"=đã bỏ, "ADMIN toàn quyền"=đã bỏ.

### 4.6 `npx tsc --noEmit`: sạch (chỉ còn artifact `.next/dev/types`).

## 5. File thay đổi
```
BE:   src/lib/permissions.ts            (+ validatePermissionMatrix)
      src/lib/audit.ts                  (+ keyToUuid — vá bug audit uuid)
      src/app/api/system/permissions/route.ts   (validate + audit uuid)
      src/app/api/system/rbac/route.ts          (bỏ ADMIN inject + audit uuid)
      src/app/api/system/rbac/reset/route.ts    (MỚI — endpoint reset)
FE:   src/app/system/permissions/page.tsx       (confirm + 403 state + fix text)
      src/app/system/rbac/page.tsx              (relabel + banner + bỏ stub)
```

## 6. Ghi chú phạm vi & mapping
- KHÔNG đổi field/enum/table/schema/migration/production-data. `keyToUuid` là fix runtime, không đổi cột.
- Mapping API UC-AUTH-05: `GET/PUT /api/system/permissions` (ma trận enforce), `GET/PUT /api/system/rbac` + `POST /reset` (hiển thị menu), mọi route business verify qua `requirePermission`.

## 7. Điểm cần vai khác chốt (Remove flag)
- **BA Main**: xác nhận "sàn đọc" (mọi baseline role đọc 16 resource nghiệp vụ) so với UC v3.1 — xem `BAO_CAO_WVG16_RBAC_MATRIX_BA.md`.
- **QA (WVG-36)**: retest độc lập 5 vai (dựa `rbac-live-matrix.ts`) + UI.

→ **Chưa deploy** (theo chỉ đạo). Chờ commit → soạn 2 file nộp WVG-34 & WVG-35.

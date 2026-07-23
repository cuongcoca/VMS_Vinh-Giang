# Báo cáo đối chiếu — Tài liệu UC v3.1 vs Code hiện tại

**Ngày:** 2026-07-23 · **Branch:** `cuongdd_web` · **Nguồn chuẩn:** `WMS_VinhGiang_UseCases_v3.1.docx` (55 UC / 11 module / 5 vai trò)

---

## 1. Tổng kết

| Trạng thái | Số UC | Tỷ lệ |
|---|---:|---:|
| ✅ **Đã làm đủ** | 42 | 76% |
| ⚠️ **Đã làm nhưng LỆCH / thiếu một phần** | 12 | 22% |
| ❌ **Chưa làm** | 1 | 2% |
| **Tổng** | **55** | |

**Không có UC nào bị bỏ sót hoàn toàn về mặt màn hình/API** — mọi module đều có route + API + model. Vấn đề nằm ở **12 điểm lệch**, trong đó 4 điểm ở mức nghiêm trọng.

Quy mô code đối chiếu: **120 API route**, ~150 page, 43 Prisma model, 1 app Expo phụ trợ.

---

## 2. Bảng đối chiếu chi tiết

### AUTH — Xác thực & Phân quyền

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-AUTH-01 Đăng nhập | ✅ | `api/auth/login`, `app/auth/page.tsx` — email hoặc SĐT, "Ghi nhớ" → token 30d |
| UC-AUTH-03 Đổi mật khẩu | ✅ | `api/auth/change-password`, `system/change-password` |
| UC-AUTH-04 Quên mật khẩu | ✅ | OTP 3 bước: `send-otp` → `verify-otp` → `reset-password` |
| UC-AUTH-05 RBAC | ⚠️ **LỆCH NẶNG** | Xem mục 3.1 |

### MD — Master Data

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-MD-01 Khai báo sản phẩm | ✅ | `model Product` đủ 6 trường mới (`short_name`, `specification`, `units_per_box`, `weight_per_box`, `volume_per_box`, `manage_lot/expiry`) + import Excel |
| UC-MD-02 Quản lý Mã hàng ★ | ✅ | `model ItemCode` có `status: pending\|standardized`, `created_by` / `standardized_by`, `suggest-merge`; mobile `thukho/item-code/new` |
| UC-MD-03 Nhóm hàng | ✅ | + import Excel (vượt spec) |
| UC-MD-04 Đơn vị tính | ✅ | |
| UC-MD-05 Vị trí kho | ✅ | `formatCode()` sinh đúng `A-03-02`; đủ 4 `LocationType`; có bulk-create, import Excel, in QR |
| UC-MD-06 Nhà cung cấp | ✅ | |

### PAL — Pallet

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-PAL-01 Tạo pallet | ✅ | `PLYYMMDD.NNN` + `pg_advisory_xact_lock` chống trùng. *Luồng offline (mất mạng → lưu offline, sync sau) chưa có* |
| UC-PAL-02 Cập nhật pallet | ✅ | |
| UC-PAL-03 Nhận diện đa phương thức | ⚠️ **LỆCH** | Xem mục 3.5 — chỉ 4/5 phương thức |
| UC-PAL-04 Xác nhận pallet | ✅ | Khóa dòng hàng, tính tổng tải trọng |
| UC-PAL-05 Sửa sau xác nhận | ✅ | `api/pallets/[id]/unlock` + audit |
| UC-PAL-06 Lịch sử pallet | ✅ | |

### IN — Inbound có phiếu

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-IN-01 Lập phiếu YC nhập | ✅ | `PHN-YYYY-SSSS` |
| UC-IN-02 Thủ kho tiếp nhận | ✅ | `receive` + `finish-receiving` |
| UC-IN-03 Đối chiếu | ✅ | Có engine phân loại + section "Hàng phát sinh" + cảnh báo mã tạm `TMP-` |
| UC-IN-04 Chốt phiếu | ✅ | Chặn chốt khi còn pallet chưa xác nhận / thiếu `qty_accepted`; bắt buộc `close_note` khi lệch |
| UC-IN-05 Theo dõi phiếu | ⚠️ **LỆCH** | Xem mục 3.4 — 6 trạng thái thay vì 8 |
| UC-IN-06 Import Excel hàng về ★ | ✅ | Đọc format Unilever, map nhóm BU (HC/BE/PC/F), 3 mức match |

### INTMP — Nhập không phiếu

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-INTMP-01 Tạo phiếu tạm (Mobile) | ✅ | `thukho/adhoc/new`, `PNT-YYYY-SSSS` |
| UC-INTMP-02 Chuẩn hóa (Desktop) | ✅ | `standardize` / `reject` / `create-supplier` |
| UC-INTMP-03 Xem tồn tạm | ✅ | Có cảnh báo tuổi phiếu: `new` <2 ngày · `warning` 2–3 · `overdue` >3 |

### FK — Xe nâng

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-FK-01 DS pallet chờ xếp | ✅ | |
| UC-FK-02 Đưa vào vị trí | ✅ | |
| UC-FK-03 Chuyển vị trí | ✅ | Khóa Mã/SL/Lô/Date |
| UC-FK-04 Sang khu chờ xuất (FEFO) | ✅ | `orderBy expiry_date asc nulls last`, ngưỡng 7/30 ngày; hỗ trợ **TH-A FULL** và **TH-B PARTIAL** (có `split_seq`) |
| UC-FK-05 Hoàn trả (Audit) | ⚠️ **LỆCH** | Xem mục 3.2 — thiếu bước Kế toán phê duyệt |
| UC-FK-06 Lịch sử luân chuyển | ✅ | Có `audit_log_id` gắn vào movement |

### OUT — Khu chờ xuất & Báo cáo

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-OUT-01 Xem khu chờ xuất | ✅ | |
| UC-OUT-02 Báo cáo xuất tương đối | ✅ | |
| UC-OUT-03 Tốc độ luân chuyển | ⚠️ **LỆCH quyền** | Xem mục 3.7 |
| UC-OUT-04 Gợi ý nhập hàng | ✅ | Đúng công thức: BQ xuất/ngày × số ngày dự trữ − tồn |
| UC-OUT-05 Cân lại tồn ★ | ⚠️ **LỆCH** | Xem mục 3.3 |

### INV — Tồn kho & Kiểm kê

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-INV-01 Tồn theo mã | ✅ | |
| UC-INV-02 Tồn theo vị trí | ✅ | |
| UC-INV-03 Tồn theo pallet | ✅ | |
| UC-INV-04 Tồn theo lô/HSD | ✅ | |
| UC-INV-05 Cảnh báo HSD & tồn thấp | ❌ **CHƯA LÀM (phần tự động)** | Xem mục 3.6 |
| UC-INV-06 Kiểm kê theo vị trí ★ | ✅ | Mạnh hơn spec: `is_outside_system`, `lot_actual`, `expiry_actual`, `found_pallet_code` |
| UC-INV-07 Kiểm kê theo mã ★ | ✅ | |
| UC-INV-08 Xử lý chênh lệch ★ | ✅ | `stock-count/[id]/discrepancy` + `recount` |
| UC-INV-09 Phiếu điều chỉnh ★ | ✅ | Duyệt 2 cấp, `requireAuth(["QUAN_LY"])` cho approve/reject, `ADJ-YYYY-NNNN`, audit đầy đủ |

### DASH / SYS / INT

| UC | Trạng thái | Bằng chứng / Ghi chú |
|---|---|---|
| UC-DASH-01 Dashboard theo vai trò | ✅ | Redirect theo role + 3 dashboard mobile riêng |
| UC-DASH-02 KPI tổng quan | ✅ | `manager-kpi` + `accountant-kpi` + `warehouse-map` |
| UC-SYS-01 Cấu hình chung | ✅ | |
| UC-SYS-02 Cấu hình mail | ✅ | SMTP + test kết nối + `MailLog` |
| UC-SYS-03 Audit Log | ✅ | + xuất Excel |
| UC-SYS-04 Quản lý người dùng | ✅ | **Đã bỏ sạch trường MLM** (Ví/Điểm/Cha/Người giới thiệu). Lệch nhỏ: xem 3.8 |
| UC-SYS-05 Profile cá nhân | ✅ | |
| UC-INT-01 Quét barcode/QR | ✅ | `BarcodeScannerModal` + `api/scan/resolve` |
| UC-INT-02 Chụp ảnh đính kèm | ⚠️ **LỆCH** | Xem mục 3.9 |
| UC-INT-03 Xuất Excel | ⚠️ **LỆCH** | Xem mục 3.10 |

---

## 3. Chi tiết các điểm LỆCH

### 3.1 🔴 UC-AUTH-05 — RBAC không được thực thi ở server (NGHIÊM TRỌNG)

**3 vấn đề chồng nhau:**

1. **Chỉ 11/120 API route có kiểm tra quyền.** Chỉ các file sau gọi `requireAuth`/`withAuth`:
   `adjustments` (3), `auth/profile`, `item-codes`, `locations/bulk`, `locations/import-excel` (2), `products/[id]`, `stock-count/[id]/recount`, `system/rbac`.
   → 109 route còn lại (gồm `forklift/return`, `outbound/rebalance`, `pallets`, `inbound/*`, `users`) **không verify JWT và không check role**. Bất kỳ ai biết URL đều gọi được.
2. **`src/middleware.ts` không guard gì cả** — chỉ rewrite path cho build mobile standalone. Comment trong file tự thừa nhận: *"ta sẽ skip middleware server-side và xử lý Auth Guard ở Layout hoặc Page"*. Token lưu `localStorage` nên middleware Edge không đọc được.
3. **Độ mịn quyền không khớp spec.** `FEATURE_MAP` chỉ có **12 feature theo module**, chỉ 2 mức (có/không). Spec v3.1 yêu cầu ma trận **55 UC × 5 vai trò** với **3 mức: ✓ / ◐ (read-only) / ⊙ (phê duyệt)**. Hiện `◐` và `⊙` không tồn tại trong code → không thể cấu hình UC-IN-05 (TK ◐), UC-INV-01/02 (NKK ◐), UC-FK-05 (KT ⊙).

**Ảnh hưởng:** UC-AUTH-05, và gián tiếp toàn bộ 55 UC vì ma trận phân quyền là nền.

### 3.2 🔴 UC-FK-05 — Thiếu bước Kế toán phê duyệt sửa nội dung

`api/forklift/return/route.ts` cho phép sửa trực tiếp `qty_box` / `lot` / `expiry_date` / `manufactured_date` rồi ghi audit log. Đúng phần *bắt buộc lý do* (≥5 ký tự) và *audit log*, nhưng **không có bước phê duyệt của Kế toán** như spec:

> *"Nếu cần sửa nội dung (SL/Lô/Date) → Kế toán phê duyệt việc sửa"* — quyền `⊙` của KE_TOAN.

Đây là **luồng DUY NHẤT trong hệ thống được sửa số liệu thực tế** → thiếu kiểm soát 2 mắt ở đúng chỗ rủi ro nhất. Kết hợp với 3.1 (route không guard) thì bất kỳ ai cũng sửa được tồn.

### 3.3 🔴 UC-OUT-05 — Cân lại tồn làm sai lệch dữ liệu dẫn xuất

`api/outbound/rebalance/route.ts` chỉ update **`qty_box`**:

```ts
await prisma.palletLine.update({
  where: { id: pallet_line_id },
  data: { qty_box: newQty },     // ← thiếu qty_unit, weight_kg
});
```

So với `api/forklift/return/route.ts` (làm đúng) thì thiếu:
- `qty_unit = qty_box × units_per_box` → **tồn theo đơn vị lẻ sai sau mỗi lần cân**
- `weight_kg = qty_box × weight_per_box` → **trọng lượng dòng sai**
- Không recalc `pallet.total_weight_kg` → **tải trọng pallet sai**

Ngoài ra: model `OutboundRebalance` / `OutboundRebalanceLine` đã khai báo trong schema nhưng **không có dòng code nào dùng** (`grep outboundRebalance` = 0 kết quả). Lần cân chỉ để lại `AuditLog`, không có phiếu cân tra cứu được — trong khi `codegen.ts` đã đặt sẵn prefix `RBL` và ghi *"chưa code dùng (TODO Sprint D)"*.

### 3.4 🟡 UC-IN-05 — 6 trạng thái phiếu thay vì 8

| Spec v3.1 (8) | `enum InboundStatus` (6) |
|---|---|
| Mới | `DRAFT` |
| Chờ Thủ kho | `PENDING` |
| Chuẩn bị | — *(gộp vào PENDING)* |
| Kiểm đếm | `RECEIVING` |
| Pallet chờ nhập | — **thiếu** |
| Đưa vào vị trí | — **thiếu** |
| Chờ chốt | `RECONCILING` |
| Đã chốt | `COMPLETED` |

Hai trạng thái "Pallet chờ nhập" và "Đưa vào vị trí" bị mất → Kế toán không nhìn được phiếu đang ở khâu xe nâng (phải tự suy từ trạng thái pallet). `CANCELLED` là trạng thái code thêm, không có trong spec.

### 3.5 🟡 UC-PAL-03 — Thiếu phương thức ③ OCR

Spec yêu cầu 5 phương thức. Code có 4:

| # | Phương thức | Trạng thái |
|---|---|---|
| ① | Quét barcode | ✅ |
| ② | Quét QR | ✅ |
| ③ | **Chụp ảnh mã vỏ thùng (OCR)** | ❌ **stub** |
| ④ | Tìm trong catalog | ✅ |
| ⑤ | Nhập tay | ✅ (có auto-fallback khi camera lỗi) |

`BarcodeScannerModal.tsx` ghi rõ: *"Cho phép mở picker ảnh từ thư viện (xử lý OCR mã ở server, hiện stub)"*. Nút "Ảnh" thực tế là **decode barcode từ file ảnh** (`scanFile` full-res), **không phải OCR chữ in trên vỏ thùng**. Hàng không có mã vạch vẫn phải nhập tay.

### 3.6 🔴 UC-INV-05 — Toàn bộ phần TỰ ĐỘNG chưa có

| Yêu cầu spec | Trạng thái |
|---|---|
| Trang cảnh báo HSD ≤7 / ≤30 ngày | ✅ `api/inventory/alerts` + `inventory/alerts` |
| Cảnh báo tồn dưới min / vượt max | ✅ (`Product.min_stock` / `max_stock`) |
| Cấu hình ngưỡng | ✅ `api/inventory/alert-settings` |
| **Cron chạy hàng ngày 6:00** | ❌ **không tồn tại** — không có cron file, GitHub Action, systemd timer hay job scheduler nào trong `scripts/`, `infra/`, `.github/` |
| **Gửi email cảnh báo** | ❌ `lib/mailer` chỉ được import ở `forgot-password/send-otp` và `system/mail` |
| **Badge / notification** | ❌ `ALERT_EXPIRY_SOON` và `ALERT_LOW_STOCK` được **khai báo** trong `lib/notifications.ts` nhưng **không có nơi nào gọi** (grep toàn repo = 0) |

Kết quả: cảnh báo chỉ hiện khi người dùng **chủ động mở trang**. Không ai được báo động — đúng ngược với mục đích của UC.

### 3.7 🟡 UC-OUT-03 — Kế toán bị chặn, trái ma trận v3.1

`src/lib/rbac.ts:99-102` hard-code:

```ts
// Chặn Kế toán truy cập trang Tốc độ luân chuyển theo TC20
if (role === "KE_TOAN" && pathname.startsWith("/outbound/turnover")) return false;
```

Ma trận v3.1 (Phần I, bảng OUT) ghi **UC-OUT-03 · KT = ✓**, và Phần III liệt kê UC-OUT-03 trong 41 UC của Kế toán. → Code và tài liệu mâu thuẫn trực tiếp. Cần chốt: sửa code hay sửa tài liệu (test case TC20 có vẻ đã quyết định khác).

### 3.8 🟢 UC-SYS-04 — Còn 3 vai trò legacy

`enum Role` vẫn giữ `ADMIN | MANAGER | STAFF` cạnh 5 vai trò mới. UI đã ẩn (`FORM_ROLES` chỉ 5 vai trò mới) nhưng `auth-server.ts` định nghĩa chúng là **SUPER_ROLES tự động pass mọi `allowedRoles`**. Tài khoản cũ mang role này sẽ bypass toàn bộ RBAC. Cần migration dữ liệu + xoá khỏi enum.

### 3.9 🟡 UC-INT-02 — Đính kèm ảnh chỉ dùng ở 1 màn hình

Model `Attachment` + `api/attachments` + `AttachmentPanel` / `AttachmentUpload` đều có, nhưng **chỉ được nhúng vào `inbound/[id]/page.tsx`**. Spec yêu cầu đính kèm vào *phiếu nhập / xuất / kiểm kê*. Chưa có ở: phiếu tạm (INTMP-01), dòng pallet, kết quả kiểm kê (INV-06/07). Component `shared/ImageUpload.tsx` **không được import ở đâu** (code chết).

Giới hạn 10 ảnh / 5MB theo spec: chưa xác nhận có enforce.

### 3.10 🟡 UC-INT-03 — Xuất Excel thiếu hộp thoại cấu hình

`components/ExcelExport.tsx` là nút xuất **một-cú-nhấp với cột cố định**. Spec yêu cầu hộp thoại chọn:
- Phạm vi: Toàn bộ / Đã lọc / Đã chọn — ❌
- Chọn cột cần xuất — ❌
- Định dạng `.xlsx` / `.csv` — ❌ (chỉ xlsx)
- Tiêu đề công ty, đóng băng dòng, tô màu cảnh báo HSD — ❌

Độ phủ cũng thiếu. Spec liệt kê phải có ở INV-01/02/03/04, OUT-02/03, SYS-03, INV-06/07:

| Trang | Có nút xuất? |
|---|---|
| `inventory/by-location` (INV-02) | ✅ |
| `inventory/by-lot` (INV-04) | ✅ |
| `outbound/report` (OUT-02) | ✅ |
| `system/audit-log` (SYS-03) | ✅ |
| `stock-count` (INV-06/07) | ✅ |
| `inventory` — tồn theo mã (INV-01) | ✅ |
| `inventory/by-pallet` (INV-03) | ✅ *(nút "Excel", cài inline không qua `ExcelExport`)* |
| **`outbound/turnover` (OUT-03)** | ❌ |

*Đã kiểm chứng bằng cách chạy app thật ngày 2026-07-23 — chỉ `outbound/turnover` thiếu nút xuất.*

---

## 4. Những chỗ code VƯỢT tài liệu (cần bổ sung vào spec)

Đây là chức năng đã chạy nhưng **không có UC nào mô tả** → tài liệu v3.1 đang thiếu:

| Chức năng | Vị trí | Ghi chú |
|---|---|---|
| **Phiếu yêu cầu xuất kho (PYX)** | `OutboundRequest` + `outbound/requests/*` + `release` + `import` | Cả một luồng outbound chính thức, không có UC nào |
| **Điều phối xe nâng (Web)** | `api/forklift/web/{assign,drivers,tasks,kpi}` | Giao việc + KPI tài xế |
| **Notification + Push** | `Notification`, `DeviceToken`, `push-service.ts`, `NotificationBell` | Hạ tầng thông báo in-app + push |
| **Session management** | `Session`, `api/auth/sessions` | Xem/thu hồi phiên đăng nhập |
| **App mobile Expo** | `mobile/` | Bản native song song với web mobile (`/thukho`, `/kiemke`, `/forklift`) — chưa rõ track nào là chính |
| **Import Excel mở rộng** | products, product-groups, locations, outbound requests | Spec chỉ nêu import cho IN-06 |
| **Movement type `SHIP`** | `enum MovementType` | Spec chỉ có 4 loại, code có 5 |
| **In QR pallet / vị trí** | `pallets/qr-print`, `locations/qr-print`, `[id]/qr-png` | |
| **Chuẩn hóa số lẻ ↔ thùng** | `qty-converter.ts`, `units_per_box` | |

---

## 5. Đề xuất thứ tự xử lý

### Đợt 1 — Chặn rủi ro dữ liệu & bảo mật
1. **Bọc `requireAuth` cho 109 route còn lại** (§3.1). Ưu tiên nhóm ghi dữ liệu: `forklift/*`, `outbound/rebalance`, `pallets/*`, `inbound/*`, `users`, `system/*`.
2. **Sửa `outbound/rebalance` recalc `qty_unit` + `weight_kg` + `total_weight_kg`** (§3.3). Đây là bug âm thầm làm sai tồn — càng chạy lâu càng khó truy vết.
3. **Thêm bước phê duyệt Kế toán cho UC-FK-05** khi có thay đổi SL/Lô/Date (§3.2).

### Đợt 2 — Đưa RBAC đúng spec
4. Nâng `FEATURE_MAP` từ 12 feature-module → ma trận **55 UC × 5 vai trò**, hỗ trợ 3 mức `✓ / ◐ / ⊙` (§3.1.3).
5. Migration bỏ `ADMIN/MANAGER/STAFF` khỏi `enum Role` + `SUPER_ROLES` (§3.8).
6. Chốt UC-OUT-03: cho Kế toán vào hay không (§3.7).

### Đợt 3 — Hoàn thiện chức năng
7. **Cron 6:00 + email + notification cho UC-INV-05** (§3.6) — dùng lại `ALERT_EXPIRY_SOON`/`ALERT_LOW_STOCK` đã khai báo sẵn.
8. Bổ sung 2 trạng thái phiếu nhập còn thiếu (§3.4).
9. Hộp thoại cấu hình xuất Excel + bổ sung 3 trang thiếu nút (§3.10).
10. Gắn đính kèm ảnh vào phiếu tạm / pallet / kiểm kê (§3.9).
11. OCR mã vỏ thùng cho UC-PAL-03 (§3.5) — hoặc **hạ scope trong tài liệu xuống 4 phương thức** nếu OCR không đáng đầu tư.

### Đợt 4 — Đồng bộ tài liệu
12. Viết UC cho 9 nhóm chức năng ở §4 (đặc biệt **phiếu yêu cầu xuất kho** và **điều phối xe nâng** — đây là 2 module lớn đang chạy mà không có đặc tả).
13. Xoá hoặc đánh dấu deprecated file `wms_usecases.html` (v3.0, 56 UC) để không ai dùng nhầm.
14. Quyết định số phận model `OutboundRebalance` — dùng thật hay xoá khỏi schema.

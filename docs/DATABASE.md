# DATABASE — WMS Vĩnh Giang

> Schema dữ liệu chi tiết, suy ra từ 56 use cases. PostgreSQL 16 + Prisma 5.
> Phiên bản: 1.0 · Ngày: 2026-05-20

---

## 0. Quy ước chung

- **Tên bảng:** `snake_case` số nhiều (`products`, `pallet_lines`).
- **Khoá chính:** `id BIGSERIAL` cho domain, `UUID` cho `users` (lộ ra ngoài).
- **Mọi bảng có:** `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `created_by`, `updated_by` (trừ bảng meta).
- **Soft delete:** `deleted_at TIMESTAMPTZ NULL` cho master data; không dùng cho transaction.
- **Tiền/SL:** dùng `DECIMAL(14,3)` cho số lượng lẻ (chai), `DECIMAL(10,2)` cho thùng. **Không bao giờ dùng FLOAT.**
- **Mã code:** sinh tự động bằng sequence + format function — không cho user nhập.
- **Mọi `FK`:** `ON UPDATE CASCADE ON DELETE RESTRICT` trừ khi ghi rõ.
- **Index nguyên tắc:** mọi FK + cột thường lọc/sort trong UI (`status`, `created_at`, `code`).
- **Audit log diff:** lưu JSONB `{ before: {...}, after: {...} }`.

---

## 1. Tổng quan các bảng (24 bảng)

| Module | Bảng |
|---|---|
| Auth/User | `users`, `roles`, `permissions`, `role_permissions`, `user_sessions`, `password_resets` |
| Master Data | `products`, `skus`, `categories`, `units`, `locations`, `suppliers` |
| Pallet | `pallets`, `pallet_lines` |
| Inbound | `inbound_requests`, `inbound_request_lines`, `inbound_temps`, `inbound_temp_lines`, `excel_imports` |
| Movement | `movements` |
| Outbound | `outbound_rebalances`, `outbound_rebalance_lines` |
| Stocktake | `stocktake_sessions`, `stocktake_lines`, `inventory_adjustments`, `inventory_adjustment_lines` |
| System | `audit_logs`, `app_settings`, `mail_settings`, `mail_logs`, `notifications`, `attachments` |

> Tổng **30 bảng** (tách thêm cho line items và setting).

---

## 2. Chi tiết từng bảng

### 2.1 Auth & User Management

#### `users` — UC-SYS-04, UC-AUTH-01, UC-AUTH-03, UC-SYS-05

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | UUID | PK, default `gen_random_uuid()` | |
| email | VARCHAR(255) | UNIQUE NOT NULL | Đăng nhập + nhận mail |
| phone | VARCHAR(20) | UNIQUE NULL | Đăng nhập bằng SĐT thay email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt cost 12 |
| full_name | VARCHAR(120) | NOT NULL | |
| avatar_url | TEXT | NULL | MinIO key |
| role_id | BIGINT | FK → roles(id), NOT NULL | |
| is_active | BOOLEAN | NOT NULL DEFAULT true | Disable khi off-board |
| last_login_at | TIMESTAMPTZ | NULL | UC-SYS-05 hiển thị |
| password_changed_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | Buộc đổi mỗi 90 ngày (tuỳ chính sách) |
| failed_login_count | SMALLINT | NOT NULL DEFAULT 0 | Khoá tạm sau 5 lần |
| locked_until | TIMESTAMPTZ | NULL | |
| created_at, updated_at | TIMESTAMPTZ | | |
| created_by, updated_by | UUID | FK → users(id) NULL | |

Indexes: `(email)`, `(phone)`, `(role_id)`, `(is_active)`.

#### `roles` — UC-AUTH-05

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(40) | UNIQUE NOT NULL | `ACCOUNTANT`, `WAREHOUSE_KEEPER`, `FORKLIFT`, `STOCKTAKER`, `MANAGER` |
| name | VARCHAR(80) | NOT NULL | "Kế toán kho", "Thủ kho",… |
| description | TEXT | NULL | |
| is_system | BOOLEAN | NOT NULL DEFAULT false | true = không cho xoá |

Seed bắt buộc 5 role này. `code` enum đóng.

#### `permissions`

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(80) | UNIQUE NOT NULL | `product.create`, `pallet.confirm`, `forklift.return`,… |
| resource | VARCHAR(40) | NOT NULL | `product`, `pallet`,… |
| action | VARCHAR(20) | NOT NULL | `create`, `read`, `update`, `delete`, `approve`, `export` |
| description | TEXT | NULL | |

#### `role_permissions` — N-N

| Cột | Type | Constraint |
|---|---|---|
| role_id | BIGINT | FK → roles(id) ON DELETE CASCADE |
| permission_id | BIGINT | FK → permissions(id) ON DELETE CASCADE |
| granted_at | TIMESTAMPTZ | DEFAULT now() |
| granted_by | UUID | FK → users(id) NULL |

PK = `(role_id, permission_id)`.

#### `user_sessions` — JWT refresh tracking

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | UUID | PK | |
| user_id | UUID | FK → users(id) ON DELETE CASCADE | |
| refresh_token_hash | VARCHAR(255) | NOT NULL | sha256 |
| device | VARCHAR(120) | NULL | "iPhone 14 - Safari" |
| ip | INET | NULL | |
| expires_at | TIMESTAMPTZ | NOT NULL | |
| revoked_at | TIMESTAMPTZ | NULL | |
| created_at | TIMESTAMPTZ | DEFAULT now() | |

#### `password_resets` — UC-AUTH-04

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | UUID | FK → users(id) ON DELETE CASCADE |
| token_hash | VARCHAR(255) | NOT NULL UNIQUE |
| expires_at | TIMESTAMPTZ | NOT NULL (≤ 60 phút) |
| used_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| ip | INET | NULL |

---

### 2.2 Master Data

#### `categories` — UC-MD-03

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(40) | UNIQUE NOT NULL | "DRINK", "SAUCE",… |
| name | VARCHAR(120) | NOT NULL | "Đồ uống",… |
| parent_id | BIGINT | FK → categories(id) NULL | Nhóm cha — tự tham chiếu |
| is_active | BOOLEAN | DEFAULT true | |
| created_at, updated_at, deleted_at | TIMESTAMPTZ | | |
| created_by, updated_by | UUID | | |

#### `units` — UC-MD-04

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(20) | UNIQUE NOT NULL | "CHAI", "THUNG", "GOI", "LON" |
| name | VARCHAR(60) | NOT NULL | "Chai" |
| is_active | BOOLEAN | DEFAULT true | |
| (audit cột chuẩn) | | | |

> Đơn giản hoá — không lưu hệ số quy đổi giữa các unit (quy đổi chai↔thùng nằm ở `products.qty_per_box`).

#### `products` — UC-MD-01 (Sản phẩm chuẩn)

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| sku | VARCHAR(40) | UNIQUE NOT NULL | "VG-NM-001" |
| barcode | VARCHAR(40) | UNIQUE NULL | EAN/UPC |
| full_name | VARCHAR(255) | NOT NULL | "Nước mắm Vĩnh Giang 500ml" |
| short_name | VARCHAR(120) | NOT NULL | "NM 500ml" |
| category_id | BIGINT | FK → categories(id) NOT NULL | |
| unit_id | BIGINT | FK → units(id) NOT NULL | Đơn vị lẻ |
| qty_per_box | INT | NOT NULL CHECK (>0) | Số lẻ / thùng |
| weight_per_box_kg | DECIMAL(10,3) | NOT NULL CHECK (≥0) | Tải trọng cho UC-IN-06 |
| volume_per_box_m3 | DECIMAL(10,4) | NULL | Thể tích kệ |
| has_lot | BOOLEAN | NOT NULL DEFAULT true | Có quản lý lô |
| has_expiry | BOOLEAN | NOT NULL DEFAULT true | Có quản lý HSD |
| status | VARCHAR(20) | NOT NULL DEFAULT 'ACTIVE' | enum: `ACTIVE`, `LOCKED`, `RETIRED`, `PENDING` |
| min_stock | DECIMAL(14,3) | NULL | Tồn min (cảnh báo) — đơn vị lẻ |
| max_stock | DECIMAL(14,3) | NULL | Tồn max |
| (audit) | | | |

Indexes: `(sku)`, `(barcode)`, `(category_id)`, `(status)`, GIN trên `full_name` để tìm tiếng Việt.

#### `skus` — UC-MD-02 (Mã hàng theo chứng từ NCC — tạm)

> Là mã hàng "theo chứng từ" do thủ kho tạo nhanh khi hàng về có mã chưa khai. Sau đó kế toán chuẩn hoá: hoặc gộp vào `products` đã có, hoặc tạo mới `products` rồi link lại.

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| supplier_code | VARCHAR(60) | NOT NULL | Mã in trên chứng từ NCC, vd "65442462" |
| short_name | VARCHAR(255) | NOT NULL | "COMFORT LQ W.F.BABY PW…" |
| unit_id | BIGINT | FK → units(id) | Đơn vị lẻ |
| qty_per_box | INT | NULL CHECK (>0) | |
| weight_per_box_kg | DECIMAL(10,3) | NULL | |
| photo_url | TEXT | NULL | Ảnh vỏ thùng (MinIO) |
| note | TEXT | NULL | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'PENDING' | `PENDING`, `MAPPED`, `REJECTED` |
| mapped_product_id | BIGINT | FK → products(id) NULL | Khi đã chuẩn hoá |
| created_by | UUID | FK → users(id) | Thủ kho tạo |
| mapped_by | UUID | FK → users(id) NULL | Kế toán xử lý |
| mapped_at | TIMESTAMPTZ | NULL | |
| supplier_id | BIGINT | FK → suppliers(id) NULL | |
| (audit) | | | |

UNIQUE `(supplier_code, supplier_id)` — cùng mã từ cùng NCC chỉ tồn tại 1 dòng PENDING.

#### `locations` — UC-MD-05

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(20) | UNIQUE NOT NULL | "A-03-02" |
| zone | VARCHAR(10) | NOT NULL | "A" — Khu |
| rack | VARCHAR(10) | NOT NULL | "03" — Kệ |
| level | VARCHAR(10) | NOT NULL | "02" — Tầng |
| type | VARCHAR(20) | NOT NULL | enum: `STORAGE` (vị trí chứa), `INBOUND_STAGING` (khu chờ nhập), `OUTBOUND_STAGING` (khu chờ xuất), `STOCKTAKE` |
| max_weight_kg | DECIMAL(10,2) | NULL | Tải trọng tối đa kệ |
| max_pallets | SMALLINT | NULL | Số pallet tối đa |
| is_active | BOOLEAN | DEFAULT true | |
| qr_image_url | TEXT | NULL | URL QR để dán lên kệ |
| (audit) | | | |

Indexes: `(code)`, `(type, is_active)`, `(zone, rack, level)`.

> **Lưu ý:** Khu chờ xuất (`OUTBOUND_STAGING`) là *logic location*. Theo UC-FK-04, khi xe nâng rút FEFO, `pallets.location_id` chuyển sang location này (thường chỉ có 1 dòng "STAGING-OUT" duy nhất hoặc nhiều khu nếu sắp xếp).

#### `suppliers` — UC-MD-06

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(40) | UNIQUE NOT NULL | "NCC-001" |
| name | VARCHAR(255) | NOT NULL | "An Phú" |
| tax_code | VARCHAR(20) | UNIQUE NULL | MST |
| contact_person | VARCHAR(120) | NULL | |
| phone | VARCHAR(20) | NULL | |
| email | VARCHAR(255) | NULL | |
| address | TEXT | NULL | |
| is_active | BOOLEAN | DEFAULT true | |
| note | TEXT | NULL | |
| (audit) | | | |

---

### 2.3 Pallet — Cốt lõi

#### `pallets` — UC-PAL-01..06

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(20) | UNIQUE NOT NULL | "PL260506.011" — sinh tự động |
| code_date | DATE | NOT NULL | Phần ngày của code (260506) |
| code_seq | INT | NOT NULL | STT trong ngày (011) |
| status | VARCHAR(20) | NOT NULL | enum: `EMPTY` (chưa kích hoạt), `COUNTING` (đang kiểm đếm), `CONFIRMED` (đã xác nhận, chờ xếp), `IN_STORAGE` (đã vào vị trí), `IN_STAGING` (ở khu chờ xuất), `RELEASED` (đã rời kho), `CANCELLED` |
| location_id | BIGINT | FK → locations(id) NULL | Vị trí hiện tại |
| inbound_request_id | BIGINT | FK → inbound_requests(id) NULL | Liên kết phiếu nhập (UC-PAL-01) |
| inbound_temp_id | BIGINT | FK → inbound_temps(id) NULL | Liên kết phiếu tạm |
| total_weight_kg | DECIMAL(10,2) | NOT NULL DEFAULT 0 | Tổng tải trọng — tính từ lines |
| total_lines | SMALLINT | NOT NULL DEFAULT 0 | Số dòng hàng |
| note | TEXT | NULL | |
| confirmed_at | TIMESTAMPTZ | NULL | Khi UC-PAL-04 |
| confirmed_by | UUID | FK → users(id) NULL | |
| (audit) | | | |

Indexes: `(code)`, `(status)`, `(location_id)`, `(inbound_request_id)`, `(code_date, code_seq)` UNIQUE.

> Constraint: `code_seq` reset hằng ngày — sinh bởi sequence + advisory lock theo `code_date` để tránh race khi nhiều thủ kho cùng bấm tạo.

#### `pallet_lines` — UC-PAL-02

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| pallet_id | BIGINT | FK → pallets(id) ON DELETE CASCADE | |
| product_id | BIGINT | FK → products(id) NULL | Khi đã chuẩn hoá |
| sku_id | BIGINT | FK → skus(id) NULL | Khi còn là mã tạm |
| qty_box | DECIMAL(10,2) | NOT NULL CHECK (>0) | SL theo thùng (đơn vị nhập liệu) |
| qty_unit | DECIMAL(14,3) | NOT NULL CHECK (>0) | SL quy đổi lẻ = qty_box × qty_per_box |
| lot | VARCHAR(40) | NULL | Lô (NULL nếu product không quản lý lô) |
| expiry_date | DATE | NULL | HSD (NULL nếu không quản lý) |
| manufactured_date | DATE | NULL | NSX |
| weight_kg | DECIMAL(10,2) | NOT NULL DEFAULT 0 | qty_box × weight_per_box |
| note | TEXT | NULL | |
| (audit) | | | |

CHECK: `(product_id IS NOT NULL) OR (sku_id IS NOT NULL)` — không được cả hai NULL.
Indexes: `(pallet_id)`, `(product_id, expiry_date)`, `(sku_id)`, `(lot, expiry_date)`.

---

### 2.4 Inbound — Nhập kho có phiếu

#### `inbound_requests` — UC-IN-01, UC-IN-05, UC-IN-06

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(30) | UNIQUE NOT NULL | "PHN-2026-0043" |
| type | VARCHAR(20) | NOT NULL | enum: `SUPPLIER`, `RETURN` |
| supplier_id | BIGINT | FK → suppliers(id) NULL | NULL khi RETURN |
| warehouse_zone | VARCHAR(80) | NULL | "Kho chính - Hà Nội" |
| expected_date | DATE | NOT NULL | |
| status | VARCHAR(30) | NOT NULL | enum 8 trạng thái: `NEW`, `PENDING_KEEPER`, `PREPARING`, `COUNTING`, `PALLET_WAITING`, `PUTAWAY`, `PENDING_FINALIZE`, `CLOSED`, `CANCELLED` |
| source | VARCHAR(20) | NOT NULL DEFAULT 'MANUAL' | `MANUAL`, `EXCEL_SIMPLE`, `EXCEL_NCC` (UC-IN-06) |
| excel_import_id | BIGINT | FK → excel_imports(id) NULL | Khi tạo từ UC-IN-06 |
| accepted_at | TIMESTAMPTZ | NULL | Khi UC-IN-02 |
| accepted_by | UUID | FK → users(id) NULL | Thủ kho tiếp nhận |
| prep_zone_ready | BOOLEAN | NOT NULL DEFAULT false | Checkbox UC-IN-02 (không bắt buộc) |
| closed_at | TIMESTAMPTZ | NULL | UC-IN-04 |
| closed_by | UUID | FK → users(id) NULL | Kế toán chốt |
| close_note | TEXT | NULL | |
| close_discrepancy_decision | VARCHAR(40) | NULL | `ACCEPT`, `REVIEW_AGAIN`, `CREATE_ADJUSTMENT` |
| note | TEXT | NULL | |
| (audit) | | | |

Indexes: `(code)`, `(status, expected_date)`, `(supplier_id)`.

#### `inbound_request_lines`

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| inbound_request_id | BIGINT | FK CASCADE | |
| line_no | SMALLINT | NOT NULL | STT |
| product_id | BIGINT | FK → products(id) NULL | |
| sku_id | BIGINT | FK → skus(id) NULL | Khi mã chưa chuẩn |
| requested_qty_box | DECIMAL(10,2) | NOT NULL CHECK (≥0) | |
| requested_qty_unit | DECIMAL(14,3) | NOT NULL | |
| note | TEXT | NULL | |
| (audit) | | | |

CHECK `(product_id IS NOT NULL OR sku_id IS NOT NULL)`.
UNIQUE `(inbound_request_id, line_no)`.

#### `inbound_temps` — UC-INTMP-01 (Nhập tạm)

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(30) | UNIQUE NOT NULL | "PNT-260506-003" |
| source_type | VARCHAR(20) | NOT NULL | `SUPPLIER`, `RETURN`, `OTHER` |
| delivered_by | VARCHAR(120) | NULL | Người giao |
| reason | TEXT | NOT NULL | BẮT BUỘC |
| photo_urls | TEXT[] | NULL | Mảng MinIO keys |
| status | VARCHAR(20) | NOT NULL | `PENDING`, `IN_PROGRESS` (kế toán đang xử lý), `STANDARDIZED` (đã chuyển PHN chính thức), `CANCELLED` |
| standardized_to | BIGINT | FK → inbound_requests(id) NULL | PHN chính thức tạo từ phiếu tạm |
| standardized_at | TIMESTAMPTZ | NULL | |
| (audit) | | | |

#### `inbound_temp_lines` — như `pallet_lines` rút gọn

#### `excel_imports` — UC-IN-06

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| file_url | TEXT | NOT NULL | MinIO key |
| file_name | VARCHAR(255) | NOT NULL | "HangUVe_05062026.xlsx" |
| supplier_id | BIGINT | FK → suppliers(id) NOT NULL | |
| order_date | DATE | NULL | |
| expected_date | DATE | NULL | |
| total_rows | INT | NOT NULL DEFAULT 0 | |
| matched_rows | INT | NOT NULL DEFAULT 0 | Đã có mã chuẩn |
| pending_rows | INT | NOT NULL DEFAULT 0 | Cần tạo mã |
| duplicated_rows | INT | NOT NULL DEFAULT 0 | Trùng |
| total_boxes | DECIMAL(12,2) | DEFAULT 0 | |
| total_weight_kg | DECIMAL(12,3) | DEFAULT 0 | |
| status | VARCHAR(20) | NOT NULL | `UPLOADING`, `PARSED`, `RECONCILED`, `COMMITTED`, `FAILED` |
| parsed_payload | JSONB | NULL | Cache parse result |
| error_message | TEXT | NULL | |
| created_by | UUID | FK → users(id) | |
| committed_at | TIMESTAMPTZ | NULL | |
| inbound_request_id | BIGINT | FK → inbound_requests(id) NULL | PHN tạo ra |
| (audit) | | | |

---

### 2.5 Movement — Lịch sử luân chuyển

#### `movements` — UC-FK-06 (cốt lõi cho audit chuyển động)

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| type | VARCHAR(30) | NOT NULL | enum 4 loại: `PUTAWAY` (FK-02), `RELOCATE` (FK-03), `PICK_FEFO` (FK-04), `RETURN_FROM_STAGING` (FK-05) |
| pallet_id | BIGINT | FK → pallets(id) NOT NULL | |
| product_id | BIGINT | FK → products(id) NULL | Khi rút theo SKU |
| qty_box | DECIMAL(10,2) | NULL | |
| qty_unit | DECIMAL(14,3) | NOT NULL CHECK (>0) | |
| lot | VARCHAR(40) | NULL | |
| expiry_date | DATE | NULL | |
| from_location_id | BIGINT | FK → locations(id) NULL | NULL nếu từ "khu chờ nhập" mơ hồ |
| to_location_id | BIGINT | FK → locations(id) NOT NULL | |
| mode | VARCHAR(10) | NULL | UC-FK-04: `FULL` (TH-A) hoặc `PARTIAL` (TH-B) |
| reason | TEXT | NULL | UC-FK-05 bắt buộc |
| reason_code | VARCHAR(40) | NULL | UC-FK-05 enum: `PARTIAL_PICKED_RETURN`, `PALLET_SPLIT`, `WRONG_DETECT`, `OTHER` |
| performed_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| performed_by | UUID | FK → users(id) NOT NULL | |
| audit_log_id | BIGINT | FK → audit_logs(id) NULL | Khi FK-05 (bắt buộc link) |
| (audit) | | | |

Indexes: `(pallet_id, performed_at DESC)`, `(type, performed_at DESC)`, `(product_id, performed_at)`, `(performed_by)`.

---

### 2.6 Outbound

#### `outbound_rebalances` — UC-OUT-05 (Cân lại tồn khu chờ xuất)

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(30) | UNIQUE NOT NULL | "RBL-2026-0021" |
| method | VARCHAR(20) | NOT NULL | `EXPORTED_QTY_FILE` hoặc `OUTBOUND_REQUEST_FILE` |
| file_url | TEXT | NOT NULL | |
| file_name | VARCHAR(255) | NOT NULL | |
| status | VARCHAR(20) | NOT NULL | `PARSED`, `PREVIEWED`, `APPLIED`, `REJECTED` |
| total_lines | INT | DEFAULT 0 | |
| matched_lines | INT | DEFAULT 0 | |
| mismatch_lines | INT | DEFAULT 0 | |
| applied_at | TIMESTAMPTZ | NULL | |
| applied_by | UUID | FK → users(id) NULL | |
| note | TEXT | NULL | |
| (audit) | | | |

#### `outbound_rebalance_lines`

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| outbound_rebalance_id | BIGINT | FK CASCADE |
| product_id | BIGINT | FK → products(id) |
| pallet_id | BIGINT | FK → pallets(id) NULL |
| qty_unit_before | DECIMAL(14,3) | NOT NULL |
| qty_unit_exported | DECIMAL(14,3) | NOT NULL |
| qty_unit_after | DECIMAL(14,3) | NOT NULL |
| diff | DECIMAL(14,3) | GENERATED ALWAYS AS (qty_unit_after - qty_unit_before) STORED |
| note | TEXT | NULL |

---

### 2.7 Inventory / Stocktaking

#### `stocktake_sessions` — UC-INV-06, 07

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(30) | UNIQUE NOT NULL | "STK-2026-0042" |
| type | VARCHAR(20) | NOT NULL | `BY_LOCATION`, `BY_SKU`, `FULL` |
| target_scope | JSONB | NULL | Vd `{ "location_ids":[...] }` hoặc `{ "product_ids":[...] }` |
| blind_count | BOOLEAN | NOT NULL DEFAULT true | Người KK có thấy SL hệ thống trước khi đếm? |
| status | VARCHAR(20) | NOT NULL | `OPEN`, `IN_PROGRESS`, `LOCKED` (chờ xử lý chênh), `CLOSED` |
| started_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |
| closed_at | TIMESTAMPTZ | NULL | |
| (audit) | | | |

#### `stocktake_lines`

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| session_id | BIGINT | FK CASCADE | |
| location_id | BIGINT | FK → locations(id) NULL | NULL khi BY_SKU mà tổng hợp |
| pallet_id | BIGINT | FK → pallets(id) NULL | |
| product_id | BIGINT | FK → products(id) NOT NULL | |
| lot | VARCHAR(40) | NULL | |
| expiry_date | DATE | NULL | |
| system_qty_unit | DECIMAL(14,3) | NOT NULL | SL hệ thống tại thời điểm KK |
| actual_qty_unit | DECIMAL(14,3) | NULL | SL thực tế đếm (NULL = chưa đếm) |
| diff_qty_unit | DECIMAL(14,3) | GENERATED ALWAYS AS (actual_qty_unit - system_qty_unit) STORED | |
| note | TEXT | NULL | |
| photo_urls | TEXT[] | NULL | |
| counter_id | UUID | FK → users(id) NULL | Người KK |
| counted_at | TIMESTAMPTZ | NULL | |
| status | VARCHAR(20) | NOT NULL DEFAULT 'PENDING' | `PENDING`, `MATCHED`, `DISCREPANCY`, `RECOUNT_REQUESTED`, `RESOLVED` |
| resolution | VARCHAR(20) | NULL | `ACCEPT`, `RECOUNT`, `IGNORE` (UC-INV-08) |
| (audit) | | | |

Indexes: `(session_id, status)`, `(location_id)`, `(product_id)`.

#### `inventory_adjustments` — UC-INV-09 — **PROTECTED + AUDIT**

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| code | VARCHAR(30) | UNIQUE NOT NULL | "ADJ-2026-0015" |
| type | VARCHAR(20) | NOT NULL | `DECREASE`, `INCREASE`, `STOCKTAKE_RESOLVE` |
| reason | VARCHAR(40) | NOT NULL | `BROKEN`, `LOST`, `STOCKTAKE`, `OTHER` |
| reason_detail | TEXT | NULL | Bắt buộc khi `OTHER` |
| stocktake_session_id | BIGINT | FK → stocktake_sessions(id) NULL | |
| status | VARCHAR(20) | NOT NULL | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `APPLIED` |
| created_by | UUID | FK → users(id) NOT NULL | Kế toán lập |
| approved_by | UUID | FK → users(id) NULL | Quản lý duyệt |
| approved_at | TIMESTAMPTZ | NULL | |
| rejected_reason | TEXT | NULL | |
| applied_at | TIMESTAMPTZ | NULL | Khi áp dụng vào tồn |
| audit_log_id | BIGINT | FK → audit_logs(id) NULL | LINK bắt buộc khi APPLIED |
| (audit) | | | |

#### `inventory_adjustment_lines`

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| adjustment_id | BIGINT | FK CASCADE |
| product_id | BIGINT | FK → products(id) NOT NULL |
| pallet_id | BIGINT | FK → pallets(id) NULL |
| location_id | BIGINT | FK → locations(id) NULL |
| lot | VARCHAR(40) | NULL |
| qty_unit_before | DECIMAL(14,3) | NOT NULL |
| qty_unit_after | DECIMAL(14,3) | NOT NULL |
| diff_qty_unit | DECIMAL(14,3) | GENERATED ALWAYS AS (qty_unit_after - qty_unit_before) STORED |
| note | TEXT | NULL |

---

### 2.8 System

#### `audit_logs` — UC-SYS-03 — **PROTECTED**

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK | |
| actor_id | UUID | FK → users(id) NOT NULL | |
| actor_role | VARCHAR(40) | NOT NULL | Snapshot role |
| action | VARCHAR(60) | NOT NULL | "pallet.confirm", "adjustment.approve",… |
| resource_type | VARCHAR(40) | NOT NULL | "pallet", "inventory_adjustment",… |
| resource_id | VARCHAR(60) | NOT NULL | id của resource |
| resource_code | VARCHAR(60) | NULL | code (PL…, ADJ…) cho dễ trace |
| before | JSONB | NULL | Trạng thái trước |
| after | JSONB | NULL | Trạng thái sau |
| reason | TEXT | NULL | Bắt buộc với FK-05, INV-09 |
| ip | INET | NULL | |
| user_agent | TEXT | NULL | |
| created_at | TIMESTAMPTZ | NOT NULL DEFAULT now() | |

Indexes: `(actor_id, created_at DESC)`, `(resource_type, resource_id)`, `(action, created_at)`.

> **APPEND-ONLY:** Trigger BEFORE UPDATE/DELETE raise exception. Backup riêng, retention ≥ 2 năm.

#### `app_settings` — UC-SYS-01

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| key | VARCHAR(60) | PK | "app_name", "hotline", "support_email", "logo_url", "favicon_url", "fefo_warn_days", "fefo_critical_days",… |
| value | JSONB | NOT NULL | Value linh hoạt |
| description | TEXT | NULL | |
| updated_at | TIMESTAMPTZ | DEFAULT now() | |
| updated_by | UUID | FK → users(id) NULL | |

#### `mail_settings` — UC-SYS-02

| Cột | Type | Constraint | Mô tả |
|---|---|---|---|
| id | BIGSERIAL | PK (chỉ 1 dòng — `is_active` filter) | |
| provider | VARCHAR(20) | NOT NULL | `SMTP`, `MAILGUN`, `SENDGRID` |
| host | VARCHAR(120) | NULL | SMTP host |
| port | INT | NULL | |
| username | VARCHAR(255) | NULL | |
| password_enc | TEXT | NULL | Mã hoá AES-256-GCM (key trong env) |
| api_key_enc | TEXT | NULL | Cho Mailgun/SendGrid |
| from_email | VARCHAR(255) | NOT NULL | |
| from_name | VARCHAR(120) | NOT NULL | |
| use_tls | BOOLEAN | DEFAULT true | |
| is_active | BOOLEAN | DEFAULT false | |
| last_tested_at | TIMESTAMPTZ | NULL | |
| last_test_result | TEXT | NULL | |
| (audit) | | | |

#### `mail_logs`

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| to_email | VARCHAR(255) | NOT NULL |
| subject | VARCHAR(255) | NOT NULL |
| template | VARCHAR(60) | NULL |
| status | VARCHAR(20) | NOT NULL `QUEUED`, `SENT`, `FAILED` |
| error | TEXT | NULL |
| sent_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### `notifications` — Cảnh báo HSD UC-INV-05

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| user_id | UUID | FK → users(id) |
| type | VARCHAR(40) | NOT NULL `HSD_CRITICAL`, `HSD_WARN`, `STOCK_LOW`, `STOCK_OVER`, `OLDEST_STOCK`,… |
| title | VARCHAR(255) | NOT NULL |
| body | TEXT | NULL |
| data | JSONB | NULL |
| read_at | TIMESTAMPTZ | NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |

#### `attachments`

| Cột | Type | Constraint |
|---|---|---|
| id | BIGSERIAL | PK |
| storage_key | TEXT | NOT NULL (MinIO key) |
| original_name | VARCHAR(255) | NOT NULL |
| mime_type | VARCHAR(80) | NOT NULL |
| size_bytes | BIGINT | NOT NULL |
| resource_type | VARCHAR(40) | NOT NULL "inbound_temp", "stocktake_line",… |
| resource_id | BIGINT | NOT NULL |
| uploaded_by | UUID | FK → users(id) |
| created_at | TIMESTAMPTZ | DEFAULT now() |

Index `(resource_type, resource_id)`.

---

## 3. Sơ đồ quan hệ tổng thể (ERD ascii)

### 3.1 Master Data

```
categories ─┐
            │ N
            ▼
units ─────▶ products ◀───── suppliers
                │  ▲
                │  │ mapped_product_id
                │  │
                └──┴─ skus (mã NCC) ◀── supplier_id (NULL)
```

Quan hệ:
- `products N─1 categories`, `products N─1 units`
- `skus N─1 units`, `skus N─0..1 products` (mapped), `skus N─0..1 suppliers`

### 3.2 Pallet & Movement

```
inbound_requests ◀────┐
                       │ 0..N
                       │
                       ▼
                   pallets ────────► locations (current)
                       │ 1
                       │ N
                       ▼
                  pallet_lines ──► products / skus
                       │
                       │ tham chiếu chéo
                       ▼
                  movements ──► from_location, to_location
                              ──► performed_by (users)
                              ──► audit_log (khi FK-05)
```

Quan hệ:
- `pallets N─0..1 inbound_requests`, `pallets N─0..1 inbound_temps`
- `pallets N─0..1 locations` (vị trí hiện tại)
- `pallet_lines N─1 pallets`, `pallet_lines N─0..1 products`, `pallet_lines N─0..1 skus` (XOR)
- `movements N─1 pallets`, `movements N─0..1 products`, `movements N─2 locations` (from/to)

### 3.3 Inbound

```
suppliers ──N──► inbound_requests ──1──► inbound_request_lines ──N──► products/skus
                       ▲
                       │ standardized_to
                       │
                  inbound_temps ──1──► inbound_temp_lines

excel_imports ──1──► inbound_requests (1)
```

### 3.4 Stocktake → Adjustment

```
stocktake_sessions ──1..N──► stocktake_lines ──► pallets/products/locations
        │
        │ 0..N (resolved tạo ra)
        ▼
inventory_adjustments ──1..N──► inventory_adjustment_lines
        │
        │ 1..1 khi APPLIED
        ▼
   audit_logs (BẮT BUỘC)
```

### 3.5 Auth & RBAC

```
users ──N──► roles ──N..N (qua role_permissions)──► permissions

users ──1..N──► user_sessions
users ──1..N──► password_resets
users ──1..N──► notifications
```

### 3.6 Bảng đếm quan hệ chuẩn

| Quan hệ | Loại | Ghi chú |
|---|---|---|
| user → role | N─1 | 1 user 1 role (UC-AUTH-05 đơn giản hoá) |
| role ↔ permission | N─N | qua `role_permissions` |
| product → category | N─1 | |
| product → unit | N─1 | Đơn vị lẻ |
| sku → product | N─0..1 | Sau chuẩn hoá |
| sku → supplier | N─0..1 | |
| inbound_request → supplier | N─0..1 | |
| inbound_request → inbound_request_lines | 1─N | |
| inbound_request → pallets | 1─N | |
| pallet → location | N─0..1 | Hiện tại |
| pallet → pallet_lines | 1─N | |
| pallet_line → product/sku | N─1 XOR | CHECK |
| pallet → movements | 1─N | |
| movement → location | N─2 | from, to |
| stocktake_session → stocktake_lines | 1─N | |
| stocktake_session → adjustment | 1─0..N | |
| adjustment → adjustment_lines | 1─N | |
| adjustment → audit_log | 1─0..1 | Bắt buộc khi APPLIED |
| audit_log → user (actor) | N─1 | |

---

## 4. Quy tắc Migration

### 4.1 Tool & Quy trình

1. **Tool:** Prisma Migrate. Mỗi PR thay schema **bắt buộc** kèm file migration sinh ra (`npx prisma migrate dev --name <slug>`).
2. **Tên file:** `YYYYMMDDHHMMSS_<verb>_<noun>.sql` (vd `20260620100000_add_blind_count_to_stocktake.sql`). Prisma tự sinh đúng format.
3. **Branch:** Mọi migration phải nằm trên branch `feature/*` hoặc `migration/*`. Không sửa trực tiếp lên `main`.
4. **Review:** PR migration cần **2 approver**, trong đó 1 là backend lead + 1 là người không tham gia viết schema (peer review).

### 4.2 Quy tắc bắt buộc

| Quy tắc | Diễn giải |
|---|---|
| **R1. Không destructive trên cột có data prod** | Cấm `DROP COLUMN`/`DROP TABLE`/`RENAME` trực tiếp. Phải qua 3 bước: thêm cột/bảng mới → migrate data → deprecate (gỡ ở release sau ≥ 1 sprint). |
| **R2. Mọi cột NOT NULL phải có DEFAULT** | Khi thêm cột vào bảng đã có data, hoặc backfill bằng UPDATE trước rồi mới ALTER NOT NULL. |
| **R3. Index lớn tạo CONCURRENTLY** | `CREATE INDEX CONCURRENTLY` để không khoá table. Migration phải tách riêng (không transaction). |
| **R4. Backward-compatible trong cùng release** | API cũ phải còn chạy được sau migration ít nhất 1 sprint — hỗ trợ rollback FE/Mobile lệch version. |
| **R5. Seed riêng, không nhét vào migration** | Seed (5 roles, permissions, sample SKU) nằm trong `prisma/seed.ts`, idempotent (upsert). |
| **R6. Test migration** | Pipeline CI restore snapshot prod gần nhất → apply migration → smoke test. Fail = block merge. |
| **R7. Migration audit_logs không destructive** | Bảng `audit_logs` không cho migration thay đổi cấu trúc cột `before/after/action/reason`. Chỉ thêm cột mới. |
| **R8. Lock migration trên prod** | Triển khai prod dùng `prisma migrate deploy` (không `dev`). Trước run, backup DB. Sau run, smoke test critical path. |

### 4.3 Mẫu migration safe

**Thêm cột NOT NULL có default:**
```sql
-- 1) add nullable + default
ALTER TABLE products ADD COLUMN min_stock DECIMAL(14,3);
UPDATE products SET min_stock = 0 WHERE min_stock IS NULL;
ALTER TABLE products ALTER COLUMN min_stock SET DEFAULT 0;
ALTER TABLE products ALTER COLUMN min_stock SET NOT NULL;
```

**Rename cột (zero-downtime):**
```sql
-- release N: add new column + sync trigger
ALTER TABLE products ADD COLUMN qty_box_qty INT;
UPDATE products SET qty_box_qty = qty_per_box;
CREATE TRIGGER sync_qty_box BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION sync_qty_box_func();
-- code đọc/ghi cả 2 cột

-- release N+1: drop old
DROP TRIGGER sync_qty_box ON products;
ALTER TABLE products DROP COLUMN qty_per_box;
```

### 4.4 Backup & Rollback

- **Trước migration prod:** snapshot pg_dump tự động qua `pgBackRest` (giữ 30 ngày).
- **Khi rollback:** ưu tiên *forward migration* (sửa lỗi bằng migration mới) hơn restore. Restore chỉ khi data corruption.
- **Test rollback script:** mọi migration nguy hiểm phải có file `*_rollback.sql` đi kèm, đã chạy test trên staging.

### 4.5 Seed data bắt buộc cho môi trường mới

- 5 roles + permissions ma trận đầy đủ.
- 4 location types mặc định (1 STORAGE mẫu, 1 INBOUND_STAGING, 1 OUTBOUND_STAGING, 1 STOCKTAKE).
- App settings mặc định (`fefo_warn_days=30`, `fefo_critical_days=7`, `pallet_code_prefix=PL`).
- 1 user `admin@vinhgiang.local` role MANAGER (mật khẩu random log 1 lần, buộc đổi).

---

## 5. Tham chiếu

- [ARCHITECTURE.md](ARCHITECTURE.md) — bố cục module
- [API_CONTRACTS.md](API_CONTRACTS.md) — endpoints mapping vào các bảng này
- [CRITICAL_PATHS.md](CRITICAL_PATHS.md) — luồng nghiệp vụ dùng các bảng nào
- [SECURITY.md](SECURITY.md) — bảo mật bảng nhạy cảm

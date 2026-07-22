# API CONTRACTS — WMS Vĩnh Giang

> Hợp đồng REST API giữa FE (web/mobile) và BE (NestJS). Suy ra trực tiếp từ 56 use cases.
> Phiên bản: 1.0 · Ngày: 2026-05-20

---

## 0. Quy ước chung

### 0.1 Base URL & Versioning

- Production: `https://api.wms.vinhgiang.com/v1`
- Staging: `https://api-stg.wms.vinhgiang.com/v1`
- Mọi endpoint prefix `/v1`. Breaking change ⇒ bump `/v2`.

### 0.2 Authentication

- **Cơ chế:** JWT Bearer Token.
- **Header:** `Authorization: Bearer <accessToken>`
- **Access token:** TTL 15 phút, claims `{ sub, role, permissions[], jti }`.
- **Refresh token:** TTL 7 ngày, gửi qua HTTP-only cookie (web) hoặc Secure Storage (mobile). Dùng để gọi `POST /auth/refresh`.
- **Endpoints không cần auth:** `POST /auth/login`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `POST /auth/refresh`.
- **403 Forbidden** ⇔ thiếu permission. **401 Unauthorized** ⇔ thiếu/sai/hết hạn token.

### 0.3 Response chuẩn

**Success (200/201):**
```json
{ "data": { ... } }
```

**List với phân trang:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 247,
    "totalPages": 13
  }
}
```

**Error (4xx/5xx) — chuẩn RFC 7807:**
```json
{
  "type": "https://wms.vinhgiang.com/errors/validation",
  "title": "Validation Error",
  "status": 422,
  "detail": "Số lượng phải lớn hơn 0",
  "instance": "/v1/pallets/123/lines",
  "errors": [
    { "field": "qty_box", "message": "Phải > 0" }
  ]
}
```

### 0.4 Query params chuẩn cho list

| Param | Mặc định | Mô tả |
|---|---|---|
| `page` | 1 | Trang (1-indexed) |
| `pageSize` | 20 (max 100) | Số item/trang |
| `sort` | tuỳ resource | `field` hoặc `-field` (desc). Vd `-created_at` |
| `q` | — | Search text |
| `status`, `from`, `to`,… | — | Filter tuỳ resource |

### 0.5 Audit-required endpoints

Endpoint có dấu **🔒 AUDIT** bắt buộc ghi `audit_logs` (UC-SYS-03). FE phải gửi `reason` trong body.

---

## 1. Auth Module

### 1.1 `POST /auth/login` — UC-AUTH-01 — `public`

Request:
```json
{
  "identifier": "kt@vinhgiang.com",   // email hoặc phone
  "password": "P@ssw0rd!"
}
```

Response 200:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "kt@vinhgiang.com",
      "fullName": "Nguyễn Thị Kế Toán",
      "role": { "code": "ACCOUNTANT", "name": "Kế toán kho" },
      "permissions": ["product.create", "product.update", "..."],
      "avatarUrl": null
    },
    "accessToken": "eyJ…",
    "refreshToken": "eyJ…",
    "expiresIn": 900
  }
}
```

Errors:
- 401 — Sai mật khẩu (`failed_login_count++`, lock sau 5 lần)
- 423 Locked — Tài khoản bị khoá tạm

### 1.2 `POST /auth/refresh` — `public` (cần refresh token)

Request: empty (refresh trong cookie/header `X-Refresh-Token`).
Response 200: `{ data: { accessToken, expiresIn } }`.

### 1.3 `POST /auth/logout` — `auth`

Thu hồi `user_sessions` hiện tại. Response 204.

### 1.4 `POST /auth/forgot-password` — UC-AUTH-04 — `public`

```json
{ "email": "kt@vinhgiang.com" }
```
Response 202 luôn (không leak email tồn tại hay không). Background job gửi mail reset link.

### 1.5 `POST /auth/reset-password` — UC-AUTH-04 — `public`

```json
{ "token": "abc…", "newPassword": "NewP@ss1!" }
```

### 1.6 `POST /auth/change-password` — UC-AUTH-03 — `auth`

```json
{ "currentPassword": "...", "newPassword": "..." }
```

---

## 2. Users & RBAC

### 2.1 `GET /users` — UC-SYS-04 — `auth + user.read`

Query: `q`, `role`, `is_active`, `page`, `pageSize`.

### 2.2 `POST /users` — UC-SYS-04 — `auth + user.create`

```json
{
  "email": "...", "phone": "...",
  "fullName": "...", "roleId": 2,
  "password": "TempP@ss1!"  // hoặc auto-generated, gửi mail
}
```

### 2.3 `PATCH /users/:id` — `auth + user.update`

### 2.4 `DELETE /users/:id` — `auth + user.delete` (soft delete `is_active=false`)

### 2.5 `GET /me` — `auth`
Trả thông tin user hiện tại + permissions.

### 2.6 `PATCH /me` — UC-SYS-05 — `auth`
Cập nhật profile (full_name, phone, avatar). Email & role không sửa được ở đây.

### 2.7 `GET /roles` — `auth + role.read`

### 2.8 `GET /roles/:id/permissions` — UC-AUTH-05 — `auth + role.read`

### 2.9 `PUT /roles/:id/permissions` — UC-AUTH-05 — `auth + role.update` 🔒 AUDIT

```json
{
  "permissionIds": [1, 2, 5, 12, ...],
  "reason": "Thêm quyền duyệt phiếu điều chỉnh cho Quản lý"
}
```

### 2.10 `GET /permissions` — `auth + role.read`

---

## 3. Master Data

### 3.1 Products — UC-MD-01

| Method | Path | Permission | Mô tả |
|---|---|---|---|
| GET | `/products` | `product.read` | Filter: `q`, `category_id`, `status`. |
| GET | `/products/:id` | `product.read` | |
| POST | `/products` | `product.create` | |
| PATCH | `/products/:id` | `product.update` | |
| DELETE | `/products/:id` | `product.delete` | Soft delete |
| POST | `/products/import-excel` | `product.create` | Import bulk |
| GET | `/products/export-excel` | `product.export` | Stream xlsx |

POST body:
```json
{
  "sku": "VG-NM-001",
  "barcode": "8934567890123",
  "fullName": "Nước mắm Vĩnh Giang 500ml",
  "shortName": "NM 500ml",
  "categoryId": 1,
  "unitId": 1,
  "qtyPerBox": 24,
  "weightPerBoxKg": 13.2,
  "volumePerBoxM3": 0.018,
  "hasLot": true,
  "hasExpiry": true,
  "minStock": 240,
  "maxStock": 4800,
  "status": "ACTIVE"
}
```

### 3.2 SKUs (Mã hàng theo chứng từ) — UC-MD-02

| Method | Path | Permission | Mô tả |
|---|---|---|---|
| GET | `/skus` | `sku.read` | Filter `status=PENDING\|MAPPED`, `supplier_id` |
| POST | `/skus` | `sku.create` | Thủ kho tạo nhanh trên mobile |
| PATCH | `/skus/:id` | `sku.update` | Kế toán bổ sung |
| POST | `/skus/:id/map` | `sku.update` 🔒 AUDIT | Map → product chuẩn |
| POST | `/skus/:id/reject` | `sku.update` | |
| POST | `/skus/bulk-create-from-document` | `sku.create` | Hỗ trợ UC-IN-06 |

POST `/skus`:
```json
{
  "supplierCode": "65442462",
  "shortName": "COMFORT LQ W.F.BABY PW FRGR Y25 360X20ML",
  "unitId": 1,
  "qtyPerBox": 360,
  "weightPerBoxKg": 8.0,
  "supplierId": 7,
  "photoUrl": "minio://skus/abc.jpg",
  "note": "Hàng U về 06/05"
}
```

POST `/skus/:id/map`:
```json
{ "productId": 142, "reason": "Trùng SKU VG-CMF-002" }
```

### 3.3 Categories — UC-MD-03 (CRUD chuẩn)

`GET/POST/PATCH/DELETE /categories` — permission `category.*`.

### 3.4 Units — UC-MD-04 (CRUD chuẩn)

`GET/POST/PATCH/DELETE /units` — permission `unit.*`.

### 3.5 Locations — UC-MD-05

| Method | Path | Permission | Mô tả |
|---|---|---|---|
| GET | `/locations` | `location.read` | Filter `type`, `zone`, `is_active`. |
| POST | `/locations` | `location.create` | |
| PATCH | `/locations/:id` | `location.update` | |
| DELETE | `/locations/:id` | `location.delete` | |
| POST | `/locations/bulk` | `location.create` | Sinh hàng loạt theo layout |
| GET | `/locations/:id/qr` | `location.read` | Trả ảnh QR PNG/SVG |

POST body:
```json
{
  "code": "A-03-02",
  "zone": "A", "rack": "03", "level": "02",
  "type": "STORAGE",
  "maxWeightKg": 1500,
  "maxPallets": 4
}
```

POST `/locations/bulk`:
```json
{
  "zone": "A",
  "rackFrom": 1, "rackTo": 10,
  "levelFrom": 1, "levelTo": 4,
  "type": "STORAGE"
}
```

### 3.6 Suppliers — UC-MD-06 (CRUD chuẩn)

`GET/POST/PATCH/DELETE /suppliers` — permission `supplier.*`.

---

## 4. Pallets — UC-PAL-01..06

### 4.1 `POST /pallets` — UC-PAL-01 — `pallet.create`

```json
{ "inboundRequestId": 42, "note": "Khu chờ nhập 1" }
```
Response 201:
```json
{
  "data": {
    "id": 1011,
    "code": "PL260506.011",
    "status": "EMPTY",
    "inboundRequestId": 42,
    "createdAt": "2026-05-06T02:25:00Z"
  }
}
```

> Backend sinh `code` qua advisory lock theo `code_date` để tránh race.

### 4.2 `GET /pallets` — `pallet.read`

Filter: `status`, `location_id`, `inbound_request_id`, `q`.

### 4.3 `GET /pallets/:id` — UC-PAL-06 — `pallet.read`

Response bao gồm lines + lịch sử movements gần nhất.

### 4.4 `POST /pallets/:id/lines` — UC-PAL-02 — `pallet.update`

```json
{
  "productId": 12,        // hoặc skuId
  "qtyBox": 5,
  "lot": "L26-04",
  "expiryDate": "2027-04-30",
  "note": null
}
```
Backend tự tính `qty_unit = qty_box * product.qty_per_box`, `weight_kg`.

### 4.5 `PATCH /pallets/:id/lines/:lineId` — `pallet.update`

(Chỉ khi pallet status = `COUNTING`.)

### 4.6 `DELETE /pallets/:id/lines/:lineId` — `pallet.update`

### 4.7 `POST /pallets/:id/confirm` — UC-PAL-04 — `pallet.confirm`

Đóng khoá pallet. Sau khi confirm, mọi PATCH/DELETE line trả 409.

```json
{ }   // không body
```
Response: pallet.status → `CONFIRMED`.

### 4.8 `POST /pallets/:id/unlock` — UC-PAL-05 — `pallet.unlock` 🔒 AUDIT

Quyền đặc biệt mở khoá pallet đã confirm.

```json
{ "reason": "Phát hiện thiếu 12 chai lô L26-04 do dán nhầm" }
```

---

## 5. Inbound — Phiếu nhập

### 5.1 `POST /inbound/requests` — UC-IN-01 — `inbound.create`

```json
{
  "type": "SUPPLIER",
  "supplierId": 1,
  "expectedDate": "2026-05-08",
  "warehouseZone": "Kho chính - Hà Nội",
  "note": "",
  "lines": [
    { "productId": 12, "requestedQtyBox": 500 },
    { "productId": 14, "requestedQtyBox": 300 },
    { "skuId": 88, "requestedQtyBox": 120 }     // mã chưa chuẩn
  ]
}
```
Response 201: `{ data: { code: "PHN-2026-0043", … } }`.

### 5.2 `GET /inbound/requests` — UC-IN-05 — `inbound.read`

Filter: `status`, `supplier_id`, `from`, `to`, `q`. Trả progress stepper (0..8).

### 5.3 `GET /inbound/requests/:id` — `inbound.read`

### 5.4 `PATCH /inbound/requests/:id` — `inbound.update`

(Chỉ khi `status=NEW`.)

### 5.5 `POST /inbound/requests/:id/accept` — UC-IN-02 — `inbound.accept`

```json
{ "prepZoneReady": true }
```

### 5.6 `GET /inbound/requests/:id/reconcile` — UC-IN-03 — `inbound.read`

Engine đối chiếu tự động — trả kết quả:
```json
{
  "data": {
    "summary": {
      "totalRequested": 920,
      "totalReceived": 876,
      "diff": -44,
      "diffPct": -4.78,
      "palletCount": 5,
      "confirmedPallets": 3,
      "tempSkuCount": 1
    },
    "lines": [
      {
        "productId": 12, "sku": "VG-NM-001", "name": "Nước mắm 500ml",
        "requestedQtyUnit": 500, "receivedQtyUnit": 500,
        "diff": 0, "status": "MATCHED",
        "palletCodes": ["PL260506.005","PL260506.008","PL260506.011"]
      },
      {
        "productId": 14, "sku": "VG-TT-002", "name": "Tương ớt 250g",
        "requestedQtyUnit": 300, "receivedQtyUnit": 240,
        "diff": -60, "status": "SHORTAGE",
        "palletCodes": ["PL260506.011"]
      },
      {
        "skuId": 99, "sku": "TMP-260506-007", "name": "Mì gói lạ NCC X",
        "requestedQtyUnit": null, "receivedQtyUnit": 30,
        "diff": 30, "status": "EXTRA_PENDING",
        "palletCodes": ["PL260506.012"]
      }
    ]
  }
}
```

### 5.7 `POST /inbound/requests/:id/finalize` — UC-IN-04 — `inbound.finalize` 🔒 AUDIT

```json
{
  "discrepancyDecision": "ACCEPT",   // hoặc REVIEW_AGAIN | CREATE_ADJUSTMENT
  "note": "Chấp nhận theo biên bản 06/05/2026",
  "createAdjustmentReason": "BROKEN"  // chỉ khi CREATE_ADJUSTMENT
}
```
Kiểm tra precondition: tất cả pallet đã PUTAWAY, mã tạm đã chuẩn hoá, total received = total allocated. Nếu thiếu → 409 với detail rõ thiếu cái gì.

### 5.8 Excel import — UC-IN-06

`POST /inbound/excel-imports` — `inbound.create`. Multipart upload file.
```
form-data:
  file: <xlsx>
  supplierId: 7
  orderDate: 2026-05-06
  expectedDate: 2026-05-07
```
Response 202: `{ data: { id: 123, status: "PARSED", jobId: "..." } }` + parsed payload trong field tiếp theo (poll `GET /inbound/excel-imports/:id`).

`GET /inbound/excel-imports/:id` — Trả preview với matched/pending/duplicated.

`POST /inbound/excel-imports/:id/commit` — Tạo PHN từ kết quả parse + tuỳ chọn tạo nhanh các SKU pending.
```json
{
  "skuStrategy": "AUTO_CREATE",   // AUTO_CREATE | SKIP | MANUAL
  "manualMapping": [
    { "rowNo": 56, "productId": 142 }   // cho dòng "trùng"
  ]
}
```
Response 201: `{ data: { inboundRequestId: 44, code: "PHN-2026-0044" } }`.

---

## 6. Inbound tạm — UC-INTMP

### 6.1 `POST /inbound-temps` — UC-INTMP-01 — `inbound_temp.create`

```json
{
  "sourceType": "SUPPLIER",
  "deliveredBy": "Anh Tâm — xe 29A12345",
  "reason": "Hàng về đột xuất chưa có phiếu, kèm phiếu giao tay",
  "photoUrls": ["minio://temps/abc.jpg"],
  "lines": [
    { "skuId": 88, "qtyBox": 10, "lot": null, "expiryDate": "2027-01-01" }
  ]
}
```

### 6.2 `GET /inbound-temps` — UC-INTMP-03 — `inbound_temp.read`

### 6.3 `POST /inbound-temps/:id/standardize` — UC-INTMP-02 — `inbound_temp.update`

```json
{
  "supplierId": 7,
  "mapLines": [
    { "lineId": 12, "productId": 142 },
    { "lineId": 13, "createProduct": { "sku": "VG-NEW-201", "fullName": "...", "qtyPerBox": 24, "weightPerBoxKg": 12 } }
  ],
  "createInboundRequest": true
}
```
Response: tạo PHN mới + chuyển status sang `STANDARDIZED`.

---

## 7. Forklift — Xe nâng

### 7.1 `GET /forklift/pallets-pending` — UC-FK-01 — `forklift.read`

DS pallet `CONFIRMED` chưa vào vị trí.

### 7.2 `POST /forklift/putaway` — UC-FK-02 — `forklift.putaway` 🔒 AUDIT (light)

```json
{
  "palletId": 1011,
  "toLocationCode": "A-03-02"   // hoặc toLocationId
}
```
Backend kiểm tra location.type = `STORAGE`, đủ tải trọng, < max_pallets.
Tạo `movements` type=`PUTAWAY`, update `pallet.location_id` và status=`IN_STORAGE`.

### 7.3 `POST /forklift/relocate` — UC-FK-03 — `forklift.relocate` 🔒 AUDIT (light)

```json
{
  "palletId": 1011,
  "fromLocationId": 23, "toLocationCode": "A-04-01"
}
```
Cấm sửa nội dung — chỉ đổi vị trí.

### 7.4 `GET /forklift/fefo-suggestions` — UC-FK-04 — `forklift.read`

Query: `productId`, `qtyUnitNeeded?`.
```json
{
  "data": {
    "productId": 12,
    "totalAvailable": 456,
    "suggestions": [
      {
        "locationCode": "A-03-02",
        "palletCode": "PL260506.005",
        "lot": "L26-03",
        "expiryDate": "2027-04-28",
        "qtyUnitAvailable": 240,
        "priority": 1,
        "warningLevel": "CRITICAL"   // CRITICAL ≤7d | WARN ≤30d | NONE
      },
      { "locationCode": "B-01-05", "expiryDate": "2027-04-30", "priority": 2, … },
      { "locationCode": "C-02-08", "expiryDate": "2027-05-30", "priority": 3, … }
    ]
  }
}
```

### 7.5 `POST /forklift/pick-fefo` — UC-FK-04 — `forklift.pick` 🔒 AUDIT (light)

```json
{
  "palletId": 1005,
  "fromLocationId": 11,
  "toLocationId": 99,           // OUTBOUND_STAGING
  "qtyUnit": 240,
  "mode": "FULL"                 // FULL | PARTIAL
}
```
Backend: BEGIN TX, SELECT pallet FOR UPDATE, kiểm `qty_unit_available ≥ qtyUnit`, tạo movement `PICK_FEFO`, update pallet location & status. COMMIT.

### 7.6 `POST /forklift/return` — UC-FK-05 — `forklift.return` 🔒 AUDIT **BẮT BUỘC**

```json
{
  "palletId": 1005,
  "toLocationCode": "A-03-02",
  "updates": {
    "productId": 12,
    "qtyUnit": 180,            // khác SL ban đầu
    "lot": "L26-03",
    "expiryDate": "2027-04-28"
  },
  "reasonCode": "PARTIAL_PICKED_RETURN",
  "reasonDetail": "Đã xuất 60 chai cho đơn ABC, trả lại 180 chai"
}
```
**Mọi field trong `updates` được phép khác giá trị hiện tại** — backend ghi diff vào audit_logs. Response 200 + audit_log_id.

### 7.7 `GET /forklift/movements` — UC-FK-06 — `movement.read`

Filter: `type`, `from`, `to`, `q` (pallet code/SKU), `performedBy`.
```json
{
  "data": [
    {
      "id": 7821,
      "type": "RETURN_FROM_STAGING",
      "pallet": { "code": "PL260506.005" },
      "product": { "sku": "VG-NM-001" },
      "lot": "L26-03",
      "expiryDate": "2027-04-28",
      "qtyUnit": 180,
      "from": { "code": "STAGING-OUT" },
      "to": { "code": "A-03-02" },
      "performedAt": "2026-05-06T09:30:00Z",
      "performedBy": { "fullName": "Phạm Văn F" }
    }
  ],
  "meta": { … }
}
```

### 7.8 `GET /forklift/movements/export` — `movement.export`
Stream xlsx theo filter.

---

## 8. Outbound

### 8.1 `GET /outbound/staging` — UC-OUT-01 — `outbound.read`

DS pallet đang ở `OUTBOUND_STAGING`, kèm cảnh báo HSD.

### 8.2 `GET /outbound/reports/relative` — UC-OUT-02 — `outbound.report`

Query: `from`, `to`, `groupBy=sku|category`, `categoryId?`.
Trả tổng SL chuyển từ STORAGE → STAGING trong kỳ.

### 8.3 `GET /outbound/reports/turnover` — UC-OUT-03 — `outbound.report`

```json
{
  "data": {
    "items": [
      {
        "productId": 12,
        "sku": "VG-NM-001",
        "avgDailyOut": 32.5,
        "ratioOutInStock": 0.15,
        "daysOfStockLeft": 12,
        "trend": "RISING"
      }
    ]
  }
}
```

### 8.4 `GET /outbound/reports/restock-suggestions` — UC-OUT-04 — `outbound.report`

Query: `daysOfCover` (mặc định 14).
```json
{
  "data": [
    {
      "productId": 12, "sku": "VG-NM-001",
      "avgDailyOut": 32.5,
      "demand": 455,
      "currentStock": 240,
      "suggestedRestock": 215
    }
  ]
}
```

### 8.5 Rebalance — UC-OUT-05

`POST /outbound/rebalances` — `outbound.rebalance` 🔒 AUDIT (preview).
Multipart:
```
file: <xlsx>
method: EXPORTED_QTY_FILE | OUTBOUND_REQUEST_FILE
```
Response 202: preview job.

`GET /outbound/rebalances/:id` — Trả preview lines với diff.

`POST /outbound/rebalances/:id/apply` — `outbound.rebalance.apply` 🔒 AUDIT **BẮT BUỘC**
```json
{ "confirm": true, "note": "Khớp với phiếu xuất số 142/2026" }
```

---

## 9. Inventory & Stocktake

### 9.1 `GET /inventory/by-sku` — UC-INV-01 — `inventory.read`

Query: `q`, `categoryId`, `supplierId`, `hsdRange`, `availabilityFilter`.
Trả từng SKU với `totalAvailable`, `totalPending`, breakdown lô/HSD.

`GET /inventory/by-sku/:productId/locations` — drill-down các vị trí chứa.

### 9.2 `GET /inventory/by-location` — UC-INV-02 — `inventory.read`

Trả pallets + lines tại từng location.

### 9.3 `GET /inventory/by-pallet` — UC-INV-03 — `inventory.read`

Filter: `status` (waiting/in_storage/moving/staging_out).

### 9.4 `GET /inventory/fefo` — UC-INV-04 — `inventory.read`
Tổng hợp toàn kho theo Lot/HSD, sort HSD ASC.

### 9.5 Alerts — UC-INV-05

`GET /inventory/alerts` — `alert.read` — Lấy cảnh báo hiện hoạt động.
`GET /inventory/alerts/settings` / `PUT /inventory/alerts/settings` — `alert.update` — Cấu hình tần suất, người nhận.

### 9.6 Stocktake — UC-INV-06, 07, 08

`POST /stocktake/sessions` — `stocktake.create`
```json
{
  "type": "BY_LOCATION",
  "blindCount": true,
  "targetScope": { "locationIds": [1,2,3] }
}
```

`GET /stocktake/sessions/:id` — Trả tiến độ.

`POST /stocktake/sessions/:id/scan-location` — UC-INV-06 — `stocktake.update`
```json
{ "locationCode": "A-03-02" }
```
Response: DS pallet + lines tại vị trí, ẩn `system_qty_unit` nếu blindCount.

`POST /stocktake/sessions/:id/lines` — UC-INV-06 — `stocktake.update`
```json
{
  "locationId": 11, "palletId": 1011, "productId": 12,
  "actualQtyUnit": 238,
  "lot": "L240120", "expiryDate": "2028-01-20",
  "note": "Vỡ 2 chai trên kệ",
  "photoUrls": ["minio://stk/abc.jpg"]
}
```

`GET /stocktake/sessions/:id/by-sku-summary` — UC-INV-07.

`POST /stocktake/sessions/:id/lines/:lineId/resolve` — UC-INV-08 — `stocktake.resolve`
```json
{ "resolution": "ACCEPT" }   // ACCEPT | RECOUNT | IGNORE
```

`POST /stocktake/sessions/:id/close` — Đóng phiên, sinh `inventory_adjustment` DRAFT.

### 9.7 Adjustments — UC-INV-09

`POST /inventory/adjustments` — `adjustment.create` (Kế toán)
```json
{
  "type": "DECREASE",
  "reason": "STOCKTAKE",
  "stocktakeSessionId": 42,
  "reasonDetail": "Theo phiên KK STK-2026-0042",
  "lines": [
    { "productId": 12, "palletId": 1011, "locationId": 11, "lot": "L240120",
      "qtyUnitBefore": 240, "qtyUnitAfter": 238, "note": "Vỡ 2 chai" }
  ]
}
```

`GET /inventory/adjustments` — Filter `status`, `reason`, `from/to`.

`POST /inventory/adjustments/:id/submit` — Chuyển DRAFT → PENDING_APPROVAL.

`POST /inventory/adjustments/:id/approve` — `adjustment.approve` 🔒 AUDIT **BẮT BUỘC** (Quản lý)
```json
{ "note": "Đồng ý theo biên bản 06/05" }
```

`POST /inventory/adjustments/:id/reject` — `adjustment.approve`
```json
{ "reason": "Cần kiểm tra lại lô L240120" }
```

---

## 10. Dashboard

### 10.1 `GET /dashboard` — UC-DASH-01 — `auth`

Trả widget khác nhau dựa trên role hiện tại của user.
```json
{
  "data": {
    "role": "ACCOUNTANT",
    "widgets": [
      { "type": "INBOUND_IN_PROGRESS", "value": 7, "delta": "2 chờ đối chiếu" },
      { "type": "TEMP_PENDING", "value": 3, "delta": "8 dòng" },
      { "type": "ALERT_HSD", "data": { "critical": 3, "warn": 12 } },
      { "type": "RECENT_DOCUMENTS", "data": [...] }
    ]
  }
}
```

### 10.2 `GET /dashboard/kpi` — UC-DASH-02 — `kpi.read` (Manager)

Query: `range=today|week|month`. Trả KPI tổng hợp.

---

## 11. System

### 11.1 `GET /system/settings` / `PUT /system/settings` — UC-SYS-01 — `setting.read/update` 🔒 AUDIT

Body PUT:
```json
{
  "appName": "WMS Vĩnh Giang",
  "hotline": "1900-xxxx",
  "supportEmail": "support@vinhgiang.com",
  "logoUrl": "minio://settings/logo.png",
  "faviconUrl": "minio://settings/fav.png",
  "fefoCriticalDays": 7,
  "fefoWarnDays": 30,
  "palletCodePrefix": "PL"
}
```

### 11.2 Mail — UC-SYS-02

`GET /system/mail` — Trả config (ẩn password/api_key).
`PUT /system/mail` — `mail.update` 🔒 AUDIT
```json
{
  "provider": "SMTP",
  "host": "smtp.gmail.com", "port": 587,
  "username": "noreply@vinhgiang.com",
  "password": "...",        // chỉ gửi khi đổi
  "fromEmail": "noreply@vinhgiang.com",
  "fromName": "WMS Vĩnh Giang",
  "useTls": true,
  "isActive": true
}
```

`POST /system/mail/test` — `mail.test`
```json
{ "to": "admin@vinhgiang.com", "subject": "Test", "body": "Hello" }
```
Response: kết quả gửi thực (success/fail + raw error).

### 11.3 Audit log — UC-SYS-03

`GET /system/audit-logs` — `audit.read` (Manager only).
Filter: `actorId`, `action`, `resourceType`, `resourceId`, `from`, `to`.

`GET /system/audit-logs/:id` — Trả full diff JSON.

> Audit log **chỉ đọc**, không có POST/PATCH/DELETE.

### 11.4 `GET /system/mail-logs` — `mail.read`

---

## 12. Integration & Utilities

### 12.1 `POST /attachments` — `auth`

Multipart upload file (ảnh chứng từ, ảnh hiện trường, file Excel ngoài flow chuẩn).
```
form-data:
  file: <binary>
  resourceType: "inbound_temp"
  resourceId: 12
```
Response 201:
```json
{ "data": { "id": 8821, "storageKey": "minio://...", "url": "https://..." } }
```

### 12.2 `GET /attachments/:id` — `auth`
Pre-signed URL có TTL 5 phút (không expose key trực tiếp).

### 12.3 `POST /integration/barcode/lookup` — UC-INT-01 — `auth`

```json
{ "code": "8934567890123" }
```
Response: product nếu match, hoặc SKU nếu match supplier_code.

### 12.4 `GET /<any-list-endpoint>?export=xlsx` — UC-INT-03

Mọi endpoint list hỗ trợ query `?export=xlsx` (cần permission `*.export`). Stream xlsx, header `Content-Disposition`.

---

## 13. Map Endpoints ↔ Use Cases (bảng tra)

| UC | Endpoint chính |
|---|---|
| UC-AUTH-01 | POST /auth/login |
| UC-AUTH-03 | POST /auth/change-password |
| UC-AUTH-04 | POST /auth/forgot-password + /auth/reset-password |
| UC-AUTH-05 | GET/PUT /roles/:id/permissions |
| UC-MD-01 | /products/* |
| UC-MD-02 | /skus/* |
| UC-MD-03 | /categories/* |
| UC-MD-04 | /units/* |
| UC-MD-05 | /locations/* |
| UC-MD-06 | /suppliers/* |
| UC-PAL-01 | POST /pallets |
| UC-PAL-02 | POST/PATCH/DELETE /pallets/:id/lines |
| UC-PAL-03 | (FE only, dùng /integration/barcode/lookup) |
| UC-PAL-04 | POST /pallets/:id/confirm |
| UC-PAL-05 | POST /pallets/:id/unlock |
| UC-PAL-06 | GET /pallets/:id |
| UC-IN-01 | POST /inbound/requests |
| UC-IN-02 | POST /inbound/requests/:id/accept |
| UC-IN-03 | GET /inbound/requests/:id/reconcile |
| UC-IN-04 | POST /inbound/requests/:id/finalize |
| UC-IN-05 | GET /inbound/requests |
| UC-IN-06 | POST /inbound/excel-imports + /commit |
| UC-INTMP-01 | POST /inbound-temps |
| UC-INTMP-02 | POST /inbound-temps/:id/standardize |
| UC-INTMP-03 | GET /inbound-temps |
| UC-FK-01 | GET /forklift/pallets-pending |
| UC-FK-02 | POST /forklift/putaway |
| UC-FK-03 | POST /forklift/relocate |
| UC-FK-04 | GET /forklift/fefo-suggestions + POST /forklift/pick-fefo |
| UC-FK-05 | POST /forklift/return |
| UC-FK-06 | GET /forklift/movements |
| UC-OUT-01 | GET /outbound/staging |
| UC-OUT-02 | GET /outbound/reports/relative |
| UC-OUT-03 | GET /outbound/reports/turnover |
| UC-OUT-04 | GET /outbound/reports/restock-suggestions |
| UC-OUT-05 | POST /outbound/rebalances + /apply |
| UC-INV-01 | GET /inventory/by-sku |
| UC-INV-02 | GET /inventory/by-location |
| UC-INV-03 | GET /inventory/by-pallet |
| UC-INV-04 | GET /inventory/fefo |
| UC-INV-05 | GET /inventory/alerts + /settings |
| UC-INV-06 | POST /stocktake/sessions/:id/lines (BY_LOCATION) |
| UC-INV-07 | GET /stocktake/sessions/:id/by-sku-summary |
| UC-INV-08 | POST /stocktake/sessions/:id/lines/:lineId/resolve |
| UC-INV-09 | /inventory/adjustments/* + approve |
| UC-DASH-01 | GET /dashboard |
| UC-DASH-02 | GET /dashboard/kpi |
| UC-SYS-01 | /system/settings |
| UC-SYS-02 | /system/mail + /test |
| UC-SYS-03 | /system/audit-logs |
| UC-SYS-04 | /users/* |
| UC-SYS-05 | GET/PATCH /me |
| UC-INT-01 | POST /integration/barcode/lookup |
| UC-INT-02 | POST /attachments |
| UC-INT-03 | ?export=xlsx trên mọi list |

---

## 14. Rate limiting

| Scope | Giới hạn |
|---|---|
| `POST /auth/login` | 10 req/phút/IP |
| `POST /auth/forgot-password` | 5 req/giờ/email |
| Mobile mọi endpoint | 120 req/phút/user |
| Web mọi endpoint | 300 req/phút/user |
| Export Excel | 10 req/phút/user |
| Excel import upload | 5 req/giờ/user |

Vượt: 429 Too Many Requests + `Retry-After`.

---

## 15. Tham chiếu

- [DATABASE.md](DATABASE.md) — Schema bảng
- [CRITICAL_PATHS.md](CRITICAL_PATHS.md) — Luồng dùng các endpoint
- [SECURITY.md](SECURITY.md) — Auth, RBAC, audit, rate-limit

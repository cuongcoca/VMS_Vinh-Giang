# WVG-63 / WMS-003 — Bảng mapping API (màn hình → endpoint → quyền → state)

Đáp ứng review P2 #6. Phủ 2 luồng: **Quản lý Mã hàng** (`/wms/item-codes`) và
**Import Excel nhập kho** (`/wms/inbound/import`). Quyền theo ma trận deny-by-default
(WVG-16, `resource:action`).

## 1. Màn Quản lý Mã hàng — `/wms/item-codes`
| Action (UI) | Endpoint | Request (chính) | Response OK | Lỗi | Quyền | State đổi |
|---|---|---|---|---|---|---|
| Mở danh sách / lọc tab (Chờ xử lý / Đã chuẩn hoá) | `GET /api/item-codes?status=&q=` | query `status`,`q` | `200 {data:[…]}` | `401`/`403` | `item_code:read` | — |
| Tạo mã hàng (mobile `/thukho/item-code/new` hoặc desktop) | `POST /api/item-codes` | `{code, short_name, unit_id, …}` | `201 {data}` | `400` mã trùng / ký tự lạ `@` / **giống account** · `403` | `item_code:write` | tạo 1 `item_codes` (status `pending`) |
| Xem chi tiết | `GET /api/item-codes/[id]` | — | `200 {data}` | `404`/`403` | `item_code:read` | — |
| Chuẩn hoá / sửa | `PUT /api/item-codes/[id]` | `{full_name, group_id, status:'standardized', …}` | `200 {data}` | `400`/`404`/`403` | `item_code:write` | cập nhật `item_codes` |
| Xoá / gộp | `DELETE /api/item-codes/[id]` | — | `200` | `409` đang dùng · `403` | `item_code:write` | ẩn/xoá `item_codes` |
| Gợi ý gộp trùng | `GET /api/item-codes/suggest-merge?...` | query | `200 {data}` | `403` | `item_code:read` | — |
| Tra theo mã / barcode (nhận diện) | `GET /api/item-codes/by-code`, `/by-barcode` | query | `200 {data}` | `404`/`403` | `item_code:read` | — |

**Chặn account (WVG-63):** ở `POST /api/item-codes` và import-confirm — regex `^[A-Za-z0-9\-_./]+$` (chặn `@`) + guard 2 lớp (`looksLikeAccount` tĩnh + `matchesUserAccount` đối chiếu `users`). Vi phạm → `400`, **không tạo record**.

## 2. Luồng Import Excel nhập kho — `/wms/inbound/import`
| Bước (UI) | Endpoint | Request | Response OK | Lỗi | Quyền | State đổi |
|---|---|---|---|---|---|---|
| ① Upload + xem trước mapping | `POST /api/inbound/import-excel` | file/rows Excel | `200 {preview: [{excel_code, matched?, …}]}` | `400` sai định dạng · `403` | `inbound:write` | **không ghi** (chỉ đọc + match) |
| ② Xác nhận tạo phiếu | `POST /api/inbound/import-excel/confirm` | `{invoice_no, supplier_id?, lines:[{item_code_id?|create_temp_code+excel_code, qty_expected, lot?, expiry_date?}]}` | `201 {data: inbound}` | **`400 {error, errors:[…]}`** pre-validate cả batch · `409` trùng mã · `403` | `inbound:write` | **ATOMIC**: tạo mã tạm (dedupe) + `inbound_requests` + `inbound_lines` trong **1 transaction** |

### Chi tiết bước ② (điểm fix WVG-63)
- **Pre-validate TOÀN batch (không ghi):** qty>0, `excel_code` có, regex mã, **chặn account** (code + tên), `item_code_id` (dòng mapped) tồn tại → **gom hết lỗi** vào `errors[]`, có lỗi → **`400` duy nhất, 0 record**.
- **Transaction (all-or-nothing):** tạo mã tạm DISTINCT → tạo phiếu + dòng. Lỗi giữa chừng → rollback sạch.
- **Error contract mới:** `{ success:false, error:"<tóm tắt>", errors:[ "Dòng n: …", … ] }` (thêm mảng `errors`; giữ `error` string cho FE cũ).

## 3. Ma trận quyền liên quan (vai được thao tác)
| Resource | QUAN_LY | KE_TOAN | THU_KHO | XE_NANG | KIEM_KE |
|---|---|---|---|---|---|
| `item_code` read / write | ✓ / ✓ | ✓ / ✓ | ✓(đọc-sàn) / ✓(tạo nhanh mobile) | đọc-sàn / — | đọc-sàn / — |
| `inbound` write (import) | ✓ | ✓ | ✓ | — | — |

(Chi tiết & bằng chứng RBAC: WVG-16.)

# WVG-73 / UC-MD-02 — API & Data Contract Evidence (Quản lý Mã hàng)

**Mục đích:** cung cấp evidence để đóng các Open Point BLOCKING của BA Main (OP-MD02-01→06) và làm test basis cho QA (WVG-75). Bám quyết định BA ngày 30/07/2026.

---

## 1. Endpoint / method / payload / response (OP-MD02-01)
Base: `/api/item-codes`. Auth: JWT Bearer. Guard: `permissions.ts` (deny-by-default).

| # | Method · Route | Chức năng | Authz (resource:action) | Response chính | Error |
|--|--|--|--|--|--|
| 1 | `GET /api/item-codes` | List (search/status/group/paging/sort) | `item_code:read` | `{success,data[],stats{pending,standardized,total},pagination}` | 401/403/500 |
| 2 | `POST /api/item-codes` | Tạo mã (Thủ kho) → `pending` | `item_code:write` | `{success,data}` (201) | 400(field)/409(trùng mã)/403/500 |
| 3 | `GET /api/item-codes/[id]` | Chi tiết | `item_code:read` | `{success,data}` | 404/500 |
| 4 | `PUT /api/item-codes/[id]` | Sửa / **Chuẩn hóa** | `item_code:write` **+ role-gate chuẩn hóa** | `{success,data,cascade}` | 400/403/404/409/500 |
| 5 | `DELETE /api/item-codes/[id]` | Xóa (chỉ `pending`) | `item_code:write` | `{success,message}` | 404/409(đã chuẩn hóa)/500 |
| 6 | `GET /api/item-codes/by-code?code=` | Tra cứu theo mã | `item_code:read` | `{success,data}` | — |
| 7 | `GET /api/item-codes/by-barcode?barcode=` | Tra cứu theo barcode | `item_code:read` | `{success,data}` | — |
| 8 | `GET /api/item-codes/suggest-merge?q=&excludeId=` | Gợi ý trùng/liên kết SKU | `item_code:read` | `{success,data{similarCodes[],matchingProducts[]}}` | — |

## 2. Status enum (OP-MD02-03) — **đóng OP**
- Cột `item_codes.status` kiểu **String**, giá trị hợp lệ: **`"pending"`** (Chờ xử lý) · **`"standardized"`** (Đã chuẩn hóa). Default `"pending"`.
- **Business transition** (BA mục 5): `pending → standardized`, một chiều, do **Kế toán** thực hiện qua route #4 với `status:"standardized"`.

## 3. Field / schema mapping (OP-MD02-02) — table `item_codes`
| Field | Kiểu | Bắt buộc | Bước | Ghi chú |
|--|--|--|--|--|
| `code` | VarChar(100) @unique | ✅ (Kế toán) | tạo/chuẩn hóa | Mã theo chứng từ NCC. Thủ kho tạo nhanh có thể để trống → hệ thống sinh `TEMP-*` tạm (xem §6) |
| `short_name` | VarChar(100) | ✅ | tạo | Tên rút gọn (Thủ kho) |
| `unit_id` | Uuid → `units` | ✅ | tạo | ĐVT = đơn vị lẻ (chai/gói/lon) |
| `specification` | VarChar(200) | ⭘ | tạo | Quy cách (mô tả đóng gói) |
| `units_per_box` | Int (default 1, ≥1) | ⭘ | tạo | **Số đơn vị lẻ / thùng** — quan hệ quy đổi lẻ↔Thùng (BA mục 4). Không có công thức quy đổi riêng |
| `weight_per_box` | Decimal(10,3) | ⭘ | tạo | Trọng lượng/thùng (≥0) — *OP-MD02-05* |
| `photo_url` `note` `barcode` | Text/VarChar | ⭘ | tạo | *upload ảnh: OP-MD02-05* |
| `full_name` | VarChar(200) | ✅ **khi chuẩn hóa** | chuẩn hóa | Tên đầy đủ (Kế toán) |
| `group_id` | Uuid → `product_groups` | ⭘ | chuẩn hóa | Nhóm hàng |
| `product_id` | Uuid → `products` | ⭘ | chuẩn hóa | **Liên kết SKU chuẩn** |
| `created_by` | Uuid → `users` | auto | tạo | **WVG-73: nay set = Thủ kho tạo** |
| `standardized_by` / `standardized_at` | Uuid / DateTime | auto | chuẩn hóa | **WVG-73: nay set = Kế toán chuẩn hóa** (trước để `TODO`) |

## 4. Authorization tại backend (BA mục 2) — **evidence live**
| Actor | Quyền `item_code` | Thực tế |
|--|--|--|
| Thủ kho | full | Tạo/sửa mã `pending`; **KHÔNG chuẩn hóa** → PUT `standardized` trả **403** (WVG-73) |
| Kế toán | full | Tạo/sửa + **chuẩn hóa** (`pending→standardized`) ✅ |
| Quản lý | special | Xem + xử lý ngoại lệ (được chuẩn hóa) |
| Xe nâng / Kiểm kê | read (READ_FLOOR) | **KHÔNG ghi** → POST/PUT/DELETE **403**; **giữ tra cứu** (GET/by-code/by-barcode **200**) — xem *OP §7* |

Kiểm chứng (dev local): Thủ kho tạo→`pending` ✅ · Thủ kho chuẩn hóa→**403** ✅ · Xe nâng POST→**403**, GET→**200** ✅ · Kế toán chuẩn hóa→`standardized` + `standardized_by` set ✅.

## 5. Thuật toán gợi ý trùng / liên kết (OP-MD02-04) — evidence
- `suggest-merge`: match **substring** (`contains`, insensitive) trên `code|short_name|full_name` (chỉ `standardized`) + `products` (`sku|name|short_name`, active), mỗi nhóm `take:10`.
- **Chỉ trả gợi ý** — KHÔNG auto-merge/auto-delete (khớp BA mục 6). "Gộp/liên kết" = Kế toán set `product_id` qua PUT (route #4); không có endpoint phá dữ liệu/xóa lịch sử.
- *Chưa có* fuzzy/similarity-threshold/normalization — nếu BA cần, mở change request (không tự thêm).

## 6. Idempotency / transaction / duplicate (OP §7 BA) — evidence
- **Tạo:** `code` `@unique` + check trùng trước insert → **409** nếu trùng; validation fail → **KHÔNG tạo record** (return sớm trước `create`).
- **Chuẩn hóa:** bọc trong **`prisma.$transaction`** (tạo/nối Product + update ItemCode atomic; re-use Product theo `sku` → idempotent khi chạy lại).
- **TEMP-***: khi Thủ kho không nhập mã, sinh `TEMP-<timestamp>-<rand>` để thỏa NOT NULL + @unique; Kế toán đổi sang mã thật khi chuẩn hóa. → **cần BA xác nhận** vs mục 3.E ("không tự sinh mã thay mã chứng từ"): đây là mã **tạm nội bộ**, không thay mã chứng từ cuối.

## 7. Open points còn lại (trả BA — WVG-72)
| OP | Nội dung | Đề xuất DEV | Trạng thái |
|--|--|--|--|
| OP-02 | TEMP-* auto-code | Giữ (mã tạm, đổi khi chuẩn hóa) | chờ BA xác nhận |
| OP-04 | Fuzzy matching | Hiện substring; không tự thêm threshold | business RESOLVED, thuật toán cung cấp |
| OP-05 | Validation trọng lượng/thùng + giới hạn upload ảnh | weight ≥0 đã có; **giới hạn size/loại ảnh chưa enforce ở API** | cần BA chốt policy |
| **Tra cứu vs quản lý** | Xe nâng/Kiểm kê giữ GET item-code (tra cứu cho stage-out/kiểm kê) | **Giữ tra cứu, chặn ghi** (đã duyệt) — vì forklift/kiemke gọi trực tiếp `/api/item-codes` | **flag BA phân biệt tra cứu ≠ quản lý** |
| **Side-effect recalc** | PUT đổi `units_per_box`/`weight_per_box` → `recalcPalletLinesByItemCode` cập nhật `pallet_line` (weight_kg, qty_unit) | Là recalc dữ liệu dẫn xuất, **không đổi balance tồn**; giữ, cần before/after evidence | flag BA mục 8 |

## 8. Stock effect (BA mục 8) = NONE
UC-MD-02 chỉ đổi master data `item_codes` (+ tạo/nối `products` khi chuẩn hóa). **Không** đụng inventory balance / stock_movement / stock_ledger / phiếu nhập / phiếu xuất. Ngoại lệ ghi nhận: recalc `pallet_line` derived fields khi đổi quy cách (mục 7 — flag).

## 9. Đã sửa đợt này (WVG-73 BE + WVG-74 FE)
- **BE:** role-gate chuẩn hóa (chỉ Kế toán/Quản lý) · set `created_by`/`standardized_by` · audit `CREATE/STANDARDIZE/UPDATE/DELETE_ITEM_CODE` (không secret).
- **FE:** WVG-65 lỗi tải → **error state + Thử lại** (không thành empty) · ẩn nút Chuẩn hóa với vai không đủ quyền (BE vẫn chốt chặn) · 401→đăng nhập.
- **KHÔNG** đổi schema/enum/migration.

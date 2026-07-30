# WVG-63 / WMS-003 — Import không tạo dữ liệu một phần (đáp ứng review 78/100)

## 1. Bối cảnh
Bug gốc: account (email/SĐT/tên) lọt thành "mã hàng chờ chuẩn hoá" khi import nhầm
file/sheet. **Pha 3 đã fix**: guard 2 lớp (`looksLikeAccount` tĩnh + `matchesUserAccount`
đối chiếu `users`) + regex chặn `@`. Review 78/100 nêu thêm điểm **DEV chưa đạt**.

## 2. Root cause điểm mới (review P1 #3)
`inbound/import-excel/confirm/route.ts` xử lý trong **vòng lặp**: vừa validate vừa
`prisma.itemCode.create()` **inline, KHÔNG bọc transaction**. Nếu dòng 1 tạo mã tạm
thành công (commit ngay) rồi dòng 2 fail `400`, **mã tạm dòng 1 vẫn còn** → dữ liệu
một phần, vi phạm AC *"validation/negative case không tạo thay đổi dữ liệu một phần"*.

## 3. Giải pháp
### 3.1 Atomic hoá `inbound/import-excel/confirm`
- **Giai đoạn A — pre-validate TOÀN batch (không ghi):** hàm thuần `prevalidateImportLines()` (`src/lib/import-item-validate.ts`) kiểm qty>0, `excel_code` có, regex mã, **chặn account** (code + tên) → **gom hết lỗi** kèm số dòng. Route đọc thêm: `item_code_id` (dòng mapped) tồn tại. Có lỗi → **`400` duy nhất `{error, errors:[…]}`, 0 record**.
- **Giai đoạn B — 1 `prisma.$transaction`:** tạo mã tạm DISTINCT (dedupe theo code, tránh trùng chính batch) → tạo `inbound_requests` + `inbound_lines` — **all-or-nothing**.

### 3.2 Rà & thống nhất cả cụm import (review yêu cầu)
| Route | Trạng thái | Ghi chú |
|---|---|---|
| `inbound/import-excel/confirm` | ❌ chưa atomic → **ĐÃ FIX** | pre-validate + transaction |
| `products/import-excel/confirm` | ✅ đã atomic | bọc `$transaction` + `upsert` |
| `locations/import-excel/confirm` | ✅ đã atomic | bọc `$transaction` |
| `outbound/requests/import` | ✅ atomic | 1 nested `create` (không tạo mã tạm) |
| `product-groups/import-excel` | ✅ atomic | 1 `createMany` |
| `POST /api/item-codes` | ✅ thấp rủi ro | tạo đơn lẻ (không loop) |

→ Chỉ 1 route thiếu atomicity; đã sửa. Các route còn lại xác nhận an toàn.

## 4. Bằng chứng
| Kiểm chứng | Kết quả |
|---|---|
| Unit `scripts/test-import-atomic.ts` (pre-validate) | ✅ **15/15** — gom hết lỗi; chặn email/SĐT/tên-trùng; account KHÔNG vào plan; dedupe mã tạm; mã thật (8 số, `TEMP-*`, có dấu) KHÔNG false-positive |
| Unit `scripts/test-item-code-guard.ts` | ✅ **22/22** (guard 2 lớp) |
| **Live negative test** (dev server + DB local) | ✅ **PASS** — batch `[mã hợp lệ + "driver@vms.vn"]` → **HTTP 400** (`errors[]` gom 2 lỗi dòng 2); `item_codes` **3 → 3 không đổi**; mã hợp lệ **KHÔNG được tạo** ⇒ **không dữ liệu một phần** |
| `npx tsc --noEmit` | ✅ sạch |
| Mapping API | `docs/reports/BAO_CAO_WVG63_API_MAPPING.md` |

## 5. Cho BA Main (review P1 #2) — rule chặn account KHÔNG phá "mã theo chứng từ NCC"
Nghiệp vụ: mã hàng nhập **theo chứng từ NCC** (không sinh tự động). Rule chặn được
thiết kế **hẹp** để không cản mã thật:
- **Chỉ chặn** khi giá trị: (a) **giống email** (`local@domain.tld`, hoặc chứa `@`); (b) **giống SĐT di động VN** (`0[3|5|7|8|9]` + 8 số / `+84…`); hoặc (c) **trùng ĐÚNG** một tài khoản trong `users` (email/phone/username/full_name).
- **KHÔNG chặn** mã hàng thật: mã 8 chữ số (vd `12345678`), `TEMP-*`, `VG-NM-500`, tên SP có dấu ("Sữa 180ml", "Dầu ăn 5L") — đã có test khẳng định.
- Regex mã chỉ cho `A–Z a–z 0–9 - _ . /` (chặn `@` và ký tự lạ) — đúng khuôn mã chứng từ.

→ Đề nghị **BA Main xác nhận** rule này khớp UC-MD-02 (mã theo chứng từ NCC) và không chặn nhầm mã hợp lệ.

## 6. Cho DevOps (review P1 #4) — backup/rollback/release/smoke
- **Backup trước làm sạch dữ liệu** (bug liên quan data prod): `pg_dump` DB (prod Docker: `docker exec wms-postgres pg_dump`; native: `pg_dump "$DBU"`).
- **Làm sạch account đã lọt** (nếu còn): rà `SELECT * FROM item_codes WHERE code ~ '@' OR code ~ '^0[35789][0-9]{8}$';` → xử lý (ẩn/xoá) có backup + audit; **không sửa balance/tồn**.
- **Deploy code** (thuần route + lib, KHÔNG migration/schema): git pull + build + restart.
- **Smoke:** chạy `scripts/test-import-atomic.ts` (unit) + 1 live negative test → 400, không tạo record; + tạo 1 phiếu import hợp lệ → 201.
- **Rollback:** revert commit + build + restart; dữ liệu không đổi schema nên không cần rollback DB.
- **Release note:** "Siết import Excel nhập kho: pre-validate toàn batch + transaction → lỗi giữa chừng không để lại mã hàng rác; chặn account lọt thành mã hàng."

## 7. Còn lại để Remove Redflag (cần vai khác)
- [ ] **QA** (WVG-75): retest độc lập + gắn evidence (dựa test + live negative ở §4).
- [ ] **BA Main**: sign-off rule §5.
- [ ] **DevOps**: xác nhận backup/rollback/smoke §6 khi release prod.
- [ ] **Commit message** rõ ràng (không "update mã hàng") — xem §Commit.

## 8. Phạm vi & an toàn
- Không đổi field/enum/table/schema/migration; chỉ siết logic route + thêm lib validate + test.
- Không sai tồn / mất audit / mở rộng quyền (quyền giữ `inbound:write`; chỉ **thắt chặt** đầu vào).

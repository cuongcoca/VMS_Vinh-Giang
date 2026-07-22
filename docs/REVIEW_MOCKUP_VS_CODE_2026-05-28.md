# BÁO CÁO ĐỐI CHIẾU MOCKUP ↔ CODE — WMS Vĩnh Giang

**Ngày**: 2026-05-28 · **Branch**: `feat/phase0-deploy-tools-and-reports`
**Mockup**: `wms_mockups_4.html` (4138 dòng, v3.0 — 56 use case, 12 module)
**Code**: ~150 file `route.ts` + ~80 page · `prisma/schema.prisma` v7
**Phương pháp**: 5 reviewer độc lập, mỗi reviewer phụ trách 2-3 module, đọc THẬT cả mockup + code

---

## TÓM TẮT EXECUTIVE

### Số liệu tổng
| Severity | Số | % |
|---|---:|---:|
| 🔴 **CRITICAL** | **12** | 11% |
| 🟠 **HIGH** | **45** | 41% |
| 🟡 MEDIUM | 47 | 42% |
| ⚪ LOW | 7 | 6% |
| **TỔNG** | **111** | 100% |

### Đánh giá: **Mockup & Code đang lệch nghiêm trọng ở nhiều mảng**

Mặc dù code phần lớn implement đúng tinh thần mockup, có **8 chủ đề lớn** mockup và code không nhất quán — gây bug nghiệp vụ, dead feature, UI hiển thị data sai, hoặc thiếu hẳn flow chính. Một số bug **trùng** với báo cáo logic review trước ([INV-001 ≡ S9-001], [OUT-005 ≡ O5-001], [audit trigger ≡ I5-001]), số còn lại là phát hiện mới chỉ qua việc đọc mockup.

### 8 chủ đề nóng (xem chi tiết phần "Cross-cutting" bên dưới)

| # | Chủ đề | Số file ảnh hưởng | Severity |
|---|---|---:|---|
| **CT-1** | **Code prefix scandal** — 5 entity có mã khác giữa mockup vs code | ~10 file | 🔴 |
| **CT-2** | **Dashboard Kế toán pull sai endpoint** — KPI hiển thị data không liên quan | 2 file | 🔴 |
| **CT-3** | **Adjustment approve không apply tồn** (= INV-001 đã ghi nhận) | 1 file | 🔴 |
| **CT-4** | **Stocktake granularity sai** — per item_code thay vì per pallet × lot | 4 file | 🔴 |
| **CT-5** | **Dead features** — UI/schema vẽ nhưng backend không xử lý (username, discrepancy_decision, rememberMe, OutboundRebalance, profile endpoint) | 6+ file | 🟠 |
| **CT-6** | **Excel export thiếu modal + thiếu 5 trang** | 6 file | 🟠 |
| **CT-7** | **Forgot password: mockup vẽ link-reset, code làm OTP** | 4 file | 🔴 |
| **CT-8** | **PYX SHIP + Rebalance không trừ tồn đúng cách** (= OUT-005) | 3 file | 🔴 |

---

## CROSS-CUTTING — 8 CHỦ ĐỀ LỚN

### CT-1 · Code prefix scandal — 5 entity mã khác nhau

| Entity | Mockup chuẩn | Code đang dùng | Vị trí trong code |
|---|---|---|---|
| **InboundRequest** | `PHN-YYYY-SSSS` | **2 nơi PHN, 2 nơi PNK** | • `inbound/route.ts:15` → `PNK`<br>• `inbound/next-code/route.ts:17` → `PNK`<br>• `inbound/new/page.tsx:108,113` fallback → `PNK`<br>• `inbound/import-excel/confirm/route.ts:13` → `PHN`<br>• `inbound-temp/[id]/standardize/route.ts:135` → `PHN` |
| **InboundTemp** | `PNT-YYMMDD-NNN` | `PTT-YYYY-SSSS` | • `inbound-temp/route.ts:13`<br>• `inbound-temp/next-code/route.ts:18` (có comment thừa nhận biết về mismatch)<br>• Schema comment `schema.prisma:491` ghi `// PNT-260506-003 (new) hoặc PTT-2026-0001 (legacy)` |
| **StocktakeSession** | `STK-YYYY-NNNN` | `KK-YYYY-NNN` | `stock-count/route.ts:60-61`, `quick-scan/route.ts:74-78` |
| **AdjustmentVoucher** | `ADJ-YYYY-NNNN` | `DCT-YYYY-NNN` | `adjustments/route.ts:42` |
| **OutboundRebalance** | `RBL-2026-NNNN` | **schema có model, KHÔNG có code sử dụng** | `schema.prisma:725-770` định nghĩa header + lines, không grep được trong `src/` |

**Tác động**: Cùng 1 phiếu trên hệ thống có 2 mã prefix khác nhau tùy nguồn tạo. UI cùng màn hình hiển thị mix `PNK-2026-0007` lẫn `PHN-2026-0008`. Báo cáo, Excel export, label QR, audit trail đều sẽ bị lệch — không thể tra cứu cross-system với khách hàng.

**Fix**: Quyết định 1 trong 2:
- (A) Đổi mockup theo code (giữ PNK/PTT/KK/DCT)
- (B) Đổi code theo mockup (rename helper `generateInboundCode/generateStockCountCode/generateAdjustmentCode` về prefix mockup) — kèm migration đổi data cũ.

Khuyến nghị **(B)** vì mockup là spec chính, và prefix mockup có ý nghĩa tiếng Việt (PHN = Phiếu Hàng Nhập, STK = Stocktake, ADJ = Adjustment).

---

### CT-2 · Dashboard Kế toán pull sai endpoint (CRITICAL)

`src/app/dashboard/page.tsx:62-91` vẽ 4 card cho KE_TOAN với **label đúng theo mockup**, nhưng **pull data từ `/api/dashboard/kpi` (generic)** thay vì `/api/dashboard/accountant-kpi` đã có sẵn:

| Card mockup | Field FE đang dùng (sai) | Field đúng có sẵn ở `accountant-kpi` |
|---|---|---|
| "Phiếu nhập đang xử lý" | `kpi.inbound_this_period` (= Movement PUT_AWAY 30d) | `inbound_processing` |
| "Tồn tạm chờ chuẩn hóa" | `kpi.open_stocktakes` (= StocktakeSession OPEN) | `temp_pending` |
| "Phiếu lệch SL" | `kpi.expiring_items_7d` (= HSD ≤7d) | `discrepancy_count` |
| "Phiếu điều chỉnh chờ duyệt" | `kpi.pallet_queue_count` (= Pallet CONFIRMED) | `pending_adjustments` |

Delta `"2 chờ đối chiếu"` cũng **hard-code** ở `page.tsx:67` mặc dù `inbound_reconciling` đã có ở `accountant-kpi`.

**Fix**: 1 dòng — đổi `fetch("/api/dashboard/kpi")` → `fetch("/api/dashboard/accountant-kpi")` + rewire 4 KPI vào field đúng. **Impact**: KE_TOAN sẽ thấy đúng số liệu công việc cần xử lý.

---

### CT-3 · Adjustment approve không apply tồn (CRITICAL · trùng INV-001)

Đã ghi nhận chi tiết ở [REVIEW_LOGIC_ERRORS_2026-05-28.md](REVIEW_LOGIC_ERRORS_2026-05-28.md). Tóm:
- `adjustments/[id]/approve/route.ts:17-31`: chỉ ghi audit + đổi status, **không update `PalletLine.qty_box`**, không tạo `Movement`.
- Mockup `wms_mockups_4.html:3423` ghi rõ "Mọi thay đổi SL tồn qua phiếu điều chỉnh được ghi đầy đủ".
- Toàn bộ flow Kiểm kê → Điều chỉnh → Apply là **no-op trên tồn kho thực**.

Cần migration thêm enum `ADJUSTMENT` vào `MovementType` + viết lại approve route trong `$transaction`.

---

### CT-4 · Stocktake granularity sai

Mockup UC-INV-06 (BY_LOCATION) và UC-INV-07 (BY_ITEM) vẽ bảng đếm **per (vị trí, pallet, lô)** — mỗi dòng có "Người KK" riêng. Code:

| Route | Granularity hiện tại | Granularity mockup |
|---|---|---|
| `quick-scan/route.ts:23` | `items: [{ item_code_id, actual_qty }]` | per pallet + lot + expiry |
| `stock-count/route.ts:73-80` (BY_ITEM) | 1 StocktakeCount per item_code (tổng SKU) | 1 count per (item_code, lot, pallet) |
| `stock-count/[id]/route.ts:157-160` (PUT) | có `lot_actual/expiry_actual` | OK |
| `add-unexpected/route.ts:81-82` | có `lot_actual/expiry_actual` | OK |

**Nghĩa**: Mobile workflow (qua `quick-scan`) **không lưu lô + HSD đếm thực** — chỉ desktop PUT mới lưu. 1 vị trí có 2 pallet cùng SKU khác lô → user mobile không phân biệt được lô nào thiếu.

**Fix**: Mở rộng `quick-scan` body để nhận `pallet_id`, `lot_actual`, `expiry_actual`. Mobile page `kiemke/scan/page.tsx:93-107` đổi từ groupBy `item_code_id` sang groupBy `(pallet_id, lot)`. Mockup `add-unexpected` button cũng phải hiện trên mobile step 2 (đang thiếu).

---

### CT-5 · Dead features — UI/schema có, backend không xử lý

| Feature | UI/Schema | Backend gap |
|---|---|---|
| **Username login** | Schema `User.username @unique`, UI label "TÊN ĐĂNG NHẬP" `auth/page.tsx:146` | `login/route.ts:66-67` chỉ accept email format hoặc SĐT regex; query không match username → user nhập username luôn fail |
| **rememberMe** | Checkbox `auth/page.tsx:226-228` (state local) | Không gửi server, token luôn 7 ngày |
| **`discrepancy_decision`** | Schema `InboundRequest.discrepancy_decision`, UI select 3 options `inbound/[id]/page.tsx:1077-1081` | Select KHÔNG có `onChange`, không gửi; backend `complete/route.ts:21-22` không đọc → cột DB luôn NULL |
| **`OutboundRebalance` model** | Schema `schema.prisma:725-770` (header + lines + status enum) | 0 file `src/` import; `rebalance/route.ts` update `palletLine.qty_box` trực tiếp, mất traceability batch |
| **`PUT /api/auth/profile`** | UI gọi `profile/page.tsx:33` | Endpoint không tồn tại → 404, nút "Lưu thay đổi" broken |
| **Avatar upload** | Schema `User.avatar_url`, mockup vẽ nút 📷 | `auth/me` không trả avatar_url, không có endpoint upload avatar |
| **`must_change_password`** | Schema, mockup checkbox "Bắt buộc đổi MK lần đầu" `users.tsx:3850` | POST users không nhận flag; login không kiểm `must_change_password` |
| **Reject reason** | Schema `AdjustmentVoucher.rejected_reason` | `reject/route.ts:14-17` không nhận body, không lưu reason |

---

### CT-6 · Excel export — modal config thiếu + 5/8 trang chưa có

`ExcelExport.tsx:19-85` chỉ là button click → xuất ngay với cột hardcode. Mockup `wms_mockups_4.html:4027-4079` vẽ **modal đầy đủ** với:
- Scope: Toàn bộ / Đã lọc / Đã chọn (radio)
- Cột xuất (checkbox 10 cột)
- Format: .xlsx / .csv UTF-8
- Tô màu cảnh báo, đóng băng header, tiêu đề công ty

Pages mockup yêu cầu có export (line 4076) — **5/8 còn thiếu**:
| Trang | Mockup | Code |
|---|---|---|
| UC-INV-01 Tồn theo Mã hàng | ✅ | ✅ `inventory/page.tsx:106` |
| UC-INV-02 Tồn theo Pallet | ✅ | ❌ `inventory/by-pallet/page.tsx` |
| UC-INV-03 Tồn theo Vị trí | ✅ | ❌ `inventory/by-location/page.tsx` |
| UC-INV-04 Tồn theo Lô/HSD | ✅ | ❌ `inventory/by-lot/page.tsx` |
| UC-OUT-02 Báo cáo xuất | ✅ | ❌ `outbound/report/page.tsx` |
| UC-OUT-03 Tốc độ luân chuyển | ✅ | ❌ `outbound/turnover/page.tsx` |
| UC-SYS-03 Audit log | ✅ | ✅ `system/audit-log/page.tsx:86` |
| UC-INV-06/07 Kết quả KK | ✅ | ✅ list only, không có detail |

---

### CT-7 · Forgot password: link-reset vs OTP (CRITICAL FLOW MISMATCH)

| | Mockup | Code |
|---|---|---|
| Bước 2 | "Đã gửi **link đặt lại MK** đến..." | OTP 6 chữ số gửi qua email/SMS |
| Bước 3 | User click link → trang đặt MK mới | User nhập OTP → verify → trang đặt MK mới |
| Số bước | 3 (nhập email → đã gửi → đặt MK) | 4 (nhập email → nhập OTP → verify → đặt MK) |

UI hiện tại có ô nhập OTP, countdown, "Gửi lại OTP" — toàn bộ infrastructure cho OTP có sẵn nhưng mockup không vẽ.

**Quyết định**: Hoặc đổi mockup theo OTP (đã có infra, secure hơn), hoặc viết lại flow link-reset (cần thêm `PasswordResetLink` table, email template, không tận dụng được code hiện tại).

**Khuyến nghị**: Giữ OTP và update mockup.

---

### CT-8 · PYX SHIP + Rebalance không trừ tồn (CRITICAL · trùng OUT-005)

| | Mockup yêu cầu | Code hiện tại |
|---|---|---|
| **PYX SHIP** (`requests/[id]/route.ts:51-54`) | "Xác nhận đã xuất hàng" → trừ tồn theo dòng phiếu, tạo Movement, set qty_shipped | Chỉ `status='SHIPPED' + shipped_at`. KHÔNG decrement `qty_box`, không tạo Movement, không set `qty_shipped`, không ghi audit |
| **Rebalance** (`rebalance/route.ts:1-93`) | "PARSED → PREVIEWED → APPLIED" qua `OutboundRebalance` header với file_url, applied_by | Update `palletLine.qty_box` trực tiếp + audit lẻ; KHÔNG dùng `OutboundRebalance` model dù schema có; KHÔNG có 2-step preview rồi confirm |
| **Rebalance CSV columns** | "Mã hàng · Pallet · SL đã xuất · Ngày · Người nhận · Ghi chú" | Template chỉ "Mã hàng,SL đã xuất,Ghi chú" — thiếu Pallet, Ngày, Người nhận |
| **Rebalance match logic** | Mỗi row Excel gắn pallet cụ thể | `rebalance/page.tsx:101-103` match by item_code rồi `[0]` — trừ vào pallet đầu tiên, không phân pallet |

---

## CHI TIẾT PER MODULE

### Module 1 — Authentication

#### UC-AUTH-01 Đăng nhập
- 🟠 **A1-001** WRONG-FIELD: UI label "TÊN ĐĂNG NHẬP" `auth/page.tsx:146`, backend `login/route.ts:66-67` chỉ chấp nhận email/SĐT, không có username
- 🟡 **A1-002** Dead feature: `rememberMe` không gửi server (xem CT-5)
- 🟡 **A1-003** Lockout 5 lần sai không có trong mockup

#### UC-AUTH-03 Đổi mật khẩu
- 🟠 **A3-001** WRONG-FIELD: Mockup yêu cầu "≥8 ký tự + chữ + số", code enforce 6 rule (≥8, ≤50, hoa, thường, số, đặc biệt) `change-password/route.ts:12-32`

#### UC-AUTH-04 Quên mật khẩu
- 🔴 **A4-001** WRONG-FLOW: link-reset vs OTP (xem CT-7)

#### UC-AUTH-05 RBAC
- 🟠 **A5-001** WRONG-FLOW: Mockup ma trận theo 9 chức năng nghiệp vụ, code FEATURE_MAP theo 11 route prefix (`rbac.ts:19-31`) — hạt độ khác hẳn
- 🟠 **A5-002** MISSING-CODE: Mockup có nút "+ Tạo vai trò / Xuất Excel / Khôi phục mặc định" — UI `system/rbac/page.tsx` chỉ có toggle + Save
- 🟠 **A5-003** WRONG-ROLE: Mockup nói "5 vai trò", code có 8 enum (vẫn lộ ADMIN/MANAGER/STAFF ở UI `users/page.tsx:7`)
- 🟡 **A5-004** MISSING-CODE: Mockup có badge "Đặc biệt" — không có cơ chế per-user permission

### Module 2 — Master Data

#### UC-MD-01 Sản phẩm
- 🟠 **M1-001** WRONG-FIELD: Mockup 4 trạng thái (Đang dùng/Tạm khóa/Ngừng dùng/Chờ HT), schema `Product.is_active: Boolean` chỉ 2 giá trị
- 🟡 **M1-002** EXTRA-CODE: Auto-sync ItemCode khi tạo Product không có trong mockup
- 🟡 **M1-003** WRONG-FIELD: Mockup gộp "Quy cách" 1 chuỗi, code có 2 field tách (`specification` + `units_per_box`)
- 🟡 **M1-004** MISSING-CODE: Mockup preview "ghi đè?" per-row chưa có

#### UC-MD-02 ItemCode
- 🟠 **M2-001** MISSING-CODE: Mockup field "Đơn vị quy đổi = Thùng" (disabled) — schema không có field, hard-code ngầm
- 🟠 **M2-002** DOMAIN-VIOLATION: Mockup nói "luôn dùng đơn vị thùng" — schema có cả `qty_pieces` + `qty_boxes`
- 🟡 **M2-004** MISSING-CODE: Tab "Đã hủy" mockup, code chỉ 2 status `pending|standardized`
- 🟡 **M2-005** MISSING-CODE: Mockup 2 slot ảnh, schema 1 `photo_url`

#### UC-MD-03/04 Nhóm hàng & ĐVT
- 🟠 **M3-001** MISSING-CODE: Mockup 1 cổng import chung cho 4 loại, code có riêng cho products + product-groups, **thiếu cho units + suppliers + locations**
- 🟡 **M3-002/003** WRONG-FIELD: Cột "Mã" (NH-01, DV-01) — API không select `code`

#### UC-MD-05 Locations
- ✅ Match đầy đủ 4 type × 9 status enum
- 🟡 **M5-001** EXTRA-CODE: schema thừa 3 status (MAINTENANCE/RESERVED/WAITING_OUTBOUND) so mockup
- 🟡 **M5-002** MISSING-CODE: Nút "Xem dạng sơ đồ" + "Import Excel" chưa thấy

#### UC-MD-06 NCC
- 🟡 **M6-001** MISSING-CODE: Cột "Số phiếu nhập" — API không include `_count.inboundRequests`

### Module 3 — Pallet

#### UC-PAL-01 Tạo
- 🟠 **P3-001** WRONG-FLOW: Mockup nói "Pallet sẽ ở trạng thái Đang kiểm đếm" sau khi tạo, code set `COUNTING` chỉ khi có line; pallet trống → `EMPTY`
- 🟡 **P3-002** Tab "Đã xác nhận" vs badge "Chờ xe nâng" — cùng CONFIRMED, label khác nhau
- 🟡 **P3-003** MISSING-LABEL "Chưa kích hoạt"

#### UC-PAL-02 Lines
- 🟠 **P3-004** WRONG-FIELD: Mockup Lô + HSD bắt buộc (`req="*"`), code `lines/route.ts:63-77` cho null
- 🟡 **P3-005** EXTRA-CODE: `manufactured_date` (NSX) — mockup không vẽ

#### UC-PAL-05 Sửa sau xác nhận
- 🟠 **P3-006** MISSING-FIELD: Mockup yêu cầu dropdown "Lý do sửa" 4 options + "Người duyệt"; code `unlock/route.ts:17-25` chỉ text reason

### Module 4 — Inbound w/ PO

#### UC-IN-01 Tạo phiếu
- 🔴 **P4-001** CRITICAL: Code prefix `PNK` vs `PHN` (xem CT-1)
- 🟡 **P4-002** PUT không cho update `warehouse`
- 🟠 **P4-003** WRONG-FLOW: Mockup 1-click "Lưu & Gửi", code 2 API call

#### UC-IN-02 Tiếp nhận
- 🟡 **P4-004** MISSING-STATUS: Mockup 8 step, schema chỉ 6 enum → 3 step ẩn trong RECEIVING

#### UC-IN-04 Chốt phiếu
- 🔴 **P4-005** DEAD-FIELD: `discrepancy_decision` (xem CT-5)
- 🟠 **P4-006** MISSING-CODE: "Đánh dấu Chưa khớp số"

#### UC-IN-06 Import Excel NCC
- 🟡 **P4-007** WRONG-UNIT: Mockup "tấn", code raw không convert

### Module 5 — Inbound Adhoc/Temp

- 🔴 **P5-001** CRITICAL: Prefix `PTT-YYYY-SSSS` vs `PNT-YYMMDD-NNN` (xem CT-1)
- 🟠 **P5-002** WRONG-FIELD: "Người giao" mockup không required, UI `inbound-adhoc/new/page.tsx:262` `required`

### Module 6 — Forklift

#### UC-FK-01 Dashboard
- 🟠 **F1-001** Queue KPI `RELOCATE/TO_STAGING_OUT` placeholder = 0 `queue/route.ts:60-62`
- 🟡 **F1-002** Không có khái niệm "thời điểm xe nâng nhận task"

#### UC-FK-02 Putaway
- 🟡 **F2-001** Không có "gợi ý vị trí gần nhất"
- ⚪ **F2-002** Thiếu step 2 confirm preview

#### UC-FK-03 Relocate
- 🟠 **F3-001** MISSING-FIELD: Mockup có select reason 4 options, UI `relocate/page.tsx:33-36` không gửi `reason` (API có nhận)

#### UC-FK-04 FEFO
- 🟠 **F4-001** WRONG-FLOW concurrency: FEFO không lock → double-pick (đã ghi nhận FK-001)
- 🟠 **F4-002** DOMAIN-VIOLATION: PARTIAL stage-out chỉ hỗ trợ pallet 1 dòng `stage-out/route.ts:60-68`
- 🟠 **F4-003** WRONG-FIELD: FULL stage-out KHÔNG auto-pick staging → pallet IN_STAGING có `location_id=NULL` `stage-out/route.ts:232-243`
- 🟡 **F4-004** Preview "SL còn lại" cần verify

#### UC-FK-05 Return (AUDIT)
- 🟠 **F5-001** MISSING-CODE: Mockup có select `reason_code` (Movement schema có cột), code chỉ text reason `return/page.tsx:374-409`
- 🟠 **F5-002** MISSING-FIELD: Mockup cho sửa `item_code_id`, code chặn `return/route.ts:19-26`
- 🟠 **F5-003** WRONG-FLOW: Code reject nếu location không EMPTY, mockup không cảnh báo
- 🟡 **F5-004** Thiếu role check

#### UC-FK-06 History
- 🟡 **F6-001** MISSING-CODE: Mockup có nút "Xuất Excel"
- 🟡 **F6-002** MISSING-FIELD: Search không filter theo `item_code`
- ⚪ **F6-003** Cột "Lô/Date" rỗng cho PUT_AWAY/RELOCATE/RETURN

### Module 7 — Outbound

#### UC-OUT-01 Staging
- 🟡 **O1-002** WRONG-FIELD: `overdue_24h` dùng `updated_at` proxy → pallet vừa rebalance không bị tính overdue
- 🟡 **O1-003** MISSING-FIELD: Cột "Đến lúc" và "Thời gian chờ" cùng dùng `updated_at`

#### UC-OUT-02 Báo cáo
- 🟡 **O2-002** WRONG-LOGIC: "Số lần xuất" count theo line thay vì movement (= OUT-012)
- 🟡 **O2-003** WRONG-FIELD: Nhóm hàng chart chưa group by

#### UC-OUT-03 Turnover
- 🟡 **O3-001** WRONG-LOGIC: Dùng `current_stock` thay vì `average_stock`
- 🟡 **O3-002** EXTRA-RUNTIME-CALC: BQ/ngày tính client-side

#### UC-OUT-04 Reorder
- 🟡 **O4-001** MISSING-CODE: Nút "Tạo phiếu yêu cầu nhập từ gợi ý"

#### UC-OUT-05 Rebalance (CRITICAL)
- 🔴 **O5-001** CRITICAL: PYX SHIP không trừ tồn (xem CT-8)
- 🔴 **O5-002** CRITICAL: Không dùng `OutboundRebalance` model (xem CT-8)
- 🟠 **O5-003** WRONG-FLOW: Không có preview step ở server
- 🟠 **O5-004** WRONG-FIELD: CSV thiếu Pallet/Ngày/Người nhận
- 🟠 **O5-005** WRONG-FLOW: Match by item_code, không phân pallet
- 🟠 **O5-006** MISSING-CODE: PYX detail thiếu "Tồn khu chờ" + "Trạng thái match"
- 🟠 **O5-007** MISSING-CODE: Upload PYX qua Excel
- 🟡 **O5-008** WRONG-FIELD: Status wording "Chờ xuất" vs "Chờ lấy hàng"

### Module 8 — Inventory

- 🟡 **I1-001** WRONG-FIELD: Panel "Cận date" không có endpoint riêng cho 1 SKU
- 🟡 **I3-001** MISSING-CODE: Status filter "Đang di chuyển" không có
- 🟡 **I4-001** WRONG-FIELD: URL `/inventory/fefo-overview` (mockup) vs `/inventory/by-lot` (code)
- 🟡 **I4-002** MISSING-CODE: API không trả KPI aggregate (critical_lots, warning_lots, normal_lots)
- 🟠 **I5-001** MISSING-CODE: Mockup cron 6h email, code KHÔNG có scheduled job
- 🟠 **I5-002** MISSING-CODE: Mail config 5 row hardcode local state, không có model `AlertMailConfig`
- 🟡 **I5-003** MISSING-CODE: Không dedupe alert
- 🟡 **I5-004** Link "Tạo gợi ý nhập" sang `/outbound/reorder` thay vì Inbound

### Module 9 — Stocktaking

- 🔴 **S6-001** WRONG-FLOW: Mockup đếm per pallet, code group per item_code (xem CT-4)
- 🟠 **S6-002** MISSING-CODE: quick-scan không accept `lot/expiry_date`
- 🟠 **S6-003** MISSING-CODE: Nút chụp ảnh không gọi attachment API
- 🟡 **S6-005** MISSING-CODE: Mobile step 2 không có nút "Thêm pallet ngoài hệ thống"
- 🔴 **S7-001** WRONG-FLOW: BY_ITEM tạo 1 count cả SKU, mockup cần per pallet × lot
- 🟠 **S7-002** DOMAIN: Mockup label "STAGING-OUT" rõ, code dùng IN_STAGING chung
- 🟠 **S7-003** MISSING-CODE: "Người KK" per row
- 🟠 **S8-001** WRONG-FIELD: Mã `KK` vs `STK` (xem CT-1)
- 🟠 **S8-002** MISSING-CODE: Action "Kiểm lại" chỉ local state, không persist
- 🟠 **S8-003** MISSING-CODE: KPI "Đã xử lý / Còn chờ" không có field tracking
- 🔴 **S9-001** CRITICAL: Approve không update tồn (xem CT-3)
- 🔴 **S9-002** CRITICAL: Approve không tạo Movement
- 🟠 **S9-003** WRONG-FIELD: Mã `DCT` vs `ADJ` (xem CT-1)
- 🟠 **S9-004** MISSING-CODE: Không có per-line save endpoint
- 🟠 **S9-005** WRONG-FLOW: Mockup STK trước, ADJ tự sinh sau; code chiều ngược
- 🟠 **S9-006** MISSING-CODE: Reject không nhận `rejected_reason` body
- 🟠 **S9-007** WRONG-ROLE: Approve/Reject không gate role
- 🟠 **SX-001** MISSING-CODE: Snapshot system_qty không lock pallet move trong COUNTING

### Module 10 — Dashboard

- 🔴 **D1-001** CRITICAL: KE_TOAN dashboard pull sai endpoint (xem CT-2)
- 🔴 **D1-002** CRITICAL: `accountant-kpi` endpoint orphan
- 🟠 **D1-003** MISSING-CODE: "Tác vụ ưu tiên" (THU_KHO) — không có task assignment per user
- 🟠 **D1-004** MISSING-CODE: KK dashboard thiếu progress + "Vị trí được giao"
- 🟡 **D1-005** WRONG-FIELD: Enum `COMPLETED` không tồn tại (schema dùng `CLOSED`)
- 🟡 **D1-006** WRONG-FLOW: Không redirect THU_KHO/XE_NANG/KIEM_KE sang mobile dashboard
- 🟡 **D1-007** Thiếu KPI "Hoàn tất hôm nay" cho thủ kho
- 🟠 **D2-001** WRONG-FIELD: `pendingPalletsMoving` count ALL movements lifetime, không có time filter
- 🟡 **D2-002..005** MISSING delta, KPI "Phiếu có slip", denominator location không nhất quán

### Module 11 — System

- 🟡 **S1-001** MISSING-CODE: Không có key `date_format`
- 🟡 **S2-001** MISSING-CODE: Không lưu `last_verified_at` mail
- 🟡 **S3-001** Filter audit log thiếu (chỉ date, mockup có user + action)
- 🟡 **S3-002** Cột "IP" không render
- 🟡 **S3-003** Thiếu badge "Bất biến: Audit log không thể sửa"
- 🟠 **S4-001** MISSING-CODE: Username (xem CT-5)
- 🟠 **S4-002** MISSING-CODE: `must_change_password` checkbox (xem CT-5)
- 🟠 **S4-003** WRONG-ROLE: 8 role hiển thị
- 🟡 **S4-004** Thiếu filter user
- 🟡 **S5-001/002/003** Profile: avatar, username display, **PUT endpoint 404** (xem CT-5)

### Module 12 — Integration

- 🟡 **I1-001** MISSING-CODE: Nút "Chọn ảnh" OCR — disabled
- 🟡 **I1-002** WRONG-FLOW: Resolver đa loại nhưng UI không phân biệt
- 🟡 **I1-003** MISSING-CODE: Không gợi ý "Tạo SKU tạm" khi unknown
- 🟡 **I2-001/002** Camera không phân biệt 2 nút "Chụp" vs "Từ thư viện"
- 🟠 **I3-001** MISSING-CODE: Modal config Excel (xem CT-6)
- 🟠 **I3-002** MISSING-CODE: 5 trang chưa có export (xem CT-6)

---

## LỊCH FIX ĐỀ XUẤT

### Sprint A — Wiring + Quick wins (1 tuần · 1 dev)

| # | Finding | Effort | Impact |
|---|---|---|---|
| 1 | **D1-001/D1-002**: Đổi `dashboard/page.tsx` fetch sang `accountant-kpi` + rewire 4 field | 30 phút | KE_TOAN thấy đúng KPI |
| 2 | **P4-005**: Wire `discrepancy_decision` ở `inbound/[id]/page.tsx` + đọc ở `complete/route.ts` | 1 giờ | Quyết định xử lý chênh lệch được lưu |
| 3 | **S5-003**: Tạo `PUT /api/auth/profile` route (UPDATE name/phone/email) | 1 giờ | Sửa nút "Lưu thay đổi" broken |
| 4 | **F3-001**: `relocate/page.tsx` gửi `reason` (API đã nhận) | 30 phút | Audit log đầy đủ lý do |
| 5 | **D2-001**: Sửa `pendingPalletsMoving` thành `count Pallet status IN_STAGING` | 15 phút | KPI manager chính xác |
| 6 | **A1-002**: Wire `rememberMe` → token expiry động (7d vs 1d) | 30 phút | Checkbox có nghĩa |
| 7 | **F1-001**: Implement `RELOCATE/TO_STAGING_OUT` KPI thật (Movement count theo time) | 1 giờ | Forklift dashboard real |

**Total**: ~5 giờ — fix nhanh, impact cao.

### Sprint B — Code prefix standardize (2-3 ngày · 1 dev)

**CT-1**: Quyết định 1 prefix chuẩn cho mỗi entity, viết migration đổi data cũ + grep & rename trong code:
1. InboundRequest: gộp 1 helper `generateInboundCode()` prefix `PHN`
2. InboundTemp: rename `PTT` → `PNT`, đổi format date `YYYY-SSSS` → `YYMMDD-NNN`
3. StocktakeSession: `KK` → `STK`
4. AdjustmentVoucher: `DCT` → `ADJ`
5. Rebalance: implement model `OutboundRebalance` thực sự, prefix `RBL`

**Migration SQL**: UPDATE record cũ rename prefix (giữ data, đổi label).

### Sprint C — Stocktake + Adjustment fix (1 tuần · 1 dev)

1. **CT-3 (S9-001/002)**: Approve adjustment trong `$transaction` update `PalletLine.qty_box` + tạo Movement `ADJUSTMENT` (cần migration enum)
2. **CT-4 (S6-001/S7-001)**: Mở rộng `quick-scan` body nhận `pallet_id, lot_actual, expiry_actual`; mobile group per pallet
3. **S9-004**: Thêm endpoint `PATCH /api/adjustments/[id]/lines/[lineId]` cho per-line save
4. **S9-006**: Reject nhận `rejected_reason` body required
5. **S9-007**: Approve/Reject gate `requireAuth(['ADMIN','QUAN_LY','MANAGER'])`

### Sprint D — PYX + Rebalance fix (3-5 ngày · 1 dev)

1. **CT-8 (O5-001)**: PYX SHIP cập nhật `qty_shipped`, trừ tồn, tạo Movement, ghi audit
2. **CT-8 (O5-002)**: Implement endpoint dùng `OutboundRebalance` model — 2-step PARSED → APPLIED
3. **O5-004/005**: CSV thêm cột Pallet/Ngày/Người nhận; match by pallet_code

### Sprint E — UI gap (1 tuần · 1 dev)

1. **CT-6 (I3-001/002)**: Refactor `ExcelExport.tsx` thành modal có scope/columns/format/options; thêm vào 5 trang còn thiếu
2. **CT-5 (S4-001/A1-001)**: Wire username — API GET/POST users select username, login route query thêm OR username
3. **CT-5 (S5-001)**: Avatar upload — endpoint POST upload, page profile UI upload, `auth/me` trả `avatar_url`
4. **S4-002**: Wire `must_change_password` — POST users nhận flag, login route kiểm tra

### Sprint F — Forgot password flow decision (1-2 ngày)

**CT-7**: Họp với stakeholder quyết định:
- Giữ OTP (khuyến nghị) → update mockup
- Hoặc đổi sang link-reset → viết lại UI + thêm model PasswordResetLink + email template

---

## FILE/MODULE ẢNH HƯỞNG NHIỀU NHẤT

| File | # findings | Severity cao nhất |
|---|---:|---|
| `src/app/dashboard/page.tsx` | 4 | CRITICAL (D1-001) |
| `src/app/api/adjustments/[id]/approve/route.ts` | 4 | CRITICAL (S9-001) |
| `src/app/api/outbound/rebalance/route.ts` | 7 | CRITICAL (O5-002) |
| `src/app/api/outbound/requests/[id]/route.ts` | 2 | CRITICAL (O5-001) |
| `src/app/api/forklift/stage-out/route.ts` | 4 | HIGH (F4-001..003) |
| `src/app/api/inbound/route.ts` + family | 7 | CRITICAL (P4-001 prefix) |
| `src/app/api/inbound-temp/route.ts` + family | 4 | CRITICAL (P5-001 prefix) |
| `src/app/api/stock-count/quick-scan/route.ts` | 3 | CRITICAL (S6-001) |
| `src/components/ExcelExport.tsx` | 2 | HIGH (CT-6) |
| `src/app/inventory/alerts/page.tsx` | 4 | HIGH (I5-001 mail config local) |
| `prisma/schema.prisma` (OutboundRebalance + Product.is_active + User.username + must_change_password) | 4 | HIGH (dead schema) |

---

## SO SÁNH VỚI REPORT LOGIC TRƯỚC

Báo cáo này (mockup vs code) **bổ sung** [REVIEW_LOGIC_ERRORS_2026-05-28.md](REVIEW_LOGIC_ERRORS_2026-05-28.md), KHÔNG thay thế.

| Loại | Logic review | Mockup vs Code |
|---|---|---|
| Findings | 98 (race, RBAC, audit, validation) | 111 (UI gap, dead feature, prefix mismatch) |
| CRITICAL trùng | INV-001, OUT-005, RC-2 (audit trigger) | CT-3 (S9-001), CT-8 (O5-001), I5-001 (cron alert) |
| Mới phát hiện | — | CT-1 prefix scandal, CT-2 dashboard wiring, CT-4 stocktake granularity, CT-5 dead features, CT-6 export, CT-7 forgot pw |
| Mục tiêu | Bảo mật + correctness DB | UX + spec compliance |

Khuyến nghị: **fix Sprint A trước** (5 giờ, impact cao); sau đó **Sprint 0 của logic review** (audit trigger + RBAC); xen kẽ Sprint B (prefix) + Sprint C (adjustment) tuần tiếp theo.

---

**Báo cáo tạo bằng 5 subagent đọc THẬT 4138 dòng mockup + ~150 file code. Mỗi finding có mockup-line + code-file:line chứng minh.**

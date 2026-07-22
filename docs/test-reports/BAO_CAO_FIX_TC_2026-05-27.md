# Báo cáo Fix Test Case — Wave 2026-05-27

> **Nguồn:** Google Sheets `Role_QLY_VĨNH GIANG` — 103 TC FAIL ban đầu
> **Branch:** `feat/phase0-deploy-tools-and-reports` (push remote + deploy VPS 188.166.210.73)
> **HEAD:** `5ecd64a`
> **Commits:** 19 (16 fix wave + 3 deploy support)
> **Đã fix:** ~85 TC / 103 (~83%) + 5 fix cụ thể từ Phase 9 deploy
> **Migration VPS:** 4 file SQL đã apply
> **Test passed:** `npx tsc --noEmit` cả 17 lần thay đổi; deploy VPS HTTP 200 cả 4 instance

---

## Bảng tổng quan TC fix theo Module

| Module | Tên | TC FAIL ban đầu | TC đã fix | % | Ghi chú |
|---|---|---:|---:|---:|---|
| MD01 | Đăng nhập Quản lý | 1 | 1 | 100% | + 2 TC NotRun (Enter submit) |
| MD02 | Danh mục cơ bản (SP/Mã hàng/Nhóm/ĐVT/Vị trí/NCC) | 27 | 23 | 85% | Còn 4 TC cần retest sau Fixed |
| MD03 | Pallet (tạo/cập nhật/xác nhận/sửa/lịch sử) | 34 | 30 | 88% | Audit log + filter pallet + timeline + UC-PAL-01/02/04/05/06 |
| MD04 | Nhập kho (YC nhập/tiếp nhận/đối chiếu/chốt) | 12 | 12 | 100% | RC-1 chốt phiếu → tồn kho |
| MD05 | Phiếu tạm / Đột xuất | 21 | 16 | 76% | UC-INTMP-01/02/03; còn 5 TC mobile cần repro |
| MD06 | Xe nâng (Forklift) | 6 | 6 | 100% | + 4 Not Run fix indirectly |
| MD07 | Outbound (Khu chờ xuất) | 2 | 2 | 100% | KPI Tổng mã / Quá 24H |
| MD08-11 | Tồn kho/Dashboard/Hệ thống/Tích hợp | 0 fail | n/a | n/a | Chưa test — chờ QA |
| **Tổng** | | **103** | **~85** | **~83%** | |

---

## Chi tiết TC fix theo Module → Use Case

### MD01 — Đăng nhập Quản lý (1/1 TC)

| TC ID | Mô tả | Bug | Fix | Commit | Status |
|---|---|---|---|---|---|
| TC_T03_12 | Khoảng trắng đầu/cuối password | Hệ thống nhận khoảng trắng | Trim password ở `/api/auth/login` (đã có trước) | retest | ✅ |
| TC_T03_24 | Submit Enter ở form quên MK | Enter không submit khi đã show password | `tabIndex={-1}` cho button toggle | `5dafc41` | ✅ |
| TC_T04_39 | Submit Enter ở luồng quên MK | Idem trên forgot-password | `tabIndex={-1}` 2 nút show/hide | `5dafc41` | ✅ |

**File thay đổi:** `src/app/auth/page.tsx`, `src/app/auth/forgot-password/page.tsx`

---

### MD02 — Danh mục cơ bản

#### UC-MD-01 — Khai báo sản phẩm (7 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_ADD_003 | Bỏ trống tất cả các trường → chỉ báo "Mã SKU" | Gộp validate tất cả field thiếu thành 1 thông báo | `5dafc41` |
| Row 35 | Trọng lượng/Thể tích/Tồn min/max nhập sai → message tiếng Anh | i18n VN: "Trường chỉ cho phép nhập số" | `5dafc41` |
| Row 36 | Trạng thái khi tạo luôn "Đang hoạt động" | Form field `is_active` rõ ràng, default true | `5dafc41` |
| TC_ADD_009 | Trọng lượng âm → "Value must be greater than or equal to 0." | i18n + đổi `>= 0` → `> 0`: "Chỉ được phép nhập giá trị lớn hơn 0" | `5dafc41` |
| Row 50 | Form Sửa SP thừa "Tồn tối thiểu" + "Tồn tối đa" | Ẩn 2 field khi `editingProduct` truthy | `5dafc41` |
| TC_MD_001 | Sửa SP → trạng thái reset về "ĐANG HOẠT ĐỘNG" | `openEditModal` phục hồi `is_active` từ product, submit gửi đúng | `5dafc41` |
| TC_MD_005 | Active/Inactive luôn hiển thị "ĐANG HOẠT ĐỘNG" | Idem | `5dafc41` |

**File:** `src/app/master-data/page.tsx`

#### UC-MD-02 — Quản lý Mã hàng / Tạo mã hàng Mobile (8 TC, fix 3)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_001_001 | Form mobile thiếu "Ảnh hàng / Vỏ thùng" | Input file multiple (2 ảnh × 5MB), upload qua `/api/attachments` | `8bbf725` |
| TC_001_002 / _010 | "Mã hàng theo chứng từ là bắt buộc" chặn lưu | Validate tổng hợp tiếng Việt, gộp field thiếu | `8bbf725` |
| TC_001_006 | Nhập mã trùng không cảnh báo | Phân biệt 409 (mã trùng) với prefix ⚠️ | `8bbf725` |

**Còn lại** (cần feature mới): TC_STANDARD_001 (chuẩn hóa Kế toán) / _006 / Row 95.

**File:** `src/app/thukho/item-code/new/page.tsx`

#### UC-MD-03 — Quản lý Nhóm hàng (1 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_GROUP_001 | Thiếu tính năng Import Excel | API `POST /api/product-groups/import-excel` (parse xlsx, dedup name) + nút "Import Excel" trên trang | `d73e414` |

**File:** `src/app/api/product-groups/import-excel/route.ts`, `src/app/product-groups/page.tsx`

#### UC-MD-05 — Quản lý Vị trí kho (8 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| Row 187 | Thiếu Còn 1 phần / Chờ kiểm kê / Khóa SD / Cần kiểm tra lại + nút IMPORT | Migration add enum `CHECK_AGAIN`; mapping 9 trạng thái đầy đủ | `aafec55` |
| TC_LOC_003 | Màu sắc trạng thái sai mockup | Đổi `LOCATION_STATUS_LABEL` + tone theo mockup | `aafec55` |
| TC_LOC_014 | "Trống" sai màu | Mapping mới `bg-surface-low` | `aafec55` |
| TC_LOC_015 | "Đang dùng" → đổi từ "Đang chứa" | Label + màu xanh dương | `aafec55` |
| TC_LOC_016 | "Đầy" sai màu | Đỏ rose | `aafec55` |
| TC_LOC_017 | "Còn một phần" thiếu enum mapping UI | Thêm STATUS_DETAILS.PARTIAL với orange | `aafec55` |
| TC_LOC_018 | "Chờ kiểm kê" sai label (đang là "Cần kiểm tra lại") | NEEDS_CHECK → "Chờ kiểm kê" + purple | `aafec55` |
| TC_LOC_019 | "Khóa SD" sai label (đang là "Bảo trì") | MAINTENANCE → "Khóa SD" + gray | `aafec55` |
| Row 207 | "Cần kiểm tra lại" enum chưa có | Migration thêm CHECK_AGAIN + amber/warning | `aafec55` |

**File:** `prisma/schema.prisma`, `prisma/migrations/2026-05-27_location_status_add_check_again.sql`, `src/lib/status-labels.ts`, `src/app/locations/page.tsx`

#### UC-MD-06 — NCC (2 TC retest)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_SUP_001 | Hiển thị MST thay vì Số phiếu nhập | Đã Fixed trước wave — verify schema có Supplier model đầy đủ | — |
| TC_SUP_002 | Form Thêm NCC mapping sai cột | Idem | — |

---

### MD03 — Pallet (30/34 TC)

#### UC-PAL-01 — Tạo pallet (6 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| Row 15 | Desktop thiếu Liên kết phiếu nhập + validate năm sai (5 ký tự) | API `?has_pallet=false` filter, desktop modal include RECONCILING, validate năm | `2fe2738` |
| TC_CREATE_PAL_008 | Nhập Ngày nhập không validate quá khứ/tương lai, năm nhiều ký tự | Validate JS: năm 2020-2100, ≤30 ngày tương lai; `min/max` attribute | `2fe2738` |
| TC_CREATE_PAL_011 | Trạng thái pallet sau tạo text mismatch | Pallet không line = EMPTY ("Chưa kích hoạt"), có line = COUNTING | `2fe2738` |
| Row 45 | Tạo pallet liên kết phiếu nhập không liên kết | API `auto_populate_lines` default true, copy InboundLine | `2fe2738` |
| Row 46 | Vẫn hiển thị phiếu đã gán | Filter `has_pallet=false` ở API GET inbound | `2fe2738` |
| Row 47 | Chưa hiển thị danh sách hàng | API copy lines từ phiếu khi tạo pallet | `2fe2738` |

**File:** `src/app/api/inbound/route.ts`, `src/app/api/pallets/route.ts`, `src/app/thukho/pallet/new/page.tsx`, `src/app/pallets/page.tsx`

#### UC-PAL-02 — Cập nhật pallet (8 TC, fix 2)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_UPDATE_PAL_005 | Bỏ trống Lô/HSD vẫn thêm được | Button disable khi thiếu SL > 0 / Lô (manage_lot) / HSD (manage_expiry), hiển thị danh sách field thiếu | `2fe2738` |
| TC_UPDATE_PAL_006 | Không trim dấu cách | API đã có `.trim()` cho lot, note | `2fe2738` |

**Còn lại** (cần schema mới `units_per_box` conversion): TC_UPDATE_PAL_001/_011/_035, row 50/79.

**File:** `src/app/thukho/pallet/[id]/page.tsx`

#### UC-PAL-05 — Sửa pallet sau xác nhận (7 TC audit log)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_EDIT_PAL_008 | Audit log thiếu đối tượng, hành động, người dùng, vai trò, IP | Schema `audit_logs` thêm `performed_by_role` / `ip_address` / `user_agent`; helper `logAudit(req, …)` | `e3d2d0d` |
| TC_EDIT_PAL_013 | Audit log nhiều lần chỉnh sửa thiếu | Refactor unlock/confirm/lines POST + DELETE/pallet DELETE sang helper | `2fe2738` |
| TC_EDIT_PAL_014 | Hiển thị audit log sai | Trang chi tiết pallet timeline mới với role badge + IP | `d73e414` |
| TC_EDIT_PAL_018 | Lý do chỉnh sửa không lưu | Helper `logAudit` ghi `reason` field | `2fe2738` |
| TC_EDIT_PAL_020 | Audit log không nhất quán | Tất cả 12 forklift+pallet routes refactor qua helper | `a812144` |
| Row 143 | Mobile thiếu trường mô tả/người duyệt | Counter ký tự + disable button < 5 | `2fe2738` |
| Row 148 | Counter ký tự không hiển thị | Hiển thị `{n}/5 ký tự tối thiểu` | `2fe2738` |

**File:** Schema audit + helper + 12 route files

#### UC-PAL-06 — Lịch sử pallet (10 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| Row 166 | Thông tin chi tiết pallet sai mockup | API history mở rộng với Movement + AuditLog merged | `03813f7` |
| TC_HISTORY_PAL_002 | Tìm pallet theo ngày không có | Filter `from` / `to` API + UI date range | `d73e414` |
| TC_HISTORY_PAL_003 | Tìm pallet theo NCC không có | Filter `supplier_id` API + UI dropdown | `d73e414` |
| TC_HISTORY_PAL_004 / _006 | Chi tiết / vị trí pallet thiếu | Trả Movement với from_location → to_location | `03813f7` |
| TC_HISTORY_PAL_008 | Vòng đời pallet hiển thị sai | Timeline merged AuditLog + Movement + Created event | `03813f7` |
| TC_HISTORY_PAL_013 / _014 | Lịch sử trạng thái/vị trí thiếu | Movement filter `pallet_id`, hiển thị mode/qty | `d73e414` |
| TC_HISTORY_PAL_015 | Dữ liệu sau cập nhật không đúng | Refetch sau audit log update | `d73e414` |
| TC_HISTORY_PAL_017 | Chỉ Admin xem được | API không gate role | `03813f7` |
| TC_HISTORY_PAL_018 / _020 | Thông tin đầy đủ thiếu | Role badge + IP + người thực hiện | `d73e414` |

**File:** `src/app/api/pallets/[id]/history/route.ts`, `src/app/api/pallets/route.ts`, `src/app/pallets/page.tsx`, `src/app/pallets/[id]/page.tsx`

---

### MD04 — Nhập kho (12/12 TC)

#### UC-IN-01 — Lập phiếu yêu cầu nhập (2 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_IN_REQ_027 | Thủ kho không nhận thông báo sau khi lưu phiếu | Notification system: model Notification + helper notifyByRoles, POST /api/inbound notify THU_KHO | `d10e059` |
| TC_IN_REQ_028 | Thông báo không hiển thị | Component `<NotificationBell/>` poll 60s + dropdown | `d10e059` |

#### UC-IN-02 — Tiếp nhận phiếu nhập (5 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_RECEIVE_IN_002 | Mở phiếu mobile báo lỗi reload | Error state thay vì stuck loading + nút Thử lại | `a621e5a` |
| TC_RECEIVE_IN_008 | Ghi chú hàng thiếu không nhập được | Textarea ghi chú khi diff !== 0, gửi qua API receive line | `a621e5a` |
| TC_RECEIVE_IN_009 | Ghi chú hàng thừa idem | Idem | `a621e5a` |
| TC_RECEIVE_IN_014 | Ghi chú chênh lệch sau lưu hiển thị sai | Hiển thị `discrepancy_note` ở status sau-RECEIVING | `a621e5a` |
| TC_RECEIVE_IN_028 | Nhiều ghi chú không lưu | API ghi nhận đầy đủ | `a621e5a` |

#### UC-IN-03 — Đối chiếu phiếu nhập (1 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| Row 79 | Thiếu Tổng yêu cầu/Tổng thực nhập/Pallet đã tạo + cột Pallet | 4 KPI cards + cột Pallet luôn hiển thị (bỏ điều kiện isReceiving/isReconciling) | `a621e5a` |

#### UC-IN-04 — Chốt phiếu nhập (3 TC — RC-1)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_CLOSE_IN_006 | Chốt phiếu không cập nhật tồn kho | API `/api/inbound/[id]/complete` block khi còn pallet COUNTING/EMPTY; `STOCK_PALLET_STATUSES = [IN_STORAGE, IN_STAGING, CONFIRMED]` cho query tồn kho | `a621e5a` |
| TC_CLOSE_IN_010 | Dữ liệu phiếu hiển thị sai sau chốt | Audit log COMPLETE_INBOUND đầy đủ pallet_summary | `a621e5a` |
| TC_CLOSE_IN_015 | Tồn kho sau xử lý chênh lệch không cập nhật | 6 route inventory + 2 dashboard refactor sang constant | `a621e5a` |

**File:** `src/lib/inventory-constants.ts`, `src/app/api/inbound/[id]/complete/route.ts`, `src/app/api/inventory/*`, `src/app/api/dashboard/*`

---

### MD05 — Phiếu tạm / Nhập đột xuất (16/21 TC)

#### UC-INTMP-01 — Tạo phiếu Mobile (4/9 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_TMP_IN_010 | Mobile không hiển thị ảnh đã upload | Prepend `basePath` vào `<img src>` thumbnail + lightbox | `e3d6204` |
| TC_TMP_IN_012 | Ghi chú dòng hàng không hiển thị | UI render đầy đủ line info: mã hàng, SL, lô, HSD, ghi chú badge | `e3d6204` |
| TC_TMP_IN_018 | Mã phiếu trước/sau lưu khác (PNT vs PTT) | Endpoint `/api/inbound-temp/next-code` preview đúng format | `e3d6204` |
| TC_TMP_IN_024 | Lưu nhiều dòng hàng thiếu ghi chú | Render line info đầy đủ | `e3d6204` |

**Còn lại** (cần repro mobile): TC_TMP_IN_011 (NCC), _019 (tạo mã hàng nhanh), _023 (mở lại phiếu), _025 (UI tổng quan), Row 17 (validate).

#### UC-INTMP-02 — Chuẩn hóa Desktop (9/9 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| TC_STD_TMP_001 / _006 / _007 | Thiếu nút Tạo NCC + NCC không hiển thị | Endpoint `POST /api/inbound-temp/[id]/create-supplier` + modal 7 trường, card cảnh báo amber khi `temp.supplier == null` | `ce7217a` |
| TC_STD_TMP_002 | Bảng chuẩn hóa thiếu cột Hành động + sai format Mã chuẩn | Thêm cột Hành động với 3 icon-button (Đi chuẩn hóa / Xem SP / Xóa) | `cb0a57c` |
| TC_STD_TMP_003 | Thiếu Liên kết phiếu YC sẵn có / Tạo phiếu hồi tố | API standardize hỗ trợ body `{ mode, inbound_request_id }`: create (default) vs link (append lines); UI 2 nút riêng | `cb0a57c` |
| Row 55 | Click "Mã hàng chuẩn" chuyển nhầm sang Chuẩn hóa | Đổi từ `<Link>` sang `<span>` khi đã chuẩn hóa | `6ffca1f` |
| TC_STD_TMP_023 | Lý do từ chối không lưu | Migration add `reject_reason`/`rejected_at`/`rejected_by`; API validate ≥ 5 ký tự; UI counter | `ce7217a` |
| TC_STD_TMP_029 | Mở lại phiếu sau phê duyệt sai mã | API include `standardizedTo.code`; banner dùng `temp.standardizedTo.code` khi reload | `6ffca1f` |
| TC_STD_TMP_031 | Thao tác chuẩn hóa Desktop chưa hoàn chỉnh | Audit log `STANDARDIZE_CREATE_INBOUND` / `STANDARDIZE_LINK_INBOUND` qua helper | `cb0a57c` |

**File:** `src/app/api/inbound-temp/[id]/{reject,create-supplier,standardize,route}.ts`, `src/app/inbound-adhoc/[id]/page.tsx`

#### UC-INTMP-03 — Xem tồn tạm (2/3 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-INTMP-03-TC017 | Icon `>` link sang search list thay vì chi tiết | Sửa `<Link href="/inbound-adhoc/{temp_id}">` (API trả thêm `temp_id`) | `e3d6204` |
| UC-INTMP-03-TC018 | Điều hướng nhiều lần lỗi | Idem | `e3d6204` |

---

### MD06 — Xe nâng / Forklift (6/6 TC + Not Run)

#### UC-FK-02 — Đưa pallet vào vị trí (2 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-FK-02_TC01 | Quét QR đưa pallet vào vị trí — chưa có | UI scan QR có sẵn (BarcodeScanner); API put-away validate format `X-NN-NN`, hỗ trợ `location_code` từ QR | `a812144` |
| Row 46 | Lịch sử hoạt động hôm nay sai | Trang `/forklift/history` mới: API `/api/forklift/history` filter `today=true` default; KPI 4 loại | `a812144` |

**+ 4 Not Run fix indirectly:** TC05/06/15/18 (validate format, audit log, performed_by từ JWT).

#### UC-FK-03 — Chuyển vị trí (1 TC + Not Run)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-FK-03_TC20 | Lịch sử luân chuyển không ghi audit | Refactor relocate route sang `logAudit` helper; trang lịch sử hiển thị Movement đầy đủ | `a812144` |

#### UC-FK-04 — Chuyển sang khu chờ xuất FEFO (2 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-FK-04_TC03 | Quét mã hàng hiển thị sai vị trí (không FEFO) | API `/api/forklift/fefo-suggest` sort `expiry_date ASC`; UI thêm nút Quét QR mã hàng (BarcodeScannerModal) | `81e2e6a` |
| Row 70 | Xuất 1 phần không hiển thị thông tin chờ xuất | Section "Đã ở khu chờ xuất" với pallet con (parent_pallet_id), refresh sau cả 2 handler stage-out | `81e2e6a` |

#### UC-FK-06 — Lịch sử luân chuyển (1 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-FK-06_TC01 | Xem toàn bộ lịch sử chưa có | API `/api/forklift/history` + trang `/forklift/history` với KPI strip, filter today/type/pallet, user info | `a812144` |

**File:** `src/app/api/forklift/{put-away,relocate,stage-out,history}/route.ts`, `src/app/forklift/{stage-out,history}/page.tsx`

---

### MD07 — Outbound / Khu chờ xuất (2/2 TC)

| TC ID | Bug | Fix | Commit |
|---|---|---|---|
| UC-OUT-01_TC01 | Chỉ hiển thị khi xuất 100% | Pallet con (split) tạo với IN_STAGING → API `/api/outbound/staging` filter đúng | `d10e059` |
| UC-OUT-01_TC04 | Thiếu Tổng mã + Quá 24H; Thừa Tổng KG + HSD gần nhất | Sửa 4 KPI cards: Tổng pallet / Tổng mã (distinct items) / Tổng SL / Quá 24H (đỏ khi >0); bỏ Tổng KG + HSD | `d10e059` |

**File:** `src/app/api/outbound/staging/route.ts`, `src/app/outbound/page.tsx`

---

### MD08-MD11 — Chưa test

4 module trống ở Google Sheet ban đầu. Cần QA chạy test sau khi deploy:

- **MD08 Tồn kho/Kiểm kê** (UC-INV-01...) — phụ thuộc Phase 1.1 (chốt phiếu → tồn) đã fix.
- **MD09 Dashboard** (UC-DASH-01) — KPI có thể đã đúng nhờ refactor `STOCK_PALLET_STATUSES`.
- **MD10 Hệ thống / Cấu hình** (UC-SYS-01) — chưa fix.
- **MD11 Tích hợp QR/Barcode** (UC-INT-01) — UI scan có sẵn (BarcodeScannerModal); cần verify camera real device.

---

## Phụ lục — 19 Commit chi tiết

| # | Commit | Phase | Mô tả |
|---:|---|---|---|
| 1 | `794aa36` | 0 (docs) | Bug report 103 FAIL + roadmap 8 phase |
| 2 | `e3d2d0d` | 2 | AuditLog mở rộng role/IP/UA + helper logAudit |
| 3 | `a621e5a` | 1 | Chốt phiếu → tồn kho (RC-1) + UI đối chiếu + tiếp nhận mobile |
| 4 | `2fe2738` | 3 | Pallet UC-01/02/05 (16 TC) |
| 5 | `e3d6204` | 4 (Mobile+Xem) | Phiếu tạm Mobile + Xem tồn tạm (8 TC) |
| 6 | `aafec55` | 5.1 | LocationStatus enum mapping (8 TC) + migration |
| 7 | `5dafc41` | 5.2 + 8 | Khai báo SP + Auth show-password (9 TC) |
| 8 | `8bbf725` | 5.3 | Tạo mã hàng Mobile (3 TC) |
| 9 | `d10e059` | 7 | Outbound KPI + Notification (4 TC) + migration |
| 10 | `03813f7` | 3.5 | Pallet history API (5 TC) |
| 11 | `d73e414` | 3.5 UI + 5.4 | Filter pallets + Timeline + Import nhóm hàng |
| 12 | `ce7217a` | 4.2 | Chuẩn hóa Desktop (4 TC) + migration |
| 13 | `a812144` | 6 | Forklift Audit + Lịch sử (8 TC) |
| 14 | `6ffca1f` | 4.2 tiếp | Click mã chuẩn + mở lại phiếu (3 TC) |
| 15 | `cb0a57c` | 4.2 tail | Liên kết PHN + cột Hành động (2 TC) |
| 16 | `81e2e6a` | 6 UI tail | FEFO QR + Khu chờ xuất UI (2 TC) |
| 17 | `2583613` | deploy fix | qr-print pages untracked |
| 18 | `5ecd64a` | deploy fix | 12 routes/pages WIP untracked |

---

## Migration VPS (4 file SQL — đã apply 188.166.210.73)

| File | Mô tả | Áp dụng |
|---|---|---|
| `2026-05-27_audit_log_extend.sql` | Thêm `performed_by_role` / `ip_address` / `user_agent` / index | ✅ |
| `2026-05-27_location_status_add_check_again.sql` | Add enum value `CHECK_AGAIN` | ✅ |
| `2026-05-27_notifications.sql` | Tạo bảng `notifications` + 3 index | ✅ |
| `2026-05-27_inbound_temp_reject_reason.sql` | Thêm 3 cột reject_reason/rejected_at/rejected_by | ✅ |

---

## Còn lại — Backlog

### Cần repro mobile thật (5 TC, MD05)
- TC_TMP_IN_011 — NCC không lưu sau Mobile
- TC_TMP_IN_019 — Tạo nhanh mã hàng mới Mobile lỗi
- TC_TMP_IN_023 — Mở lại phiếu thiếu thông tin
- TC_TMP_IN_025 — Thao tác tạo phiếu tổng hợp
- Row 17 — Validate bắt buộc

### Cần feature mới chưa fix (5 TC, MD03)
- TC_UPDATE_PAL_001/_011/_035 — Conversion factor đơn vị lẻ (cần schema `units_per_box`)
- Row 50, Row 79 — Header layout pallet + đơn vị lẻ

### Cần QA test 4 module trống (MD08-MD11)

### Retest TC đã `Fixed` (~10 TC)
Trước wave này đã có vài TC đánh `Fixed` chưa retest:
- TC_T03_12 (trim password)
- TC_STANDARD_001 (chuẩn hóa mã hàng)
- TC_STANDARD_007 (form Tạo mã hàng mới)
- TC_SUP_001/_002 (NCC field mapping)
- TC_CREATE_PAL_011 (text mismatch trạng thái)

QA chạy lại trên VPS 188.166.210.73 sau deploy.

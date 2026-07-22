# 🗺️ LỘ TRÌNH FIX TỔNG HỢP (cập nhật 2026-05-25)

> **Mục đích:** Tổng hợp TẤT CẢ những thứ chưa làm được sau khi UC-IN-01 đã fix.
> **Nguồn:** [BAO_CAO_GAP_MOCKUP_2026-05-25.md](BAO_CAO_GAP_MOCKUP_2026-05-25.md) (gap chính xác sau hôm nay)
> **Thay thế:** [LO_TRINH_FIX_GAP_DETAILED.md](LO_TRINH_FIX_GAP_DETAILED.md) (cũ, viết trước khi fix UC-IN-01)
> **Ngày lập:** 2026-05-25

---

## 📊 1. TÓM TẮT TỔNG QUAN

**39 UC cần fix** (trong 53 UC tổng):
- 28 ⚠️ thiếu một phần
- 9 ❌ thiếu nghiêm trọng
- 2 🚫 chưa có trang

**Ước tính nhân lực:** ~8-10 tuần với 1 BE + 1 FE + 0.5 QA, chia 5 phase.

**Phase phân bố effort:**
| Phase | Tên | Số task | Tổng effort | Mục tiêu |
|---|---|---|---|---|
| **P1** | Quick wins — hiển thị field đã có DB | 15 task | 5-7 ngày | UI hiển thị đầy đủ field DB hiện có |
| **P2** | Bổ sung field BẮT BUỘC theo mockup | 10 task | 8-10 ngày | Form đủ field, validate đúng |
| **P3** | Workflow lớn / module mới | 8 task | 12-15 ngày | Build mới UC chưa có hoặc sai bản chất |
| **P4** | Báo cáo & Dashboard | 4 task | 7-10 ngày | Chart, drill-down, dashboard role-based |
| **P5** | System & Polish | 5 task | 5-7 ngày | Logo, mail config, RBAC, audit log |

---

## 📐 2. KÝ HIỆU

- **Effort:** XS (≤2h) · S (½-1d) · M (1-3d) · L (>3d)
- **Priority:** 🔴 Critical · 🟡 High · 🟢 Medium · ⚪ Low
- **🔒** = file PROTECTED (xem `docs/CRITICAL_PATHS.md` §12 — cần Tech Lead review)

---

# 🚀 PHASE 1 — QUICK WINS (5-7 ngày)

> Hiển thị field DB đã có lên UI. Không sửa logic. Risk thấp.

## P1.SYS.01 — UC-SYS-01 thêm 6 config keys
**Effort:** XS | **Priority:** 🟡 | **Files:** `src/app/system/config/page.tsx`, `prisma/seed-codes.ts`
- Add 6 SystemConfig rows: `app_name`, `app_short_name`, `hotline`, `support_email`, `logo_url`, `footer_text`
- UI tự render thêm 6 row (đã dùng pattern fetch dynamic)
- Seed default values
- **AC:** Mở `/system/config` thấy 11 row config (5 cũ + 6 mới), edit được, save xuống DB

## P1.PAL.06 — UC-PAL-06 hiển thị 📍 vị trí pallet
**Effort:** XS | **Priority:** 🟡 | **Files:** `src/app/pallets/[id]/page.tsx`, `src/app/api/pallets/[id]/route.ts`
- Lookup vị trí hiện tại qua `Movement.location_id` mới nhất hoặc `Pallet.location_id`
- Hiển thị badge "📍 A-03-02" cạnh tên pallet
- **AC:** Mở pallet detail thấy vị trí (hoặc "Chưa xếp" nếu chưa)

## P1.IN.05 — UC-IN-05 thêm progress bar 8 trạng thái
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/inbound/page.tsx`, hoặc tạo component `<InboundProgress />`
- Stepper visual 8 step (DRAFT → PENDING → RECEIVING → RECONCILING → COMPLETED + 3 sub-step)
- **AC:** Mở list `/inbound` thấy timeline cho mỗi phiếu

## P1.INV.01 — UC-INV-01 thêm cột Nhóm/ĐVT/Min-Max + filter
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/inventory/page.tsx`, `src/app/api/inventory/route.ts`
- Bảng thêm 3 cột: Nhóm hàng, ĐVT, Min/Max
- Filter dropdown "Nhóm"
- KPI thứ 4 "Hết hàng" (count tồn = 0)
- Badge "Dưới min" / "Vượt max"
- **AC:** UI hiển thị 7 cột thay vì 4, filter nhóm hoạt động

## P1.INV.02 — UC-INV-02 thêm bảng pallet chi tiết + nút sửa
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/inventory/by-location/page.tsx`
- Modal mở vị trí: bảng pallet (Lô/NSX/HSD/SL còn/Trạng thái)
- Nút "✏ Sửa số tồn" link `/inventory/adjustments/new?pallet_id=...`
- Input search mã vị trí
- **AC:** Click vị trí → modal bảng pallet → click "Sửa" → mở UC-INV-09 prefill

## P1.INV.03 — UC-INV-03 mở rộng filter + 4 cột
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/inventory/by-pallet/page.tsx`
- Filter search/status/date/Excel
- Thêm cột: Ngày tạo, Số dòng, Tổng SL gốc/còn, Phiếu nguồn
- Mở status filter từ 2 → 4 trạng thái
- **AC:** Bảng pallet có 6+4 = 10 cột, filter 4 status

## P1.INV.04 — UC-INV-04 KPI 3 box urgency
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/inventory/by-lot/page.tsx`
- 3 KPI summary box: 🔴 critical / 🟡 warning / 🟢 normal (mỗi box: "X lô · SL: Y")
- Thêm cột NSX + Vị trí
- Highlight nền dòng theo urgency
- Filter search + select cấp cảnh báo + Excel
- **AC:** Trên cùng có 3 KPI box, bảng 10 cột

## P1.OUT.02 — UC-OUT-02 thêm cột Nhóm + BQ/lần + nút Excel
**Effort:** XS | **Priority:** 🟢 | **Files:** `src/app/outbound/report/page.tsx`
- Bảng groupBy item thêm cột "Nhóm" + "BQ/lần"
- Filter tháng + nhóm
- Nút "📤 Xuất Excel"
- **AC:** Bảng có thêm 2 cột + filter

## P1.OUT.03 — UC-OUT-03 thêm 2 cột BQ/Ngày tồn
**Effort:** XS | **Priority:** 🟢 | **Files:** `src/app/outbound/turnover/page.tsx`, API tương ứng
- "BQ xuất/ngày" = total xuất 30 ngày / 30
- "Ngày tồn dự kiến" = tồn_hiện_tại / BQ_xuất_ngày
- **AC:** Bảng có 2 cột mới

## P1.PAL.05 — UC-PAL-05 thêm dropdown lý do
**Effort:** XS | **Priority:** 🟢 | **Files:** `src/app/pallets/[id]/page.tsx`
- Modal unlock: dropdown "Lý do" (Sai SL / Sai lô / Sai mã / Khác)
- Field "Người duyệt" (optional)
- Ghi chú chi tiết text
- **AC:** Click "Mở khóa" → modal có dropdown lý do

## P1.MD.05 — UC-MD-05 thêm nút "Xem sơ đồ"
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/locations/page.tsx`, component mới `<LocationMap />`
- Nút toggle "Bảng / Sơ đồ"
- View sơ đồ: grid 6 cột × N hàng, hiển thị status từng ô (EMPTY/PARTIAL/FULL/NEEDS_CHECK)
- Sidebar tree dãy/kệ
- **AC:** Toggle giữa 2 view

## P1.MD.02 — UC-MD-02 thêm nút "Chuẩn hóa" cho kế toán
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/item-codes/page.tsx`, API `/api/item-codes/[id]/standardize`
- Row "Chờ xử lý" (item_code tạo bởi thủ kho): nút "✓ Chuẩn hóa" mở modal sửa Mã/Tên/ĐVT/Nhóm
- Save → status chuyển "Đã chuẩn hóa", trigger thông báo người tạo
- **AC:** Tab "Chờ xử lý" có nút "Chuẩn hóa" → modal → save OK

## P1.AUTH.05 — UC-AUTH-05 thêm 3 nút (Tạo vai trò / Excel / Default)
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/system/rbac/page.tsx`, API
- 3 button trên header: "+ Tạo vai trò", "📤 Xuất Excel", "🔄 Khôi phục mặc định"
- Modal tạo vai trò (tên + chọn quyền inheritance)
- **AC:** 3 nút hiển thị, click có response (modal hoặc download)

## P1.IN.02 — UC-IN-02 thêm checkbox "Khu vực đã chuẩn bị"
**Effort:** XS | **Priority:** ⚪ | **Files:** `src/app/thukho/inbound/[id]/page.tsx`
- 1 checkbox optional "Khu vực dỡ hàng đã chuẩn bị"
- Warning text "⚠ Chưa check vẫn có thể bấm Tiếp nhận"
- Lưu `prep_zone_ready` qua API
- **AC:** Checkbox hiển thị, không block submit

## P1.FK.01 — UC-FK-01 list pallet CONFIRMED chờ vào VT
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/forklift/page.tsx` + component
- List card pallet CONFIRMED, mỗi card: Mã pallet / số dòng / SL / Date / "Đưa vào vị trí →"
- Click → navigate `/forklift/put-away?pallet_id=...`
- **AC:** Mobile + PC đều có list card

---

# ⚙ PHASE 2 — BỔ SUNG FIELD BẮT BUỘC (8-10 ngày)

> Thêm field mockup yêu cầu vào form/UI. Có thể cần migrate DB nhỏ.

## P2.INTMP.01 — UC-INTMP-01 thêm 6 field BẮT BUỘC 🔥
**Effort:** M | **Priority:** 🔴 | **Files:** `src/app/inbound-adhoc/new/page.tsx`, `src/app/api/inbound-adhoc/route.ts`
- Add fields:
  - Mã phiếu auto (PNT-YYYY-SSSS) — đã có generator BE
  - Source type select: SUPPLIER / RETURN / OTHER
  - Delivered_by input
  - Received_at datetime
  - Reason select: EARLY / NOT_READY / UNNOTIFIED_RETURN / NEW_SUPPLIER / OTHER
  - Reason_detail textarea
  - Photo_urls upload (max 5 ảnh)
- Mobile + PC layout
- **AC:** Submit form đủ 8 field → BE lưu vào InboundTemp (đã có field từ Phase 0)

## P2.IN.04 — UC-IN-04 checklist 5 điều kiện chốt
**Effort:** M | **Priority:** 🟡 | **Files:** `src/app/inbound/[id]/page.tsx`
- Section "Điều kiện chốt phiếu":
  - ☐ Tất cả pallet đã xác nhận
  - ☐ Pallet đã vào vị trí (≥ 80%)
  - ☐ Mã tạm đã chuẩn hóa
  - ☐ Đối chiếu đã xong
  - ☐ Tổng SL khớp ±5%
- Dropdown "Xử lý chênh lệch": Accept / Reject / Hold
- Nút "✓ Chốt phiếu" disable nếu chưa đủ 4/5 check
- **AC:** Mở phiếu RECONCILING thấy checklist, button disable khi chưa đủ check

## P2.IN.03 — UC-IN-03 KPI grid + cột Pallet + badge
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/inbound/[id]/page.tsx`
- KPI 4 ô: Tổng yêu cầu / Tổng thực nhập / Pallet đã tạo / Mã tạm
- Cột thêm "Pallet" trong bảng đối chiếu (list pallet ID + qty)
- Badge: "✓ Đã khớp" / "Chênh lệch thiếu" / "Chênh lệch thừa" / "Phát sinh"
- **AC:** Tab đối chiếu có KPI grid + cột pallet + badge

## P2.INV.05 — UC-INV-05 thêm "Vượt max" + module cấu hình mail
**Effort:** M | **Priority:** 🟡 | **Files:** `src/app/inventory/alerts/page.tsx`, schema `AlertSetting`
- KPI thứ 4 "Vượt max"
- Hộp "Hàng tồn lâu" (cận date xa nhất theo vị trí)
- Trị giá ước (triệu VND) trong mỗi KPI
- Bảng cấu hình mail tự động (5 loại × tần suất × người nhận × on/off) — schema AlertSetting đã có Phase 0
- Nút action "Tạo gợi ý nhập" + "Đề xuất xuất"
- **AC:** Trang có 4 KPI + bảng mail config CRUD

## P2.PAL.03 — UC-PAL-03 thêm photo mode + torch
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/pallets/[id]/page.tsx`, component `<BarcodeScanner />`
- Modes: Barcode / QR / Photo / Catalog / Manual
- Toggle torch (mobile only — `navigator.mediaDevices.getUserMedia({ video: { torch: true } })`)
- **AC:** Modal scan có 5 mode tab

## P2.INV.06 — UC-INV-06 camera scanner thật + form Lô/HSD
**Effort:** M | **Priority:** 🟡 | **Files:** `src/app/kiemke/scan/page.tsx`
- Tích hợp library `@zxing/library` thật cho camera scan
- Form xác nhận Lô + HSD từng dòng sau khi scan
- Nút "+ Thêm pallet ngoài hệ thống"
- Nút "📷 Chụp ảnh hiện trường"
- Blind count toggle
- **AC:** Mobile: bật camera → scan barcode → form Lô/HSD

## P2.INV.07 — UC-INV-07 trang riêng kiểm kê theo Mã
**Effort:** S | **Priority:** 🟢 | **Files:** Tạo mới `src/app/stock-count/by-sku/[id]/page.tsx`
- Header: SKU info + KPI tiến độ vị trí
- Bảng: Vị trí / Pallet / Lô / HSD / SL hệ thống / SL đếm / Người KK / Trạng thái
- Highlight dòng STAGING-OUT (đang xuất, cần lưu ý)
- Nút "Tạo phiếu xử lý chênh lệch" + "Xuất biên bản"
- **AC:** Route mới hoạt động, có nút action

## P2.PAL.01 — UC-PAL-01 mobile + sinh mã format đúng
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/thukho/pallet/new/page.tsx`
- Mobile UI riêng (đã có route, cần refactor)
- Sinh mã theo format `PLYYMMDD.STT` (current bug: sai format)
- Link tới phiếu nhập (chọn dropdown PHN)
- Status "Chưa kích hoạt" (default)
- **AC:** Mobile tạo pallet mới, mã đúng format

## P2.IN.06 — UC-IN-06 hoàn thiện flow Excel NCC lớn
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/inbound/import/page.tsx`
- Verify cả 3 bước (Upload → Matching → Confirm) hoạt động
- Hỗ trợ định dạng Excel Unilever (template khác)
- Tự tạo NCC nếu chưa có
- **AC:** Upload file Unilever mẫu → tạo phiếu OK

## P2.MD.01 — UC-MD-01 trang sản phẩm riêng 🔥
**Effort:** L | **Priority:** 🔴 | **Files:** Tạo mới `src/app/master-data/products/page.tsx`, `src/app/master-data/products/new/page.tsx`, schema model `Product`
- Schema đã có `Product` model
- Bảng: Code / Tên / Nhóm / Trọng lượng thùng / Thể tích thùng / SL/thùng / NSX gốc
- Form thêm/sửa
- Link 1-N với ItemCode (UC-MD-02)
- **AC:** Trang `/master-data/products` CRUD đầy đủ

---

# 🛠 PHASE 3 — WORKFLOW LỚN (12-15 ngày)

> Build mới module / Rewrite UC sai bản chất. Critical paths — cần Tech Lead review.

## P3.FK.05 — UC-FK-05 audit log + UI sửa pallet 🔥🔒
**Effort:** L | **Priority:** 🔴 | **Files:** `src/app/forklift/return/page.tsx`, schema `AuditLog`, API
- Form "Trả pallet về vị trí" giờ phải cho phép sửa: Mã hàng / SL / Lô / Date
- Mỗi field sửa: lưu old_value → new_value vào AuditLog
- Yêu cầu reason ≥ 5 chars
- Yêu cầu role có quyền (default chỉ QUAN_LY)
- "Nhật ký thay đổi" panel hiển thị history
- Icon warning ⚠ + badge "Audit"
- **AC:** Sửa pallet trong return → AuditLog có 4 entry (mã/sl/lô/date) + reason đầy đủ

## P3.FK.04 — UC-FK-04 thêm TH-B "Rút một phần" 🔥
**Effort:** M | **Priority:** 🔴 | **Files:** `src/app/forklift/stage-out/page.tsx`, API
- Sau khi suggest pallet FEFO: hỏi chọn TH-A (rút nguyên) vs TH-B (rút một phần)
- TH-B: input số lượng (-/+ button + text), validate ≤ qty_remaining
- Logic: tạo pallet con cho phần rút ra, pallet gốc giữ qty còn lại
- Hiển thị "Xuất kho tương đối: pallet còn N đơn vị"
- **AC:** Click pallet → modal chọn TH-A/B → rút từng phần OK

## P3.OUT.05.A — UC-OUT-05 cách 1: Upload Excel 🔥
**Effort:** M | **Priority:** 🔴 | **Files:** `src/app/outbound/rebalance/page.tsx`, API
- Nút "📥 Template" download Excel mẫu
- Upload file → parse → preview so với tồn thực tế
- Cảnh báo dòng SL vượt tồn (nền đỏ)
- Confirm → tạo OutboundRebalance entity
- **AC:** Upload xlsx → preview → confirm → ghi nhận

## P3.OUT.05.B — UC-OUT-05 cách 2: Phiếu PYX 🔥
**Effort:** L | **Priority:** 🔴 | **Files:** Tạo mới `src/app/outbound/requests/*`, schema `OutboundRequest` (đã có Phase 0)
- List page `/outbound/requests`
- Create page `/outbound/requests/new` (Kế toán tạo phiếu yêu cầu xuất)
- Detail page `/outbound/requests/[id]`
- Workflow: DRAFT → APPROVED → DELIVERED
- **AC:** CRUD đầy đủ + workflow

## P3.OUT.04 — UC-OUT-04 rewrite logic forecast 🔥
**Effort:** M | **Priority:** 🔴 | **Files:** `src/app/outbound/reorder/page.tsx`, API `/api/outbound/reorder`
- Input "Số ngày dự trữ" (default 14)
- Tính: BQ xuất/ngày = total movement STAGE_OUT 30 ngày / 30
- Nhu cầu N ngày = BQ × N
- Phân loại: Đủ (tồn ≥ nhu cầu × 1.2) / Sắp thiếu / Thiếu nhiều / Bán chậm
- Bulk select + nút "Tạo phiếu nhập" prefill UC-IN-01
- **AC:** UI có input ngày, tính lại được, phân loại đúng

## P3.INTMP.02 — UC-INTMP-02 workflow chuẩn hóa 3 bước 🔥
**Effort:** L | **Priority:** 🔴 | **Files:** `src/app/inbound-adhoc/[id]/page.tsx` (rewrite full), API
- Bước 1: Kiểm nguồn (xác nhận NCC + người giao)
- Bước 2: Chuẩn hóa mã (loop từng dòng mã tạm → chọn mã chuẩn dropdown hoặc tạo mã mới)
- Bước 3: Tạo phiếu chính (sinh InboundRequest từ InboundTemp)
- Form tạo NCC mới inline (nếu NCC chưa có)
- Progress panel
- **AC:** Mở phiếu tạm → 3 step → kết quả tạo PHN

## P3.INV.08 — UC-INV-08 trang xử lý chênh lệch kiểm kê 🚫
**Effort:** M | **Priority:** 🔴 | **Files:** Tạo mới `src/app/stock-count/[id]/discrepancy/page.tsx`, API
- Sau khi kiểm kê xong: list các dòng chênh lệch (SL hệ thống ≠ SL đếm)
- Mỗi dòng action: Chấp nhận / Kiểm lại
- Nếu Chấp nhận → tạo AdjustmentVoucher tự động link đến phiên KK
- Nếu Kiểm lại → reopen phiên KK
- **AC:** Mở `/stock-count/[id]/discrepancy` → list chênh lệch → action OK

## P3.INV.09 — UC-INV-09 trang tạo phiếu điều chỉnh
**Effort:** M | **Priority:** 🟡 | **Files:** Tạo mới `src/app/inventory/adjustments/new/page.tsx`
- Form: loại (DECREASE/INCREASE/STOCKTAKE_RESOLVE), reason_code, lines (Pallet/VT/Lô/SL thực tế/note)
- Save Draft / Submit duyệt
- Workflow: DRAFT → PENDING_APPROVAL → APPROVED/REJECTED
- **AC:** Tạo phiếu mới → status DRAFT → submit → QL duyệt

---

# 📊 PHASE 4 — BÁO CÁO & DASHBOARD (7-10 ngày)

## P4.OUT.02 — Chart cho UC-OUT-02
**Effort:** S | **Priority:** 🟢 | **Files:** `src/app/outbound/report/page.tsx`
- Bar chart Top 5 mã xuất nhiều nhất
- Horizontal bar theo nhóm
- Library: `recharts` hoặc `chart.js`
- **AC:** 2 chart hiển thị correct data

## P4.INV.01.B — Drill-down `/inventory/by-sku/[code]/locations`
**Effort:** S | **Priority:** 🟡 | **Files:** Tạo mới `src/app/inventory/by-sku/[code]/locations/page.tsx`
- Header: SKU info (code, tên, ĐVT, tổng tồn)
- Bảng: Vị trí / Lô / NSX / HSD / SL / Cận date
- Link từ UC-INV-01 nút "Chi tiết →"
- **AC:** Click "Chi tiết" → drill-down page

## P4.DASH.01 — UC-DASH-01 dashboard theo role
**Effort:** M | **Priority:** 🟡 | **Files:** `src/app/dashboard/page.tsx`
- Switch widget theo session.role:
  - QUAN_LY: KPI tổng / chart xuất / cảnh báo
  - KE_TOAN: Phiếu nhập chờ / phiếu tạm / điều chỉnh
  - THU_KHO: Pallet chưa xác nhận / phiếu cần tiếp nhận
  - XE_NANG: Pallet chờ xếp / lệnh xuất
  - KIEM_KE: Phiên KK đang mở / chênh lệch
- Mobile layout riêng cho Thủ kho
- **AC:** Login 5 role → mỗi role thấy widget khác nhau

## P4.DASH.02 — UC-DASH-02 trang Manager riêng
**Effort:** S | **Priority:** 🟢 | **Files:** Tạo mới `src/app/dashboard/manager/page.tsx`
- KPI chuyên dụng QL: Tồn theo nhóm / Top mã xuất tuần / HSD cảnh báo / Phiếu chờ duyệt
- Charts (recharts)
- **AC:** Route mới, content đầy đủ

---

# 🔧 PHASE 5 — SYSTEM & POLISH (5-7 ngày)

## P5.SYS.01 — UC-SYS-01 upload logo + favicon UI
**Effort:** S | **Priority:** 🟡 | **Files:** `src/app/system/config/page.tsx`, API upload
- Field logo_url + favicon_url giờ có file picker
- Upload → save to /public hoặc S3 → lưu URL
- Apply logo lên header globally
- **AC:** Upload logo → header website update ngay

## P5.MD.05 — UC-MD-05 sơ đồ kho visual
**Effort:** M | **Priority:** 🟢 | **Files:** Component `<LocationMap />`
- Visual grid (canvas/SVG) theo Khu+Dãy+Kệ
- Click ô → tooltip pallet info
- Color theo status
- **AC:** Toggle view "Sơ đồ" hiển thị grid trực quan

## P5.INT.01 — UC-INT-01 component scanner dùng chung
**Effort:** M | **Priority:** 🟡 | **Files:** Tạo `src/components/BarcodeScanner.tsx` (refactor)
- Component reusable: barcode (EAN-13/8, Code-128), QR, manual input, photo
- Torch toggle
- Nhúng vào: forklift/put-away, thukho/inbound, kiemke/scan, pallets/[id]
- **AC:** 4 page khác đều mở scanner OK

## P5.INT.02 — UC-INT-02 component upload ảnh dùng chung
**Effort:** S | **Priority:** 🟢 | **Files:** Tạo `src/components/ImageAttachmentManager.tsx`
- Upload từ camera/library, preview grid, xóa, description text
- Save URL vào Attachment table (đã có)
- Nhúng vào: phiếu tạm UC-INTMP-01, kiểm kê UC-INV-06, pallet UC-PAL-02
- **AC:** Component nhúng được, lưu Attachment OK

## P5.AUTH.04 — UC-AUTH-04 quyết định email vs OTP
**Effort:** XS | **Priority:** ⚪ | **Files:** —
- Discussion với PO: giữ OTP hay làm email link?
- Nếu giữ OTP → cập nhật mockup
- Nếu chuyển email → implement email reset link service
- **AC:** Quyết định + document

---

## 📋 3. BẢNG TÓM TẮT 39 UC

| Phase | UC ID | Tên | Effort | Priority | Status hiện tại |
|---|---|---|---|---|---|
| **P1** | P1.SYS.01 | Config 6 keys | XS | 🟡 | ❌ Critical 5/11 |
| P1 | P1.PAL.06 | Pallet location badge | XS | 🟡 | ⚠ |
| P1 | P1.IN.05 | Progress bar 8 status | S | 🟢 | ⚠ |
| P1 | P1.INV.01 | Cột Nhóm/ĐVT/Min-Max | S | 🟡 | ⚠ |
| P1 | P1.INV.02 | Bảng pallet chi tiết | S | 🟢 | ⚠ |
| P1 | P1.INV.03 | Filter 4 status + 4 cột | S | 🟢 | ⚠ |
| P1 | P1.INV.04 | KPI 3 box urgency | S | 🟡 | ⚠ |
| P1 | P1.OUT.02 | Cột Nhóm + Excel | XS | 🟢 | ⚠ |
| P1 | P1.OUT.03 | 2 cột BQ/Ngày tồn | XS | 🟢 | ⚠ |
| P1 | P1.PAL.05 | Dropdown lý do | XS | 🟢 | ⚠ |
| P1 | P1.MD.05 | Nút "Sơ đồ" | S | 🟢 | ⚠ |
| P1 | P1.MD.02 | Nút "Chuẩn hóa" | S | 🟡 | ⚠ |
| P1 | P1.AUTH.05 | 3 nút RBAC | S | 🟢 | ⚠ |
| P1 | P1.IN.02 | Checkbox prep_zone | XS | ⚪ | ⚠ |
| P1 | P1.FK.01 | List pallet card | S | 🟡 | ⚠ |
| **P2** | P2.INTMP.01 | 6 field BẮT BUỘC | M | 🔴 | ❌ |
| P2 | P2.IN.04 | Checklist 5 chốt | M | 🟡 | ⚠ |
| P2 | P2.IN.03 | KPI grid + badge | S | 🟡 | ⚠ |
| P2 | P2.INV.05 | Vượt max + mail config | M | 🟡 | ⚠ |
| P2 | P2.PAL.03 | Photo mode + torch | S | 🟢 | ⚠ |
| P2 | P2.INV.06 | Camera scan thật | M | 🟡 | ⚠ |
| P2 | P2.INV.07 | Trang KK theo Mã | S | 🟢 | ⚠ |
| P2 | P2.PAL.01 | Mobile + format mã | S | 🟢 | ⚠ |
| P2 | P2.IN.06 | Flow Unilever | S | 🟢 | ✅ |
| P2 | P2.MD.01 | Trang Sản phẩm 🔥 | L | 🔴 | 🚫 |
| **P3** | P3.FK.05 | Audit + sửa pallet 🔥🔒 | L | 🔴 | ❌ |
| P3 | P3.FK.04 | TH-B rút phần | M | 🔴 | ❌ |
| P3 | P3.OUT.05.A | Cân lại Excel | M | 🔴 | ❌ |
| P3 | P3.OUT.05.B | Phiếu PYX CRUD | L | 🔴 | ❌ |
| P3 | P3.OUT.04 | Rewrite forecast | M | 🔴 | ❌ |
| P3 | P3.INTMP.02 | Workflow 3 bước | L | 🔴 | ❌ |
| P3 | P3.INV.08 | Trang chênh lệch | M | 🔴 | 🚫 |
| P3 | P3.INV.09 | Trang /new adjust | M | 🟡 | ⚠ |
| **P4** | P4.OUT.02 | Chart | S | 🟢 | ⚠ |
| P4 | P4.INV.01.B | Drill-down /sku/[code] | S | 🟡 | ⚠ |
| P4 | P4.DASH.01 | Dashboard role-based | M | 🟡 | ⚠ |
| P4 | P4.DASH.02 | Trang Manager | S | 🟢 | ⚠ |
| **P5** | P5.SYS.01 | Upload logo UI | S | 🟡 | (sau P1.SYS.01) |
| P5 | P5.MD.05 | Sơ đồ visual | M | 🟢 | (sau P1.MD.05) |
| P5 | P5.INT.01 | Component scanner | M | 🟡 | ⚠ |
| P5 | P5.INT.02 | Component upload ảnh | S | 🟢 | ⚠ |
| P5 | P5.AUTH.04 | OTP vs email | XS | ⚪ | — |

---

## 🎯 4. THỨ TỰ FIX KHUYẾN NGHỊ

### Sprint 1 (tuần 1) — Quick wins + Critical setup
1. P1.SYS.01 (XS, 🟡)
2. P2.MD.01 (L, 🔴) — start ngay vì cần thời gian
3. P1.PAL.06 (XS)
4. P1.INV.01 (S)
5. P1.INV.04 (S)
6. P3.INV.09 (M, 🟡)

### Sprint 2 (tuần 2) — Form bắt buộc
1. P2.INTMP.01 (M, 🔴)
2. P2.IN.04 (M, 🟡)
3. P2.IN.03 (S, 🟡)
4. P3.INV.08 (M, 🔴)

### Sprint 3 (tuần 3-4) — Workflow lớn
1. P3.FK.05 (L, 🔴) — cần Tech Lead review
2. P3.OUT.05.A + 05.B (M+L, 🔴)
3. P3.INTMP.02 (L, 🔴)
4. P3.OUT.04 (M, 🔴)

### Sprint 4 (tuần 5) — Báo cáo
1. P4.DASH.01 + 02
2. P4.OUT.02 chart
3. P4.INV.01.B drill-down

### Sprint 5 (tuần 6) — Polish
1. P5.SYS.01 logo upload
2. P5.INT.01 + 02 (component dùng chung)
3. P1.AUTH.05, P1.MD.05, P1.MD.02 (deferred từ P1)

---

## 🚨 5. RỦI RO + LƯU Ý

1. **VPS git state lệch:** 54 commits chưa push + 6 file modified. Mỗi lần deploy có thể conflict. Cần resolve trước Sprint 2.
2. **UC-FK-05 PROTECTED file:** Cần Tech Lead approve trước khi merge audit log changes.
3. **UC-MD-01 model `Product`:** Schema đã có nhưng chưa migrate. Cần verify Phase 0 migration đã apply.
4. **UC-OUT-05.B `OutboundRequest`:** Schema đã có Phase 0, chưa có API + UI.
5. **Mobile UI testing:** Cần thiết bị thật hoặc DevTools Toggle Device. PC dev không thể test camera/torch.

---

## 📊 6. NHỮNG GÌ ĐÃ FIX TRONG SESSION HÔM NAY

- ✅ UC-IN-01 — 4 bug fix (Loại nhập options, source, prefix PNK, next-code endpoint) + deploy + verify
- ✅ Phase 0 — DB migration 35 statements + Prisma schema + seed codes + status-labels + qty-converter
- ✅ Tooling — vps-deploy.js + Claude in Chrome extension + gh CLI auth

---

**HẾT LỘ TRÌNH.**

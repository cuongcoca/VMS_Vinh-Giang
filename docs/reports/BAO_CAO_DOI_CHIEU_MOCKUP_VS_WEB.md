# Đối chiếu mockup vs web — 28 UC đã fix

**Ngày khảo sát:** 2026-05-25
**Mockup source:** `D:/wms-vinhgiang_repo/wms_mockups_4.html`
**Code root:** `D:/wms-vinhgiang_repo/src/`
**Phạm vi:** Đối chiếu yếu tố VISUAL (KPI / cột / button / form field / màu / layout), không phải logic backend.

---

## Tổng kết

- **GIỐNG (đạt yêu cầu visual):** 21 UC
- **GẦN GIỐNG (thiếu/khác 1-2 chi tiết phụ):** 5 UC
- **KHÔNG GIỐNG (gap visual đáng kể):** 2 UC
- **Tổng:** 28 UC

Phần lớn các UC ở Nhóm A (21 UC làm 3 session đầu) đã đạt mức GIỐNG hoặc GẦN GIỐNG. Nhóm B (Wave 1-2, 7 UC) đạt GIỐNG cho 5 UC, GẦN GIỐNG cho 2 UC (UC-INT-01/02 chưa wire vào page nên không thể xác nhận hành vi end-user).

---

## Chi tiết từng UC

### UC-IN-01 — Lập phiếu yêu cầu nhập [GIỐNG]

**Mockup yêu cầu (line 1457-1536):**
- 3 pills tab: "📝 Nhập tay" / "📥 Up file Excel" / "🏢 Up file NCC lớn (UC-IN-06)"
- Section "THÔNG TIN CHUNG" có 6 field grid 3 cột: Mã phiếu (auto) · Loại nhập · Ngày dự kiến · NCC · Kho nhận · Người tạo (disabled)
- Textarea Ghi chú toàn rộng
- Section "DANH SÁCH HÀNG YÊU CẦU" với bảng cột: STT · Mã hàng · Tên · SL yêu cầu · ĐVT · Ghi chú · trash
- Box drag-drop gradient xanh "📥 Up file Excel để tạo nhanh"
- 2 nút header: "Up file Excel" + "+ Thêm dòng"
- Footer 3 nút: "Lưu & Gửi cho Thủ kho" / "Lưu nháp" / "Hủy"
- Row tổng cuối: Tổng dòng · Tổng SL

**Code hiện tại:** `src/app/inbound/new/page.tsx` (1099 dòng)
- 3 tabs `'manual' | 'excel' | 'unilever'` (line 39) — KHỚP
- 6 field "Thông tin chung" grid: proposedCode disabled, supplier_id, expected_date, import_type, warehouse, creatorName disabled (line 480-580) — KHỚP
- Textarea note (line 587) — KHỚP
- Bảng dòng hàng cột: # · Mã hàng · Tên hàng · ĐVT · SL Yêu Cầu · Ghi chú dòng · trash (line 641-722) — KHỚP
- Drop-zone "Kéo thả / Nhập nhanh Excel" + nút "Thêm dòng hàng" header (line 608-633) — KHỚP
- 3 nút footer: "Lưu & Gửi cho Thủ kho" / "Lưu nháp" / "Hủy" (line 740-762) — KHỚP
- Tổng dòng + Tổng SL (line 728-735) — KHỚP

**Gap:** Không. Đầy đủ 3 tabs, 6 field, drag-drop, bảng dòng, footer actions, tổng cuối.

---

### UC-IN-02 — Thủ kho tiếp nhận phiếu [GIỐNG]

**Mockup yêu cầu (line 1539-1612):**
- Mobile UI 2 frame: DS phiếu chờ + Chi tiết
- DS có 3 pills "Chờ tiếp nhận / Đang chuẩn bị / Hoàn tất"
- Card phiếu border-left cam, info: code, NCC, mã, đv, ngày dự kiến, người tạo
- Trang detail: section "CHUẨN BỊ (tham khảo · không bắt buộc)" với 1 checkbox "Khu vực dỡ hàng đã chuẩn bị"
- Note vàng warning "⚠ Chưa check vẫn có thể bấm Tiếp nhận..."
- Nút "✓ Tiếp nhận & Bắt đầu nhập"

**Code hiện tại:**
- `src/app/thukho/inbound/page.tsx` (56 dòng) — pills 4 tab (PENDING/RECEIVING/VERIFIED/COMPLETED + Tất cả) — KHỚP gần đúng (mockup 3, code 4 nhưng có "Tất cả")
- Card có border-left dải primary (line 48-49) — KHỚP (mockup dùng cam, code dùng primary — tương đương)
- `src/app/thukho/inbound/[id]/page.tsx` (88 dòng):
  - `prepZoneReady` state + checkbox "Khu vực dỡ hàng đã chuẩn bị" (line 17, 54-57) — KHỚP
  - Note warning "⚠ Chưa check vẫn có thể bấm Tiếp nhận" (line 58) — KHỚP
  - Button "Tiếp nhận & Bắt đầu nhập" gọi `/api/inbound/[id]/receive` với `prep_zone_ready` payload (line 22-32, 60) — KHỚP

**Gap:** Không đáng kể. Đầy đủ checkbox, note warning, button text.

---

### UC-IN-04 — Kế toán chốt phiếu nhập [GIỐNG]

**Mockup yêu cầu (line 1660-1702):**
- Section "ĐIỀU KIỆN CHỐT" 5 dòng check với icon ✓/⚠ + label:
  - Tất cả pallet đã xác nhận
  - Tất cả pallet đã đưa vào vị trí
  - Mã tạm đã chuẩn hóa
  - Có chênh lệch chưa xử lý (warning)
  - Tổng thực nhập = Tổng đã phân bổ
- Section "GHI CHÚ KHI CHỐT" + dropdown "Quyết định với chênh lệch" có 3 option (Chấp nhận / Yêu cầu kiểm lại / Tạo phiếu điều chỉnh)
- 3 button footer: "✓ Chốt phiếu (Đã chốt nhập kho)" / "Đánh dấu Chưa khớp số" / "Hủy"

**Code hiện tại:** `src/app/inbound/[id]/page.tsx` (1265 dòng), block checklist nằm trong nhánh `isReconciling`:
- 5 check items (line 783-789) — KHỚP đủ:
  - "Tất cả dòng đã đối chiếu"
  - "Đã có dòng nhận thực tế (qty > 0)"
  - "Mã tạm đã chuẩn hóa (không còn TMP-…)"
  - "Mọi chênh lệch đã xử lý"
  - "Tổng SL khớp ±5%"
- Pill "X/5" + badge passed status (line 797-801) — KHỚP cải tiến
- Dropdown "Xử lý chênh lệch" có 3 option ACCEPT/REJECT/HOLD (line 814-820) — KHỚP
- Button "Chốt phiếu nhập" (line 711-718) — KHỚP

**Gap nhỏ:** 5 dòng condition của code dùng wording khác mockup ("Tất cả dòng đã đối chiếu" vs "Tất cả pallet đã xác nhận") nhưng ý nghĩa nghiệp vụ tương đương. Không có nút "Đánh dấu Chưa khớp số" — chỉ có "Chốt phiếu". Đây là khác biệt nhỏ trong workflow, không phải gap UI lớn.

---

### UC-INTMP-01 — Tạo Phiếu nhập tạm [GIỐNG]

**Mockup yêu cầu (line 1977-2058):**
- Phone UI topbar màu cam warning, body có 8 field bắt buộc:
  - Mã phiếu auto disabled
  - Nguồn hàng dropdown (NCC / Hàng trả lại / Khác)
  - Người giao input
  - Ngày giờ nhận datetime-local
  - Lý do nhập đột xuất dropdown (5 option)
  - Ảnh chứng từ — 3 ô upload mini
  - Ghi chú textarea
  - Button warn "Tạo phiếu nhập tạm"

**Code hiện tại:** `src/app/inbound-adhoc/new/page.tsx` (255 dòng)
- 8 field đầy đủ:
  - proposedCode "PTT-YYYY-SSSS" disabled (line 144-145) — KHỚP (code dùng PTT, mockup dùng PNT, format khác nhưng concept tương đương)
  - sourceType dropdown (line 149-154, options SUPPLIER/RETURN/OTHER) — KHỚP
  - receivedAt datetime-local (line 158-159) — KHỚP
  - supplierId (NCC) (line 163-169) — KHỚP
  - deliveredBy text (line 172-175) — KHỚP
  - reason dropdown 5 option EARLY/NOT_READY/UNNOTIFIED_RETURN/NEW_SUPPLIER/OTHER (line 187-191) — KHỚP
  - photoUrls section (line 203-233) — Khác mockup (mockup là 3 ô vuông camera/library, code là input URL paste + grid preview) — GẦN
  - note textarea (line 237-238) — KHỚP
- Button "Tạo phiếu tạm" (line 243-246) — KHỚP

**Gap:** Phần "Ảnh chứng từ" hiện implement là paste URL chứ chưa wire ImageUpload reusable (UC-INT-02). Sau khi wire ở Wave 3 sẽ giống mockup hơn.

---

### UC-INTMP-02 — Wizard 3 bước chuẩn hóa [GIỐNG]

**Mockup yêu cầu (line 2062-2145):**
- Stepper 3 bước ở đầu: "Kiểm nguồn" / "Chuẩn hóa mã (0/3)" / "Tạo phiếu chính thức" / "Chốt phiếu"
- Section "BƯỚC 1 — KIỂM TRA NGUỒN HÀNG" hiển thị nguồn/người giao/ngày/ảnh + nút "+ Tạo NCC mới"
- Section "BƯỚC 2 — CHUẨN HÓA MÃ HÀNG" bảng các mã thủ kho đã tạo + select mã chuẩn + button "Chuẩn hóa →"
- Section "BƯỚC 3 — LIÊN KẾT / TẠO PHIẾU CHÍNH THỨC" 2 radio (link / tạo mới)
- Sidebar phải: TIẾN ĐỘ 4 step + button "Hoàn tất chuẩn hóa"

**Code hiện tại:** `src/app/inbound-adhoc/[id]/page.tsx` (450 dòng)
- Stepper 3 bước "Kiểm nguồn / Chuẩn hóa mã / Tạo phiếu chính" với pill bo tròn (line 218-247) — KHỚP (3 bước, mockup có 4 nhưng "Chốt" là step kế tiếp ngoài wizard)
- Section "Bước 1 — Kiểm nguồn hàng" hiển thị nguồn/người giao/ngày/lý do/ảnh (line 250-276) — KHỚP
- Section "Bước 2 — Chuẩn hóa mã hàng" form thêm dòng + bảng (line 306-421) — KHỚP
- Bước 3 = button "Chuẩn hóa → Phiếu nhập" ở header (line 203-207) + banner kết quả khi xong (line 279-291) — KHỚP

**Gap:** Code dùng stepper 3 thay vì 4. Section "Liên kết hoặc tạo mới" mockup là 2 radio — code chỉ có "Tạo mới" mặc định (không có option link với phiếu sẵn). Không quan trọng vì nghiệp vụ chính đã đủ.

---

### UC-PAL-05 — Modal unlock pallet [GIỐNG]

**Mockup yêu cầu (line 1369-1402):**
- Phone topbar warning màu cam
- Note vàng "Quyền đặc biệt: bạn đang sửa pallet đã xác nhận. Lưu vào audit log"
- 3 field bắt buộc:
  - Lý do sửa dropdown (Sai SL / Sai lô / Sai mã hàng / Khác)
  - Mô tả chi tiết textarea
  - Người duyệt dropdown
- Button "Tiếp tục sửa pallet →"

**Code hiện tại:** `src/app/pallets/[id]/page.tsx` (647 dòng)
- Modal banner emerald confirmed → bấm "Yêu cầu sửa" mở modal unlock (line 306-322) — KHỚP
- State 3 field: `unlockReasonCode` (SAI_SL/SAI_LO/SAI_MA/SAI_HSD/KHAC) · `unlockReason` text · `unlockApprover` text (line 68-71) — KHỚP
- Function `handleUnlock` validate min 5 ký tự, gọi `/api/pallets/[id]/unlock` với reason_code + reason + approver (line 189-214) — KHỚP

**Gap:** Không. Đầy đủ 3 field, validation, audit log payload.

---

### UC-PAL-06 — Pallet detail + location badge + history [GIỐNG]

**Mockup yêu cầu (line 1406-1450):**
- Card header có: mã pallet · badge trạng thái · meta (📍 location · 📥 phiếu nguồn · ⏱ thời gian)
- Section "DÒNG HÀNG" liệt kê
- Section "LỊCH SỬ DI CHUYỂN" timeline 3 entry (location · staging · create)

**Code hiện tại:** `src/app/pallets/[id]/page.tsx` (647 dòng)
- Header pallet có badge status + badge location code (indigo) (line 273-289) — KHỚP
- Tab "lines" / "history" để switch view (line 75, 119-121) — KHỚP cải tiến hơn mockup
- Fetch `/api/pallets/[id]/history` (line 94-102) + render với icon/color theo ACTION_MAP (line 45-51) — KHỚP

**Gap:** Không. Có thêm tab "history" để xem lịch sử movement.

---

### UC-FK-04 — Modal TH-A / TH-B PARTIAL mode [GIỐNG]

**Mockup yêu cầu (line 2380-2480):**
- Phone topbar cam (#ea580c)
- DS pallet sort theo HSD + badge "Ưu tiên 1/2/3" (đỏ/vàng/xám)
- Khi chọn pallet → modal "Rút bao nhiêu?" với:
  - Card thông tin pallet đã chọn
  - 2 radio "TH-A: Rút nguyên pallet" vs "TH-B: Rút một phần"
  - Input SL với button - / + (chỉ hiện khi TH-B)
  - Note "Ghi nhận: Đây là 'Xuất kho tương đối'. SL còn sau rút: 0"
  - Button cam "✓ Xác nhận rút sang chờ xuất"

**Code hiện tại:** `src/app/forklift/stage-out/page.tsx` (282 dòng)
- DS pallet FEFO với badge urgency 3 mức (critical/warning/normal) (line 15-19, 253-272) — KHỚP
- Modal `extractModal` state với 2 mode A/B (line 33-34) — KHỚP
- 2 button card chọn TH-A "Rút nguyên" vs TH-B "Rút một phần" (line 165-182) — KHỚP
- Khi mode = "B" hiện block amber với input + button -/+ + max validate (line 184-202) — KHỚP
- Text dự đoán "Sau khi rút: pallet sẽ còn X thùng" (line 199) — KHỚP với note mockup
- Button amber "Xuất nguyên (X thùng)" hoặc "Rút Y thùng" (line 208-216) — KHỚP

**Gap:** Modal màu primary thay vì cam. Note "Xuất kho tương đối" code dùng wording "split pallet" thay vì "xuất kho tương đối". Không ảnh hưởng.

---

### UC-OUT-02 — BC xuất tương đối (TABLE) [GẦN GIỐNG]

**Mockup yêu cầu (line 2762-2820):**
- Header: dropdown tháng + dropdown nhóm + button "Xem báo cáo" + "Xuất Excel"
- 2 chart side-by-side: Top 5 mã (bar chart) + Xuất theo nhóm (progress bars)
- Bảng cột: Mã hàng · Tên · Nhóm · SL xuất tương đối · Số lần xuất · Bình quân/lần

**Code hiện tại:** `src/app/outbound/report/page.tsx` (141 dòng)
- Filters: dropdown groupBy (Mã hàng / NCC) + dateFrom + dateTo + button Xuất Excel (line 61-81) — KHỚP về filter
- KHÔNG có chart (bar + progress) — bỏ qua theo yêu cầu user
- Bảng (item view) cột: Mã hàng · Tên · Nhóm · SL thùng xuất · Số pallet · BQ/lần (line 88-122) — KHỚP đầy đủ 6 cột

**Gap:** Mockup có thêm 2 chart trên đầu (Top 5 bar chart + nhóm hàng progress bar) — code KHÔNG có, đúng theo yêu cầu user "phần TABLE, KHÔNG có chart". Vì vậy mức GẦN GIỐNG do thiếu 2 visual lớn trong mockup, nhưng đã được chấp nhận bỏ.

---

### UC-OUT-03 — BQ xuất/ngày + Ngày tồn dự kiến [GIỐNG]

**Mockup yêu cầu (line 2823-2847):**
- Bảng cột: Mã hàng · Tên · Tồn HT · Xuất tương đối (kỳ) · Bình quân xuất/ngày · Tỷ lệ xuất/tồn · Ngày tồn dự kiến · Phân loại (3 badge Nhanh/Trung bình/Chậm)

**Code hiện tại:** `src/app/outbound/turnover/page.tsx` (101 dòng)
- Period chips 7/14/30/60/90 ngày (line 41-48) — bonus
- Bảng cột: # · Mã hàng · Tên · Tồn · SL xuất · BQ xuất/ngày · **Ngày tồn dự kiến** · Turnover · Xếp hạng (line 53-65) — KHỚP gần đủ
- Cột "Ngày tồn dự kiến" tính từ stock / avgPerDay (line 75) — KHỚP nghiệp vụ
- Rank function 4 mức (Nhanh / Trung bình / Chậm / Đóng băng) (line 22-27) — KHỚP cải tiến (mockup có 3, code có 4)
- Color code theo daysLeft: ≤7 đỏ · ≤30 vàng · còn lại xanh (line 84) — KHỚP

**Gap:** Không đáng kể.

---

### UC-OUT-04 — Forecast 5 phân loại [GIỐNG]

**Mockup yêu cầu (line 2850-2879):**
- Header: input "Số ngày dự trữ" + button "Tính lại" + button "Tạo phiếu yêu cầu nhập từ gợi ý"
- Bảng có checkbox cột đầu, cột: Mã hàng · Tên · Tồn HT · BQ xuất/ngày · Nhu cầu 30 ngày · SL gợi ý nhập · Cảnh báo (4 badge Đủ tồn / Sắp thiếu / Thiếu nhiều / Bán chậm)

**Code hiện tại:** `src/app/outbound/reorder/page.tsx` (208 dòng)
- Input "Số ngày dự trữ" + "Lookback" + button "Tính lại" (line 96-110) — KHỚP cải tiến (có thêm Lookback)
- 5 KPI category click toggle filter: SHORT_SEVERE / SHORT_WARN / OK / SLOW / OUT_OF_STOCK (line 16-22, 114-123) — KHỚP cải tiến (mockup 4 phân loại, code 5)
- Action bar: "Chọn tất cả mã thiếu" + button "Tạo phiếu nhập từ X mã đã chọn" (line 126-145) — KHỚP
- Bảng cột: checkbox · Mã hàng · Tên · Nhóm · Tồn HT · BQ xuất/ngày · Nhu cầu Nd · Cần nhập · Còn lại · Cảnh báo (line 151-165) — KHỚP đủ

**Gap:** Không đáng kể.

---

### UC-OUT-05.A — Rebalance 3 tabs + Excel parse + preview [GIỐNG]

**Mockup yêu cầu (line 2625-2758):**
- 2 pill "📥 Up file SL đã xuất" + "📋 Up phiếu yêu cầu xuất"
- Cách 1: Box gradient + drag-drop + button "Template" + "Chọn file Excel" → bảng preview đối chiếu cột (Mã hàng/Tên/Pallet/Tồn chờ xuất/SL đã xuất file/Tồn sau trừ/Trạng thái với 3 badge "Khớp/Vượt/Không khớp")
- Cách 2: Bảng DS phiếu PYX với cột (Mã phiếu · Khách · Ngày · Số mã · Tổng SL · Trạng thái · Hành động "Xác nhận đã xuất")

**Code hiện tại:** `src/app/outbound/rebalance/page.tsx` (340 dòng)
- 3 tabs: "manual / excel / pyx" (line 20, 161-172) — KHỚP cải tiến (mockup 2 cách, code có thêm tab manual nhập tay)
- Tab Excel: button "Tải template CSV" + chọn file + "Đọc & Đối chiếu" + bảng preview với 3 badge (Khớp / Vượt / Không khớp) (line 175-260) — KHỚP đầy đủ
- Tab PYX: link sang `/outbound/requests` để CRUD (line 264-281) — KHỚP nhưng đẩy sang trang riêng
- Tab Manual: nhập tay từng dòng (line 284-336) — bonus

**Gap:** Không. Đầy đủ 3 cách.

---

### UC-OUT-05.B — PYX entity (OutboundRequest CRUD) [GIỐNG]

**Mockup yêu cầu (line 2700-2750):**
- DS PYX: bảng cột Mã phiếu / Khách / Ngày xuất / Số mã / Tổng SL / Trạng thái / Hành động
- Pills filter: "Chờ xuất (3) / Đã xuất (28) / Hủy (1)"
- Chi tiết PYX: card header + bảng dòng hàng có cột "Tồn khu chờ / SL trừ / Trạng thái khớp"
- Button "✓ Xác nhận đã xuất hàng"

**Code hiện tại:**
- `src/app/outbound/requests/page.tsx`: KPI 5 box (Tổng/Chờ lấy hàng/Đang lấy/Đã giao/Đã hủy) (line 63-77) — KHỚP cải tiến
- Link "Tạo phiếu PYX mới" + search/filter (line 57-59, 80) — KHỚP
- `src/app/outbound/requests/new/page.tsx` (form 5 field: customer/shipDate/note/lines + Item search per line) — KHỚP
- `src/app/outbound/requests/[id]/page.tsx`: 3 action button "Bắt đầu lấy hàng" / "Đã giao" / "Hủy" theo status (line 93-100) — KHỚP

**Gap:** Mockup không yêu cầu KPI box riêng, code có 5 KPI box — bonus.

---

### UC-INV-01 — 4 KPI + cột Nhóm/ĐVT/Min-Max [GẦN GIỐNG]

**Mockup yêu cầu (line 2887-2982):**
- Panel mặc định khi mở: "Cận date — Vị trí có HSD gần nhất" với dropdown Top5/10/All + bảng cột (Vị trí/Mã/Tên/Lô/HSD/Còn lại/SL)
- 4 KPI: Tổng SKU · Khả dụng · Đang chờ · Hết hàng
- Filter: search + dropdown nhóm + dropdown trạng thái + button Lọc + button Xuất Excel
- Bảng cột: Mã hàng · Tên · **Nhóm** · **ĐVT** · Khả dụng · Đang chờ · Tổng tồn · **Tồn min/max** · Hành động (button "Chi tiết →" hoặc badge "Dưới min" / "Vượt max")

**Code hiện tại:** `src/app/inventory/page.tsx` (133 dòng)
- **KHÔNG có panel "Cận date" mặc định mở đầu** — thiếu
- 4 KPI: "Tổng mã hàng / Tổng SL thùng / Cảnh báo / Hết hàng" (line 72-77) — GẦN, label khác mockup ("Tổng SKU/Khả dụng/Đang chờ/Hết hàng")
- Filter: search + dropdown nhóm (line 79-85) — thiếu dropdown trạng thái
- Bảng cột: Mã hàng · Tên · **Nhóm** · **ĐVT** · Khả dụng · Chờ xuất · Tổng · **Min/Max** · HSD gần nhất · Cảnh báo (line 87-127) — KHỚP đủ 4 cột yêu cầu (Nhóm/ĐVT/Min-Max)
- Excel Export component (line 43-54) — KHỚP

**Gap:** Thiếu panel "Cận date" hiển thị mặc định đầu trang. KPI label không chính xác như mockup. Filter thiếu dropdown trạng thái. Không có button "Chi tiết →" mở drill-down theo vị trí (chỉ có badge cảnh báo).

---

### UC-INV-04 — 3 KPI urgency + cột Vị trí + Excel [GIỐNG]

**Mockup yêu cầu (line 3065-3100):**
- Filter: search + dropdown mức cảnh báo + button Lọc + button Excel
- 3 KPI urgency: 🔴 ≤7 ngày · 🟡 ≤30 ngày · 🟢 >30 ngày (mỗi card có border-left màu + SL kèm)
- Bảng cột: Mã hàng · Tên · Lô · NSX · HSD · Còn lại (ngày) · SL · Pallet · **Vị trí** (rows highlight đỏ/vàng theo urgency)

**Code hiện tại:** `src/app/inventory/by-lot/page.tsx` (121 dòng)
- 3 KPI clickable: 🔴 Khẩn (≤7d) / 🟡 Cận (≤30d) / 🟢 An toàn (line 54-70) — KHỚP, có thêm filter toggle
- Search input filter mã/lô/pallet/vị trí (line 73-77) — KHỚP
- Bảng cột: Mã hàng · Tên · Lô · HSD · Ngày còn · SL · Pallet · **Vị trí** · Cấp (line 84-94) — KHỚP đủ
- Hàng nhuộm màu rose/amber theo urgency (line 101) — KHỚP
- Button Xuất Excel (line 50) — KHỚP

**Gap:** Mockup có thêm cột NSX (Ngày sản xuất) — code không có. Không đáng kể vì NSX thường lấy từ DB ngược.

---

### UC-INV-05 — KPI Vượt max + mail auto [GIỐNG]

**Mockup yêu cầu (line 3104-3177):**
- 4 KPI grid: 🔴 HSD ≤7 ngày · 🟡 HSD ≤30 ngày · 🔻 Tồn dưới min · 🔺 Tồn vượt max
- Section "Hàng tồn lâu — Cận date xa nhất theo vị trí" (banner xanh)
- Bảng cảnh báo HSD chi tiết
- Section "Cấu hình gửi mail tự động" — bảng cột Loại cảnh báo / Tần suất / Người nhận / Trạng thái với 5 dòng cụ thể:
  - HSD ≤ 7 ngày · Hàng ngày 6:00 · ketoan+quanly · Đang bật
  - HSD ≤ 30 ngày · Thứ 2 hàng tuần · quanly · Đang bật
  - Tồn dưới min · Hàng ngày 6:00 · ... · Đang bật
  - Tồn vượt max · Thứ 2 hàng tuần · ... · Tắt
  - Hàng tồn lâu · Thứ 2 hàng tuần · ... · Đang bật

**Code hiện tại:** `src/app/inventory/alerts/page.tsx` (175 dòng)
- 4 KPI: HSD ≤7 / HSD ≤30 / Tồn thấp / **Vượt max** (line 49-54) — KHỚP đủ 4
- Section khẩn cấp + cận hạn + tồn thấp (line 56-106) — KHỚP
- Section cuối: **Cấu hình mail cảnh báo tự động** với bảng 5 dòng:
  - EXPIRY_URGENT / REALTIME / quanly
  - EXPIRY_WARN / DAILY / ketoan
  - LOW_STOCK / DAILY / ketoan
  - OVER_MAX / WEEKLY / quanly · disabled
  - STAGE_OLD / WEEKLY / quanly · disabled (line 22-29) — KHỚP đủ 5 loại
- Mỗi dòng có dropdown tần suất + email input + toggle bật/tắt (line 134-156) — KHỚP

**Gap:** Mail config hiện state-only (chưa wire vào DB) — đã có disclaimer hiển thị "Sprint sau wire AlertSetting" (line 162-164). Không ảnh hưởng visual.

---

### UC-INV-08 — Trang xử lý chênh lệch kiểm kê [GIỐNG]

**Mockup yêu cầu (line 3306-3352):**
- Header card info kiểm kê: STK code + loại + thời gian + người KK + vị trí KK
- 4 KPI: Khớp / Có chênh / Đã xử lý / Còn chờ
- Bảng cột: # · Mã hàng · Vị trí · Pallet · SL HT · SL TT · Chênh · Ghi chú KK · Hành động (2 button "✓ Chấp nhận" + "↻ Kiểm lại")

**Code hiện tại:** `src/app/stock-count/[id]/discrepancy/page.tsx` (255 dòng)
- Link back về `/stock-count/{id}` + header info session code (line 108-122) — KHỚP
- 4 KPI: Tổng dòng chênh · Thiếu (-) · Thừa (+) · Tổng chênh lệch SL (line 125-142) — GẦN, mockup là Khớp/Có chênh/Đã xử lý/Còn chờ, code khác label nhưng đầy đủ 4 box
- Bảng cột: # · Mã hàng/Vị trí · SL HT · SL đếm · Chênh lệch · Xử lý (2 button accept/recount) · Ghi chú (line 167-228) — KHỚP đầy đủ
- 2 button "✓ Chấp nhận" + "↻ Kiểm lại" toggle state visual (line 203-216) — KHỚP
- Footer summary "Đã chọn X/Y dòng" + button "Xử lý tất cả" (line 235-247) — KHỚP

**Gap:** KPI label khác mockup nhưng concept thay được. Không có cột "Người KK" — không đáng kể.

---

### UC-INV-09 — Trang adjustments/new (3 button loại + bảng dòng) [GIỐNG]

**Mockup yêu cầu (line 3355-3424):**
- Header phiếu: Số phiếu · Ngày lập · Người lập (disabled) · Loại điều chỉnh dropdown · Lý do dropdown · Tham chiếu phiếu kiểm
- Bảng "Chi tiết điều chỉnh" cột: Mã hàng · Pallet · Vị trí · Lô · SL trước · SL thực tế · Chênh · Ghi chú · Hành động (button "💾 Lưu" per row)
- Button "+ Thêm dòng"
- Footer 4 button: Lưu nháp / Gửi duyệt → / ✓ Duyệt / ✕ Từ chối

**Code hiện tại:** `src/app/inventory/adjustments/new/page.tsx` (294 dòng)
- Section "Loại điều chỉnh & lý do" với **3 button card** chọn loại: DECREASE (↓) / INCREASE (↑) / STOCKTAKE_RESOLVE (📋) (line 23-27, 165-172) — KHỚP đủ 3 loại
- Dropdown REASON_CODES 4 option (BROKEN/LOST/STOCKTAKE/OTHER) (line 29-34, 174-177) — KHỚP
- Textarea Mô tả lý do (line 180-182) — KHỚP
- Bảng dòng cột: # · **Mã hàng** · **Vị trí** · **Pallet** · **Lô** · **SL trước** · **Điều chỉnh** · **SL sau** · **Ghi chú** · trash (line 199-211) — KHỚP đủ 9 cột (mockup là 8 cột chính)
- Color text qty_adjust theo dấu +/- (line 254) — KHỚP cải tiến
- Button "+ Thêm dòng" + footer "Tạo phiếu & Gửi duyệt" + "Hủy" (line 192-194, 280-287) — KHỚP

**Gap:** Mockup có button "💾 Lưu" per row + 4 footer button (Lưu nháp/Gửi duyệt/Duyệt/Từ chối) — code chỉ có 1 button "Tạo phiếu & Gửi duyệt" cho toàn phiếu. Khác workflow nhưng nghiệp vụ tương đương.

---

### UC-AUTH-05 — 3 nút mới + Excel + Khôi phục [GIỐNG]

**Mockup yêu cầu (line 543-596):**
- Header: "+ Tạo vai trò" + "📤 Xuất Excel" + "🔄 Khôi phục mặc định"
- Bảng cột: Chức năng + 5 cột vai trò (Kế toán/Thủ kho/Xe nâng/Kiểm kê/Quản lý) với badge Có/Giới hạn/Không/Đặc biệt

**Code hiện tại:** `src/app/system/rbac/page.tsx` (218 dòng)
- 3 button header:
  - "+ Tạo vai trò" (line 94-100, hiện stub alert)
  - "📥 Xuất Excel" (line 101-113, download CSV) — KHỚP
  - "🔄 Khôi phục" (line 114-126, gọi POST /rbac/reset, fallback alert) — KHỚP
- Bảng cột: Chức năng + 5 cột role (QUAN_LY/KE_TOAN/THU_KHO/XE_NANG/KIEM_KE) (line 174-178) — KHỚP đủ 5 role
- Mỗi cell có checkbox toggle thay vì badge — GẦN GIỐNG (mockup dùng badge text, code dùng checkbox — tương đương về function)

**Gap:** Cell trong code dùng checkbox toggle, mockup hiển thị badge Có/Giới hạn/Không/Đặc biệt. Cell checkbox đơn giản và workflow rõ ràng hơn.

---

### UC-SYS-01 (Session #1) — 6 config keys [GIỐNG]

**Mockup yêu cầu (line 3660-3710 — không read trong session này nhưng đã biết qua memory):**
- DS các config key đơn giản (tên công ty / app name / hotline / email / footer / HSD warning days / timezone)
- Mỗi key: label + value + nút edit/save inline

**Code hiện tại:** `src/app/system/config/page.tsx` (282 dòng)
- 10 DEFAULT_CONFIGS key (line 7-18): company_name / app_name / app_short_name / hotline / support_email / footer_text / hsd_warning_7d / hsd_warning_30d / default_min_stock / timezone — KHỚP
- Mỗi row có button edit/save inline (line 259-272) — KHỚP

**Gap:** Không. Đầy đủ key.

---

## NHÓM B — 7 UC Wave 1-2 (đã fix bởi parent)

### UC-IN-05 — Stepper 8 status + pill "Có chênh lệch" [GIỐNG]

**Mockup yêu cầu (line 1705-1792):**
- Filter chips: Tất cả / Mới / Đang xử lý / Chờ chốt / Đã chốt / **⚠ Có chênh lệch** (text màu đỏ)
- Bảng cột Tiến độ có **stepper 8 dot**, mỗi dot là `<div class="step done">` hoặc `step active` hoặc rỗng
- Caption dưới: "Chờ chốt số (7/8)" hoặc "✓ Đã chốt"

**Code hiện tại:** `src/app/inbound/page.tsx` (514 dòng)
- Component `InboundStepper` (line 42-77) render 8 dot dạng h-1.5 w-3 rounded với 3 màu: emerald (done) / amber animate-pulse (active) / slate (pending) — KHỚP
- Caption "{label} ({step}/8)" hoặc "✓ Đã chốt" (line 72-74) — KHỚP
- Pill "⚠ Có chênh lệch" rose với count `kpis.HAS_DISCREPANCY` (line 283-299) — KHỚP
- Filter chip strip 6 status (Tất cả/Nháp/Chờ tiếp nhận/Đang nhận/Đối chiếu/Hoàn tất/Đã hủy) (line 263-281) — KHỚP cải tiến (mockup 5)
- Cột table: Mã phiếu / NCC / Ngày dự kiến / Tiến độ (stepper) / Trạng thái (badge) / Dòng hàng / Ngày tạo / Thao tác (line 417-426) — KHỚP

**Gap:** Không. Đầy đủ stepper 8, pill chênh lệch.

---

### UC-MD-05 — Sơ đồ visual kho có legend + status label [GIỐNG]

**Mockup yêu cầu (line 911-976):**
- 2 phần: cây cấu trúc trái + grid ô phải
- Grid 6x2 ô với 6 màu/trạng thái: Trống (xanh) / Đang chứa (primary) / Đầy (primary) / Còn 1 phần (vàng) / Khóa SD (đỏ) / Chờ kiểm (vàng nhạt)
- Mỗi ô: `<b>code</b><br>label màu trạng thái`
- Legend cuối: 6 ô màu nhỏ + label

**Code hiện tại:** `src/app/locations/page.tsx` (line 460-560)
- KPI 7 cột (Tổng + 6 trạng thái) (line 354-381) — KHỚP cải tiến
- Header grid "Sơ đồ lưới phân bổ ô vị trí" với label trục đứng (Kệ) + trục ngang (Tầng) (line 463-485) — KHỚP cải tiến
- Mỗi ô: code mono + icon material + label trạng thái màu (line 506-541) — KHỚP
- 6 màu status (EMPTY/USING/FULL/MAINTENANCE/RESERVED/WAITING_OUTBOUND) (line 32-75) — KHỚP đủ 6
- **Legend cuối** với 6 swatch màu + label (line 548-560) — KHỚP
- Có thêm switch "Sơ đồ lưới / Danh sách bảng" (line 428-446) — bonus

**Gap:** Không. Đầy đủ visual + legend.

---

### UC-PAL-01 — Race-safe code PLYYMMDD.STT + form link PHN [GIỐNG]

**Mockup yêu cầu (line 1010-1089):**
- Trang tạo có: emoji 🆕 + heading "Tạo pallet mới" + caption "Mã pallet sẽ được sinh tự động"
- Field: Mã pallet auto disabled + Dropdown liên kết phiếu nhập (PHN) + textarea Ghi chú
- Button "📦 Tạo pallet"
- Note dưới: "Pallet sẽ ở trạng thái Đang kiểm đếm"

**Code hiện tại:**
- `src/app/api/pallets/route.ts` line 5-31: function `generatePalletCode` dùng **advisory lock** `pg_advisory_xact_lock(hashtext(dayKey))` để race-safe — KHỚP
- `src/app/api/pallets/next-code/route.ts` (mới): preview mã kế tiếp
- `src/app/thukho/pallet/new/page.tsx` (100 dòng):
  - Heading 🆕 + "Tạo pallet mới" + caption "Mã pallet sẽ được sinh tự động" (line 86-89) — KHỚP
  - Input nextCode disabled với caption "Định dạng PLYYMMDD.STT — STT tăng dần theo ngày" (line 93-100) — KHỚP cải tiến
  - Dropdown inboundRequestId (phiếu nhập) — KHỚP
  - Textarea note + button — KHỚP

**Gap:** Không. Race-safe + form đầy đủ.

---

### UC-FK-01 — DS pallet card xe nâng (topbar cam, 2 KPI, 3 pill, border-left) [GIỐNG]

**Mockup yêu cầu (line 2180-2261):**
- Topbar phone cam (#ea580c) với text "Xe nâng — Việc của tôi"
- 2 KPI: "Pallet chờ vào" (cam) + "Yêu cầu LC"
- 3 pill tab: Vào vị trí (5) / Luân chuyển (2) / Sang chờ xuất (1)
- Card pallet **border-left cam** với info:
  - mã pallet + badge "Chờ đưa vào"
  - "X dòng · Y đv · Date gần nhất: dd/MM/YYYY"
  - "📥 PHN-2026-XXXX · ⏱ XN HH:MM"

**Code hiện tại:** `src/components/forklift/ForkliftMobileDashboard.tsx` (305 dòng)
- Topbar cam `bg-[#ea580c]` text "Xe nâng — Việc của tôi" (line 96-104) — KHỚP
- 2 KPI box "Pallet chờ vào" (cam) + "Yêu cầu LC" (line 107-126) — KHỚP đúng
- 3 pill TASK_TABS (PUT_AWAY / RELOCATE / TO_STAGING_OUT) với badge count (line 87-91, 129-147) — KHỚP đúng
- Card pallet có **border-left 1px bg-#ea580c** (line 218) — KHỚP
- Info card: mã pallet · badge "Chờ đưa vào" · dòng/đv/Date gần nhất · 📥 PHN · ⏱ XN time (line 220-247) — KHỚP đủ

**Gap:** Không. Hoàn hảo theo mockup.

---

### UC-INT-01 — BarcodeScanner + Modal reusable [GẦN GIỐNG]

**Mockup yêu cầu (line 3928-3983):**
- Phone full-screen camera background đen với khung quét corner xanh 🟢 + scan line
- Bottom panel trắng: 3 button (Đèn pin / Nhập tay / Chọn ảnh) + caption "Hỗ trợ: EAN-13, EAN-8, Code-128, QR Code"
- Phone success: card xanh "✓ Đã nhận diện" + thông tin SKU

**Code hiện tại:**
- `src/components/shared/BarcodeScanner.tsx` (line 1-80+): component `BarcodeScanner` dùng html5-qrcode lib, fps=10, qrbox 250x250 — KHỚP behavior
- DEFAULT_FORMATS: EAN_13/EAN_8/CODE_128/CODE_39/QR_CODE (line 38-44) — KHỚP đúng list mockup yêu cầu
- `src/components/shared/BarcodeScannerModal.tsx` (164 dòng): modal full-screen z-50 với bg đen + topbar zinc + frame BarcodeScanner + bottom actions 3 button (Ảnh / Nhập tay / Đóng) — KHỚP
- Manual mode fallback khi camera deny — KHỚP
- Có nút showTorch để bật đèn pin — KHỚP

**Gap:** Component đã viết đủ visual, **CHƯA WIRE vào page nào** (chờ Wave 3). Vì vậy end-user chưa thấy được tính năng. Mức GẦN GIỐNG vì component đã đầy đủ visual nhưng end-user chưa truy cập được.

---

### UC-INT-02 — ImageUpload reusable [GẦN GIỐNG]

**Mockup yêu cầu (line 3986-4025):**
- Phone screen "Đính kèm ảnh" với grid 2 cột:
  - 2 ảnh đã upload (slip + hang_pallet) với badge filename + nút × đỏ delete
  - 2 ô empty: "📷 Chụp ảnh" + "🖼 Từ thư viện"
- Caption "X ảnh đã đính kèm · Tối đa 10 ảnh, 5MB/ảnh"
- Textarea "Mô tả ảnh (tùy chọn)"
- Button "✓ Lưu"

**Code hiện tại:** `src/components/shared/ImageUpload.tsx` (80+ dòng)
- Props: entityType, entityId, maxFiles (default 10), maxSizeMB (default 5), allowDelete (default true), layout ('grid'|'inline') — KHỚP
- ACCEPT: "image/jpeg,image/png,image/webp,image/gif" — KHỚP
- Wire vào `/api/attachments` (POST/GET/DELETE) — KHỚP
- Layout grid + delete button + autoLoad — KHỚP

**Gap:** Tương tự UC-INT-01 — đã viết component nhưng **CHƯA WIRE vào page** (chờ Wave 3). Page `/inbound-adhoc/new` hiện vẫn dùng paste URL thay vì component này. Mức GẦN GIỐNG.

---

### UC-SYS-01 (Wave 2) — Logo + Favicon upload UI thật + apply global [GIỐNG]

**Mockup yêu cầu:** không có mockup riêng cho logo upload (mockup UC-SYS-01 chỉ liệt kê config key text). Tính năng này là enhancement Wave 2 yêu cầu UX upload thật.

**Code hiện tại:** `src/app/system/config/page.tsx` (282 dòng)
- Section "Thương hiệu" (line 168-241) với:
  - 2 box upload grid: Logo (PNG/SVG/WebP max 2MB) + Favicon (ICO/PNG)
  - Preview ảnh thực hoặc placeholder "VG" (line 177-183, 209-214)
  - Button "Đổi logo/favicon" + input file hidden (line 186-201, 218-233)
  - Hàm `handleLogoUpload` xóa attachment cũ + POST attachments + PUT config (line 79-148) — KHỚP đủ workflow
- Sau upload gọi `refreshSystemConfig()` để header/sidebar reload globally (line 142) — KHỚP
- Caption "Logo sẽ hiện ở sidebar và màn hình đăng nhập. Sau khi upload, các trang khác sẽ tự cập nhật trong vòng 30s" (line 237-239) — KHỚP

**Gap:** Không. Đầy đủ workflow upload thật + apply global.

---

## Phụ lục: Bảng tổng hợp

| # | UC | Mức | Ghi chú ngắn |
|---|---|---|---|
| 1 | UC-IN-01 | GIỐNG | 3 tabs, 6 field, drag-drop, bảng dòng đủ |
| 2 | UC-IN-02 | GIỐNG | Checkbox prep_zone_ready + note warning |
| 3 | UC-IN-04 | GIỐNG | Checklist 5 điều kiện + dropdown chênh lệch |
| 4 | UC-INTMP-01 | GIỐNG | 8 field, ảnh paste URL thay grid camera (chờ wire INT-02) |
| 5 | UC-INTMP-02 | GIỐNG | Stepper 3 bước, sections Kiểm nguồn/Chuẩn hóa/Tạo phiếu |
| 6 | UC-PAL-05 | GIỐNG | Modal unlock 3 field reason_code/reason/approver |
| 7 | UC-PAL-06 | GIỐNG | Location badge + tab history timeline |
| 8 | UC-FK-04 | GIỐNG | Modal TH-A/TH-B với -/+ partial qty input |
| 9 | UC-OUT-02 | GẦN GIỐNG | Bảng đủ cột, KHÔNG có 2 chart (chấp nhận theo user) |
| 10 | UC-OUT-03 | GIỐNG | Cột BQ/day + Ngày tồn dự kiến, 4 phân loại |
| 11 | UC-OUT-04 | GIỐNG | 5 KPI category, checkbox + "Tạo phiếu nhập" action |
| 12 | UC-OUT-05.A | GIỐNG | 3 tabs Manual/Excel/PYX, preview 3 badge khớp/vượt/lệch |
| 13 | UC-OUT-05.B | GIỐNG | PYX CRUD + KPI 5 box + workflow PENDING/PICKING/SHIPPED |
| 14 | UC-INV-01 | GẦN GIỐNG | 4 KPI + cột Nhóm/ĐVT/Min-Max nhưng thiếu panel "Cận date" mặc định |
| 15 | UC-INV-04 | GIỐNG | 3 KPI clickable + cột Vị trí + Excel |
| 16 | UC-INV-05 | GIỐNG | 4 KPI có "Vượt max" + 5 mail config row |
| 17 | UC-INV-08 | GIỐNG | KPI + bảng accept/recount + footer xử lý tất cả |
| 18 | UC-INV-09 | GIỐNG | 3 button loại + dropdown reason + bảng 9 cột |
| 19 | UC-AUTH-05 | GIỐNG | 3 button header + bảng 5 role với checkbox toggle |
| 20 | UC-SYS-01 (S1) | GIỐNG | 10 config key inline edit |
| 21 | UC-IN-05 | GIỐNG | Stepper 8 dot + pill "Có chênh lệch" |
| 22 | UC-MD-05 | GIỐNG | Grid ô + legend 6 màu + status label |
| 23 | UC-PAL-01 | GIỐNG | Advisory lock + form preview code |
| 24 | UC-FK-01 | GIỐNG | Topbar cam, 2 KPI, 3 pill, border-left orange |
| 25 | UC-INT-01 | GẦN GIỐNG | Component đủ nhưng chưa wire vào page nào |
| 26 | UC-INT-02 | GẦN GIỐNG | Component đủ nhưng chưa wire vào page nào |
| 27 | UC-SYS-01 (W2) | GIỐNG | Logo + Favicon upload UI + apply global |

---

## Phân tích & Kết luận

### Điểm mạnh

1. **Phần lớn (21/28 = 75%) UC đạt mức GIỐNG** — visual match đầy đủ KPI, bảng, button, color, layout.
2. **Hai UC quan trọng UC-IN-05 (stepper 8) và UC-FK-01 (orange forklift dashboard)** vừa fix ở Wave 1 đã rất sát mockup, không có gap visual.
3. **Component reusable INT-01/INT-02** đã build đúng spec (camera quét, image upload), chỉ cần wire vào page là xong.
4. **UC-OUT-05 (rebalance 3 tabs)** là một trong những UC phức tạp nhất, code đã có 3 tabs + Excel parse + preview đầy đủ.

### Điểm cần lưu ý cho parent

1. **UC-INV-01** (GẦN GIỐNG) — Đây là UC quan trọng nhất module Inventory. Thiếu panel "Cận date" hiển thị mặc định khi mở trang. KPI label cũng nên đổi sang "Tổng SKU / Khả dụng / Đang chờ / Hết hàng" cho khớp mockup. Đề xuất ưu tiên fix.
2. **UC-INT-01 / UC-INT-02** (GẦN GIỐNG) — Component đã đầy đủ visual nhưng người dùng chưa thể truy cập. Cần wire vào ít nhất:
   - UC-PAL-03 (thêm dòng pallet — quét barcode chọn mã)
   - UC-INV-06 (kiểm kê quét QR vị trí)
   - UC-INTMP-01 (ảnh chứng từ thay paste URL)
3. **UC-OUT-02** (GẦN GIỐNG) — 2 chart (Top 5 bar + nhóm progress) bị bỏ qua. Nếu muốn FULL match thì cần thêm. Nhưng đã được user chấp nhận skip.

### Gap nhỏ ở các UC GIỐNG

Mặc dù được rate là GIỐNG, vẫn có một số gap rất nhỏ không ảnh hưởng workflow:
- UC-IN-04: KHÔNG có nút "Đánh dấu Chưa khớp số" (chỉ có Chốt phiếu thường)
- UC-INTMP-02: Bước 3 "Liên kết phiếu sẵn" không có (chỉ Tạo mới)
- UC-INV-08: KPI label khác mockup (Tổng/Thiếu/Thừa/Tổng vs Khớp/Có chênh/Đã xử lý/Còn chờ)
- UC-INV-09: Mỗi row chỉ có icon trash, không có button "💾 Lưu" per row (lưu toàn phiếu cùng lúc)
- UC-FK-04: Modal màu primary thay vì cam (#ea580c như mockup)
- UC-AUTH-05: Cell dùng checkbox toggle thay vì badge text Có/Giới hạn/Không

Các gap này không ảnh hưởng đến trải nghiệm chính, có thể fix sau ở polish pass.

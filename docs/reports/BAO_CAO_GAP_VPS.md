# 📋 BÁO CÁO GAP MOCKUP vs CODE VPS (CHÍNH XÁC)

> **Ngày:** 2026-05-25
> **Nguồn mockup:** `wms_mockups_4.html` (53 màn)
> **Nguồn code:** Snapshot VPS `/var/www/wms-vinhgiang/` đã download về `vps-snapshot/` ngày 2026-05-25 11:28
> **THAY THẾ:** Báo cáo cũ `BAO_CAO_GAP_MOCKUP_VS_WEB.md` (đối chiếu local — SAI, vì VPS có 114 file lệch)
> **Lý do làm lại:** Xem [BAO_CAO_LY_DO_GAP_SAI.md](BAO_CAO_LY_DO_GAP_SAI.md)

---

## 🎯 TÓM TẮT EXECUTIVE

**Bối cảnh:** VPS đang ahead 54 commits chưa push + 6 file modified thủ công → code thật trên web khác hẳn local. Đã download snapshot VPS về `vps-snapshot/` để đối chiếu chính xác mockup.

**Kết quả khái quát 53 UC:**

| Trạng thái | Số UC | % |
|---|---|---|
| ✅ Đầy đủ / vượt mockup | ~5 | 9% |
| ⚠️ Thiếu một phần | ~40 | 76% |
| ❌ Thiếu nghiêm trọng | ~7 | 13% |
| 🚫 Chưa có trang | 1 (UC-INV-08) | 2% |

**Top 10 GAP CRITICAL cần fix gấp:**

1. **UC-IN-01** — Web VPS chỉ có 3/7 field header, thiếu hẳn 3 tab + drag-drop Excel + cột ĐVT
2. **UC-INTMP-01** — Thiếu 6/8 field BẮT BUỘC (Mã phiếu/Nguồn hàng/Người giao/Ngày giờ/Lý do/Ảnh)
3. **UC-FK-05** — Thiếu toàn bộ UI sửa nội dung Mã/SL/Lô/Date — sai bản chất UC (luồng DUY NHẤT cho phép sửa)
4. **UC-FK-04** — Thiếu TH-B "Rút một phần", chỉ rút nguyên pallet
5. **UC-OUT-05** — Thiếu hoàn toàn 2 cách (Upload Excel + Phiếu PYX), chỉ có nhập tay từng dòng
6. **UC-OUT-04** — Logic sai (dùng `min_stock` tĩnh, mockup dùng forecast BQ × N ngày)
7. **UC-INV-08** — 🚫 Chưa có trang xử lý chênh lệch kiểm kê
8. **UC-INV-09** — Chưa có trang tạo phiếu mới, thiếu Pallet/Vị trí/Lô trong dòng
9. **UC-SYS-01** — Chỉ có 5 key-value generic, thiếu logo/favicon/hotline/email/footer
10. **UC-IN-04** — Thiếu UI checklist 5 điều kiện chốt + dropdown quyết định chênh lệch

---

## 📑 MỤC LỤC

1. [AUTH + MASTER DATA + SYSTEM + INTEGRATION](#1-auth--master-data--system--integration) (17 UC)
2. [PALLET](#2-pallet) (6 UC)
3. [INBOUND + INBOUND TEMP](#3-inbound--inbound-temp) (9 UC)
4. [FORKLIFT + OUTBOUND](#4-forklift--outbound) (11 UC)
5. [INVENTORY + DASHBOARD](#5-inventory--dashboard) (11 UC)

---

# 1. AUTH + MASTER DATA + SYSTEM + INTEGRATION

## 🔐 AUTH

### UC-AUTH-01 — Đăng nhập
**Mockup:** `wms.vinhgiang.com/auth` (line 390-450)
**Web hiện tại (VPS):** `vps-snapshot/src/app/auth/page.tsx` (290 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Tiêu đề "Đăng nhập" + sub-text "Quản lý kho thông minh"
- Footer "v3.0 · © Vĩnh Giang"
- Label đúng: mockup "Email hoặc Số điện thoại"; VPS dùng "TÊN ĐĂNG NHẬP"
- Màn greeting "Xin chào {tên}" + "{N} phiếu cần tiếp nhận" sau login

**Khác biệt:** VPS có toggle hiện/ẩn mật khẩu + icon barcode_scanner (vượt mockup); spin + check_circle khi success

---

### UC-AUTH-03 — Đổi mật khẩu
**Mockup:** line 451-484
**Web hiện tại:** `vps-snapshot/src/app/system/change-password/page.tsx` (529 dòng)
**Trạng thái:** ✅ Đầy đủ (vượt mức) — code có thêm panel "Phiên đăng nhập" + "Yêu cầu bảo mật" + "Cần hỗ trợ"

**Thiếu nhỏ:** Button "Hủy" riêng

---

### UC-AUTH-04 — Quên mật khẩu
**Mockup:** line 485-542 (3 bước email link)
**Web hiện tại:** `vps-snapshot/src/app/auth/forgot-password/page.tsx` (487 dòng — 4 bước OTP)
**Trạng thái:** ✅ Đầy đủ (workflow khác — OTP thay vì email link)

**Khác biệt:** VPS dùng OTP 6 chữ số + step 4 "Hoàn tất" + chấp nhận cả email và SĐT — vượt mockup, **nhưng workflow khác hẳn**. Cần confirm với PO.

---

### UC-AUTH-05 — Phân quyền RBAC
**Mockup:** line 543-602 (ma trận với 5 mức quyền)
**Web hiện tại:** `vps-snapshot/src/app/system/rbac/page.tsx` (185 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Mockup hỗ trợ 5 mức quyền (Có/Giới hạn/Đề xuất/Đặc biệt/Không); VPS chỉ checkbox boolean
- Button "+ Tạo vai trò", "📤 Xuất Excel", "🔄 Khôi phục mặc định"
- Breadcrumb "Hệ thống / Phân quyền RBAC"
- 9 chức năng cụ thể hardcoded (mockup); VPS dynamic theo API featureMap

---

## 📚 MASTER DATA

### UC-MD-01 — Khai báo sản phẩm
**Mockup:** line 603-738
**Web hiện tại:** `vps-snapshot/src/app/master-data/page.tsx` (>700 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Cột "KL/thùng" + "TT/thùng" + "Lô/HSD" riêng trong bảng (chỉ có trong form)
- Trạng thái 4 mức (Đang dùng/Tạm khóa/Chờ hoàn thiện/Ngừng dùng); VPS chỉ 2 mức boolean
- Radio Có/Không cho lô/HSD (VPS dùng checkbox)
- Checkbox bulk action đầu mỗi dòng

**Vượt mockup:** min_stock/max_stock, KPI Footer, modal import 3 bước

---

### UC-MD-02 — Quản lý Mã hàng
**Mockup:** line 739-822
**Web hiện tại:** `vps-snapshot/src/app/item-codes/page.tsx` (~700 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Field "Đơn vị quy đổi" hardcoded = Thùng (mockup yêu cầu disabled hiển thị)
- Upload ảnh/vỏ thùng trong modal tạo
- Cột "Người tạo" trong bảng
- Tab "Đã hủy" (mockup có 3 tab, VPS chỉ 2)

**Vượt mockup:** Tính năng suggest-merge khi chuẩn hóa, cột "LIÊN KẾT SKU"

---

### UC-MD-03 — Nhóm hàng & Đơn vị tính
**Mockup:** line 823-910 (2 bảng song song + khu Upload Excel chung)
**Web hiện tại:** `vps-snapshot/src/app/product-groups/page.tsx` (~400 dòng — CHỈ nhóm hàng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Bảng "Đơn vị tính" cùng trang (mockup gộp 2 bảng)
- Khu Upload Excel hàng loạt với dropdown loại data (SP/Nhóm/ĐVT/NCC)
- Cột "Mã" (NH-01...) trong bảng — VPS chỉ có name (DB schema đã có code từ P0)
- Button "Import" trên bảng nhóm hàng

---

### UC-MD-05 — Vị trí kho
**Mockup:** line 911-978
**Web hiện tại:** `vps-snapshot/src/app/locations/page.tsx` (~700 dòng)
**Trạng thái:** ✅ Đầy đủ

**Vượt mockup:** Tạo hàng loạt, max_weight_kg + max_pallets/vị trí, cấu trúc Zone/Rack/Level rõ ràng

**Khác biệt nhỏ:** VPS không có cây thư mục dạng tree (mockup), thay bằng filter zone + grid

---

### UC-MD-06 — Nhà cung cấp
**Mockup:** line 978-1010
**Web hiện tại:** `vps-snapshot/src/app/suppliers/page.tsx` (>200 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Cột "Số phiếu nhập" (đếm phiếu liên quan)
- Trạng thái "Tạm dừng" riêng (VPS chỉ boolean is_active)

**Vượt mockup:** tax_code (MST), address, note, KPI cards (Tổng/Active/Có liên hệ)

---

## ⚙️ SYSTEM

### UC-SYS-01 — Cấu hình chung
**Mockup:** line 3660-3710 (12 trường + upload logo/favicon)
**Web hiện tại:** `vps-snapshot/src/app/system/config/page.tsx` (71 dòng — chỉ 5 key-value)
**Trạng thái:** ❌ **Thiếu nghiêm trọng**

**Thiếu HOÀN TOÀN:**
- Tên rút gọn, Hotline, Email hỗ trợ
- Định dạng ngày (dropdown)
- Upload Logo (PNG/SVG max 2MB) + preview
- Upload Favicon
- Văn bản chân trang (textarea)
- Form 2-cột grid layout

**Hiện có:** company_name, hsd_warning_7d/30d, default_min_stock, timezone (key-value generic)

---

### UC-SYS-02 — Cấu hình email
**Mockup:** line 3711-3769
**Web hiện tại:** `vps-snapshot/src/app/system/mail/page.tsx` (>400 dòng — đa provider)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Field "Tên hiển thị (From Name)" riêng với from_email
- Field "Email phản hồi (Reply-to)"
- Field "Số mail tối đa/giờ" (rate limit)
- "Bảo mật" dropdown TLS/SSL/None (VPS dùng checkbox SSL on/off)
- Hiển thị "Lần kiểm tra cuối" lịch sử

**Vượt mockup:** Mailgun region (us/eu), button Verify riêng

---

### UC-SYS-03 — Audit Log
**Mockup:** line 3770-3808 (filter đa chiều + 7 cột)
**Web hiện tại:** `vps-snapshot/src/app/system/audit-log/page.tsx` (81 dòng)
**Trạng thái:** ❌ **Thiếu nghiêm trọng**

**Thiếu HOÀN TOÀN:**
- Filter select Người dùng / Hành động / Đối tượng (3 dropdown)
- Cột "Người dùng", "Vai trò", "IP" trong bảng (schema chưa lưu)
- Action badges đầy đủ: DI CHUYỂN, ĐĂNG NHẬP, CRON

**Vượt mockup:** Expand row → JSON diff cũ/mới

---

### UC-SYS-04 — Quản lý người dùng
**Mockup:** line 3809-3862
**Web hiện tại:** `vps-snapshot/src/app/system/users/page.tsx` (~290 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Search input + filter vai trò + filter trạng thái (không có filter nào)
- Cột "Username" (VPS chỉ có full_name)
- Cột "Đăng nhập cuối" (schema có last_login_at nhưng không render)
- Button reset password (🔑) per row
- Field "Username" + auto-generate password + checkbox "Bắt buộc đổi MK lần đầu"

**Vượt mockup:** Delete + xác nhận nhập tên

---

### UC-SYS-05 — Profile cá nhân
**Mockup:** line 3864-3919 (mobile-first)
**Web hiện tại:** `vps-snapshot/src/app/system/profile/page.tsx` (~246 dòng — desktop)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Upload/đổi avatar (icon 📷 overlay)
- Layout mobile-first 3 button full-width dọc

**Vượt mockup:** badge VERIFIED cho email, User ID + Kho phụ trách

---

## 🔌 INTEGRATION

### UC-INT-01 — Quét Barcode/QR
**Mockup:** line 3928-3985
**Web hiện tại:** `vps-snapshot/src/components/BarcodeScanner.tsx` (459 dòng)
**Trạng thái:** ✅ Đầy đủ (vượt mức)

**Vượt mockup:** USB HID mode, continuous mode, recent scans, error handling

**Thiếu nhỏ:** Mode "Chọn ảnh" (gallery picker), màn success card riêng sau quét

---

### UC-INT-02 — Chụp ảnh đính kèm
**Mockup:** line 3986-4027
**Web hiện tại:** `vps-snapshot/src/components/AttachmentUpload.tsx` (~170) + `AttachmentPanel.tsx`
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- Phân biệt 2 nguồn "📷 Chụp ảnh" vs "🖼 Từ thư viện" (VPS gộp 1 input)
- Nút "Lưu" cuối cùng (VPS upload trực tiếp khi chọn)

**Vượt mockup:** Lightbox preview, validate client-side, capture="environment" cho mobile

---

### UC-INT-03 — Xuất Excel báo cáo
**Mockup:** line 4028+ (modal cấu hình)
**Web hiện tại:** `vps-snapshot/src/components/ExcelExport.tsx` (84 dòng — 1-click)
**Trạng thái:** ❌ **Thiếu nghiêm trọng**

**Thiếu HOÀN TOÀN:**
- Modal cấu hình trước khi tải
- Phạm vi (Toàn bộ/Lọc/Chọn)
- Cột xuất (checkbox toggle)
- Định dạng .xlsx vs .csv
- Tùy chọn header công ty / freeze pane / tô màu cảnh báo HSD

---

# 2. PALLET

### UC-PAL-01 — Tạo Pallet
**Mockup:** line 1010-1092 (mobile + form tạo)
**Web hiện tại:** `vps-snapshot/src/app/thukho/pallet/page.tsx` (158) + `new/page.tsx` (125) + `pallets/page.tsx` (364)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Dropdown "Liên kết phiếu nhập (PHN-…)"** trong form tạo — chỉ chọn supplier
- Preview mã pallet trước khi tạo (mockup hiện disabled `PL260506.012`)
- Hiển thị "số mã hàng" + "số dòng" riêng biệt (VPS chỉ có total_lines)
- Hiển thị vị trí `📍 A-03-02` trên card list
- Tabs status theo mockup (Đang xử lý/Đã xác nhận/Đã vào vị trí)
- **Lệch tên field giữa mobile (`receive_date`) và desktop (`inbound_date`)** — API contract risk

---

### UC-PAL-02 — Cập nhật chi tiết hàng
**Mockup:** line 1093-1210
**Web hiện tại:** `vps-snapshot/src/app/thukho/pallet/[id]/page.tsx` (391) + `pallets/[id]/page.tsx` (595)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Preview quy đổi tự động** "5 thùng × 24 chai = 120 chai · 66 kg"
- Trường "ĐVT lẻ (auto, disabled)"
- Quy cách + trọng lượng/thùng trên card item đã chọn (mobile thiếu hẳn)
- Stepper −/+ cho qty (chỉ input number thường)
- Hiển thị quy đổi trên list dòng (chỉ hiện qty_cartons thùng thô)
- Bắt required dynamic theo manage_lot/manage_expiry

**Khác biệt nghiêm trọng:**
- **Mobile dùng `qty_cartons`/`lot_number`, Desktop dùng `qty_box`/`lot`** — 2 page gọi cùng endpoint với body khác → high-risk bug

---

### UC-PAL-03 — Nhận diện mã hàng đa phương thức
**Mockup:** line 1211-1287
**Web hiện tại:** `vps-snapshot/src/components/BarcodeScanner.tsx` (459 dòng)
**Trạng thái:** ✅ Có nhưng UX khác

**Thiếu:**
- Mode "Ảnh" (chụp vỏ thùng + OCR/AI) — VPS không có
- Mode "Danh mục" tích hợp trong scanner (mockup có pill filter nhóm hàng)
- Màn success card sau quét (mockup có xác nhận với mã vạch + quy cách)

**Vượt mockup:** USB HID mode, continuous mode, recent scans

---

### UC-PAL-04 — Xác nhận Pallet
**Mockup:** line 1288-1366
**Web hiện tại:** Mobile `thukho/pallet/[id]` (line 305-342) + Desktop `pallets/[id]` (line 171-183)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Block tổng kết đầy đủ**: Tổng mã hàng (distinct) + Tổng SL đơn vị lẻ + Date gần nhất
- Checkbox "Tôi xác nhận đã kiểm đếm chính xác"
- Màn success animation riêng (icon ✓ to + button "Tạo pallet mới"/"Về danh sách")
- Push notification cho xe nâng

**Vấn đề:** Desktop dùng `window.confirm()` browser — UX rất tệ trên mobile

---

### UC-PAL-05 — Sửa Pallet sau xác nhận
**Mockup:** line 1369-1402
**Web hiện tại:** Mobile + Desktop trong `pallets/[id]` (line 548-583)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Dropdown "Lý do sửa" với 4 enum** (Sai SL / Sai lô-HSD / Sai mã / Khác)
- **Field "Người duyệt"** (approver) — workflow approval 2 cấp
- Tách "Lý do (category)" + "Mô tả chi tiết" (VPS gộp 1 textarea)

**Risk:** VPS không có **permission gate** UI button "Yêu cầu sửa" — mọi user thấy được

---

### UC-PAL-06 — Chi tiết Pallet + Lịch sử
**Mockup:** line 1406-1451
**Web hiện tại:** Desktop `pallets/[id]` (595) + Mobile `thukho/pallet/[id]` (391)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu nghiêm trọng:**
- **Vị trí hiện tại** (`location_code`) trên header — mockup hiển thị `📍 A-03-02` bold; VPS không bind
- **Liên kết Phiếu nhập (PHN)** trên header — VPS chỉ có supplier
- **SL đơn vị lẻ** trên card dòng (`240 chai`); VPS chỉ qty_cartons thùng
- Audit log thiếu event **MOVE/PLACED** với location
- Hiển thị **tên + role** người thao tác trong timeline ("Xe nâng: Hoàng Văn G")

---

# 3. INBOUND + INBOUND TEMP

### UC-IN-01 — Lập Phiếu yêu cầu nhập 🔥 CRITICAL
**Mockup:** line 1457-1538 (7 field + 3 tabs + drag-drop Excel)
**Web hiện tại:** `vps-snapshot/src/app/inbound/new/page.tsx` (**380 dòng** — phiên bản tối giản)
**Trạng thái:** ❌ **Thiếu nghiêm trọng (~30% khớp)**

**Thiếu HOÀN TOÀN:**
- **Mã phiếu (auto, disabled)** preview ở header
- **Loại nhập** (Nhập từ NCC / Hàng trả lại) — KHÔNG có field `import_type`
- **Kho nhận** — KHÔNG có select kho
- **Người tạo** display
- **3 pill tabs** chế độ tạo (Nhập tay / Up Excel / Up NCC lớn)
- **Banner drag-drop Excel inline** + nút Template
- **Cột "ĐVT"** trong bảng dòng
- **Hàng tổng** "Tổng dòng · Tổng SL" ở chân bảng

**Form VPS chỉ có 3 field:** NCC + Ngày dự kiến + Ghi chú (so với 7 field mockup)

---

### UC-IN-02 — Thủ kho tiếp nhận phiếu
**Mockup:** line 1539-1613
**Web hiện tại:** Mobile `thukho/inbound/page.tsx` (56) + Desktop `inbound/[id]/page.tsx` (1210)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Checklist 1 dòng "Khu vực dỡ hàng đã chuẩn bị"** (không bắt buộc)
- Warning banner "Chưa check vẫn được bấm Tiếp nhận"
- Detail mobile dành riêng cho Thủ kho (VPS dùng chung desktop)
- Card list mobile có nút "Tiếp nhận →" trên từng row
- Tabbar bottom mobile (Pallet/Phiếu nhập/Tồn/Tôi)
- Tổng số mã + tổng SL trên card (`3 mã · 920 đv`)
- Người tạo trên card

---

### UC-IN-03 — Đối chiếu Pallet với Phiếu
**Mockup:** line 1615-1657
**Web hiện tại:** Tab reconciling trong `inbound/[id]/page.tsx`
**Trạng thái:** ⚠️ Thiếu một phần (~45% khớp)

**Thiếu nghiêm trọng:**
- **Cột "Pallet"** trong bảng đối chiếu (mã pallet liên kết)
- **KPI "Pallet đã tạo"** (5, 3 XN + 2 đang đếm) — thiếu khái niệm Pallet
- **KPI "Mã tạm"** (1, Cần KT chuẩn hóa)
- **Khái niệm "Hàng phát sinh"** (thực nhận có mà PHN không có) + mã tạm `TMP-yymmdd-xxx`
- Trạng thái dòng theo phân loại: ✓ Đã khớp / Thiếu / Thừa / **Hàng phát sinh**
- % delta `−44 (−4.8%)`
- Nút "Yêu cầu kiểm lại"
- Nút "📤 Xuất Excel"

---

### UC-IN-04 — Kế toán chốt phiếu nhập
**Mockup:** line 1660-1702
**Web hiện tại:** `inbound/[id]/page.tsx` line 429-456 (handler đơn giản)
**Trạng thái:** ⚠️ Thiếu một phần (~40% khớp)

**Thiếu HOÀN TOÀN:**
- **Trang/section riêng "Chốt phiếu"** với UI dedicated
- **Block "ĐIỀU KIỆN CHỐT"** với 5 checklist (pallet xác nhận, pallet vào vị trí, mã tạm chuẩn hóa, chênh lệch xử lý, tổng nhập = tổng phân bổ)
- **Textarea ghi chú khi chốt** riêng cho action finalize
- **Dropdown "Quyết định với chênh lệch"** 3 lựa chọn (Chấp nhận / Yêu cầu kiểm lại / Tạo phiếu ADJ)
- **Nút "Đánh dấu Chưa khớp số"**

Hiện chỉ có button "Chốt phiếu nhập" + browser confirm() dialog

---

### UC-IN-05 — Theo dõi phiếu nhập
**Mockup:** line 1705-1792
**Web hiện tại:** `vps-snapshot/src/app/inbound/page.tsx` (436 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~65% khớp)

**Thiếu:**
- **Cột "Tiến độ" với Stepper 8 chấm tròn** (`done · done · active · pending`) + label `Chờ chốt số (7/8)`
- **Cột "SL nhập / yêu cầu"** dạng tỷ lệ `876/920` — VPS chỉ có "Dòng hàng" count
- **Filter chip "⚠ Có chênh lệch"** (màu đỏ)
- **8 status lifecycle** chi tiết — VPS chỉ 6 status

**Vượt mockup:** Search text, date range, ExcelExport, Active filter summary

---

### UC-IN-06 — Import Excel hàng về NCC
**Mockup:** line 1797-1971 (3 bước chi tiết)
**Web hiện tại:** `vps-snapshot/src/app/inbound/import/page.tsx` (488 dòng — 3 bước)
**Trạng thái:** ⚠️ Thiếu một phần (~50% khớp)

**Thiếu Bước 1:**
- **Field "Loại hàng về"** (Hàng U về / MASAN / Khác)
- **Field "Ngày đặt hàng"**
- **Field "Ngày dự kiến hàng về"** (VPS đặt nhầm ở Bước 3)
- **Link tải template**
- Banner xác nhận file `142 dòng · ngày đặt 5/6 · ngày về 5/7`

**Thiếu Bước 2:**
- **KPI "Tổng số thùng" + "Tổng tải trọng"** + ước tính xe
- **Cột "Trọng lượng (kg)"** trong bảng (không parse từ Excel)
- **Cột "BU"** (Business Unit: HC/BE/PC/F)
- **Pills filter** (Tất cả / Có mã / Cần tạo / Trùng)
- **Search input** "Tìm mã/tên"
- **Nút "+ Tạo mã"** inline từng dòng (modal tạo nhanh)
- **Nút "⚡ Tạo nhanh N mã"** + "Bỏ qua các mã chưa có"
- **Khái niệm "Trùng"** (1 mã NCC → ≥2 SKU)

**Thiếu Bước 3:**
- Banner success sau khi tạo
- Field "Nguồn dữ liệu" (link file Excel)
- **Bảng "Tóm tắt theo nhóm BU"** (HC/BE/PC/F)
- Nút "📤 Xuất phiếu PDF"

---

### UC-INTMP-01 — Tạo Phiếu nhập tạm 🔥 CRITICAL
**Mockup:** line 1977-2059
**Web hiện tại:** Desktop `inbound-adhoc/new/page.tsx` (72) + Mobile `thukho/adhoc/new/page.tsx` (40)
**Trạng thái:** ❌ **Thiếu nghiêm trọng (~25% khớp)**

**Thiếu 6/8 field BẮT BUỘC:**
- **Mã phiếu PNT** preview ở header
- **Nguồn hàng** (Nhà cung cấp / Hàng trả lại / Khác) — bắt buộc
- **Người giao** (text)
- **Ngày giờ nhận** (datetime-local) — bắt buộc
- **Lý do nhập đột xuất** với 5 options — **BẮT BUỘC** (mockup nhấn mạnh)
- **Upload ảnh chứng từ** (3 ô)
- Banner cảnh báo cam "Nhập đột xuất"
- Section "PALLET (1)" với card pallet
- Nút "+ Tạo pallet mới" + "Gửi cho Kế toán xử lý →"

**Hiện chỉ có 2 field:** supplier_id (tùy chọn) + note

---

### UC-INTMP-02 — Chuẩn hóa phiếu tạm
**Mockup:** line 2062-2145 (3 bước trên 1 màn)
**Web hiện tại:** `vps-snapshot/src/app/inbound-adhoc/[id]/page.tsx` (366 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~50% khớp)

**Thiếu HOÀN TOÀN:**
- **Layout 2-column** với sticky progress sidebar phải
- **Bước 1 "Kiểm tra nguồn hàng"** — không có Người giao, Ngày giờ, Ảnh
- **Button "+ Tạo NCC mới từ thông tin này"**
- **Bước 2 — Cột "Mã chuẩn" với select inline** mỗi dòng + nút "Chuẩn hóa →" từng dòng
- **Bước 3 — Radio** "Liên kết phiếu có sẵn" vs "Tạo mới hồi tố"
- **Sidebar tiến độ** 4 mục

Hiện chỉ có 1 button "Chuẩn hóa → Phiếu nhập" gộp tất cả

---

### UC-INTMP-03 — Theo dõi tồn tạm
**Mockup:** line 2148-2174
**Web hiện tại:** `vps-snapshot/src/app/inbound-adhoc/page.tsx` (183 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~55% khớp)

**Thiếu:**
- **KPI "⚠ Quá hạn (>3 ngày)"** màu đỏ
- **Cột "Mã tạm"** (TMP-260503-001) riêng
- **Cột "Số ngày tồn"** + logic tính tuổi
- **Status phân loại theo tuổi** (Quá hạn/Sắp quá/Mới)
- Granularity: mockup 1 row = 1 mã tạm; VPS 1 row = 1 phiếu

---

# 4. FORKLIFT + OUTBOUND

## 🚜 FORKLIFT

### UC-FK-01 — DS Pallet chờ xếp
**Mockup:** line 2180-2262 (mobile cam #ea580c)
**Web hiện tại:** `forklift/page.tsx` (16) + `ForkliftMobileDashboard.tsx` (264) + `forklift/pallet/page.tsx` (322)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Tổng số đơn vị (đv)** trên card (chỉ có total_lines + kg)
- **Date gần nhất / HSD sớm nhất** highlight cảnh báo
- **Pill 3 nhóm việc** (Vào vị trí / Luân chuyển / Sang chờ xuất)
- **Mã phiếu nhập** (PHN) trong meta card
- **Tab bar dưới 4 tab** cố định mobile
- **Màn chi tiết pallet đọc-only** với banner "🔒 Đọc-only" + nút "🚜 Bắt đầu đưa vào vị trí"
- **Topbar màu cam #ea580c** đặc trưng xe nâng

VPS có thêm: cảnh báo FEFO hard-code, mini map, activity timeline mock — KHÔNG có trong mockup

---

### UC-FK-02 — Đưa Pallet vào vị trí
**Mockup:** line 2265-2334 (2 màn)
**Web hiện tại:** `vps-snapshot/src/app/forklift/put-away/page.tsx` (137 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Wizard 2 bước** rõ ràng (Bước 1 chọn vị trí, Bước 2 xác nhận)
- **"VỊ TRÍ TRỐNG GỢI Ý"** sắp xếp theo "Gần nhất"
- **Banner cảnh báo nghiệp vụ** trên màn xác nhận
- Icon "📦 → 📍" layout trực quan
- Hiển thị **số đv/chai** của pallet
- Mã vị trí dạng full text "Dãy A · Kệ 03 · Ô 01"

---

### UC-FK-03 — Chuyển vị trí pallet
**Mockup:** line 2337-2377
**Web hiện tại:** `vps-snapshot/src/app/forklift/relocate/page.tsx` (113 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Trường "Lý do" với 4 preset** (Sắp xếp lại / Gom lô / Giải phóng / Khác)
- **Banner "🔒 Khóa nội dung"** cảnh báo
- Hiển thị **mã hàng + SL chai/đv** của pallet nguồn (chỉ hiện location)
- Quét QR cho pallet nguồn

---

### UC-FK-04 — Chuyển sang Khu chờ xuất (FEFO) 🔥
**Mockup:** line 2380-2480 (2 màn, TH-A + TH-B)
**Web hiện tại:** `vps-snapshot/src/app/forklift/stage-out/page.tsx` (186 dòng)
**Trạng thái:** ⚠️ Thiếu một phần — **thiếu hẳn TH-B**

**Thiếu CRITICAL:**
- **TH-B "Rút một phần"** với input số lượng + stepper +/− — VPS chỉ làm TH-A nguyên pallet
- **Rank "Ưu tiên 1/2/3"** rõ ràng (VPS dùng badge critical/warning/normal)
- **Banner FEFO** giải thích
- **Card highlight viền đỏ** cho ưu tiên 1
- **Tính/hiển thị "SL còn lại sau rút"** trên màn xác nhận
- **Banner "Xuất kho tương đối"**
- API stage-out cần nhận thêm `qty` khi TH-B

---

### UC-FK-05 — Trả về vị trí (Audit) 🔥🔥 CRITICAL
**Mockup:** line 2483-2540 (form audit log đầy đủ)
**Web hiện tại:** `vps-snapshot/src/app/forklift/return/page.tsx` (261 dòng)
**Trạng thái:** ❌ **Thiếu hoàn toàn — sai bản chất UC**

**Thiếu HOÀN TOÀN:**
- **Toàn bộ section "CẬP NHẬT NỘI DUNG"** — không có UI sửa Mã/SL/Lô/HSD (đây là **luồng DUY NHẤT cho phép sửa**)
- **Banner "Quyền đặc biệt — DUY NHẤT cho phép sửa"**
- **Tự tính chênh lệch SL** ("Đã xuất 60 chai")
- **Dropdown 4 preset lý do** (Đã xuất một phần / Đổi pallet / Phát hiện sai / Khác)
- Tách "Lý do (select)" + "Mô tả chi tiết (textarea)"
- Permission check role

Hiện code chỉ làm "di chuyển pallet từ staging về kho" — KHÔNG phải UC-FK-05 đúng nghĩa

---

### UC-FK-06 — Lịch sử luân chuyển
**Mockup:** line 2543-2581 (bảng web 9 cột)
**Web hiện tại:** `vps-snapshot/src/app/forklift/history/page.tsx` (119 dòng — timeline)
**Trạng thái:** ⚠️ Thiếu một phần — UI khác hẳn

**Thiếu:**
- **Cột Mã hàng, Lô/Date, SL, Người thực hiện** (VPS không hiển thị)
- **Search text** "Mã pallet, mã hàng"
- **Nút Xuất Excel**
- **View dạng bảng tabular** (thay cho timeline)

---

## 📤 OUTBOUND

### UC-OUT-01 — Xem khu chờ xuất
**Mockup:** line 2587-2622
**Web hiện tại:** `vps-snapshot/src/app/outbound/page.tsx` (147 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **KPI "⚠ Quá 24h"** màu đỏ — KHÔNG cảnh báo theo ngưỡng giờ
- **KPI "Tổng mã"** (đếm distinct SKU)
- **Cột "Lô"** riêng trong bảng
- **Cột "Tên hàng"** riêng (VPS gộp "Hàng hóa")
- **Nút "Xuất Excel"**, **Nút "🔍 Lọc"**
- **Tô đỏ HSD cận date + thời gian chờ >12h**
- Nút "Cân lại tồn" làm thành **nút primary lớn** (UC-OUT-05)

---

### UC-OUT-05 — Cân lại tồn khu chờ xuất 🔥🔥 CRITICAL ★ Mới hoàn toàn
**Mockup:** line 2625-2759 (2 cách upload)
**Web hiện tại:** `vps-snapshot/src/app/outbound/rebalance/page.tsx` (139 dòng)
**Trạng thái:** ❌ **Thiếu hoàn toàn — đi sai hướng**

**Thiếu HOÀN TOÀN cách 1 (Upload Excel):**
- Upload file Excel
- Template download
- Date picker
- **Preview đối chiếu** (parse file → so tồn → cảnh báo SL vượt)
- Trạng thái "✓ Xuất hết — gỡ pallet" trên từng dòng
- Banner giải thích nghiệp vụ
- Button Confirm/Hold/Cancel

**Thiếu HOÀN TOÀN cách 2 (Phiếu yêu cầu xuất - PYX):**
- **Entity Phiếu yêu cầu xuất (PYX)** — không có CRUD
- Route `/staging-out/outbound-requests` chưa tồn tại
- Trường: Mã PYX, Khách/NCC, Ngày xuất, Người tạo/nhận
- Workflow: Chờ xuất → Đang lấy hàng → Đã xuất

VPS chỉ có form 1 bảng nhập tay từng dòng SL — chỉ phù hợp <10 dòng

---

### UC-OUT-02 — Báo cáo xuất tương đối
**Mockup:** line 2762-2821 (2 chart)
**Web hiện tại:** `vps-snapshot/src/app/outbound/report/page.tsx` (118 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **2 chart** (bar Top 5 + horizontal Theo nhóm hàng)
- **Cột "Nhóm hàng"**
- **Cột "Bình quân/lần"** (SL/số lần)
- **Filter theo tháng** preset
- **Filter theo nhóm hàng**
- **Nút Xuất Excel**

---

### UC-OUT-03 — Tốc độ luân chuyển
**Mockup:** line 2824-2846
**Web hiện tại:** `vps-snapshot/src/app/outbound/turnover/page.tsx` (92 dòng)
**Trạng thái:** ⚠️ Thiếu một phần

**Thiếu:**
- **Cột "Bình quân xuất/ngày"** (qty_out / period_days)
- **Cột "Ngày tồn dự kiến"** (current_stock / avg_per_day)

**Vượt mockup:** Filter period 7/14/30/60/90 ngày, 4 mức phân loại (thêm "Đóng băng")

---

### UC-OUT-04 — Gợi ý nhập hàng
**Mockup:** line 2850-2879
**Web hiện tại:** `vps-snapshot/src/app/outbound/reorder/page.tsx` (83 dòng)
**Trạng thái:** ❌ **Thiếu hoàn toàn logic** — sai hướng

**Thiếu CRITICAL:**
- **Input "Số ngày dự trữ"** + nút "Tính lại"
- **Cột "BQ xuất/ngày"** (cần lịch sử)
- **Cột "Nhu cầu N ngày"** (BQ × ngày)
- **Logic gợi ý = Nhu cầu − Tồn** (VPS dùng `min_stock` − current — sai)
- **Bulk select** + nút "Tạo phiếu yêu cầu nhập từ gợi ý"
- **Cảnh báo phân loại** (Đủ tồn/Sắp thiếu/Thiếu nhiều/Bán chậm)
- Pre-fill mã + SL vào form `/inbound/new` khi tạo phiếu

VPS dùng `min_stock` tĩnh; mockup dùng forecast theo lịch sử — 2 hướng nghiệp vụ khác

---

# 5. INVENTORY + DASHBOARD

## 📊 INVENTORY

### UC-INV-01 — Tồn theo Mã hàng
**Mockup:** line 2887-2983
**Web hiện tại:** `vps-snapshot/src/app/inventory/page.tsx` (103 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~40% khớp)

**Thiếu:**
- **Panel "🚨 Cận date theo vị trí"** mặc định mở khi vào màn
- **KPI 4 ô** (Tổng SKU / Khả dụng / Đang chờ / **Hết hàng**) — VPS chỉ 3 KPI
- **Cột "Nhóm hàng"** + **"ĐVT"** + **"Tồn min/max"**
- **Filter "Nhóm" và "Trạng thái"**
- **Nút "Chi tiết →"** mở drill-down `/inventory/by-sku/{code}/locations` (🚫 chưa có)
- Badge "Dưới min" / "Vượt max"

---

### UC-INV-02 — Tồn theo Vị trí
**Mockup:** line 2985-3030
**Web hiện tại:** `vps-snapshot/src/app/inventory/by-location/page.tsx` (88 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~50% khớp)

**Thiếu:**
- **Input tra cứu trực tiếp mã vị trí**
- **Nút Excel export**
- **Bảng pallet chi tiết** với cột Lô/NSX/HSD/SL còn/Trạng thái
- **Nút "✏ Sửa số tồn"** mở UC-INV-09 prefill
- **Sơ đồ kệ riêng** (theo Khu+Kệ)
- Màu "HSD warning" và "Khóa" riêng

---

### UC-INV-03 — Tồn theo Pallet
**Mockup:** line 3032-3062
**Web hiện tại:** `vps-snapshot/src/app/inventory/by-pallet/page.tsx` (59 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~35% khớp)

**Thiếu:**
- Toàn bộ thanh filter (search/trạng thái/date/Excel)
- Cột "Ngày tạo", "Số dòng", "Tổng SL gốc/còn", **"Phiếu nguồn"**
- Filter 4 trạng thái (chỉ fetch IN_STORAGE + IN_STAGING)

---

### UC-INV-04 — Báo cáo FEFO toàn kho
**Mockup:** line 3064-3101
**Web hiện tại:** `vps-snapshot/src/app/inventory/by-lot/page.tsx` (55 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~50% khớp)

**Thiếu:**
- Filter search + select cấp cảnh báo + Excel
- **KPI 3 ô** (🔴 / 🟡 / 🟢) với "X lô · SL: Y"
- Cột "NSX", "Vị trí"
- Highlight nền dòng theo urgency

---

### UC-INV-05 — Cảnh báo HSD & Tồn thấp
**Mockup:** line 3104-3178
**Web hiện tại:** `vps-snapshot/src/app/inventory/alerts/page.tsx` (93 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~45% khớp)

**Thiếu:**
- **Hộp "Vượt max"** (KPI thứ 4)
- **Hộp "Hàng tồn lâu — cận date xa nhất theo vị trí"** + báo cáo riêng
- Trị giá ước (~triệu VND) trong KPI
- Nút action trong KPI ("Tạo gợi ý nhập")
- Hành động "Đề xuất xuất" từng dòng
- **Bảng cấu hình gửi mail tự động** (5 loại + tần suất + người nhận + on/off)

---

### UC-INV-06 — Kiểm kê theo Vị trí (mobile)
**Mockup:** line 3187-3266 (3 bước)
**Web hiện tại:** `kiemke/scan/page.tsx` (103) + `kiemke/tasks/[id]/page.tsx` (170) + `stock-count/[id]/page.tsx` (126)
**Trạng thái:** ⚠️ Thiếu một phần (~50% khớp)

**Thiếu:**
- **Camera scanner UI** thật (chỉ có icon static)
- **Form xác nhận Lô + HSD** riêng từng dòng
- **Nút "+ Thêm pallet ngoài hệ thống"**
- **Nút "📷 Chụp ảnh hiện trường"**
- **Blind count toggle**
- Trang `kiemke/scan` **chưa thật sự lưu API** (setSaved giả lập)
- Wizard 3 bước rõ ràng (UI dồn 2)

---

### UC-INV-07 — Kiểm kê theo Mã hàng
**Mockup:** line 3268-3303
**Web hiện tại:** `stock-count/[id]/page.tsx` xử lý BY_ITEM chung
**Trạng thái:** ⚠️ Thiếu một phần (~30% khớp)

**Thiếu:**
- Trang riêng `/stocktake/by-sku` với SKU header
- Cột **Vị trí · Pallet · Lô · HSD · Người KK · Trạng thái**
- **Cảnh báo highlight dòng STAGING-OUT**
- Nút "Tạo phiếu xử lý chênh lệch" + "Xuất biên bản"
- KPI "Tiến độ vị trí (8/8)"

---

### UC-INV-08 — Xử lý chênh lệch kiểm kê
**Mockup:** line 3306-3354
**Web hiện tại:** 🚫 **KHÔNG có trang riêng**
**Trạng thái:** 🚫 **Thiếu HOÀN TOÀN trang/route**

**Thiếu HOÀN TOÀN:**
- Trang `/stocktake/discrepancy/{stk_code}` chuyên biệt
- Header phiên thông tin tổng hợp
- KPI 4 ô (Khớp / Có chênh / Đã xử lý / Còn chờ)
- Bảng 9 cột với nút "✓ Chấp nhận" / "↻ Kiểm lại" từng dòng
- Cột "Ghi chú KK" hiển thị từ phiên trước
- Liên kết tự sinh ADJ từ phiên kiểm STK

---

### UC-INV-09 — Phiếu điều chỉnh tồn
**Mockup:** line 3355-3424 (quy trình 5 bước)
**Web hiện tại:** `inventory/adjustments/page.tsx` (192) + `[id]/page.tsx` (226)
**Trạng thái:** ⚠️ Thiếu một phần (~40% khớp)

**Thiếu:**
- **Trang tạo phiếu mới `/inventory/adjustments/new`** — chưa có route
- Form header: **Loại điều chỉnh** (select) + **Lý do** (dropdown) + **Tham chiếu STK** (input)
- Bảng dòng input edit + nút "Lưu" từng dòng + nút "+ Thêm dòng"
- **Cột Pallet · Vị trí · Lô** trong bảng dòng (schema line thiếu liên kết)
- Nút "Lưu nháp" / "Gửi duyệt" (2 nút riêng — code chỉ có Approve/Reject)
- Timeline lịch sử duyệt 2 cấp
- Block ghi chú quy trình 5 bước

---

## 📈 DASHBOARD

### UC-DASH-01 — Dashboard theo vai trò
**Mockup:** line 3433-3585 (4 role)
**Web hiện tại:**
- Kế toán: `page.tsx` (399)
- Thủ kho: `thukho/page.tsx` → `ThukhoMobileDashboard.tsx`
- Xe nâng: `forklift/page.tsx` → `ForkliftMobileDashboard.tsx`
- Kiểm kê: `kiemke/page.tsx`

**Trạng thái:** ⚠️ Thiếu một phần (~55% khớp)

**Thiếu theo từng role:**

**Kế toán:**
- KPI đúng spec: Phiếu nhập đang xử lý / Tồn tạm chờ chuẩn hóa / **Phiếu lệch SL** / **Phiếu điều chỉnh chờ duyệt**
- Panel "Cảnh báo HSD/Tồn thấp" gộp 3 dòng + Panel "Phiếu vừa cập nhật"

**Thủ kho:**
- KPI "Hoàn tất hôm nay", "Lệch SL"
- Greeting card gradient cá nhân
- **Tabbar 4 tab** (Trang chủ / Nhập / Pallet / Tôi)

**Xe nâng:**
- KPI "Yêu cầu di chuyển" / "Yêu cầu xuất tương đối" / "Hoàn trả vị trí" (4 KPI riêng cho từng loại task)

**Kiểm kê:**
- Greeting card gradient cá nhân "Đợt kiểm kê hôm nay"
- **Card session với progress bar** (92/142 vị trí)
- Section "Vị trí được giao" theo Khu/Kệ

---

### UC-DASH-02 — KPI tổng quan (Quản lý)
**Mockup:** line 3587-3651
**Web hiện tại:** `vps-snapshot/src/app/dashboard/page.tsx` (96 dòng)
**Trạng thái:** ⚠️ Thiếu một phần (~30% khớp)

**Thiếu HOÀN TOÀN:**
- **Bar chart "Tồn theo nhóm hàng"** (cần API group-by category)
- **Bảng "Top mã xuất tương đối"** (top 5)
- **Panel "Cảnh báo HSD"** 3 mức (≤7d / ≤30d / >30d)
- **Panel "Phiếu chờ xử lý"** 5 dòng tổng hợp
- **Filter kỳ "Tháng/Tuần/Hôm nay"** (code dùng 7/30/90 ngày)
- KPI "Pallet đang dùng / 240 vị trí" số tuyệt đối

VPS thiên về navigation links + KPI flat; mockup thiên về analytics charts

---

# 📌 PHỤ LỤC: BẢNG TỔNG HỢP

## Bảng đếm gap theo nhóm

| Nhóm | Tổng UC | ✅ | ⚠️ | ❌ | 🚫 |
|---|---|---|---|---|---|
| Auth | 4 | 2 | 1 | 0 | 0 (1 cần confirm OTP vs link) |
| Master Data | 5 | 1 | 4 | 0 | 0 |
| System | 5 | 0 | 3 | 2 | 0 |
| Integration | 3 | 1 | 1 | 1 | 0 |
| Pallet | 6 | 0 | 6 | 0 | 0 |
| Inbound | 6 | 0 | 4 | 2 | 0 |
| Inbound Temp | 3 | 0 | 1 | 1 | 0 (INTMP-01 critical) |
| Forklift | 6 | 0 | 4 | 1 | 0 (FK-05 sai bản chất) |
| Outbound | 5 | 0 | 3 | 2 | 0 (OUT-04, OUT-05) |
| Inventory | 9 | 0 | 7 | 0 | 1 (INV-08 chưa có) + 1 sub-page chưa có (INV-01 drill-down) |
| Dashboard | 2 | 0 | 2 | 0 | 0 |

**Tổng:** 53 UC — ~5 ✅, ~36 ⚠️, ~9 ❌, ~1 🚫

## Trang chưa tồn tại (cần tạo mới)

1. `/inventory/by-sku/[code]/locations` — drill-down UC-INV-01
2. `/stocktake/discrepancy/[id]` — UC-INV-08 xử lý chênh lệch
3. `/inventory/adjustments/new` — UC-INV-09 tạo phiếu mới
4. `/staging-out/outbound-requests/*` — UC-OUT-05 cách 2 (PYX entity)

## Field DB cần thêm (P0.DB.01 đã thêm phần lớn — verify)

✅ Đã thêm trong Phase 0:
- `pallets.inbound_request_id`, `pallets.created_by` (P1.PAL.01-02)
- `users.username`, `users.must_change_password`, `users.avatar_url` (P5.SYS.03-05)
- `product_groups.code`, `units_of_measure.code` (P5.MD.01)
- `OutboundRequest` + `OutboundRebalance` entity (P3.OUT.01-02)
- `MailSettings` + `MailLog` (P5.SYS.02)
- `AlertSetting` (P4.INV.01)
- `LocationStatus` enum PARTIAL + NEEDS_CHECK (P5.MD.03)
- `inbound_temps.source_type/delivered_by/received_at/reason/photo_urls` (P2.INTMP.01)
- `inbound_requests.prep_zone_ready/discrepancy_decision/source_file_*` (P2.IN.04-06)
- `movements.item_code_id/qty_box/qty_unit/lot/expiry_date/mode/reason_code/audit_log_id` (P3.FK.01-02)
- `adjustment_*` thêm type/reason_code/pallet/lot (P3.INV.01)

🔴 Còn thiếu (cần thêm Phase 1):
- `Pallet.location` history audit log event (UC-PAL-06)
- Audit log `actor_id`/`role`/`ip`/`user_agent` (UC-SYS-03)
- `min_stock`/`max_stock` per item code (UC-INV-05) — đã có ở Product nhưng có cần ở ItemCode không?

## Workflow lệch hoàn toàn (cần thiết kế lại)

| UC | Vấn đề | Khuyến nghị |
|---|---|---|
| UC-AUTH-04 | OTP (VPS) vs Email link (mockup) | Confirm PO chọn workflow |
| UC-IN-04 | Thiếu UI điều kiện chốt + quyết định chênh lệch | Build modal/page riêng |
| UC-FK-05 | Code chỉ trả vị trí, không cho sửa nội dung — **sai bản chất** | **Rebuild hoàn toàn** form audit |
| UC-FK-04 | Chỉ TH-A nguyên pallet, thiếu TH-B một phần | Thêm radio + split pallet logic |
| UC-OUT-05 | Thiếu cả 2 cách (file + PYX); chỉ nhập tay | **Build mới** 2 modules |
| UC-OUT-04 | Logic `min_stock` tĩnh, mockup yêu cầu forecast | Đổi API + UI |
| UC-INTMP-01 | Form chỉ 2/8 field | Bổ sung 6 field BẮT BUỘC |
| UC-INTMP-02 | Workflow 3 bước → code 1 nút | Redesign 3-step page |
| UC-INV-08 | 🚫 Chưa có trang | Build mới hoàn toàn |
| UC-INV-09 | Chưa có trang tạo mới | Build `/new` + bảng inline edit |
| UC-INT-03 | Modal cấu hình (mockup) vs 1-click (VPS) | Refactor component |

## So sánh báo cáo CŨ vs MỚI

| UC | Báo cáo CŨ (đối chiếu local) | Báo cáo MỚI (đối chiếu VPS) | Chênh lệch |
|---|---|---|---|
| UC-IN-01 | ⚠️ "Đã redesign khá khớp" | ❌ "Thiếu nghiêm trọng (~30%)" | **Sai nghiêm trọng** |
| UC-INTMP-01 | ❌ "Thiếu nhiều field BẮT BUỘC" | ❌ Đúng (~25%) | Khớp |
| UC-FK-05 | ❌ "Code chỉ trả vị trí" | ❌ Đúng | Khớp |
| UC-FK-04 | ❌ "Thiếu TH-B" | ❌ Đúng | Khớp |
| UC-OUT-05 | ❌ "Thiếu 2 cách" | ❌ Đúng | Khớp |
| UC-IN-05 | ⚠️ "Thiếu stepper" | ⚠️ Khớp (~65%) | Khớp |

Báo cáo MỚI khác CŨ chủ yếu ở UC-IN-01 + một số UC khác mà tôi tưởng đã khớp local nhưng thực ra VPS có version cũ hơn.

---

# 🎯 LỘ TRÌNH FIX (cập nhật theo gap chính xác)

So với `LO_TRINH_FIX_GAP_DETAILED.md` cũ, cần thay đổi ưu tiên:

**P1 (ưu tiên cao nhất — fix ngay):**
- UC-IN-01 — Bổ sung toàn bộ 4 field thiếu + 3 tabs + drag-drop Excel + cột ĐVT
- UC-INTMP-01 — Bổ sung 6 field BẮT BUỘC
- UC-INV-08 — Tạo trang mới hoàn toàn

**P2 (CRITICAL workflow):**
- UC-FK-05 — Rebuild form audit cho phép sửa nội dung
- UC-FK-04 — Thêm TH-B rút một phần
- UC-OUT-05 — Build 2 cách (file + PYX)
- UC-INV-09 — Tạo trang `/new` + form đầy đủ

**P3 (báo cáo + dashboard):**
- UC-INV-09 các cột thiếu
- UC-DASH-02 charts + bảng top
- UC-OUT-04 logic forecast
- UC-OUT-02 charts

**P4 (polish):**
- UC-SYS-01 logo/favicon/hotline
- UC-INT-03 modal cấu hình
- UC-MD-03 bảng đơn vị tính
- ...

---

**HẾT BÁO CÁO.** Đây là báo cáo chính xác dựa trên code VPS thực tế ngày 2026-05-25.

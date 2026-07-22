# 📋 BÁO CÁO GAP — MOCKUP vs GIAO DIỆN WEB HIỆN TẠI

> **Ngày tổng hợp:** 2026-05-25
> **Nguồn mockup:** `wms_mockups_4.html` (53 màn theo 53 UC)
> **Nguồn code:** `D:\wms-vinhgiang_repo\src\app\` + `D:\wms-vinhgiang_repo\src\components\`
> **Phạm vi:** Đối chiếu **trường (field)**, **cột bảng**, **button/action**, **workflow** — KHÔNG đối chiếu style/UI.

---

## 🎯 TÓM TẮT EXECUTIVE

| Trạng thái | Ý nghĩa | Số UC |
|---|---|---|
| ✅ Đầy đủ / vượt mockup | Code có đủ field/action mockup yêu cầu | ~13 |
| ⚠️ Thiếu một phần | Có trang nhưng thiếu vài field hoặc khác workflow | ~30 |
| ❌ Thiếu nghiêm trọng | Khác hẳn workflow, thiếu nhiều field cốt lõi | ~9 |
| 🚫 Chưa có trang | Folder code chưa tồn tại | 1 (`/inventory/by-sku/[code]/locations`) |

**Top 10 ưu tiên cần làm trước (ảnh hưởng nghiệp vụ lớn nhất):**

1. **UC-OUT-05** — Thiếu hẳn 2 cách nhập (Up file SL xuất + Up phiếu yêu cầu xuất); code mới chỉ có manual entry.
2. **UC-FK-05** — Code KHÔNG cho phép sửa nội dung (Mã/SL/Lô/HSD), chỉ trả vị trí — sai bản chất UC.
3. **UC-FK-04** — Thiếu TH-B "Rút một phần" (PARTIAL), chỉ rút nguyên pallet.
4. **UC-INTMP-01** — Thiếu field BẮT BUỘC: Lý do, Người giao, Ngày giờ nhận, Ảnh chứng từ.
5. **UC-INTMP-02** — Thiếu workflow 3 bước chuẩn hóa (KT nguồn → Map mã → Tạo PHN); chỉ có 1 nút.
6. **UC-IN-04** — Thiếu UI điều kiện chốt 5 dòng + dropdown quyết định chênh lệch.
7. **UC-IN-06** — Thiếu nhiều field meta (Loại hàng, Ngày đặt, BU), thiếu tải template, thiếu xuất PDF, thiếu xử lý mã trùng.
8. **UC-INV-09** — Chưa có trang tạo phiếu mới; thiếu cột Pallet/Vị trí/Lô trong bảng dòng.
9. **UC-INV-06** — Thiếu camera QR thực, blind count, chụp ảnh hiện trường, thêm pallet ngoài hệ thống.
10. **UC-SYS-01** — Thiếu logo/favicon/hotline/email hỗ trợ/văn bản chân trang.

---

## 📑 MỤC LỤC

1. [AUTH + MASTER DATA + SYSTEM + INTEGRATION](#1-auth--master-data--system--integration) (17 UC)
2. [PALLET](#2-pallet) (6 UC)
3. [INBOUND + INBOUND TEMP](#3-inbound--inbound-temp) (9 UC)
4. [FORKLIFT + OUTBOUND](#4-forklift--outbound) (11 UC)
5. [INVENTORY + DASHBOARD](#5-inventory--dashboard) (11 UC)

---

# 1. AUTH + MASTER DATA + SYSTEM + INTEGRATION

## 🔐 AUTH (UC-AUTH-01..05)

### UC-AUTH-01 — Đăng nhập
**Mockup:** `wms.vinhgiang.com/auth` (line 390-450)
**Web hiện tại:** `src/app/auth/page.tsx`
**Trạng thái:** ✅ Đầy đủ (có khác biệt nhỏ)

**Trường thiếu:**
- Footer phiên bản `v3.0 · © Vĩnh Giang` — code không hiển thị version footer.

**Trường khác biệt:**
- Mockup label `Email hoặc Số điện thoại` (placeholder `vd: thukho01@vinhgiang.com`); code dùng `TÊN ĐĂNG NHẬP` với placeholder `Nhập tên đăng nhập hoặc mã NV`. Backend dùng `identifier` (chấp nhận cả 2) — cơ chế đúng nhưng tên hiển thị sai mockup.

**Chức năng thiếu:**
- Không có màn "Chuyển hướng theo vai trò" độc lập (mockup yêu cầu welcome screen "Vào Dashboard Thủ kho"); code redirect ngầm.

---

### UC-AUTH-03 — Đổi mật khẩu
**Mockup:** `wms.vinhgiang.com/system/change-password` (line 451-484)
**Web hiện tại:** `src/app/system/change-password/page.tsx`
**Trạng thái:** ✅ Đầy đủ (vượt mockup)

**Khác biệt:**
- Code có thêm panel "Phiên đăng nhập" và "Yêu cầu bảo mật" — bonus.
- Mockup yêu cầu hint text "Mật khẩu mới phải có ít nhất 8 ký tự, gồm chữ và số." — code không có dòng mô tả ngắn ở đầu form.

---

### UC-AUTH-04 — Quên mật khẩu
**Mockup:** `wms.vinhgiang.com/auth/forgot-password` (line 485-542) — 3 bước Email → Mail đã gửi → Đặt MK mới
**Web hiện tại:** `src/app/auth/forgot-password/page.tsx`
**Trạng thái:** ❌ Khác biệt nghiêm trọng về luồng

**Khác biệt:**
- Mockup dùng **gửi link reset qua email** (bước 2 = "Kiểm tra email"); code dùng **OTP 6 chữ số** (bước 2 nhập OTP). Hai cơ chế hoàn toàn khác nhau.
- Mockup không có trường OTP, không có countdown, không có "lượt thử"; code có đầy đủ.

**Ghi chú:** Cần xác nhận với PO mockup nào là chuẩn cuối cùng (OTP vs email-link).

---

### UC-AUTH-05 — Phân quyền RBAC
**Mockup:** `wms.vinhgiang.com/admin/rbac` (line 543-602)
**Web hiện tại:** `src/app/system/rbac/page.tsx`
**Trạng thái:** ⚠️ Thiếu một phần

**Trường thiếu:**
- Mockup hỗ trợ 4 mức quyền: `Có` / `Giới hạn` / `Đề xuất` / `Không` / `Đặc biệt`; code chỉ có **checkbox boolean** (Có/Không) — **thiếu mức "Giới hạn", "Đề xuất", "Đặc biệt"**.
- Cột "Chức năng" mockup liệt kê 9 chức năng nghiệp vụ; code dynamic — không rõ có đủ 9 không.

**Chức năng thiếu:**
- `+ Tạo vai trò` (code hardcoded 5 role).
- `📤 Xuất Excel` ma trận phân quyền.
- `🔄 Khôi phục mặc định`.

---

## 📚 MASTER DATA (UC-MD-01..06)

### UC-MD-01 — Khai báo sản phẩm
**Mockup:** `wms.vinhgiang.com/master-data/products` (line 603-737)
**Web hiện tại:** `src/app/master-data/page.tsx`
**Trạng thái:** ✅ Đầy đủ (vượt mockup)

**Trường thiếu (cột bảng):**
- Cột `KL/thùng` và `TT/thùng` — mockup hiển thị trong bảng, code chỉ có trong form chi tiết.

**Trường khác biệt:**
- Mockup `Trạng thái` có 4 giá trị (Đang dùng / Tạm khóa / Ngừng dùng / Chờ hoàn thiện); code chỉ có 2 (`active`/`inactive`) — **thiếu "Tạm khóa", "Chờ hoàn thiện"**.
- Code có thêm `min_stock`, `max_stock` — bonus.

**Chức năng thiếu:**
- Checkbox chọn nhiều (bulk action).

---

### UC-MD-02 — Quản lý Mã hàng
**Mockup:** `wms.vinhgiang.com/master-data/skus` (line 738-820)
**Web hiện tại:** `src/app/item-codes/page.tsx`
**Trạng thái:** ✅ Đầy đủ (rất tốt)

**Trường thiếu:**
- Form mobile (Thủ kho): trường `Đơn vị quy đổi` (mặc định "Thùng", disabled) — code không có.
- Form mobile: trường `Ảnh hàng / vỏ thùng` (upload ảnh) — code **không có upload ảnh** dù DB có `photo_url`.

**Trường khác biệt:**
- Mockup tab có 3: `Chờ xử lý` / `Đã chuẩn hóa` / `Đã hủy`; code chỉ 2 — **thiếu tab "Đã hủy"**.
- **Thiếu cột "Người tạo"** và **cột "ĐV quy đổi"** trong bảng.

---

### UC-MD-03 — Nhóm hàng & Đơn vị tính
**Mockup:** `wms.vinhgiang.com/master-data/groups` (line 823-910) — gộp 2 bảng + khu Upload Excel
**Web hiện tại:** `src/app/product-groups/page.tsx`
**Trạng thái:** ❌ Thiếu nghiêm trọng

**Trường thiếu:**
- **Bảng Đơn vị tính** — code chỉ có Nhóm hàng (mockup yêu cầu gộp 2 bảng trên cùng trang).
- **Khu Upload Excel hàng loạt** với dropdown chọn loại dữ liệu (SP/Nhóm/ĐVT/NCC), nút `Tải template`, nút `Chọn file Excel`, thống kê (`X hợp lệ`, `Y trùng mã`, `Z lỗi`).
- Cột `Mã` (NH-01, NH-02...) — code chỉ có UUID.

**Chức năng thiếu:**
- Nút `📥 Import` riêng cho Nhóm/ĐVT.

---

### UC-MD-05 — Vị trí kho
**Mockup:** `wms.vinhgiang.com/master-data/locations` (line 911-977)
**Web hiện tại:** `src/app/locations/page.tsx`
**Trạng thái:** ✅ Đầy đủ (vượt mockup)

**Trường thiếu:**
- **Cây thư mục Dãy/Kệ** (tree bên trái) + danh sách khu chức năng (`🅿️ Khu chờ nhập`, `🚚 Khu chờ xuất`, `📋 Khu kiểm kê`) — code có dropdown filter zone nhưng **không có UI tree**.

**Trường khác biệt:**
- Mockup có trạng thái "Còn một phần" và "Cần kiểm tra lại"; code thiếu (có thêm `RESERVED`/`WAITING_OUTBOUND` không có trong mockup).

**Chức năng thiếu:**
- `📥 Import Excel` cho vị trí.

---

### UC-MD-06 — Nhà cung cấp
**Mockup:** line 978-1004
**Web hiện tại:** `src/app/suppliers/page.tsx`
**Trạng thái:** ✅ Đầy đủ (vượt mockup)

**Trường thiếu:**
- Cột `Số phiếu nhập` (đếm phiếu NCC đã tham gia) — code không có.

---

## ⚙️ SYSTEM (UC-SYS-01..05)

### UC-SYS-01 — Cấu hình chung
**Mockup:** `wms.vinhgiang.com/system/general` (line 3660-3708)
**Web hiện tại:** `src/app/system/config/page.tsx`
**Trạng thái:** ❌ Thiếu nghiêm trọng

**Trường thiếu:**
- `Tên ứng dụng *` (code chỉ có `company_name`).
- `Tên rút gọn` (input).
- `Hotline` (input).
- `Email hỗ trợ` (input).
- `Định dạng ngày` (select DD/MM/YYYY).
- **`Logo`** (upload, PNG/SVG max 2MB, preview).
- **`Favicon`** (upload).
- `Văn bản chân trang` (textarea).

**Chức năng thiếu:**
- Nút `Đổi logo` / `Đổi favicon` — không có upload UI.

---

### UC-SYS-02 — Cấu hình Mail
**Mockup:** line 3711-3768
**Web hiện tại:** `src/app/system/mail/page.tsx`
**Trạng thái:** ✅ Đầy đủ (có khác biệt nhỏ)

**Trường thiếu:**
- `Bảo mật` (select TLS/SSL/None) — code dùng checkbox `smtp_secure` boolean — **thiếu "None"**.
- `Tên hiển thị (From Name)` — code chỉ có email, không tách From Name.
- `Email phản hồi (Reply-to)` — không có.
- `Số mail tối đa/giờ` (rate limit) — không có.
- Hiển thị `Lần kiểm tra cuối` (history) — code chỉ toast tạm thời.

---

### UC-SYS-03 — Audit Log
**Mockup:** line 3770-3806
**Web hiện tại:** `src/app/system/audit-log/page.tsx`
**Trạng thái:** ⚠️ Thiếu một phần

**Trường thiếu (filter):**
- Filter `Tất cả người dùng` (select user).
- Filter `Tất cả hành động` (select Tạo/Sửa/Xóa/Duyệt).
- Filter `Tất cả đối tượng` (Pallet/Phiếu nhập/Tồn kho/Người dùng).

**Trường thiếu (cột bảng):**
- `Người dùng`, `Vai trò`, `IP` — code không hiển thị.

**Khác biệt:**
- Action types mockup: TẠO/SỬA/DUYỆT/DI CHUYỂN/ĐĂNG NHẬP/CRON; code có CREATE/UPDATE/DELETE/APPROVE/REJECT — **thiếu LOGIN, MOVE, CRON**.

---

### UC-SYS-04 — Quản lý người dùng
**Mockup:** line 3809-3861
**Web hiện tại:** `src/app/system/users/page.tsx`
**Trạng thái:** ⚠️ Thiếu một phần

**Trường thiếu:**
- Trường `Username` (cột bảng và form) — code chỉ có `full_name`/`email`/`phone`.
- Cột `Đăng nhập cuối` — code có `last_login_at` trong type nhưng **không hiển thị**.
- Form: `Username *` không có.
- Checkbox `Bắt buộc đổi mật khẩu lần đầu đăng nhập` — không có.

**Khác biệt:**
- Filter mockup có: search + select vai trò + select trạng thái — code **không có filter**.

**Chức năng thiếu:**
- Nút `🔑` (reset password) — code chỉ có lock/unlock + delete.

---

### UC-SYS-05 — Profile cá nhân
**Mockup:** line 3864-3919 (mobile)
**Web hiện tại:** `src/app/system/profile/page.tsx`
**Trạng thái:** ✅ Đầy đủ (có khác biệt nhỏ)

**Trường thiếu:**
- Avatar upload (icon `📷` để đổi ảnh) — code không có (chỉ icon person mặc định).

---

## 🔌 INTEGRATION (UC-INT-01..03)

### UC-INT-01 — Quét Barcode/QR
**Mockup:** line 3928-3983
**Web hiện tại:** `src/components/BarcodeScanner.tsx`
**Trạng thái:** ✅ Đầy đủ (vượt mockup)

**Trường thiếu:**
- Nút `📷 Chọn ảnh` (decode từ ảnh trong gallery) — không có.
- Card "Đã nhận diện" với info SKU sau khi quét (mockup có lookup VG-NM-001 ngay) — scanner chỉ return code, không lookup product info trong scanner.

**Khác biệt:**
- Code có thêm USB HID + Manual mode — bonus.

---

### UC-INT-02 — Chụp ảnh / Đính kèm
**Mockup:** line 3986-4025 (mobile)
**Web hiện tại:** `src/components/AttachmentUpload.tsx`
**Trạng thái:** ✅ Đầy đủ (có khác biệt nhỏ)

**Trường thiếu:**
- `Mô tả ảnh (tùy chọn)` (textarea) — DB có `note` nhưng UI không cho nhập.
- Counter `2 ảnh đã đính kèm · Tối đa 10 ảnh, 5MB/ảnh` — không hiển thị giới hạn.

---

### UC-INT-03 — Xuất Excel báo cáo
**Mockup:** line 4028+ (Modal cấu hình)
**Web hiện tại:** `src/components/ExcelExport.tsx`
**Trạng thái:** ❌ Thiếu nghiêm trọng

**Trường thiếu:**
- `Phạm vi dữ liệu` (Toàn bộ / Đã lọc / Đã chọn).
- `Cột xuất ra` (checkbox toggle cột).
- `Định dạng file` (.xlsx / .csv).
- Tùy chọn `Bao gồm tiêu đề công ty và ngày xuất`.
- Tùy chọn `Đóng băng dòng tiêu đề` (freeze pane).
- Tùy chọn `Tô màu cảnh báo` (theo HSD).

**Khác biệt:**
- Mockup là **modal cấu hình**; code là **button 1-click**. Hai approach khác hẳn.

---

# 2. PALLET

### UC-PAL-01 — Tạo Pallet (mobile, Thủ kho)
**Mockup:** mobile screen "Tạo pallet mới" (line 1010-1092)
**Web hiện tại:** `src/app/thukho/pallet/` + `src/app/pallets/page.tsx` (desktop view)
**Trạng thái:** ⚠️ Phần lớn đã có, lệch một số chi tiết

**Trường thiếu:**
- **"Liên kết với phiếu nhập (PHN-xxxx)"** — mockup cho chọn phiếu nhập trong dropdown; code mobile chỉ chọn NCC trực tiếp.
- **Preview "Mã pallet auto" disabled** — mockup hiển thị mã sẽ sinh ngay trên form; code chỉ có hint chữ.
- **Count theo tab** (`Đang xử lý (4)`, `Đã xác nhận (12)`) — code mobile có tabs nhưng không hiển thị badge số lượng.
- **Field "Số mã hàng"** trên card (`3 mã hàng · 5 dòng`) — code chỉ có `total_lines`.
- **Field "Liên kết PHN" trên card** (`📥 PHN-2026-0042`) — code chỉ hiển thị NCC.
- **Mã vị trí trên card** (badge `Đã vào A-03-02`) — code chỉ có status IN_STORAGE không kèm location.

**Khác biệt:**
- Code có thêm `Ngày nhập` (`receive_date`) không có trong mockup form tạo.
- Code mobile bắt buộc NCC, mockup không bắt buộc.
- Tabs: code dùng `Tất cả / Đang đếm / Chờ xếp / Trong kho`, mockup `Đang xử lý / Đã xác nhận / Đã vào vị trí`.

---

### UC-PAL-02 — Cập nhật chi tiết hàng (mobile)
**Mockup:** line 1093-1210
**Web hiện tại:** `src/app/thukho/pallet/[id]/page.tsx`
**Trạng thái:** ⚠️ Có core fields nhưng thiếu quy đổi thùng→lẻ

**Trường thiếu:**
- **Quy đổi thùng → đơn vị lẻ realtime** (`5 thùng × 24 chai = 120 chai`) — không hiển thị conversion preview.
- **Quy cách** (`24 chai/thùng`) và **trọng lượng/thùng** (`13.2 kg/thùng`) sau khi chọn mã hàng — code lưu nhưng không show.
- **Đơn vị lẻ (auto) disabled** trong form — không có.
- **Lô / HSD bắt buộc (`*`)** — code đang để optional cả 2.
- **Nút −/+ tăng giảm SL** — code chỉ có input number.
- **Meta `👤 người tạo` + `📥 PHN-xxxx`** trên header pallet — không có.
- **SL đơn vị lẻ (qty_unit) trên card** — mockup hiển thị `120 / Chai`, code chỉ show thùng.
- **Field `manufactured_date` (NSX)** — declared trong state nhưng KHÔNG render input trong form.

---

### UC-PAL-03 — Nhận diện mã hàng đa phương thức
**Mockup:** line 1211-1287
**Web hiện tại:** `src/components/BarcodeScanner.tsx`
**Trạng thái:** ✅ Code mạnh hơn mockup ở phần kỹ thuật

**Trường thiếu:**
- **Mode "Chụp ảnh mã vỏ thùng" (OCR)** — mockup có nút `📷 Ảnh`; code không có.
- **Mode "Danh mục"** trong scanner — mockup có nút `📋 Danh mục`; code đẩy chức năng ra ngoài.
- **Pill filter theo nhóm hàng** (`Đồ uống · Gia vị · Đồ hộp`).
- **Màn "Quét thành công"** với card xanh xác nhận (mã + tên + quy cách + barcode) — code auto-select không hiển thị màn confirmation.
- **Hiển thị "Mã vạch"** trong card kết quả.

**Khác biệt nghiêm trọng:**
- **Mobile pallet detail (`thukho/pallet/[id]`) KHÔNG có nút quét mã / không dùng `BarcodeScanner`** — chỉ desktop có. Đây là thiếu sót lớn vì UC-PAL-03 là use-case mobile của thủ kho.

---

### UC-PAL-04 — Xác nhận Pallet
**Mockup:** line 1288-1368 (màn tổng kết + success)
**Web hiện tại:** `src/app/thukho/pallet/[id]/page.tsx` (mobile) + `src/app/pallets/[id]/page.tsx` (desktop)
**Trạng thái:** ⚠️ Logic confirm có, nhưng UI tổng kết chưa khớp

**Trường thiếu:**
- **Bảng tổng kết đầy đủ**: thiếu **`Tổng mã hàng` (distinct)**, **`Tổng SL theo đơn vị lẻ`**, **`Date gần nhất` (min expiry)**.
- **Checkbox "Tôi xác nhận đã kiểm đếm chính xác"** — không có.
- **Note cảnh báo chi tiết** ("Mã/SL/Lô/Date bị KHÓA với Xe nâng").
- **Push notification cho Xe nâng** — verify backend.
- **Success screen với CTA "Tạo pallet mới" và "Về danh sách"** — chỉ refresh trang.

**Khác biệt:**
- Code desktop dùng `window.confirm()` (UX thô) — không khớp mockup có popup tổng kết.

---

### UC-PAL-05 — Sửa pallet sau khi xác nhận
**Mockup:** line 1369-1405 ("⚠ Sửa pallet đã XN")
**Web hiện tại:** `src/app/pallets/[id]/page.tsx` + `src/app/thukho/pallet/[id]/page.tsx`
**Trạng thái:** ⚠️ Có unlock nhưng thiếu phân loại lý do

**Trường thiếu:**
- **Select "Lý do sửa" với 4 enum** (Sai SL / Sai lô-HSD / Sai mã / Khác) — code chỉ có textarea tự do.
- **Field "Người duyệt" (approver)** — mockup yêu cầu chỉ định người duyệt; code không có approval workflow.
- **Phân biệt 2 field "Lý do" (select) và "Mô tả chi tiết" (textarea)** — code gộp làm một.

---

### UC-PAL-06 — Chi tiết Pallet + Lịch sử
**Mockup:** line 1406-1456
**Web hiện tại:** `src/app/pallets/[id]/page.tsx` (desktop) + `src/app/thukho/pallet/[id]/page.tsx` (mobile)
**Trạng thái:** ⚠️ Có timeline nhưng thiếu vị trí và metadata

**Trường thiếu (NGHIÊM TRỌNG):**
- **Vị trí hiện tại (current location)** — mockup hiển thị `📍 A-03-02` ngay trên header khi pallet `IN_STORAGE`; **code KHÔNG hiển thị mã vị trí** trên trang detail (cả desktop lẫn mobile). Gap lớn vì biết pallet đang ở đâu là core info.
- **Liên kết Phiếu nhập (PHN)** trên header — code chỉ có NCC.
- **SL theo đơn vị lẻ (qty_unit)** trên card dòng hàng — mockup show `240 chai`, code show số thùng.
- **Event "PUTAWAY" / "MOVE_TO_LOCATION"** trong `ACTION_MAP` — thiếu.
- **Tên vai trò người thao tác** trong timeline (`Xe nâng: Hoàng Văn G`) — code chỉ show fullName.
- **Mã vị trí trong từng mốc lịch sử** (mockup gắn `A-03-02` vào event putaway).

---

# 3. INBOUND + INBOUND TEMP

### UC-IN-01 — Lập Phiếu yêu cầu nhập
**Mockup:** `wms.vinhgiang.com/inbound/requests/new` (line 1457-1538)
**Web hiện tại:** `src/app/inbound/new/page.tsx`
**Trạng thái:** ⚠️ Đã redesign khá khớp mockup (commit c416af2) nhưng còn lệch

**Trường thiếu:**
- Nút **"⬇ Template"** (tải file mẫu Excel) ở khu drag-drop manual.
- Mockup ghi chú "Mã chưa có → tự tạo theo chứng từ (UC-MD-02)" — code có flag `create_temp_code` nhưng không hiển thị thông báo.

**Trường khác biệt:**
- **Enum `import_type`**: mockup 2 (`Nhập từ NCC`, `Hàng trả lại`); code 3 (`Nhập từ NCC`, `Nhập chuyển kho`, `Nhập hoàn trả`). Tên `Nhập hoàn trả` ≠ `Hàng trả lại`; thêm `Nhập chuyển kho` không có trong mockup.
- **Kho nhận**: code hardcode 2 option text, không fetch từ API warehouses.
- **Tab thứ 3**: mockup viết "Up file NCC lớn → UC-IN-06" là **link sang `/inbound/import`**; code implement thành tab riêng trong page.

---

### UC-IN-02 — Thủ kho tiếp nhận phiếu
**Mockup:** mobile screens (line 1539-1614)
**Web hiện tại:** `src/app/thukho/inbound/page.tsx` + `[id]/page.tsx` + `src/app/inbound/[id]/page.tsx` (desktop)
**Trạng thái:** ⚠️ Flow có nhưng thiếu **checklist "Khu vực dỡ hàng đã chuẩn bị"**

**Trường thiếu:**
- **Checklist "Khu vực dỡ hàng đã chuẩn bị"** (1 checkbox không bắt buộc) — không có ở cả mobile lẫn desktop.
- **Banner cảnh báo** "chưa check vẫn được bấm Tiếp nhận".
- **Tổng số mã + tổng SL** trên card list (`3 mã · 920 đv`) — code chỉ ghi `{total_lines} dòng`.
- **Người tạo** (`👤 Nguyễn Thị KT`) trên card.

**Khác biệt:**
- Tab "Đã đối chiếu (VERIFIED)" trong code không khớp với mockup pill "Đang chuẩn bị (1)" / "Hoàn tất".
- Code dùng status text raw (`{data.status}`) trong header, mockup hiển thị badge label tiếng Việt.

---

### UC-IN-03 — Đối chiếu Pallet với Phiếu YC
**Mockup:** line 1615-1659
**Web hiện tại:** `src/app/inbound/[id]/page.tsx` (tab reconciling)
**Trạng thái:** ❌ Thiếu khái niệm Pallet + Mã tạm + Hàng phát sinh

**Trường thiếu:**
- **Cột "Pallet"** trong bảng — không hiển thị mã pallet liên kết.
- **KPI "Pallet đã tạo"** (5, 3 XN + 2 đang đếm) và **KPI "Mã tạm"** (1, Cần KT chuẩn hóa) — không có.
- **Khái niệm "Hàng phát sinh"** (thực nhập có mà phiếu YC không có) — code chỉ cho thêm dòng ở DRAFT, không xử lý phát sinh khi reconcile.
- **Mã tạm `TMP-yymmdd-xxx`** hiển thị inline trong bảng đối chiếu.
- **Trạng thái dòng theo phân loại**: `✓ Đã khớp` / `Chênh lệch thiếu` / `Chênh lệch thừa` / `Hàng phát sinh`. Code chỉ có badge dấu số.
- **% delta** trên KPI tổng (`−44 (−4.8%)`).

**Chức năng thiếu:**
- "Yêu cầu kiểm lại" (gửi phiếu về RECEIVING).
- "Xuất Excel" tại màn đối chiếu.
- Link sang chuẩn hóa mã tạm trực tiếp.

---

### UC-IN-04 — Kế toán chốt phiếu nhập
**Mockup:** line 1660-1704
**Web hiện tại:** `src/app/inbound/[id]/page.tsx` (handleCompleteInbound)
**Trạng thái:** ❌ Thiếu hẳn UI điều kiện chốt và quyết định chênh lệch

**Trường thiếu:**
- **Toàn bộ checklist 5 điều kiện chốt** (pallet xác nhận, pallet vào vị trí, mã tạm chuẩn hóa, chênh lệch đã xử lý, tổng nhập = tổng phân bổ).
- **Textarea ghi chú khi chốt** riêng cho action finalize.
- **Dropdown "Quyết định với chênh lệch"** 3 lựa chọn (Chấp nhận / Yêu cầu kiểm lại / Tạo phiếu điều chỉnh tồn UC-INV-09).
- **Nút "Đánh dấu Chưa khớp số"** trạng thái nửa chừng.

**Khác biệt:**
- Điều kiện chốt code chỉ check `qty_accepted` đầy đủ; mockup yêu cầu 5 điều kiện đa chiều.
- Mockup tách URL `/finalize`, code gộp vào `/inbound/[id]`.

---

### UC-IN-05 — Theo dõi trạng thái phiếu nhập
**Mockup:** `wms.vinhgiang.com/inbound/requests` (line 1705-1796)
**Web hiện tại:** `src/app/inbound/page.tsx`
**Trạng thái:** ⚠️ List có đủ cơ bản nhưng thiếu stepper tiến độ

**Trường thiếu:**
- **Cột "Tiến độ" với stepper 8 bước** (`Chờ chốt số (7/8)`) — không có.
- **Cột "SL nhập / yêu cầu"** (`876 / 920`) — code chỉ có "Dòng hàng" count.
- **Filter "Có chênh lệch"** (red chip).
- **8 trạng thái roadmap chi tiết** (Chuẩn bị, Kiểm đếm, Pallet chờ nhập, Đưa vào vị trí, Chờ chốt) — code chỉ có 6.

---

### UC-IN-06 — Import Excel hàng về NCC
**Mockup:** `wms.vinhgiang.com/inbound/import-excel` (line 1797-1976, 3 bước)
**Web hiện tại:** `src/app/inbound/import/page.tsx` (3 bước stepper)
**Trạng thái:** ⚠️ Có 3 bước nhưng thiếu nhiều field meta + KPI BU + summary nhóm

**Bước 1 — Upload (thiếu):**
- **Loại hàng về** (`Hàng U về` / `Hàng MASAN` / `Khác`).
- **Ngày đặt hàng (theo file)**.
- **Ngày dự kiến hàng về** ở Bước 1 (code đặt nhầm ở Bước 3).
- **Nút tải template Excel**.
- **Confirm box** sau upload (số dòng, ngày đặt, ngày về preview).
- Hint nhận diện cột (Mã hàng · Tên · SL thùng · Trọng lượng tấn).

**Bước 2 — Preview & đối chiếu mã (thiếu):**
- KPI **Tổng số thùng** + **Tổng tải trọng** + ước tính xe.
- KPI **Cần tạo mã** tách số mã trùng.
- Cột **Trọng lượng (kg)** trong bảng (không parse Excel).
- Cột **BU** (Business Unit: HC/BE/PC/F).
- **Trạng thái "Trùng (2)"** — code chỉ có matched/similar/unmatched, không xử lý 1 mã → ≥2 SKU.
- Pills filter (Tất cả / Có mã / Cần tạo / Trùng).
- Nút **"+ Tạo mã"** trực tiếp trên dòng (popup tạo mã).
- Box hướng dẫn 3 lựa chọn (Tạo nhanh / Tạo từng mã / Bỏ qua).
- Nút **"⚡ Tạo nhanh N mã hàng theo chứng từ"** và **"Bỏ qua các mã chưa có"**.

**Bước 3 — Kết quả (thiếu):**
- Banner success sau khi tạo (code chỉ redirect).
- Trường **"Nguồn dữ liệu"** (link tới file Excel).
- **Bảng Tóm tắt theo nhóm BU** (HC/BE/PC/F).
- **Nút "Xuất phiếu PDF"**.
- Cấu trúc 2 bước riêng (preview confirm + tạo phiếu) — code gộp 1.

---

### UC-INTMP-01 — Tạo Phiếu nhập tạm (mobile thủ kho)
**Mockup:** line 1977-2061
**Web hiện tại:** `src/app/thukho/adhoc/new/page.tsx` + desktop `src/app/inbound-adhoc/new/page.tsx`
**Trạng thái:** ❌ Thiếu đa số trường BẮT BUỘC của mockup

**Trường thiếu (CRITICAL):**
- **Nguồn hàng *** (select: Nhà cung cấp / Hàng trả lại / Khác) — chỉ có supplier select tùy chọn.
- **Người giao** (text) — không có.
- **Ngày giờ nhận *** (datetime-local) — không có.
- **Lý do nhập đột xuất *** (select bắt buộc 5 options: Hàng về sớm / Chưa kịp lập phiếu / Hàng trả lại không báo trước / NCC mới chưa khai báo / Khác) — KHÔNG CÓ. **Đây là field BẮT BUỘC**.
- **Ảnh chứng từ** (upload nhiều) — không có ở mobile (desktop `inbound-adhoc/[id]` cũng không).
- **Khái niệm Pallet** trong phiếu tạm — không có ở UI.
- **Nút "+ Tạo pallet mới"** + **"Gửi cho Kế toán xử lý →"**.

**Khác biệt:**
- **Mã tự sinh**: mockup `PNT-260506-003` (yymmdd-NNN), code `PTT-YYYY-SSSS` (yyyy-NNNN). Tiền tố PNT vs PTT, pattern khác.
- Code mobile dùng `qty_cartons`/`lot_number`, desktop dùng `qty_box`/`lot` — không đồng bộ tên field.

---

### UC-INTMP-02 — Xử lý phiếu nhập tạm (chuẩn hóa)
**Mockup:** line 2062-2147 (3 bước trên 1 màn desktop)
**Web hiện tại:** `src/app/inbound-adhoc/[id]/page.tsx`
**Trạng thái:** ❌ Có chức năng nhưng mô hình rất khác mockup

**Bước 1 KIỂM TRA NGUỒN HÀNG (thiếu):**
- Bảng read-only: Nguồn, Người giao + SĐT, Ngày giờ, Ảnh chứng từ.
- Nút "+ Tạo NCC mới từ thông tin này".

**Bước 2 CHUẨN HÓA MÃ HÀNG (thiếu):**
- Bảng với cột **Mã chuẩn** (select dropdown + "+ Tạo mới") + **Hành động "Chuẩn hóa →"** từng dòng.
- Code không có khái niệm "mã tạm" thực sự (khi tạo dòng đã chọn mã chuẩn rồi).

**Bước 3 LIÊN KẾT/TẠO PHIẾU CHÍNH THỨC (thiếu):**
- 2 radio: "Liên kết với phiếu YC có sẵn" / "Tạo phiếu mới (hồi tố)" — code chỉ có 1 cách.

**Side panel TIẾN ĐỘ (thiếu):**
- 4 dòng checklist tiến độ chuẩn hóa.

---

### UC-INTMP-03 — Theo dõi tồn tạm
**Mockup:** line 2148-2179
**Web hiện tại:** `src/app/inbound-adhoc/page.tsx`
**Trạng thái:** ⚠️ List có nhưng thiếu "Số ngày tồn" + cảnh báo quá hạn

**Trường thiếu:**
- **Cột "Mã tạm"** (`TMP-yymmdd-xxx`) — không có.
- **Cột "Tên rút gọn"** của mã tạm.
- **Cột "Số ngày tồn"** + tô màu red nếu quá hạn.
- **KPI "⚠ Quá hạn (>3 ngày)"** — không có.
- **Trạng thái phân loại theo tuổi**: Quá hạn (red) / Sắp quá (amber) / Mới (blue).

**Khác biệt:**
- Mockup là báo cáo **theo mã hàng tạm** (mỗi dòng = 1 mã trong 1 phiếu); code là báo cáo **theo phiếu**.
- KPI "Tổng SL tồn tạm" mockup tính **đơn vị (đv)**, code tính **thùng**.

---

# 4. FORKLIFT + OUTBOUND

## 🚜 FORKLIFT (UC-FK-01..06)

### UC-FK-01 — Danh sách pallet chờ xếp
**Mockup:** mobile (line 2180-2264)
**Web hiện tại:** `src/app/forklift/page.tsx` + `src/components/forklift/ForkliftMobileDashboard.tsx` + `src/app/forklift/pallet/page.tsx`
**Trạng thái:** ⚠️ Có cơ bản, thiếu nhiều trường

**Trường thiếu:**
- `Số dòng (total_lines)` trên card (data có nhưng không show).
- `Tổng SL đơn vị/chai` trên card.
- `Date gần nhất` (HSD sớm nhất) trên card.
- Mã phiếu nhập gốc (`PHN-xxxx`).
- **Pill filter 3 nhóm**: Vào vị trí / Luân chuyển / Sang chờ xuất.
- **Tabbar bottom** (Việc/Bản đồ/Lịch sử/Tôi) — code chỉ có quick actions.
- **Màn "Chi tiết pallet đọc-only"** với note lock + danh sách dòng đầy đủ.
- KPI riêng "Yêu cầu LC" (luân chuyển).

---

### UC-FK-02 — Đưa Pallet vào vị trí chứa
**Mockup:** 2 màn mobile (line 2265-2336)
**Web hiện tại:** `src/app/forklift/put-away/page.tsx`
**Trạng thái:** ⚠️ Có flow chính, thiếu wizard 2 bước và gợi ý

**Trường thiếu:**
- **Section "VỊ TRÍ TRỐNG GỢI Ý"** với khoảng cách gần nhất / ưu tiên — chỉ list flat trong dropdown.
- Input text **nhập mã vị trí thủ công** ngoài dropdown/scan.
- **Bước xác nhận riêng** (preview before commit) — hiện submit thẳng.
- Card hiển thị **tổng đv (qty_box)** của pallet (chỉ show kg).
- Badge **trạng thái "Đang chuyển"** trên card pallet.
- Mã phiếu nhập gốc / người nhận trên card.
- **Mô tả tác động sau xác nhận** ("Pallet sẽ rời khu chờ nhập...").

**Khác biệt:**
- Code dùng 1 form duy nhất; mockup chia 2 step rõ (Bước 1 chọn vị trí, Bước 2 xác nhận).

---

### UC-FK-03 — Chuyển vị trí pallet
**Mockup:** line 2337-2379
**Web hiện tại:** `src/app/forklift/relocate/page.tsx`
**Trạng thái:** ⚠️ Có flow chính, thiếu `Lý do` và note khóa nội dung

**Trường thiếu:**
- **Trường `Lý do (tùy chọn)`** (select 4 options: Sắp xếp lại kho / Gom hàng cùng lô / Giải phóng vị trí / Khác) — KHÔNG CÓ.
- Hiển thị **mã hàng + SL chai/đv** của pallet nguồn (chỉ hiện location).
- **Note khóa nội dung** 🔒 cảnh báo (Mã/SL/Lô/Date không thay đổi).
- Input text **nhập mã vị trí đích** thủ công.
- Badge "Đang chứa" trên card vị trí nguồn.

---

### UC-FK-04 — Chuyển sang Khu chờ xuất (FEFO)
**Mockup:** 2 màn mobile (line 2380-2482)
**Web hiện tại:** `src/app/forklift/stage-out/page.tsx`
**Trạng thái:** ❌ Thiếu flow chọn SL rút (TH-A/TH-B)

**Trường thiếu (CRITICAL):**
- **TH-B: Rút một phần** — KHÔNG CÓ flow nhập số lượng từng phần (chỉ rút nguyên pallet).
- **Radio chọn rõ TH-A vs TH-B**.
- **Input số lượng + stepper +/−** khi rút một phần.
- **Màn xác nhận riêng** (preview) với card đối chiếu nguồn → đích, hiện SL còn lại sau rút.
- **Badge "Ưu tiên 1/2/3"** theo thứ tự FEFO (chỉ có badge cấp độ HSD).
- Hiển thị tổng SL hiện có tại vị trí so với SL rút.

**Khác biệt:**
- Code dùng `urgency` (critical/warning/normal) theo `days_until_expiry`; mockup dùng `Ưu tiên 1/2/3` theo thứ tự rank-based.

---

### UC-FK-05 — Hoàn trả pallet về vị trí
**Mockup:** mobile (line 2483-2542) với form audit log đặc biệt
**Web hiện tại:** `src/app/forklift/return/page.tsx`
**Trạng thái:** ❌ THIẾU NGHIÊM TRỌNG — code chỉ trả vị trí, KHÔNG cho phép sửa nội dung

**Trường thiếu (CRITICAL):**
- **Toàn bộ phần chỉnh sửa nội dung dòng**: Mã hàng, SL còn lại, Lô, HSD đều KHÔNG cho phép sửa.
- **Cảnh báo SL khác SL ban đầu** (so sánh delta, vd "Đã xuất 60 chai").
- **Select `Lý do thay đổi nội dung`** với 4 option preset (hiện chỉ có textarea tự do).
- Tách `Mô tả chi tiết` riêng khỏi `Lý do`.
- **Note cảnh báo "Quyền đặc biệt + Audit log bắt buộc"** đầu màn.

**Bản chất sai:**
- Code hiện tại = "di chuyển pallet từ staging về kho" — không phải UC-FK-05 đúng nghĩa cho phép sửa nội dung.
- Permission check (chỉ Người được phân quyền) — code không thấy check role.

---

### UC-FK-06 — Lịch sử luân chuyển
**Mockup:** Desktop browser view (line 2543-2586)
**Web hiện tại:** `src/app/forklift/history/page.tsx` (timeline)
**Trạng thái:** ⚠️ Có timeline KHÁC HẲN cấu trúc mockup (table)

**Trường thiếu:**
- **Cột `Mã hàng`** — không hiển thị SKU.
- **Cột `Lô/Date`** — không hiển thị lô + HSD.
- **Cột `SL`** — không hiển thị số lượng di chuyển.
- **Cột `Người`** — không hiển thị `performed_by`.
- **Search box** theo mã pallet/mã hàng.
- **Button "📤 Xuất Excel"**.
- Phân loại 5 loại (mockup) vs 4 loại (code): mockup phân biệt rõ "Vị trí → Chờ xuất (FK-04)" vs "Chờ xuất → Vị trí (FK-05)" với 2 màu khác.

**Khác biệt:**
- View pattern: Timeline mobile-first (code) vs Bảng table desktop (mockup).
- Mockup `wms.vinhgiang.com/movements` (admin), code đặt route `/forklift/history` (module xe nâng) — semantic quyền truy cập khác.

---

## 📤 OUTBOUND (UC-OUT-01..05)

### UC-OUT-01 — Xem hàng tại Khu chờ xuất
**Mockup:** `wms.vinhgiang.com/staging-out` (line 2587-2624)
**Web hiện tại:** `src/app/outbound/page.tsx`
**Trạng thái:** ⚠️ Có bảng nhưng thiếu nhiều cột chi tiết và KPI cảnh báo

**Trường thiếu:**
- **Cột `Mã hàng` (item code)** — chỉ có tên gộp join string.
- **Cột `Lô`** riêng.
- **Cột `Tên` riêng** từng dòng (hiện gộp).
- **Cột `Đến lúc`** (timestamp tới staging).
- **KPI `Tổng mã (SKU distinct)`**.
- **KPI `⚠ Quá 24h`** (đếm pallet wait > 24h) + highlight đỏ.
- Button **"⚖ Cân lại tồn (UC-OUT-05)"** trực tiếp trên trang (code có nav card riêng).
- Button **"📤 Xuất Excel"**.
- Button **"🔍 Lọc"** với filter panel.

**Khác biệt:**
- Mockup mỗi row là từng `pallet_line` (line-level); code gộp về pallet-level.
- Đơn vị: mockup "đv" (chai), code "thùng" + KG.

---

### UC-OUT-05 — Cân lại tồn ở Khu chờ xuất ★
**Mockup:** Desktop, 2 cách (line 2625-2761)
**Web hiện tại:** `src/app/outbound/rebalance/page.tsx`
**Trạng thái:** ❌ Thiếu hẳn 2 cách, code chỉ có 1 cách rất đơn giản (nhập tay từng dòng)

**Cách 1 (Up file SL đã xuất) — thiếu HẾT:**
- Toàn bộ chức năng upload file Excel + parsing.
- Button download template Excel.
- Input chọn ngày xuất.
- Đối chiếu file với tồn — phát hiện dòng vượt tồn → cảnh báo.
- Cột preview `Trạng thái` (Xuất hết-gỡ pallet / Khớp / SL vượt).
- Note hậu xác nhận với danh sách tác động (4 dòng).
- Button "Tạm hoãn (giữ file)".

**Cách 2 (Up phiếu yêu cầu xuất) — thiếu HẾT:**
- **Toàn bộ entity `Phiếu yêu cầu xuất (PYX)`** — không có CRUD.
- Route `/staging-out/outbound-requests` chưa tồn tại.
- Trường: Mã phiếu, Khách/NCC nhận, Ngày xuất, Người tạo, Người nhận.
- Workflow trạng thái: Chờ xuất → Đang lấy hàng → Đã xuất / Hủy.
- Bảng dòng phiếu với đối chiếu tồn (Yêu cầu vs Tồn vs SL trừ).
- Button "✓ Xác nhận đã xuất hàng".
- Upload phiếu Excel bulk.

**Hiện trạng:**
- Form 1 bảng đơn duy nhất hiển thị TẤT CẢ dòng pallet ở staging với input nhập tay SL.

---

### UC-OUT-02 — Báo cáo Xuất kho tương đối
**Mockup:** line 2762-2823
**Web hiện tại:** `src/app/outbound/report/page.tsx`
**Trạng thái:** ⚠️ Có table cơ bản, thiếu chart và metric

**Trường thiếu:**
- **Chart "Top 5 mã xuất nhiều nhất"** (bar chart vertical).
- **Chart "Xuất theo nhóm hàng"** (bar chart horizontal với %).
- **Cột `Nhóm`** (chưa có category field trong code).
- **Cột `Số lần xuất`** (frequency).
- **Cột `Bình quân/lần`** (qty_out / số lần).
- Filter chọn **kỳ** preset (Tháng X/YYYY) thay vì from-to manual.
- Filter theo **nhóm hàng**.
- Button **"📤 Xuất Excel"**.

---

### UC-OUT-03 — Báo cáo Tốc độ luân chuyển
**Mockup:** line 2824-2849
**Web hiện tại:** `src/app/outbound/turnover/page.tsx`
**Trạng thái:** ⚠️ Có cơ bản, thiếu `Ngày tồn dự kiến` + `Bình quân xuất/ngày`

**Trường thiếu:**
- **Cột `Bình quân xuất/ngày`** (`qty_out / period_days`).
- **Cột `Ngày tồn dự kiến`** (`current_stock / avg_per_day`).

**Khác biệt:**
- Code có thêm "Đóng băng" cho hàng không xuất — bonus.

---

### UC-OUT-04 — Gợi ý nhập hàng
**Mockup:** line 2850-2886
**Web hiện tại:** `src/app/outbound/reorder/page.tsx`
**Trạng thái:** ⚠️ Logic tính khác biệt + thiếu nhiều trường

**Trường thiếu:**
- **Trường `BQ xuất/ngày`** (calculated metric).
- **Trường `Nhu cầu N ngày`** (BQ × ngày).
- **Input filter "Số ngày dự trữ"** (cấu hình động).
- **Checkbox chọn nhiều dòng** để tạo phiếu bulk.
- **Button "Tạo phiếu yêu cầu nhập từ gợi ý"** (bulk, ở header).
- Badge phân loại nhiều cấp (Đủ/Sắp thiếu/Thiếu nhiều/Bán chậm).

**Công thức KHÁC NHAU:**
- Mockup: forecast-based (`BQ xuất/ngày × Ngày dự trữ`).
- Code: threshold-based (`min_stock − current_stock`).

---

# 5. INVENTORY + DASHBOARD

## 📊 INVENTORY (UC-INV-01..09)

### UC-INV-01 — Tồn theo Mã hàng
**Mockup:** line 2887-2983
**Web hiện tại:** `src/app/inventory/page.tsx`
**Trạng thái:** ⚠️ Thiếu drill-down và panel cận date

**Trường thiếu:**
- Panel mặc định **"Cận date — Vị trí có HSD gần ngày hiện tại nhất"** với select Top 5/Top 10/Tất cả ≤30 ngày.
- Cột `Nhóm`, `ĐVT`, `Tồn min/max`.
- Select filter Nhóm + Trạng thái.
- KPI "Hết hàng".
- **Trang drill-down `/inventory/by-sku/[code]/locations`** — 🚫 CHƯA TỒN TẠI.
- Badge "Dưới min" (đỏ) / "Vượt max" (vàng).
- Sắp xếp theo Date xa nhất.

---

### UC-INV-02 — Tồn theo Vị trí
**Mockup:** line 2985-3029
**Web hiện tại:** `src/app/inventory/by-location/page.tsx`
**Trạng thái:** ⚠️ Thiếu nút "Sửa số tồn" và bảng chi tiết pallet đầy đủ

**Trường thiếu:**
- Input tra cứu mã vị trí trực tiếp.
- Cột bảng: Lô, NSX, HSD, Trạng thái pallet.
- Cột "Trọng lượng (kg/kg max)" trong header info.
- **Nút "Sửa số tồn"** trên từng dòng pallet (chuyển sang ADJ form prefill UC-INV-09).
- Xuất Excel.
- Visualization HSD (ô màu vàng) và Khóa (ô màu đỏ).

---

### UC-INV-03 — Tồn theo Pallet
**Mockup:** line 3032-3062
**Web hiện tại:** `src/app/inventory/by-pallet/page.tsx`
**Trạng thái:** ⚠️ Thiếu nhiều cột và filter

**Trường thiếu:**
- Cột Ngày tạo, Số dòng, Tổng SL gốc, Tổng SL còn, Phiếu nguồn (PNK-…).
- Trạng thái "Đang di chuyển", "Xuất tương đối".
- Search input, filter date, filter status dropdown, nút Lọc, Xuất Excel.

---

### UC-INV-04 — Báo cáo FEFO (Tồn theo Lô/Date)
**Mockup:** line 3065-3101
**Web hiện tại:** `src/app/inventory/by-lot/page.tsx`
**Trạng thái:** ⚠️ Thiếu KPI và filter

**Trường thiếu:**
- Cột NSX, Vị trí.
- **KPI 3 cards** (số lô + tổng SL) theo mức cảnh báo ≤7/≤30/>30.
- Search + select filter + nút Lọc + Xuất Excel.
- Highlight background row theo mức.

---

### UC-INV-05 — Cảnh báo HSD & Tồn thấp
**Mockup:** line 3104-3178
**Web hiện tại:** `src/app/inventory/alerts/page.tsx`
**Trạng thái:** ⚠️ Thiếu cảnh báo vượt max, hàng tồn lâu và cấu hình email

**Trường thiếu:**
- **KPI "Tồn vượt max"** + nút "Tạo gợi ý nhập".
- **KPI "Hàng tồn lâu — cận date xa nhất theo vị trí"** + báo cáo riêng.
- **Bảng cấu hình gửi mail** (loại/tần suất/người nhận/toggle).
- Trị giá ước tính (~triệu VND).
- Cron 6:00 + email gửi quản lý + badge dashboard.

---

### UC-INV-06 — Kiểm kê theo Vị trí (mobile + desktop)
**Mockup:** line 3187-3265 (3 bước)
**Web hiện tại:** `src/app/kiemke/scan/` + `src/app/kiemke/tasks/[id]/` + `src/app/stock-count/[id]/`
**Trạng thái:** ⚠️ Thiếu QR camera, blind count, ảnh chứng minh

**Trường thiếu:**
- **Camera QR scanner** thực sự (code chỉ có input text mã vị trí).
- **Bước 3 riêng** (form chi tiết với Lô/HSD xác nhận + ghi chú riêng + chụp ảnh).
- Trường "Lô (xác nhận)", "HSD (xác nhận)" trong form đếm.
- Nút **"+ Thêm pallet ngoài hệ thống"**.
- Nút **"📷 Chụp ảnh hiện trường"**.
- **Chế độ blind count** (ẩn SL hệ thống trước khi đếm).
- Trường Pallet/Lô/HSD trong bảng items tại vị trí.

---

### UC-INV-07 — Kiểm kê theo Mã hàng
**Mockup:** line 3268-3303
**Web hiện tại:** `src/app/stock-count/[id]/page.tsx` (type=BY_ITEM)
**Trạng thái:** ⚠️ Thiếu KPI tổng hợp và xử lý staging-out

**Trường thiếu:**
- Header Mã hàng + Tên hàng (khi type=BY_ITEM).
- KPI tổng "SL hệ thống" và "SL thực tế".
- Cột Pallet, Lô, HSD, Người KK, Trạng thái (Khớp/Có chênh) trong bảng counts.
- **Highlight đặc biệt cho STAGING-OUT** + cảnh báo "phải bao gồm khu xuất tương đối".
- Nút "Tạo phiếu xử lý chênh lệch", "Xuất biên bản kiểm kê".

---

### UC-INV-08 — Xử lý chênh lệch kiểm kê
**Mockup:** line 3306-3352
**Web hiện tại:** `src/app/stock-count/[id]/page.tsx` (gộp với UC-07)
**Trạng thái:** ❌ Thiếu hẳn workflow approve từng dòng

**Trường thiếu:**
- Header info đợt: Loại, Thời gian range, Số người KK, X/Y vị trí.
- KPI Khớp / Có chênh / Đã xử lý / Còn chờ.
- Cột Pallet, Ghi chú KK trong bảng.
- **Nút "Chấp nhận" / "Kiểm lại" theo từng dòng** (chỉ có nút Hoàn tất chung).
- Trạng thái dòng (Đã chấp nhận / Cần kiểm lại / Chờ).
- Highlight row theo trạng thái xử lý.

---

### UC-INV-09 — Phiếu điều chỉnh tồn
**Mockup:** line 3355-3424
**Web hiện tại:** `src/app/inventory/adjustments/page.tsx` + `[id]/page.tsx`
**Trạng thái:** ⚠️ Thiếu tạo phiếu mới, thiếu nhiều trường form

**Trường thiếu:**
- **Trang tạo phiếu mới `/inventory/adjustments/new`** — không tồn tại.
- Form fields: Loại điều chỉnh (select), Tham chiếu phiếu kiểm (input STK-…), Người lập.
- Cột trong bảng dòng: **Pallet, Vị trí, Lô, Ghi chú** từng dòng.
- Nút "Lưu từng dòng" + "Thêm dòng".
- Workflow 5 bước (chỉ có approve/reject, không có "Lưu nháp", "Gửi duyệt").
- Lịch sử duyệt timeline.
- Loại điều chỉnh phân biệt Giảm/Tăng/Điều chỉnh sau KK.

---

## 📈 DASHBOARD (UC-DASH-01..02)

### UC-DASH-01 — Dashboard theo vai trò
**Mockup:** line 3433-3584
**Web hiện tại:**
- Kế toán: `src/app/page.tsx`
- Thủ kho mobile: `src/app/thukho/page.tsx` → `ThukhoMobileDashboard.tsx`
- Xe nâng mobile: `src/app/forklift/page.tsx` → `ForkliftMobileDashboard.tsx`
- Kiểm kê mobile: `src/app/kiemke/page.tsx`

**Trạng thái:** ⚠️ Có đủ 4 role nhưng widget chưa khớp mockup

**Thiếu theo từng role:**

**Kế toán:**
- KPI "Phiếu lệch SL", "Phiếu điều chỉnh chờ duyệt", "Tồn tạm chờ chuẩn hóa".
- Card "Cảnh báo HSD/Tồn thấp" gộp 3 dòng (code chỉ có HSD).
- Greeting cá nhân theo tên user.

**Thủ kho:**
- KPI "Hoàn tất hôm nay", "Lệch SL".
- Greeting card gradient cá nhân.

**Xe nâng:**
- KPI "Yêu cầu di chuyển", "Yêu cầu xuất tương đối", "Hoàn trả vị trí".
- Greeting cá nhân.

**Kiểm kê:**
- Greeting card gradient cá nhân "Đợt kiểm kê hôm nay".
- Card session với progress bar visual.
- Section "Vị trí được giao" liệt kê theo Khu/Kệ.
- KPI "Có chênh lệch" hiện đang là "—" (chưa fetch).

---

### UC-DASH-02 — KPI tổng quan (Quản lý)
**Mockup:** line 3587-3651
**Web hiện tại:** `src/app/dashboard/page.tsx`
**Trạng thái:** ⚠️ Thiếu phân tích nhóm và top mã

**Trường thiếu:**
- KPI "Tổng SKU" + delta tháng, "Cảnh báo" tổng hợp (X + "Y nguy cấp").
- **Card "Tồn theo nhóm hàng"** với progress bars per nhóm.
- **Card "Top mã xuất tương đối"** top 5.
- Card "Cảnh báo HSD" 3 mức (≤7/≤30/>30) hiển thị cùng nhau.
- **Card "Phiếu chờ xử lý"** tổng hợp 5 loại (Phiếu nhập có slip, Tồn tạm, Pallet chờ xếp, Pallet đang di chuyển, Adj chờ duyệt).
- Tùy chọn kỳ "Tháng/Tuần/Hôm nay".

---

# 📌 PHỤ LỤC: BẢNG TỔNG HỢP NHANH

## Bảng đếm gap theo nhóm

| Nhóm | Tổng UC | ✅ Đầy đủ | ⚠️ Thiếu một phần | ❌ Thiếu nghiêm trọng | 🚫 Chưa có |
|---|---|---|---|---|---|
| Auth | 4 | 2 | 1 | 1 | 0 |
| Master Data | 5 | 3 | 1 | 1 | 0 |
| System | 5 | 1 | 3 | 1 | 0 |
| Integration | 3 | 2 | 0 | 1 | 0 |
| Pallet | 6 | 0 | 6 | 0 | 0 |
| Inbound | 6 | 0 | 4 | 2 | 0 |
| Inbound Temp | 3 | 0 | 1 | 2 | 0 |
| Forklift | 6 | 0 | 4 | 2 | 0 |
| Outbound | 5 | 0 | 4 | 1 | 0 |
| Inventory | 9 | 0 | 8 | 1 | 1 sub-page |
| Dashboard | 2 | 0 | 2 | 0 | 0 |

## Trang chưa tồn tại

1. `/inventory/by-sku/[code]/locations` — drill-down từ UC-INV-01 sang DS các ô chứa mã hàng.

## Field bắt buộc trong DB nhưng chưa có UI

1. `ItemCode.photo_url` — UI form tạo mã hàng không có upload ảnh.
2. `Attachment.note` — UI attachment không cho nhập mô tả.
3. `User.last_login_at` — UI quản lý user không hiển thị cột này.
4. `Pallet.location_id` — UI chi tiết pallet KHÔNG hiển thị mã vị trí hiện tại (gap lớn nhất).

## Workflow lệch hoàn toàn (cần thiết kế lại)

| UC | Vấn đề |
|---|---|
| UC-AUTH-04 | Mockup dùng email-link, code dùng OTP. Cần confirm chuẩn. |
| UC-FK-05 | Code chỉ trả vị trí, không cho sửa nội dung — sai bản chất UC. |
| UC-FK-04 | Chỉ có TH-A (rút nguyên), thiếu TH-B (rút một phần). |
| UC-OUT-05 | Thiếu 2 cách (file SL xuất + PYX); chỉ có nhập tay. |
| UC-INTMP-02 | Chuẩn hóa 3 bước (KT nguồn → Map mã → Tạo PHN) → code 1 nút. |
| UC-IN-04 | Thiếu UI điều kiện chốt + quyết định chênh lệch. |
| UC-INT-03 | Mockup là modal cấu hình, code là 1-click. |

## Khuyến nghị triển khai (sắp xếp ưu tiên)

**Sprint A (1 tuần):** Sửa các field hiển thị thiếu (đã có DB):
- Hiển thị mã vị trí trên pallet detail (UC-PAL-06).
- Hiển thị `last_login_at` trong user list (UC-SYS-04).
- Thêm cột Mã hàng/Lô/SL/Người trong forklift history (UC-FK-06).
- Thêm tổng SL nhập/yêu cầu trong inbound list (UC-IN-05).

**Sprint B (2 tuần):** Bổ sung field BẮT BUỘC theo mockup:
- UC-INTMP-01: thêm Nguồn hàng, Người giao, Ngày giờ, Lý do, Ảnh chứng từ.
- UC-IN-04: thêm UI điều kiện chốt + dropdown quyết định.
- UC-PAL-02: thêm quy đổi thùng→lẻ + quy cách + trọng lượng.
- UC-SYS-01: thêm logo/favicon/hotline/email/footer.

**Sprint C (3 tuần):** Bổ sung workflow lớn:
- UC-FK-05: cho phép sửa nội dung + audit log.
- UC-FK-04: thêm TH-B rút một phần + màn xác nhận.
- UC-OUT-05: build 2 cách (file + PYX entity mới).
- UC-INV-09: trang tạo phiếu mới + Pallet/Vị trí/Lô.
- UC-INTMP-02: workflow 3 bước.

**Sprint D (2 tuần):** Bổ sung báo cáo + visualization:
- UC-DASH-02: card nhóm hàng + top SKU + phiếu chờ xử lý.
- UC-INV-04/05: KPI cards + cấu hình mail.
- UC-OUT-02: chart Top 5 + Theo nhóm.
- UC-OUT-04: công thức forecast + bulk tạo phiếu.

---

**Hết báo cáo.** Liên hệ Tech Lead trước khi sửa file 🔒 PROTECTED (xem `docs/CRITICAL_PATHS.md`).

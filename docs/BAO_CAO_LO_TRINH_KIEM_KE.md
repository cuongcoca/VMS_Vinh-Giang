# BÁO CÁO TIẾN ĐỘ & ĐÁNH GIÁ BACKEND: VAI TRÒ NGƯỜI KIỂM KÊ
*Ngày báo cáo: 22/05/2026*
*Hệ thống: Vinh Giang WMS*

Báo cáo này rà soát toàn bộ các Use Case thuộc vai trò **Người kiểm kê** dựa trên hiện trạng mã nguồn Backend (Next.js API & Prisma Schema) và xác nhận cấu hình cổng truy cập ứng dụng di động tại đường dẫn `https://188.166.210.73/kiemke`.

---

## 1. CỔNG TRUY CẬP ỨNG DỤNG (https://188.166.210.73/kiemke)

> [!NOTE]
> Đường dẫn `https://188.166.210.73/kiemke` đã được thiết lập và cấu hình thành công trên VPS:
> - **Thư mục lưu trữ:** `/var/www/wms-vinhgiang/vaitro/kiemke/`
> - **Phân quyền:** Đã cấp quyền `www-data:www-data` và chmod `755` để Nginx có thể phục vụ tĩnh trực tiếp.
> - **Cổng xem trước:** Đã tích hợp đầy đủ **11 màn hình mockup di động** (`01_trang_chu` đến `11_ho_so_tai_khoan`) cùng trang điều hướng trung tâm `index.html`.
> - **Hoạt động:** Người kiểm kê có thể truy cập bằng điện thoại qua đường dẫn trên để xem trước giao diện và chuẩn bị cho việc tích hợp API.

---

## 2. BẢNG TỔNG HỢP ĐÁNH GIÁ 12 USE CASE VAI TRÒ KIỂM KÊ

Dưới đây là chi tiết so sánh giữa yêu cầu đặc tả (Use Cases) và hiện trạng triển khai trong Backend:

| Mã Use Case | Tên Use Case | Mức độ ưu tiên | Trạng thái Backend | File Backend / Model tương ứng | Đánh giá & Ghi chú |
| :--- | :--- | :---: | :---: | :--- | :--- |
| **UC-AUTH-01** | Đăng nhập | Must | **HOÀN THÀNH** | `/api/auth/login`<br>Model: `User`, `Session` | Đầy đủ validate email/SĐT, băm mật khẩu `bcrypt`, khóa tài khoản sau 5 lần nhập sai, ghi nhận thiết bị & IP. |
| **UC-AUTH-03** | Đổi mật khẩu | Must | **HOÀN THÀNH** | `/api/auth/change-password` | Kiểm tra mật khẩu cũ, độ mạnh mật khẩu mới, và thu hồi (revoke) các session khác của tài khoản. |
| **UC-AUTH-04** | Quên mật khẩu | Must | **HOÀN THÀNH** *(Mock)* | `/api/auth/forgot-password/*`<br>Model: `OtpCode`, `PasswordResetToken` | Quy trình 3 bước bảo mật (Send OTP -> Verify -> Reset). Hiện tại OTP đang ở chế độ mock (in ra console và trả về response để tiện test). |
| **UC-PAL-06** | Xem lịch sử pallet | Must | **HOÀN THÀNH** | `/api/pallets/[id]/history`<br>Model: `Pallet`, `AuditLog` | Truy xuất toàn bộ lịch sử thay đổi trạng thái pallet từ bảng `audit_logs` (thao tác bởi ai, lúc nào, thay đổi gì). |
| **UC-FK-06** | Lịch sử luân chuyển | Should | **HOÀN THÀNH** | `/api/movements`<br>Model: `Movement` | Lọc và hiển thị dòng thời gian luân chuyển pallet giữa các vị trí kho (`from_location` -> `to_location`). |
| **UC-INV-01** | Lập phiếu yêu cầu nhập | Must | **HOÀN THÀNH** | `/api/inbound`<br>Model: `InboundRequest`, `InboundLine` | *Lưu ý:* Đặc tả gốc gán cho Kế toán kho. Tuy nhiên API backend đã sẵn sàng cho việc tạo mới và thêm dòng hàng. |
| **UC-INV-02** | Tồn kho theo vị trí | Must | **HOÀN THÀNH** | `/api/inventory/by-location`<br>Model: `Location`, `Pallet`, `PalletLine` | Lấy chi tiết hàng hóa ở từng ô kệ, thống kê tổng số thùng (qty_box) và tổng hợp theo từng Khu vực (Zone). |
| **UC-INV-06** | Kiểm kê theo vị trí | Must | **HOÀN THÀNH** | `/api/stock-count`<br>Model: `StocktakeSession`, `StocktakeCount` | Tạo phiên kiểm kê `BY_LOCATION`, nạp tồn hệ thống tự động, cập nhật số thực đếm, đối soát chênh lệch. |
| **UC-INV-07** | Kiểm kê theo mã hàng | Must | **HOÀN THÀNH** | `/api/stock-count`<br>Model: `StocktakeSession`, `StocktakeCount` | Tạo phiên kiểm kê `BY_ITEM`, gom tồn của SKU trên tất cả ô kệ để kiểm, cập nhật số lượng thực tế. |
| **UC-DASH-01** | Dashboard theo vai trò | Must | **CHƯA HOÀN THIỆN ĐẦY ĐỦ** | `/api/dashboard/kpi` | API hiện tại trả về bộ KPI dùng chung cho toàn bộ kho. Chưa có logic phân loại thông tin riêng biệt cho vai trò `KIEM_KE` (chỉ hiển thị phiên kiểm kê được phân công). |
| **UC-SYS-05** | Profile cá nhân | Must | **CHƯA HOÀN THIỆN ĐẦY ĐỦ** | `/api/auth/me`<br>`/api/users/[id]` | Mới chỉ lấy được thông tin cơ bản và cập nhật Tên. Chưa hỗ trợ đổi ảnh đại diện (avatar) hay ca trực. |
| **UC-INT-01** | Quét barcode/QR Code | Must | **HỖ TRỢ TỐT** | `/api/locations?q=...`<br>`/api/item-codes?search=...` | Backend hỗ trợ tra cứu nhanh vị trí / sản phẩm qua mã quét được từ camera/thiết bị di động. |

---

## 3. CHI TIẾT CÁC PHẦN ĐÃ LÀM ĐƯỢC (DONE)

### A. Hạ tầng & Giao diện xem trước trên thiết bị di động
- Cấu hình Nginx phục vụ tĩnh toàn bộ thư mục `/kiemke` độc lập với Web App chính `/wms`.
- Tải lên và giải nén 11 màn hình giao diện di động. Nhân viên kiểm kê truy cập là có ngay giao diện chuẩn mobile-first, sử dụng Tailwind CSS và Font chữ "Be Vietnam Pro" theo đúng thiết kế yêu cầu.

### B. Nghiệp vụ cốt lõi Kiểm kê (Stock Count / Stocktake)
Backend đã thiết kế cấu trúc CSDL và viết API xử lý nghiệp vụ kiểm kê rất chi tiết và an toàn:
1. **Tạo phiên kiểm kê (`POST /api/stock-count`):**
   - Phân tách rõ ràng giữa 2 hình thức: Kiểm kê theo Vị trí (`BY_LOCATION`) và Kiểm kê theo Mã hàng (`BY_ITEM`).
   - Tự động quét CSDL để lấy số lượng tồn hệ thống hiện tại (`system_qty`) của các pallet đang lưu kho tại thời điểm tạo phiên, tránh tình trạng sai lệch số liệu lịch sử.
   - Tự động sinh mã phiên kiểm kê theo định dạng chuẩn: `KK-YYYY-NNN` (ví dụ: `KK-2026-001`).
2. **Ghi nhận kết quả đếm (`PUT /api/stock-count/[id]`):**
   - Cho phép cập nhật số lượng thực tế (`actual_qty`) đếm được của từng dòng, lưu vết ghi chú (`note`), thời gian kiểm (`counted_at`).
   - Tự động tính toán chênh lệch thừa/thiếu (`discrepancy = actual_qty - system_qty`).
   - Tự động chuyển trạng thái phiên kiểm sang `COUNTING` (Đang kiểm kê).
3. **Hoàn tất kiểm kê (`POST /api/stock-count/[id]/complete`):**
   - Chặn không cho hoàn tất nếu còn dòng hàng chưa được đếm.
   - Tự động phân loại: Nếu không có chênh lệch -> Chuyển trạng thái sang `CLOSED` (Đóng phiên). Nếu có chênh lệch -> Chuyển sang `RECONCILING` (Chờ đối chiếu) để cấp quản lý xử lý chênh lệch tồn kho.

### C. Xem tồn kho và lịch sử pallet
- **Tra cứu tồn kho theo vị trí:** API `/api/inventory/by-location` cung cấp dữ liệu trực quan cho sơ đồ kho. Thống kê theo Zone (Khu A, Khu B,...) kèm số ô trống, ô đã có pallet để hiển thị trực quan lên ứng dụng di động.
- **Tra cứu lịch sử pallet:** API `/api/pallets/[id]/history` trả về đầy đủ lịch sử hoạt động của pallet, lấy thông tin từ bảng `audit_logs` giúp nhân viên kiểm kê biết pallet này từng thay đổi những gì, do ai thực hiện.
- **Lịch sử luân chuyển kệ:** API `/api/movements` trả về lịch sử di chuyển pallet thực hiện bởi xe nâng, hữu ích cho việc truy tìm các pallet bị lạc vị trí khi kiểm kê phát hiện sai lệch.

---

## 4. CHI TIẾT CÁC PHẦN CHƯA HOÀN THIỆN & CẦN CẢI THIỆN (GAPS)

Để ứng dụng kiểm kê hoạt động mượt mà trên điện thoại thực tế, Backend cần bổ sung các điểm sau:

### 1. Dashboard riêng cho Người kiểm kê (`UC-DASH-01`)
- **Hiện tại:** API `/api/dashboard/kpi` trả về số liệu chung của cả kho (tổng tồn, kg, việc xe nâng, cảnh báo HSD).
- **Yêu cầu bổ sung:** Cần lọc chỉ trả về các chỉ số mà người kiểm kê quan tâm như:
  - Số phiên kiểm kê đang mở cần thực hiện.
  - Số vị trí được phân công đếm trong ngày.
  - Tỷ lệ hoàn thành công việc kiểm kê.

### 2. Thông tin ảnh đại diện và ca trực trong Hồ sơ cá nhân (`UC-SYS-05`)
- **Hiện tại:** Bảng `users` trong DB chưa có cột lưu đường dẫn ảnh đại diện (`photo_url` hoặc `avatar_url`). API `/api/users/[id]` chỉ cho sửa Tên (`full_name`) và Quyền (`role`).
- **Yêu cầu bổ sung:** 
  - Thêm cột `avatar_url` vào bảng `User` trong file `prisma/schema.prisma`.
  - Tạo endpoint upload ảnh đại diện (kết hợp lưu file vào thư mục public hoặc cloud).

### 3. Tích hợp cổng gửi OTP thật (`UC-AUTH-04`)
- **Hiện tại:** Việc gửi OTP khi quên mật khẩu đang giả lập (Mock).
- **Yêu cầu bổ sung:** Tích hợp với dịch vụ SMS Gateway (FPT/VNPT) hoặc hệ thống gửi Email Mailgun/SMTP thực tế để gửi OTP cho người dùng di động.

---

## 5. ĐÁNH GIÁ TIẾN ĐỘ & KẾ HOẠCH BÀN GIAO TIẾP THEO

- **Tiến độ Backend cho vai trò Kiểm kê:** **~90%** (Nghiệp vụ cốt lõi đã chạy tốt trên API).
- **Tiến độ Frontend:** **100%** (Đã dựng xong giao diện tĩnh và đưa lên link `https://188.166.210.73/kiemke`).
- **Liên kết Frontend - Backend:** **0%** (Các file HTML hiện trạng vẫn dùng dữ liệu tĩnh mẫu).

### Lộ trình tiếp theo để đưa vào sử dụng:
1. **Bước 1: Kết nối API vào Giao diện kiểm kê di động:**
   Viết mã JavaScript trong các trang HTML tĩnh ở `/var/www/wms-vinhgiang/vaitro/kiemke/` để gọi API Backend (sử dụng token JWT sau khi đăng nhập để xác thực).
2. **Bước 2: Tích hợp thư viện quét mã bằng Camera:**
   Sử dụng thư viện quét mã vạch JS (như `html5-qrcode` hoặc SDK của thiết bị quét chuyên dụng) tích hợp vào màn hình quét mã (`04_quet_ma_vach`) để tự động điền mã vị trí/pallet và gọi API tìm kiếm.
3. **Bước 3: Tinh chỉnh Database & API Dashboard:**
   Thực hiện bổ sung cột `avatar_url` cho User và tối ưu hóa API Dashboard để trả thông tin cá nhân hóa theo vai trò `KIEM_KE`.

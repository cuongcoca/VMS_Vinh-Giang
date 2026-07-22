# Changelog

All notable changes to this project will be documented in this file.

## [2026-06-11]

- **Giao diện Tồn kho (`/inventory`):**
  - Loại bỏ bộ lọc dropdown nhóm hàng ("Tất cả nhóm") theo yêu cầu của người dùng để tối giản hóa bộ lọc tìm kiếm.
  - Chuẩn hóa phân trang client-side bằng cách tích hợp helper `useClientPagination` và component `<ListPageFooter />` dùng chung (thỏa mãn yêu cầu kiểm thử `TC_PENDING_004`), đảm bảo thanh phân trang và selector số dòng/trang luôn hiển thị kể cả khi danh sách ít hơn 50 bản ghi.
  - Khắc phục lỗi lệch số lượng SKU dưới định mức tối thiểu giữa trang Tồn kho chính và Trung tâm cảnh báo (đồng bộ từ 1 SKU lên 2 SKU): API `/api/inventory/by-item` đã được cập nhật để trả về cả các mã hàng đã chuẩn hóa có số lượng bằng 0 nhưng có cấu hình định mức tồn tối thiểu (`min_stock > 0`), giúp hiển thị chính xác các mã cần nhập hàng.
- **Tự động hóa điều phối xe nâng (FEFO task picking):**
  - **API Phiếu xuất (`requests/[id]/route.ts`):** Tự động tính toán gợi ý FEFO các pallet cần lấy cho từng dòng hàng khi kế toán bắt đầu lấy hàng, trả về dưới dạng danh sách `suggested_pallets` trong chi tiết phiếu xuất.
  - **API Hàng đợi Xe nâng (`queue/route.ts`):** Trả về các phiếu xuất đang ở trạng thái `PICKING` khi tài xế xe nâng yêu cầu danh sách công việc `TO_STAGING_OUT`, đồng thời cập nhật KPI cho xe nâng.
  - **Màn hình checklist di động mới (`/forklift/outbound/[id]/page.tsx`):** Tạo màn hình di động cho tài xế xe nâng hiển thị danh sách pallet và vị trí cần di chuyển (lấy theo FEFO), hỗ trợ di chuyển nguyên pallet (`mode = FULL`) và di chuyển một phần (`mode = PARTIAL`) kèm modal nhập số lượng tiện lợi.
  - **Dashboard xe nâng (`ForkliftMobileDashboard.tsx`):** Hiển thị hàng đợi các phiếu xuất đang lấy hàng và tạo liên kết trực tiếp tới màn hình nhiệm vụ di động.
  - **Định tuyến thông báo (`NotificationBell.tsx`):** Cấu hình dịch đường dẫn thông báo xuất kho cho xe nâng trỏ chính xác đến màn hình nhiệm vụ di động mới.
- **Quản lý người dùng & Hồ sơ (`UC-INV-01`, `UC-SYS-05`):**
  - **Mở/Khóa tài khoản (`TC02`):** Tích hợp hộp thoại xác nhận lại (`window.confirm`) trước khi thực hiện thao tác khóa hoặc mở khóa tài khoản của người dùng.
  - **Popup tạo tài khoản (`TC04`):** Loại bỏ sự kiện click đóng khi click ra ngoài backdrop nền mờ của modal Thêm/Sửa người dùng để tránh việc vô tình mất dữ liệu đang nhập.
  - **Hồ sơ cá nhân di động (`TC03`, `TC05`):** 
    - Chuyển trường số điện thoại trong component [MobileAccountSettings.tsx](file:///d:/wms-vinhgiang_repo/src/components/mobile/MobileAccountSettings.tsx) sang trạng thái `disabled` (vô hiệu hóa) khi chỉnh sửa thông tin cá nhân trên giao diện di động.
    - Tăng giới hạn dung lượng file ảnh đại diện upload và chụp hình từ 2MB lên **5MB** trong component [MobileAccountSettings.tsx](file:///d:/wms-vinhgiang_repo/src/components/mobile/MobileAccountSettings.tsx).
    - Cập nhật các file layout di động ([thukho/layout.tsx](file:///d:/wms-vinhgiang_repo/src/app/thukho/layout.tsx), [kiemke/layout.tsx](file:///d:/wms-vinhgiang_repo/src/app/kiemke/layout.tsx), [forklift/layout.tsx](file:///d:/wms-vinhgiang_repo/src/app/forklift/layout.tsx)) để tự động kết xuất ảnh đại diện của người dùng di động ở góc trái thanh tiêu đề (Header Top Bar) nếu họ đã tải lên ảnh thành công, thay cho các biểu tượng icon tĩnh mặc định trước đó.
- **Giao diện Gợi ý nhập hàng (`/wms/outbound/reorder`):**
  - Chuyển màu nút "Tạo phiếu nhập" sang màu đỏ (`bg-rose-600`) khi chưa chọn mã hàng nào và chuyển sang màu xanh lá (`bg-emerald-600`) khi đã chọn ít nhất 1 mã hàng.
- **Giải quyết triệt để lỗi 404 khi nhấn thông báo cho tất cả các vai trò (`/thukho`, `/kiemke`, `/xenang`, `/wms`):**
  - Tích hợp bộ dịch đường dẫn tập trung `getNormalizedRoute` tại [NotificationBell.tsx](file:///d:/wms-vinhgiang_repo/src/components/shared/NotificationBell.tsx) để tự động phân tích loại thực thể (`stock-count`, `adjustments`, `inbound`, `inbound-temp`, `pallet`, `outbound`, `item-codes`) từ bất kỳ URL thô nào được gửi từ Backend.
  - Tự động chuẩn hóa và ánh xạ đường dẫn đích theo vai trò người dùng (sử dụng `basePath` đang hoạt động) để loại bỏ hoàn toàn nguy cơ 404:
    - **Thủ kho (`/thukho`):** Ánh xạ các thông báo kiểm kê lệch (`/ketoan/stock-count/[id]`) sang danh sách kiểm kê `/thukho/warehouse/stocktake`, phiếu điều chỉnh sang `/thukho/warehouse/movements`, phiếu yêu cầu nhập từ Excel sang `/thukho/adhoc/[id]`, phiếu nhập chính thức sang `/thukho/inbound/[id]`, chi tiết pallet sang `/thukho/pallet/[id]`, yêu cầu xuất kho sang `/thukho/warehouse/staging`, tạo mã hàng sang `/thukho/item-code/new`.
    - **Kiểm kê (`/kiemke`):** Ánh xạ kiểm kê lệch `/ketoan/stock-count/[id]` sang `/kiemke/tasks/[id]` khớp với vai trò.
    - **Xe nâng (`/xenang`):** Ánh xạ thông tin pallet sang `/xenang/forklift/pallet`.
    - **Kế toán/Quản lý (`/wms`):** Ánh xạ các link từ `/ketoan/` hay `/thukho/` thành các trang chi tiết chuẩn trên desktop (`/wms/inbound-adhoc/[id]`, `/wms/stock-count/[id]`, `/wms/inventory/adjustments/[id]`, `/wms/pallets/[id]`, `/wms/outbound/requests/[id]`).
- **Sửa lỗi hiển thị Modal Thủ kho di động (Pallet):**
  - Khắc phục lỗi các nút Xác nhận và Mở khóa / Yêu cầu sửa pallet bị ẩn đằng sau thanh điều hướng dưới (Bottom Navigation Bar) trên màn hình chi tiết pallet của thủ kho (`/thukho/pallet/[id]`).
  - Sử dụng React Portal (`createPortal` từ `react-dom`) để kết xuất các modal (Confirm Dialog, Success Screen, Unlock Dialog, BarcodeScannerModal) trực tiếp vào `document.body`, đưa chúng ra khỏi stacking context cục bộ của thẻ `<main className="overflow-y-auto">`.
  - Điều chỉnh padding-bottom của các wrapper modal từ `pb-24` về `pb-4` giúp các hộp thoại hiển thị cân đối và đẹp mắt trên các thiết bị di động.
- **Quản lý mã hàng & Quét mã vạch (`item-codes`):**
  - Bổ sung trường "Mã vạch (Barcode)" vào bảng dữ liệu `ItemCode` trong schema cơ sở dữ liệu.
  - Cập nhật API POST `/api/item-codes` và PUT `/api/item-codes/[id]` để tiếp nhận, validate và cập nhật thông tin mã vạch của mã hàng tạm.
  - Tự động sao chép thông tin mã vạch từ `ItemCode` sang sản phẩm chuẩn (`Product.barcode`) khi thực hiện chuẩn hóa mã hàng.
  - Thiết kế lại các form popup "Tạo mã hàng mới" và "Chuẩn hóa mã hàng", tích hợp thêm input "Mã vạch (Barcode)" và nút gọi `BarcodeScannerModal` cho phép quét mã vạch trực tiếp qua camera thiết bị.
  - Hiển thị trực quan mã vạch dạng nhãn nhỏ bên dưới mã hàng trong bảng quản lý.
- **Xuất Excel Master Data đầy đủ:**
  - Khắc phục lỗi nút "Xuất Excel" trên trang danh mục sản phẩm (Master Data) chỉ xuất dữ liệu 1 trang (10 sản phẩm).
  - Tích hợp callback `fetchAllProductsForExport` sử dụng API bất đồng bộ để tự động tải toàn bộ danh sách sản phẩm khớp với bộ lọc tìm kiếm hiện tại (nhóm hàng, trạng thái, từ khóa) với giới hạn tối đa 100.000 bản ghi.
  - Cập nhật component `ExcelExport` hỗ trợ nạp dữ liệu động khi click chuột thông qua thuộc tính `fetchData`.
- **Cấu hình Email (`UC_SYS_02_TC07`):**
  - Thay thế nút checkbox "smtp_secure" bằng hộp chọn (select dropdown) "Bảo mật" gồm các tuỳ chọn `TLS`, `SSL` và `None` khớp hoàn toàn với thiết kế Mockup.
  - Cập nhật logic đánh giá `secure` của transporter trong `src/lib/mailer.ts` để nhận diện giá trị bảo mật mới, đảm bảo tính tương thích ngược với cấu hình `"true"`/`"false"` trước đó.
- **Hồ sơ cá nhân di động (`UC-SYS-05`):**
  - Bổ sung tính năng thay đổi ảnh đại diện (avatar upload) đồng bộ cho cả 3 phân hệ Mobile Web (`kiemke`, `thukho`, `forklift`) thông qua component dùng chung `MobileAccountSettings`.
  - Tích hợp các bộ lọc kiểm soát định dạng ảnh (.png, .jpg, .jpeg, .webp) và giới hạn dung lượng tải lên tối đa là 2MB.
  - Căn chỉnh hiển thị ảnh đại diện chuẩn hình tròn tỉ lệ `object-cover` trên thanh tiêu đề và thông tin cá nhân của các trang hồ sơ di động, đảm bảo không vỡ layout khi upload ảnh nhỏ.
- **Đính kèm ảnh chứng từ / hàng hóa (`UC-INT-02`):**
  - **Hỗ trợ chọn ảnh từ thư viện (`TC03`, `TC14`):** Loại bỏ thuộc tính `capture="environment"` trên thẻ input file để hiển thị hộp thoại native, cho phép người dùng di động tùy chọn tải ảnh từ Thư viện ảnh (Gallery) hoặc Chụp ảnh trực tiếp từ Camera.
  - **Mô tả & ghi chú ảnh (`TC09`, `TC10`):** Bổ sung ô nhập ghi chú (`textarea`) tối đa 500 ký tự ở Frontend và cơ chế lưu vào DB qua FormData. Thêm validate server-side ở API `/api/attachments` chặn ghi chú vượt quá 500 ký tự.
  - **Xem trước ảnh lớn (`TC15`):** Tích hợp Modal Lightbox phóng to khi click vào thumbnail ảnh cũ/mới đính kèm, hiển thị chi tiết tên file và nội dung mô tả ghi chú của ảnh.
  - **Tối ưu xóa ảnh (`TC16`):** Thiết kế lại nút xóa (dấu `×` màu đỏ) với kích thước `w-8 h-8` to hơn, căn lề và xử lý sự kiện `stopPropagation` để không kích hoạt modal xem ảnh khi xóa.
- **Sửa lỗi Xe nâng & Luân chuyển (9 Testcases):**
  - **Scanner & Modal QR (`UC-FK-02_TC15`, `UC-FK-03_TC18`):** Thêm cảnh báo tự động báo lỗi sau 15 giây nếu không nhận diện được mã QR, và hiển thị trực tiếp lỗi camera trên giao diện.
  - **Quét QR Pallet màn chuyển vị trí (`UC-FK-03_TC09`, `UC-FK-03_TC17`):** Tích hợp nút quét QR trực tiếp và modal camera cho ô chọn Pallet, tự động báo lỗi Toast nếu pallet không tồn tại hoặc không ở trạng thái lưu kho.
  - **So khớp mã hàng màn Stage Out (`UC-FK-04_TC01`, `UC-FK-04_TC03`):** Cải tiến thuật toán so khớp mã hàng, hỗ trợ so khớp linh hoạt cả mã nội bộ (`code`), mã vạch (`product.barcode`) và mã SKU của sản phẩm.
  - **Kiểm tra số lô hợp lệ khi Hoàn trả pallet (`UC-FK-05_TC11`):** Thêm kiểm tra ở API hoàn trả pallet để chặn hành vi sửa đổi/nhập số lô hàng không tồn tại cho mã hàng tương ứng.
  - **Nâng cấp Lịch sử luân chuyển (`UC-FK-06_TC02`, `UC-FK-06_TC15`, `UC-FK-06_TC19`):**
    - Sửa nhãn trạng thái `STAGE_OUT` hiển thị thành *"Xuất FEFO"*.
    - Nạp đầy đủ thông tin dòng hàng đối với chuyển pallet ghép trên giao diện timeline lịch sử.
    - Sửa lỗi múi giờ (GMT+7) cho bộ lọc tìm kiếm di chuyển trong ngày hôm nay.
    - Sửa lỗi file xuất Excel/CSV: thêm chỉ định `sep=,` ở đầu tệp và gộp danh sách mã hàng của pallet ghép bằng dấu `;` trên cùng một hàng để hiển thị đúng cột.
- **Quản lý người dùng (`UC-SYS-04`):**
  - **Sửa lỗi hiển thị cảnh báo:** Chuyển đổi thông báo kết quả từ local toast `z-50` sang global `useToast` (`z-[60]`) để không bị che khuất đằng sau lớp phủ và popup "Thêm người dùng mới".
  - **Tìm kiếm theo Số điện thoại:** Bổ sung cột số điện thoại (`u.phone`) vào bộ lọc tìm kiếm trên client để hiển thị đúng khi tìm theo SĐT, đồng thời cập nhật placeholder tìm kiếm.
- **Cân lại tồn (`UC-OUT-05`):**
  - Đồng bộ hoá các nhãn tiêu đề cột trong bảng preview cân lại tồn của tất cả 3 phương thức xuất hàng (Nhập tay, Excel, PYX) theo đúng thiết kế và yêu cầu kiểm thử:
    - Đổi cột "Tên" / "Tên (hệ thống)" thành "Tên hàng"
    - Đổi cột "SL đã xuất" / "SL từ Excel" / "SL yêu cầu" thành "Số lượng"
    - Đảm bảo hiển thị đầy đủ cột "Trạng thái" trong bảng dòng hàng nhập tay.


### Deployed
- Đồng bộ và triển khai mã nguồn lên VPS Công ty (`42.96.16.197`) và VPS Cá nhân (`188.166.210.73`).
- Khắc phục lỗi xuất Excel giới hạn 1 trang trên Master Data.
- Triển khai tính năng Quét/Tạo mã vạch cho phân hệ Quản lý mã hàng (Item Codes), đã đồng bộ database schema và chạy ổn định.
- Biên dịch thành công Next.js cho cả 4 instance chạy song song (`wms`, `xenang`, `thukho`, `kiemke`).
- Restart các tiến trình PM2 tương ứng và lưu cấu hình trạng thái, xác minh toàn bộ các endpoint trả về mã HTTP 200 (OK).

## [2026-06-10]
### Fixed
- **Kiểm kê & tồn kho - Ưu tiên 1 (UC-INV-06 & UC-INV-07):**
  - **Tạo phiếu kiểm kê:** Tách biệt các mặt hàng khi kiểm kê theo vị trí (BY_LOCATION) và tách biệt các vị trí khi kiểm kê theo mã hàng (BY_ITEM) thay vì gộp chung, đảm bảo hiển thị chi tiết đầy đủ SKU và Vị trí tương ứng trên cả Web Admin và Mobile.
  - **Bảng đối chiếu Web Admin:** Bỏ điều kiện ẩn cột "Mã hàng" để luôn hiển thị đồng thời cả cột Vị trí và Mã hàng trên trang chi tiết phiên kiểm kê.
  - **Chuỗi thông báo lỗi quét vị trí:** Đồng bộ hiển thị lỗi quét vị trí không tồn tại trên mobile trực tiếp từ API (`json.error`) thay vì hardcode.
  - **Cảnh báo quét thất bại:** Cung cấp thông điệp chứa tiền tố `"Lỗi quét thất bại."` trực quan khi giải mã ảnh chụp mã vạch không thành công hoặc lỗi camera.
- **Kiểm kê & tồn kho - Ưu tiên 2 (UC-INV-08):**
  - **Khóa xử lý chênh lệch:** Chặn tạo phiếu điều chỉnh ở cả API POST `/api/adjustments` và UI trang chênh lệch nếu phiên kiểm kê đã `CLOSED` hoặc đã có phiếu điều chỉnh ở trạng thái `PENDING` / `APPROVED` để chống trùng lặp.
  - **Khóa cập nhật số lượng:** Chặn chỉnh sửa/cập nhật số lượng kiểm kê ở API PUT `/api/stock-count/[id]` nếu phiên kiểm kê đã `CLOSED`.
- **Kiểm kê & tồn kho - Ưu tiên 3 (UC-INV-05):**
  - **Widget tồn tối thiểu:** Sửa lỗi Widget hiển thị sai (luôn trả về 0) số lượng SKU dưới mức tồn tối thiểu (`low_stock_skus`) trên API dashboard kế toán.
- **Lỗi Camera quét barcode (Barcode Scanner):**
  - Khắc phục lỗi đen màn hình và đơ khi đổi camera bằng cách `await` quá trình giải phóng camera cũ trước khi khởi động camera mới (tránh race condition).
  - Khắc phục lỗi bỏ qua tùy chọn Camera sau (luôn chọn camera trước) do gộp trực tiếp `deviceId` vào thuộc tính `videoConstraints` trước khi truyền vào thư viện `html5-qrcode`.
  - Tự động nhận diện thiết bị và gán nhãn thân thiện (ví dụ: *"Camera sau (Chính)"*) thay vì dùng nhãn mặc định của trình duyệt.
  - Ngăn chặn tình trạng tự động nhảy sang chế độ nhập tay khi gặp lỗi chuyển đổi camera tạm thời.
- **Lỗi quét Pallet báo "Không tồn tại" trên ứng dụng Xe nâng:**
  - Cập nhật hàm `handleScan` trong `src/app/forklift/pallet/page.tsx` thực hiện gọi API `/api/pallets/by-code?code=...` để tra cứu trực tiếp trong cơ sở dữ liệu nếu pallet quét được nằm ngoài 200 bản ghi mới nhất đã tải sẵn local.

### Deployed
- Sync các file sửa đổi lên VPS Công ty (`42.96.16.197`).
- Biên dịch Next.js thành công cho các phân hệ `kiemke` (`BASE_PATH=/kiemke`) và `wms` (`BASE_PATH=/wms`).
- Restart toàn bộ các tiến trình PM2 liên quan (`wms-kiemke`, `wms-vinhgiang`, `wms-thukho`, `wms-xenang`) và xác minh phản hồi HTTP 200 hoạt động tốt.

## [2026-05-25]

### Changed
- Cập nhật trang đăng nhập chính tại `/wms/auth` (file `src/app/auth/page.tsx`):
  - Xóa dòng chữ "Vĩnh Giang" trong Brand Header.
  - Phóng to logo của hệ thống WMS Vĩnh Giang từ `w-16 h-16` lên `w-24 h-24`.
  - Thay đổi màu chữ phụ đề "Warehouse Management System" sang màu `rgb(0, 30, 113)`.
  - Loại bỏ hoàn toàn phần Footer chứa thông tin hỗ trợ kỹ thuật và trạng thái hoạt động ở cuối.
- Thay thế toàn bộ logo của hệ thống bằng phiên bản siêu độ phân giải `1373x1145` từ `asset/logo.png` và tái tạo tự động các tệp tin favicon/icon bình phương sắc nét.
- Đã triển khai và biên dịch thành công Next.js (`wms-vinhgiang` instance) trên VPS cá nhân `188.166.210.73` đồng thời restart PM2 service.

## [2026-05-22]

### Added
- Created a premium mobile-first hub page `vaitro/kiemke/index.html` to navigate the 11 inventory mockup screens.
- Created `scratch/deploy_local.js` to facilitate native SCP transfer to the correct VPS folders using pre-configured SSH keys.

### Changed
- Extracted 11 mockup zip archives under `vaitro/kiemke` into subdirectories.
- Updated `DEPLOY.md` to reference the correct VPS IP `188.166.210.73` instead of `42.96.16.197`.
- Modified `ssh-run.js` and `ssh-upload.js` to target the active VPS IP and use local dependencies.
- Deployed all inventory mockups to `/var/www/wms-vinhgiang/vaitro/kiemke/` (separating it from `/var/www/chioi.vn/kiemke/` of the Chi Oi project) and updated Nginx `/etc/nginx/sites-enabled/chioi` to alias the `/kiemke` route correctly.

### Added
- Created a comprehensive progress and technical evaluation report `docs/BAO_CAO_LO_TRINH_KIEM_KE.md` detailing backend coverage for the 12 inventory role use cases.

### Changed
- Centered the rectangular Vĩnh Giang logo in a square canvas and exported as high-res square `icon.png` and multi-size `favicon.ico` (containing 16px, 32px, 48px, 64px, 128px, and 256px sizes) to replace Next.js/Vercel default branding on tab favicons.
- Updated favicons and icons across `/wms` (Admin), `/xenang` (Forklift), and `/kiemke` (Mobile inventory) portals.
- Re-built Next.js application routes on VPS under both `BASE_PATH=/wms` and `BASE_PATH=/xenang` environment variables to output correct explicit `<link rel="icon">` tags.

## [2026-05-23]

### Changed
- Synced the latest codebase from personal VPS (`188.166.210.73`) to company VPS (`42.96.16.197`), which includes:
  - Delete user feature with confirmation dialog in `/system/users`
  - 5 API bug fixes (locations inclusion, pallet detail expansion, auth/me dual keys, RBAC admin role support, and FEFO no-param mode)
  - Updated `tsconfig.json`
- Rebuilt WMS Next.js production build (`BASE_PATH=/wms`) on the company VPS.
- Restarted PM2 instances `wms-vinhgiang` and `wms-xenang` on the company VPS and verified HTTP 200.
- Updated `vps-sync.js` WMS port from 3001 to 4200 in the verify command definition to match the company VPS architecture.
- Fixed 404 errors on `/thukho` and `/kiemke` by configuring them on the company VPS:
  - Updated Nginx config `khohangvinhgiang.io.vn` on the company VPS to proxy `/thukho` (port 3003) and `/kiemke` (port 3004).
  - Built Next.js for `thukho` (`BASE_PATH=/thukho`) and `kiemke` (`BASE_PATH=/kiemke`) on the company VPS.
  - Registered and started `wms-thukho` and `wms-kiemke` PM2 processes.
  - Expanded `vps-sync.js` build, restart, and verify commands to support all 4 Next.js instances.



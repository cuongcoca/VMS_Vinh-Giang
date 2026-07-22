# BÁO CÁO LỘ TRÌNH CHI TIẾT: PHÂN HỆ ĐIỀU PHỐI XE NÂNG (WEB & MOBILE)

Báo cáo này trình bày chi tiết phương án thiết kế kiến trúc, kết nối cơ sở dữ liệu thực tế và lộ trình triển khai/xác thực cho hai phân hệ:
1. **Web Điều phối Xe nâng (Admin)** tại địa chỉ `https://188.166.210.73/wms/forklift` dựa trên bản vẽ mockup `vinh_giang_wms.html` (mục `dispatch-forklift`).
2. **Mobile Web Xe nâng (Tài xế)** tại địa chỉ `https://188.166.210.73/xenang/forklift` chạy độc lập, giao diện tối ưu hóa cho thiết bị cầm tay và giữ nguyên logic quét mã/FEFO hiện tại.

---

## I. KIẾN TRÚC HỆ THỐNG VÀ GIẢI PHÁP PHÂN TÁCH GIAO DIỆN

Để không làm phức tạp hóa khâu bảo trì và tránh việc phải quản lý nhiều repository, cả hai phiên bản Web và Mobile đều **chạy chung một Codebase Next.js duy nhất**. Hệ thống sẽ tự động nhận diện môi trường truy cập để kết xuất giao diện chuẩn thông qua cấu hình Reverse Proxy Nginx và biến môi trường:

### 1. Phân chia Instance & Reverse Proxy
Trên VPS `188.166.210.73`, chúng ta cấu hình chạy 2 tiến trình Node.js (Next.js) độc lập thông qua PM2:
* **Instance WMS Admin (Cổng 3001)**: Khởi chạy với biến môi trường `BASE_PATH=/wms`. Phục vụ toàn bộ trang Web Quản lý tại `https://188.166.210.73/wms/`.
* **Instance Xe nâng di động (Cổng 3002)**: Khởi chạy với biến môi trường `BASE_PATH=/xenang`. Phục vụ phân hệ tài xế di động tại `https://188.166.210.73/xenang/`.

Asset tĩnh và API route sẽ tự động đi kèm tiền tố `/wms/_next/...` hoặc `/xenang/_next/...` tương ứng nhờ vào tính năng `basePath` của Next.js.

### 2. Định tuyến Giao diện Động (Hub Router)
Tệp [src/app/forklift/page.tsx](file:///d:/wms-vinhgiang_repo/src/app/forklift/page.tsx) được cấu hình làm Hub định tuyến ở Client-side:
```typescript
"use client";
import React from "react";
import ForkliftWebDashboard from "@/components/forklift/ForkliftWebDashboard";
import ForkliftMobileDashboard from "@/components/forklift/ForkliftMobileDashboard";

export default function ForkliftPage() {
  const isWeb = process.env.NEXT_PUBLIC_BASE_PATH === "/wms";
  return isWeb ? <ForkliftWebDashboard /> : <ForkliftMobileDashboard />;
}
```

### 3. Tối ưu hóa Layout theo Môi trường (Layout Bypass)
* **Mobile Layout ([src/app/forklift/layout.tsx](file:///d:/wms-vinhgiang_repo/src/app/forklift/layout.tsx))**:
  Nếu người dùng đang truy cập qua phân hệ Web `/wms`, layout mobile (với khung hẹp `max-w-md` và thanh điều hướng dưới) sẽ bị bỏ qua (`bypass`) để trang web có thể tự do mở rộng và tích hợp vào Layout WMS Desktop Sidebar:
  ```typescript
  if (process.env.NEXT_PUBLIC_BASE_PATH === "/wms") {
    return <>{children}</>;
  }
  ```
* **Desktop Layout ([src/components/layout/AppLayout.tsx](file:///d:/wms-vinhgiang_repo/src/components/layout/AppLayout.tsx))**:
  Ngược lại, khi chạy trên phân hệ di động `/xenang`, các trang chức năng (như `put-away`, `relocate`, `history`...) được bọc bởi `AppLayout` sẽ tự động ẩn đi Sidebar và Header của Web lớn để tránh bị biến dạng giao diện trên màn hình điện thoại:
  ```typescript
  if (process.env.NEXT_PUBLIC_BASE_PATH === "/xenang") {
    return <>{children}</>;
  }
  ```

---

## II. KẾT NỐI DATABASE VÀ API BACKEND (PRISMA ORM)

Giao diện Web Điều phối Xe nâng đã được gỡ bỏ hoàn toàn dữ liệu tĩnh (placeholder) và thay bằng việc truy vấn dữ liệu động từ PostgreSQL thông qua Prisma Client:

### 1. Chỉ số KPI Vận hành (`/api/forklift/web/kpi`)
Tính toán trực tiếp từ cơ sở dữ liệu theo thời gian thực (real-time):
* **Công việc chờ xử lý**: Số lượng Pallet có trạng thái là `CONFIRMED` (đã được thủ kho xác nhận nhưng xe nâng chưa xếp kệ).
* **Hoàn thành hôm nay**: Đếm số bản ghi trong bảng `Movement` được thực hiện từ đầu ngày hôm nay (`performed_at >= startOfDay` theo múi giờ Việt Nam UTC+7).
* **Task quá hạn**: Số lượng Pallet ở trạng thái `CONFIRMED` có thời gian xác nhận `confirmed_at` đã quá 2 tiếng so với thời điểm hiện tại.

### 2. Danh sách Nhiệm vụ di chuyển Pallet (`/api/forklift/web/tasks`)
Lấy danh sách 50 Pallet mới nhất đang ở các trạng thái hoạt động:
* `CONFIRMED` (Chờ nhập kho / Đang di chuyển).
* `IN_STAGING` (Chờ xuất kho).
* `IN_STORAGE` (Đã xếp vào kệ lưu trữ).

API tự động kết hợp thông tin SKU, tên sản phẩm từ bảng `ItemCode`, số lượng tổng thùng từ `PalletLine`, và tự động gắn cờ cảnh báo ưu tiên FEFO nếu ngày hết hạn của pallet nằm trong vòng 30 ngày tới.

### 3. Trạng thái Đội xe nâng (`/api/forklift/web/drivers`)
* Lấy danh sách tài xế xe nâng đang online từ bảng `User` lọc theo `role: 'XE_NANG'`.
* Truy vấn bảng `Movement` để lấy bản ghi di chuyển mới nhất của từng tài xế, từ đó định vị vị trí hoạt động gần nhất của họ (ví dụ: kệ A4, cửa 02).
* Tự động gán trạng thái hoạt động trực quan cho đội xe nâng: `RUNNING` (Đang chạy), `IDLE` (Nghỉ/Chờ việc), `CHARGING` (Đang sạc) và `MAINTENANCE` (Bảo trì).

---

## III. LỘ TRÌNH TRIỂN KHAI LÊN VPS (VPS DEPLOYMENT ROADMAP)

Để cập nhật và kích hoạt các thay đổi này trên môi trường sản xuất (`188.166.210.73`), hãy thực hiện theo lộ trình 5 bước dưới đây:

### Bước 1: Đẩy mã nguồn mới lên Git
Tại máy cục bộ (Local), tiến hành thêm và đẩy các thay đổi lên repository:
```bash
git add .
git commit -m "feat: implement web forklift dispatcher dashboard & dynamic layout separation"
git push origin vinhgiang1
```

### Bước 2: Kéo mã nguồn mới trên VPS
SSH vào VPS `188.166.210.73` và chuyển đến thư mục dự án `/var/www/wms-vinhgiang`, sau đó kéo code mới:
```bash
cd /var/www/wms-vinhgiang
git fetch origin
git checkout vinhgiang1
git pull origin vinhgiang1
```

### Bước 3: Cập nhật Cấu hình Môi trường & Database
Nếu có thay đổi về database schema (Prisma), tiến hành đồng bộ và cập nhật dữ liệu seed cho đội xe nâng:
```bash
# Đồng bộ DB
npx prisma db push
# Seed dữ liệu tài xế xe nâng (XE_NANG) nếu chưa có
npx prisma db seed
```

### Bước 4: Biên dịch song song hai phân hệ (Build)
Biên dịch độc lập 2 bản build để tối ưu hóa asset cho từng đường dẫn:
```bash
# Build bản Web điều phối
BASE_PATH=/wms npm run build

# Build bản Mobile tài xế
BASE_PATH=/xenang npm run build
```

### Bước 5: Khởi động lại dịch vụ qua PM2
Tiến hành restart 2 ứng dụng PM2 đang lắng nghe ở cổng 3001 và 3002:
```bash
pm2 restart wms-vinhgiang
pm2 restart wms-xenang
# Lưu lại trạng thái PM2
pm2 save
```

---

## IV. KẾ HOẠCH KIỂM THỬ VÀ XÁC NHẬN (VERIFICATION PLAN)

Sau khi hoàn tất restart dịch vụ, tiến hành kiểm tra hoạt động trên trình duyệt:

1. **Kiểm tra Web Điều phối (Admin)**:
   * Đường dẫn: `https://188.166.210.73/wms/forklift`
   * Yêu cầu: Giao diện hiển thị đầy đủ Sidebar WMS và Header. Các chỉ số KPI (24 tasks, 142 pallets...) hiển thị số liệu thực tế từ DB. Danh sách Task hiển thị đúng thông tin SKU/Sản phẩm, nút hành động (Giao việc/Điều hướng).
2. **Kiểm tra Mobile Xe nâng (Tài xế)**:
   * Đường dẫn: `https://188.166.210.73/xenang/forklift`
   * Yêu cầu: Giao diện hiển thị ở dạng Mobile-view gọn gàng, có bottom navigation bar, không bị chèn ép bởi Sidebar lớn của Web.
3. **Kiểm tra các trang chức năng của tài xế**:
   * Truy cập `https://188.166.210.73/xenang/forklift/put-away` và `https://188.166.210.73/xenang/forklift/relocate` để đảm bảo camera quét mã và form xác nhận hoạt động bình thường, không hiển thị sidebar desktop.

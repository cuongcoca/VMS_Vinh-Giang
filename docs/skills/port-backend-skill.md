# KỸ NĂNG: CHUYỂN ĐỔI BACKEND NESTJS SANG NEXT.JS (WMS VĨNH GIANG)

Tài liệu này định nghĩa quy trình chuẩn để AI Agent tự động đọc hiểu logic backend NestJS cũ và chuyển đổi thành API Routes Next.js 16 (App Router) cho dự án WMS Vĩnh Giang.

---

## 1. Bản Đồ Ánh Xạ Đường Dẫn (Path Mapping)

Khi cần code bất kỳ API nào, hãy định vị file nguồn NestJS và file đích Next.js theo sơ đồ sau:

| Module cần port | Thư mục nguồn (NestJS) | File API đích (Next.js) | Trang UI đích (Next.js) |
|---|---|---|---|
| **Nhóm hàng** | `.../backend/src/modules/master-data/categories/` | `src/app/api/product-groups/` | `src/app/product-groups/page.tsx` |
| **Đơn vị tính** | `.../backend/src/modules/master-data/units/` | `src/app/api/units/` | `src/app/units/page.tsx` |
| **Nhà cung cấp** | `.../backend/src/modules/master-data/suppliers/` | `src/app/api/suppliers/` | `src/app/suppliers/page.tsx` |
| **Vị trí/Kho** | `.../backend/src/modules/master-data/locations/` | `src/app/api/locations/` | `src/app/locations/page.tsx` |
| **Sản phẩm (SKU)**| `.../backend/src/modules/master-data/products/` | `src/app/api/products/` | `src/app/master-data/page.tsx` |

---

## 2. Quy Trình Chuyển Đổi Logic (4 Bước)

### Bước 1: Đọc hiểu file nguồn NestJS
Tìm trong thư mục module nguồn các file:
- `*.controller.ts`: Xem cấu trúc endpoint (route path, Method GET/POST/PUT/DELETE, DTO validation bằng Zod).
- `*.service.ts`: Xem logic xử lý database qua Prisma, logic validate dữ liệu lỗi (BadRequestException), logic check dữ liệu đang sử dụng (in-use) trước khi xóa.

### Bước 2: Đối chiếu Model Database
Mở file `prisma/schema.prisma` của dự án đích để xem cấu trúc model mới vì tên model và kiểu dữ liệu có thể khác dự án cũ:
- *Ví dụ:* Dự án cũ dùng `Unit` (ID BigInt, code, deletedAt) -> Dự án mới dùng `UnitOfMeasure` (ID UUID, name, symbol, is_active).
- Luôn sử dụng đúng tên trường và quan hệ của database mới.

### Bước 3: Viết API Routes trong Next.js
Tạo cấu trúc Next.js App Router API:
- `src/app/api/[module]/route.ts` cho các method chung:
  - `GET`: Hỗ trợ search qua query params (`?q=`), trả về danh sách kèm relations count (ví dụ: `_count: { products: true }`).
  - `POST`: Thêm mới bản ghi. Validate bắt buộc nhập, check trùng lặp (trùng tên/mã).
- `src/app/api/[module]/[id]/route.ts` cho các method riêng:
  - `GET`: Lấy chi tiết bản ghi.
  - `PUT`: Cập nhật bản ghi. Validate dữ liệu đầu vào, chặn cập nhật trùng tên với bản ghi khác.
  - `DELETE`: Xử lý xóa. **Bắt buộc** check quan hệ (in-use check). Nếu bản ghi đang được tham chiếu bởi bảng khác (ví dụ: đơn vị tính đang được gán cho sản phẩm), từ chối xóa và trả về lỗi thông báo chi tiết cho user. Nếu không sử dụng, thực hiện soft-delete (set `is_active = false`).

### Bước 4: Đồng bộ hóa lên VPS
Sau khi hoàn thành code và build cục bộ thành công:
1. Commit và push code lên GitHub branch hiện tại.
2. SSH lên VPS `188.166.210.73` tại thư mục `/var/www/wms-vinhgiang`.
3. Kéo code (`git pull`) -> Chạy build (`npx next build`) -> Khởi động lại service (`pm2 restart wms-vinhgiang`).
4. Chạy script test verify API trực tiếp từ VPS để đảm bảo mọi logic validation đều hoạt động ổn định.

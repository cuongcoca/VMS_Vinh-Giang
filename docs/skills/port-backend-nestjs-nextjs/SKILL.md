---
name: port-backend-nestjs-nextjs
description: >-
  Kỹ năng tự động chuyển đổi logic NestJS Master-Data sang API Route Next.js 16 và UI dashboard cho WMS Vĩnh Giang.
---

# Kỹ năng Chuyển đổi NestJS sang Next.js (WMS Vĩnh Giang)

## Tổng quan
Kỹ năng này giúp AI Agent tự động hóa việc dịch chuyển business logic từ hệ thống NestJS cũ sang nền tảng Next.js 16 (App Router) mới, đảm bảo giữ vững các quy tắc validation dữ liệu, kiểm tra quan hệ ràng buộc (in-use checks) khi xóa và đồng bộ hóa an toàn lên VPS.

## Mã nguồn hỗ trợ
- Script phân tích tự động: [port_helper.py](file:///D:/wms-vinhgiang_repo/docs/skills/port-backend-nestjs-nextjs/scripts/port_helper.py)

---

## Các bước thực hiện (Workflow)

### Bước 1: Quét nhanh module NestJS nguồn
Sử dụng script `port_helper.py` để lấy nhanh cấu trúc của module cần port:
```bash
uv run docs/skills/port-backend-nestjs-nextjs/scripts/port_helper.py <tên_module>
# Ví dụ: uv run docs/skills/port-backend-nestjs-nextjs/scripts/port_helper.py suppliers
```

### Bước 2: Viết Route API Next.js đích
1. Tạo `/api/[module]/route.ts`:
   - `GET`: Hỗ trợ tham số `?q=` để tìm kiếm. Trả về relations `_count`.
   - `POST`: Nhận JSON body, validate định dạng bằng Zod hoặc check tay. Check trùng lặp tên/mã trong database.
2. Tạo `/api/[module]/[id]/route.ts`:
   - `GET`: Lấy chi tiết bản ghi.
   - `PUT`: Cập nhật bản ghi, kiểm tra trùng lặp trừ ID hiện tại.
   - `DELETE`: Kiểm tra quan hệ ràng buộc (in-use check). Nếu bảng khác đang tham chiếu đến thì cấm xóa và trả về lỗi chi tiết. Nếu không, cập nhật `is_active = false` (soft-delete).

### Bước 3: Thiết kế UI Frontend
Tạo file `src/app/[module]/page.tsx` sử dụng:
- Bố cục thống nhất với `AppLayout`.
- Bảng hiển thị dữ liệu có Checkbox đa chọn (multi-select).
- Bộ tìm kiếm (Search) có tính năng debounce.
- Form modal thêm/sửa có autofocus ô nhập đầu tiên.
- Nút "Lưu & Thêm tiếp" để tạo nhanh nhiều bản ghi.
- Các thẻ KPI thống kê trạng thái.
- Hệ thống thông báo Toast nổi ở góc phải dưới và Confirm Dialog.

### Bước 4: Deploy & Restart VPS
1. Push code lên Git:
   ```bash
   git add .
   git commit -m "feat([UC-MD-XX]): Porting [Module]"
   git push origin vinhgiang1
   ```
2. Deploy trên VPS `188.166.210.73`:
   ```bash
   ssh root@188.166.210.73 "cd /var/www/wms-vinhgiang && git pull origin vinhgiang1 && npx next build && pm2 restart wms-vinhgiang"
   ```

---

## Các lỗi thường gặp (Common Mistakes)
1. **Quên in-use check khi xóa:** Luôn phải dùng `include: { _count: { select: { ... } } }` để kiểm tra bản ghi có đang được liên kết ở bảng khác không trước khi cho phép xóa.
2. **Trùng lặp tên/mã:** Luôn kiểm tra trùng lặp trên những bản ghi đang hoạt động (`is_active: true`) cả khi Thêm mới (POST) và Cập nhật (PUT).
3. **TypeScript build error ở local:** Thư mục nguồn NestJS cũ nằm lồng trong repo đích nên cần đảm bảo `"exclude": ["vinh_giang_wms-main"]` có mặt trong `tsconfig.json`.

# Hướng dẫn Triển khai WMS Vĩnh Giang — Production VPS

**Server:** 188.166.210.73 (Ubuntu, PM2 native deployment)
**Stack:** Next.js 16 + Prisma 7 + Postgres 16 (Native)
**Live URLs:**
- Web Admin: `https://188.166.210.73/wms` (Tự động redirect sang trang login nếu chưa xác thực)
- Xe nâng di động: `https://188.166.210.73/xenang/forklift`

> ⚠️ **QUAN TRỌNG — Quét mã QR/barcode bằng camera:** Trình duyệt CHỈ cho bật camera trong
> "secure context" (HTTPS **chứng chỉ hợp lệ** hoặc localhost). Mở app bằng **IP + chứng chỉ
> tự ký** (`https://188.166.210.73/...`) → iOS/Android **chặn camera** → nút quét không lên hình.
> **Vì vậy cho nhân viên (thủ kho / xe nâng / kiểm kê) mở app bằng TÊN MIỀN hợp lệ:**
> `https://khohangvinhgiang.io.vn/thukho`, `.../xenang`, `.../kiemke` (đã có chứng chỉ Let's Encrypt).
> Nếu buộc dùng IP: bấm nút **"Ảnh"** trong màn quét (chụp/chọn ảnh mã — không cần camera stream) hoặc **"Nhập tay"**.

---

## 1. Kiến trúc Triển khai trên VPS

Dự án WMS Vĩnh Giang được chạy trực tiếp (native) trên VPS bằng cách phân chia thành **4 instance** chạy song song từ cùng một thư mục mã nguồn để phân tách các giao diện theo vai trò:

| Tiến trình PM2 | Thư mục chạy | Port | Khởi chạy | Base Path | Dist Directory |
|---|---|---|---|---|---|
| `wms-vinhgiang` | `/var/www/wms-vinhgiang` | 3001 | `npm start -- -p 3001` | `/wms` | `.next` |
| `wms-xenang` | `/var/www/wms-vinhgiang` | 3002 | `npm start -- -p 3002` | `/xenang` | `.next-xenang` |
| `wms-thukho` | `/var/www/wms-vinhgiang` | 3003 | `npm start -- -p 3003` | `/thukho` | `.next-thukho` |
| `wms-kiemke` | `/var/www/wms-vinhgiang` | 3004 | `npm start -- -p 3004` | `/kiemke` | `.next-kiemke` |

Nginx (`/etc/nginx/sites-enabled/chioi`) làm reverse proxy điều phối request:
- `https://188.166.210.73/wms` -> Proxy sang `http://127.0.0.1:3001`
- `https://188.166.210.73/xenang` -> Proxy sang `http://127.0.0.1:3002`
- `https://188.166.210.73/thukho` -> Proxy sang `http://127.0.0.1:3003`
- `https://188.166.210.73/kiemke` -> Proxy sang `http://127.0.0.1:3004`

**Đăng nhập tập trung:** Tất cả vai trò đăng nhập tại `/wms/auth`. Sau khi login, hệ thống tự redirect theo role (XE_NANG→/xenang, THU_KHO→/thukho, KIEM_KE→/kiemke, Desktop→/wms).

---

## 2. Cấu hình Môi trường (.env)

Tệp `/var/www/wms-vinhgiang/.env` cấu hình cơ sở dữ liệu PostgreSQL cục bộ:
```env
DATABASE_URL=postgresql://wms_user:wms_password@127.0.0.1:5432/wms_vinhgiang?schema=public
JWT_SECRET=vinhgiang_super_secret_key_2026
```

---

## 3. Quy trình Triển khai Đẩy mã nguồn (Deployment Workflow)

### Bước 1: Tại máy Local (Windows)
1. Commit các thay đổi trên nhánh chính `main`:
   ```bash
   git add .
   git commit -m "commit message"
   git push origin main
   ```

### Bước 2: Trên VPS (42.96.16.197 — khohangvinhgiang.io.vn)
SSH vào VPS:
```bash
ssh root@42.96.16.197
```
Chuyển tới thư mục dự án và cập nhật code mới nhất:
```bash
cd /var/www/wms-vinhgiang
git fetch origin
git checkout main
git pull origin main
```

### Bước 3: Đồng bộ Database (nếu có cập nhật schema)
```bash
npx prisma db push
```

### Bước 4: Biên dịch mã nguồn (Build)
Biên dịch Next.js cho từng instance (để Next.js phân tách file static chuẩn):
```bash
# Biên dịch cho bản Web Admin (base path /wms, folder build .next)
BASE_PATH=/wms npm run build

# Biên dịch cho bản Xe nâng di động (base path /xenang, folder build .next-xenang)
BASE_PATH=/xenang npm run build
```

### Bước 5: Restart Dịch vụ thông qua PM2
```bash
pm2 restart wms-vinhgiang
pm2 restart wms-xenang
pm2 save
```

---

## 4. Các câu lệnh Vận hành Thường nhật trên VPS

### Quản lý Tiến trình (PM2)
```bash
# Xem danh sách và trạng thái các app
pm2 list

# Xem log real-time của hệ thống WMS
pm2 logs wms-vinhgiang
pm2 logs wms-xenang

# Xem thông tin chi tiết của từng app (cwd, env, port...)
pm2 show wms-vinhgiang
pm2 show wms-xenang
```

### Truy vấn/Backup Database (PostgreSQL)
```bash
# Đăng nhập shell psql để kiểm tra dữ liệu trực tiếp
psql -U wms_user -d wms_vinhgiang

# Backup cơ sở dữ liệu ra file nén sql.gz
pg_dump -U wms_user -d wms_vinhgiang | gzip > /var/www/wms-vinhgiang/backups/wms-$(date +%Y%m%d-%H%M).sql.gz
```

### Seed Dữ liệu Demo/Dữ liệu Xe nâng
```bash
# Chạy script seed forklift để thêm pallet và tài xế xe nâng test
npx tsx prisma/seed-forklift.ts
```

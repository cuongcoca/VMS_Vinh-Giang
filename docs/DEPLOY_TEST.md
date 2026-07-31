# Hướng dẫn deploy lên server (Test / Prod)

Tài liệu cho người mới clone repo về vẫn deploy được. Script: [`scripts/deploy-test.sh`](../scripts/deploy-test.sh).

## 1. Kiến trúc chạy trên server
1 mã nguồn build thành **4 app** (khác `BASE_PATH` → khác `distDir`), chạy bằng **pm2**:

| App | pm2 name | BASE_PATH | Port | distDir |
|--|--|--|--|--|
| Desktop (web) | `wms-vinhgiang` | `/wms` | 4200 | `.next` |
| Thủ kho (mobile) | `wms-thukho` | `/thukho` | 3003 | `.next-thukho` |
| Xe nâng (mobile) | `wms-xenang` | `/xenang` | 3002 | `.next-xenang` |
| Kiểm kê (mobile) | `wms-kiemke` | `/kiemke` | 3004 | `.next-kiemke` |

- **Test:** `103.97.134.164` — PostgreSQL 16 **native**, code ở `/var/www/wms-vinhgiang`.
- **Prod:** `42.96.16.197` — PostgreSQL 16 trong **Docker**. Cùng cách deploy (đổi server + `.env`).
- Nginx reverse-proxy các path `/wms /thukho /xenang /kiemke` → port tương ứng; QR cần domain HTTPS.

## 2. Yêu cầu có sẵn trên server (chuẩn bị 1 lần)
- `node` + `npm`, `pm2` (đã tạo 4 process `wms-*`), `psql`, `git`.
- **`.env`** ở thư mục app (chứa `DATABASE_URL`, `JWT_SECRET`…). **KHÔNG commit** — `git reset --hard` giữ nguyên file untracked này; script sẽ **DỪNG nếu thiếu** `.env`.
- `public/uploads` (ảnh) — nằm ngoài git; nếu quy trình backup tách ra `/root/uploads-keep` thì script tự khôi phục.
- Đã cấu hình `pm2 startup` + `pm2 save` để tự bật lại sau reboot.

## 3. Deploy — cách thường dùng (chạy TRÊN server)
Code được kéo thẳng từ GitHub (`git fetch --depth=1` + `reset --hard`), **không cần đẩy thủ công**. Chỉ cần **push code lên nhánh `cuongdd_web`** rồi trên server chạy:

```bash
ssh root@103.97.134.164
bash /var/www/wms-vinhgiang/scripts/deploy-test.sh
```

Chạy nền + xem log (khi deploy lâu, tránh rớt SSH):

```bash
nohup bash /var/www/wms-vinhgiang/scripts/deploy-test.sh > /root/deploy-run.log 2>&1 < /dev/null &
tail -f /root/deploy-run.log
```

Script làm tuần tự: **1)** fetch+reset nhánh `cuongdd_web` → **2)** khôi phục uploads → **3)** áp mọi `prisma/migrations/*.sql` (idempotent) → **4)** `prisma generate` → **5)** build 4 app (`BASE_PATH` lần lượt) → **6)** `pm2 restart` → **7)** health check 4 port.

> **An toàn:** build cả 4 app **TRƯỚC**, chỉ `pm2 restart` khi **tất cả** build OK. Build lỗi → dừng, app cũ vẫn chạy.

Biến môi trường tùy chọn (mặc định đã hợp lý): `APP_DIR`, `GIT_URL`, `GIT_BRANCH`.

## 4. Migration
- Đặt file SQL **idempotent** (`IF NOT EXISTS` / `ON CONFLICT`) vào `prisma/migrations/*.sql`; script áp theo thứ tự tên (prefix ngày = thứ tự thời gian) với `ON_ERROR_STOP=1`.
- **Task thuần code** (không đổi schema) → không cần thêm file, các migration cũ áp lại **không tác dụng phụ** (idempotent).
- Sau đổi schema Prisma nhớ cập nhật `schema.prisma` + thêm file `.sql` tương ứng.

## 5. Đổi cấu trúc thư mục (route-group…) → xóa cache build
Khi có refactor di chuyển file/route (vd route-group `(app)/`), xóa cache trước khi build để tránh type-cache cũ:

```bash
cd /var/www/wms-vinhgiang && rm -rf .next .next-thukho .next-xenang .next-kiemke
```

rồi chạy lại script. Deploy thuần code (không đổi cấu trúc) **không cần** bước này.

## 6. Health check & rollback
- Health: script tự `curl` 4 port, kỳ vọng **HTTP 200**. Thủ công: `pm2 list`, `pm2 logs wms-vinhgiang --lines 50`.
- **Rollback:** trước deploy nên backup `tar` thư mục + `pg_dump` DB. Khi lỗi: bung backup + `psql < dump.sql` + `pm2 restart wms-vinhgiang wms-thukho wms-xenang wms-kiemke`.
  - ⚠️ Backup DB **phải dùng `pg_dump` phiên bản khớp server (PG16)** — bản cũ (vd v12) tạo dump rỗng thầm lặng. Prod chạy `docker exec <pg_container> pg_dump …`.

## 7. Ghi chú bảo mật
- **Thông tin đăng nhập SSH / mật khẩu DB KHÔNG nằm trong repo.** Lấy riêng từ quản trị dự án.
- Script chỉ đọc `DATABASE_URL` từ `.env` **trên server**, không hardcode secret.

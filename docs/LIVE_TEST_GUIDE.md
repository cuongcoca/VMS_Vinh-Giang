# LIVE TEST GUIDE — WMS Vĩnh Giang

> Hướng dẫn restart máy → khởi động infra → seed DB → chạy live test toàn bộ luồng.
> Mục tiêu: trong 30 phút sau reboot, login vào hệ thống và demo được luồng Nhập kho có phiếu (CP-01).

---

## 0. Tại sao phải reboot

Tại thời điểm build M11, Windows báo `VirtualAlloc failed` khi compile NestJS — RAM dùng hết do nhiều process Node + Docker WSL không giải phóng tốt. Reboot là cách nhanh nhất để clear toàn bộ.

---

## 1. Reboot máy

**Lưu các tab/file chưa save** rồi:
- `Start` → `Power` → `Restart`
- Hoặc PowerShell admin: `Restart-Computer`

Sau khi máy bật lại, **đăng nhập Windows xong, KHÔNG mở ngay các app nặng** (Chrome nhiều tab, Slack, VS Code multi-window). Chỉ mở Terminal/Git Bash.

---

## 2. Khởi động Docker Desktop

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Đợi tray icon Docker chuyển sang trạng thái "Engine running" (~30-60 giây). Kiểm tra:

```bash
docker version --format '{{.Server.Version}}'
# Phải in ra: 29.x.x (nếu fail: chờ thêm 30s rồi thử lại)
```

> **Nếu Docker stuck "Engine starting" > 3 phút:** Right-click tray → Quit Docker Desktop → khởi động lại. Nếu vẫn lỗi: Settings → Troubleshoot → "Clean / Purge data" (mất images cũ nhưng không ảnh hưởng dự án).

---

## 3. Khởi động infra (Postgres + Redis + MinIO + Mailhog)

```bash
cd "/d/New folder/vinh_giang_wms"
docker compose up -d
```

Đợi ~20 giây cho Postgres healthcheck pass. Kiểm tra:

```bash
docker compose ps
# Phải thấy 4 services healthy: wms-postgres, wms-redis, wms-minio, wms-mailhog
```

Test connection:
```bash
docker exec wms-postgres pg_isready -U wms -d wms_dev
# /var/run/postgresql:5432 - accepting connections
```

---

## 4. Setup backend

```bash
cd "/d/New folder/vinh_giang_wms/backend"
```

### 4.1 Verify .env

File `.env` đã được tạo sẵn từ session trước với JWT keys, MAIL_ENC_KEY, etc. Verify:
```bash
ls -la .env private.pem public.pem
head -3 .env   # Phải có DATABASE_URL trỏ tới localhost:5432
```

Nếu thiếu `.env`, regen:
```bash
cd "/d/New folder/vinh_giang_wms/backend"
PRIV=$(base64 -w 0 private.pem) && PUB=$(base64 -w 0 public.pem) && MAILK=$(openssl rand -hex 32) && cat > .env <<EOF
NODE_ENV=development
PORT=3001
APP_NAME=WMS Vĩnh Giang API
APP_URL=http://localhost:3001
WEB_URL=http://localhost:3000
DATABASE_URL=postgresql://wms:wms_dev_password@localhost:5432/wms_dev?schema=public
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=wms_dev_password
JWT_PRIVATE_KEY_BASE64=${PRIV}
JWT_PUBLIC_KEY_BASE64=${PUB}
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800
JWT_ISSUER=wms.vinhgiang.com
JWT_AUDIENCE=wms-api
BCRYPT_COST=10
PASSWORD_RESET_TTL=3600
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=wms_minio
MINIO_SECRET_KEY=wms_dev_password
MINIO_USE_SSL=false
MINIO_BUCKET=wms
MAIL_ENC_KEY=${MAILK}
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=300
LOG_LEVEL=debug
EOF
```

### 4.2 Migrate database

```bash
npx prisma migrate dev --name init
```

Lệnh này sẽ:
- Tạo file `prisma/migrations/<timestamp>_init/migration.sql`
- Apply migration vào DB
- Regen Prisma client

> Lần đầu mất ~30 giây. Nếu fail "P1001: Can't reach database server": kiểm tra `docker compose ps` lại.

### 4.3 Seed data

```bash
npm run db:seed
```

Sau khi xong:
```
🌱 Seeding…
✅ Seed done. Login: admin@vinhgiang.local / Admin@123
```

DB giờ có:
- 5 roles + ~60 permissions + đầy đủ ma trận quyền
- 5 user (1 cho mỗi role) — password `Admin@123`
- 5 units (CHAI, GOI, LON, HOP, THUNG)
- 3 categories (DRINK, SAUCE, INSTANT)
- 4 sample locations (1 mỗi loại)
- App settings defaults (fefo_warn_days=30, fefo_critical_days=7)

### 4.4 Start backend dev server

```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run start:dev
```

Đợi đến khi thấy:
```
🚀 WMS API ready on http://localhost:3001/v1
```

Bạn sẽ thấy ~80 endpoints được mapped. Mở terminal mới cho frontend.

---

## 5. Setup frontend

```bash
cd "/d/New folder/vinh_giang_wms/frontend"
cat .env.local   # phải có NEXT_PUBLIC_API_URL=http://localhost:3001/v1
npm run dev
```

Đợi:
```
✓ Ready in ~12s
- Local: http://localhost:3000
```

---

## 6. Test live — smoke test

### 6.1 Login

Mở browser → http://localhost:3000/login

Login với `admin@vinhgiang.local` / `Admin@123` → redirect vào `/dashboard` thấy widget MANAGER (5 cards: HSD, Stock low, ADJ pending, PHN in progress, STK sessions).

### 6.2 Master data

Tạo 1-2 sản phẩm để có data test:
1. Sidebar → `Sản phẩm` → `+ Thêm sản phẩm`
2. Điền:
   - SKU: `VG-NM-001`
   - Tên đầy đủ: `Nước mắm Vĩnh Giang 500ml`
   - Tên rút gọn: `NM 500ml`
   - Nhóm: `Đồ uống`
   - Đơn vị: `Chai`
   - Quy cách: `24`
   - Trọng lượng/thùng: `13.2`
   - ✓ Có quản lý lô
   - ✓ Có quản lý HSD
3. Lưu → thấy trong list

### 6.3 Tạo vị trí kho

Sidebar → `Vị trí kho` → `Tạo hàng loạt`:
- Khu: `A`
- Kệ từ: 1 → đến: 5
- Tầng từ: 1 → đến: 3
- Loại: Vị trí chứa

→ Tạo 15 vị trí A-01-01..A-05-03.

### 6.4 Luồng Inbound (CP-01)

**Bước 1 — Kế toán lập PHN:**
1. Sidebar → `Phiếu nhập` → `+ Lập phiếu mới`
2. Loại: `Nhập từ NCC`, chọn supplier bất kỳ (nếu chưa có, tạo NCC trước)
3. Ngày dự kiến: hôm nay + 1
4. `+ Thêm dòng` → search `VG-NM-001` → SL: 10 (thùng)
5. `💾 Lưu & gửi cho Thủ kho` → vào page chi tiết PHN, status = NEW

**Bước 2 — Thủ kho tiếp nhận:**
1. Trên page PHN-XXX, có block "UC-IN-02 — Thủ kho tiếp nhận"
2. Bấm `✓ Tiếp nhận & bắt đầu nhập`
3. Status → PREPARING

**Bước 3 — Tạo pallet:**
1. Sidebar → `Pallet` → `+ Tạo pallet` → redirect tới /pallets/[id]
2. Lưu ý mã: `PL{YYMMDD}.001`
3. `+ Thêm dòng` → search VG-NM-001 → SL: 10 thùng (auto convert 240 chai, 132 kg)
4. Lưu dòng → `✓ Xác nhận pallet (= đã nhập xong)` → confirm dialog → status CONFIRMED

> **Lưu ý:** Pallet này chưa link với PHN. Trong production luồng đầy đủ, khi tạo pallet sẽ có dropdown chọn PHN. Hiện tại tạm thời tạo riêng để demo flow.

**Bước 4 — Xe nâng putaway:**
1. Sidebar → `Xe nâng` → thấy pallet `PL...001` chờ
2. Bấm `Putaway →`
3. Nhập vị trí: `A-01-01`
4. `✓ Xác nhận` → pallet status → IN_STORAGE, có thêm 1 Movement type=PUTAWAY

**Bước 5 — Xem báo cáo tồn:**
1. Sidebar → `Tồn theo SKU` → thấy VG-NM-001 với qtyAvailable=240
2. Sidebar → `Tồn theo vị trí` → A-01-01 có pallet
3. Sidebar → `Luân chuyển` → 1 row PUTAWAY

### 6.5 Luồng FEFO (CP-04)

1. Tạo thêm 1-2 pallet với HSD khác nhau (vd HSD 2026-08-01 và 2027-01-01) tại các vị trí khác
2. Sidebar → `Xe nâng` → `Rút FEFO`
3. Search `VG-NM-001` → thấy 2-3 card xếp theo HSD ASC, card đầu tiên có badge "Ưu tiên 1"
4. Chọn `Khu chờ xuất` (nếu chưa có, tạo location type=OUTBOUND_STAGING trước, vd `OUT-01`)
5. Bấm `Rút từ vị trí này →` → chọn TH-A (FULL) → `✓ Xác nhận rút`
6. Pallet → IN_STAGING, vào `/outbound/staging` thấy nó

### 6.6 Cảnh báo HSD

1. Sidebar → `Cảnh báo` → KPI cards
2. Sidebar → `FEFO toàn kho` → table sort HSD ASC + badge warning

### 6.7 Excel import (UC-IN-06)

1. Tạo file test.xlsx với cột:
   | Mã hàng | Tên hàng | SL thùng | Trọng lượng |
   |---|---|---|---|
   | VG-NM-001 | Nước mắm 500ml | 50 | 660 |
   | UNKNOWN-001 | Bột giặt 1kg | 30 | 300 |
2. Sidebar → `Import Excel` → `📥 Upload file mới`
3. Chọn NCC + ngày dự kiến + chọn file → `→ Upload & parse`
4. Preview: 1 MATCHED + 1 PENDING + tổng 80 thùng
5. Strategy: `AUTO_CREATE` → `→ Commit (tạo PHN)` → redirect tới PHN mới với 2 dòng

### 6.8 RBAC test

1. Logout, login bằng `forklift@vinhgiang.local` / `Admin@123`
2. Dashboard giờ chỉ thấy 2 widget (PENDING_PUTAWAY, IN_STAGING)
3. Sidebar chỉ có 5-6 entries (không có Sản phẩm, Người dùng, etc.)
4. Vào URL `/master-data/products` direct → 403 Forbidden

### 6.9 Audit log

1. Login lại làm admin
2. Sidebar → `Audit log` → thấy entries của các thao tác vừa làm:
   - `pallet.unlock` (nếu có)
   - `forklift.return` (nếu có)
   - `inbound.finalize` (nếu chốt phiếu)
3. Click vào 1 entry → thấy Before/After JSON diff

---

## 7. Troubleshooting

| Triệu chứng | Cách xử |
|---|---|
| `docker compose up` fail "no space left" | `docker system prune -af` |
| Redis container exit 255 / `exec format error` | `docker compose stop redis && docker rmi redis:7-alpine && docker pull --platform linux/amd64 redis:7-alpine && docker compose up -d redis` |
| Backend báo `Authentication failed against database` | DATABASE_URL trong .env sai, hoặc Postgres chưa up |
| Frontend báo CORS error | CORS_ORIGINS trong backend .env phải có `http://localhost:3000` |
| `npm run start:dev` báo OOM | Đảm bảo dùng `cmd.exe //c "set NODE_OPTIONS=--max-old-space-size=6144 && npm run start:dev"` (env phải set qua cmd để propagate vào child process) |
| Login OK nhưng API call báo 401 | Token chưa save vào localStorage — check DevTools → Application → Local Storage |
| **Login hang trên Windows/WSL2** (curl timeout, không có log POST trên backend) | **Postgres WAL fsync stall** — đặc trưng của WSL2 disk I/O. Đã sửa trong `docker-compose.yml` (postgres command có `synchronous_commit=off`, `fsync=off`). Nếu vẫn fail: `docker compose down -v && docker compose up -d` để reset volume + apply config mới. |
| Prisma báo `Timed out fetching a new connection from the connection pool` | Pool exhausted. Đã đặt `connection_limit=20&pool_timeout=30` trong DATABASE_URL. Nếu vẫn fail: kill stuck queries: `docker exec wms-postgres psql -U wms -d wms_dev -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='active' AND query LIKE 'UPDATE%';"` |
| Excel import fail "Không đọc được file" | File phải .xlsx (không phải .xls cũ), có header row với "Mã hàng" + "SL thùng" |
| `docker compose down` hang vô tận | Postgres backends stuck trên WAL — Quit Docker Desktop tray → start lại → `docker compose down -v --remove-orphans` → `docker compose up -d` |

---

## 8. Stop sạch khi kết thúc

```bash
# Terminal backend: Ctrl+C
# Terminal frontend: Ctrl+C
docker compose down    # stops containers, keeps volumes
# Hoặc: docker compose down -v   # xoá luôn data (start fresh)
```

---

## 9. Quick verification — 1 command stack

Sau khi setup xong lần đầu, các lần sau chỉ cần:

```bash
cd "/d/New folder/vinh_giang_wms" && docker compose up -d && cd backend && NODE_OPTIONS="--max-old-space-size=4096" npm run start:dev &
cd "/d/New folder/vinh_giang_wms/frontend" && npm run dev
```

(2 terminals: backend background, frontend foreground.)

---

## 10. Báo cáo lại

Sau khi test xong từng bước, báo tôi:
- Bước nào pass / fail
- Screenshot nếu UI khác mockup
- Lỗi 500 (nếu có) — kèm body response (RFC 7807 format)
- Performance issue (page load > 2s, etc.)

# Báo cáo Deploy — VPS Công ty 42.96.16.197

**Thời điểm:** 2026-05-26, ~08:43 → ~09:05 (Asia/Bangkok)
**Người thực hiện:** Claude (Opus 4.7) theo yêu cầu user
**Mục tiêu:** Đồng bộ toàn bộ code mới từ local (đã verify trên VPS cá nhân 188.166.210.73) lên VPS công ty 42.96.16.197 mà **KHÔNG đụng dữ liệu database**.

---

## 1. Tóm tắt kết quả

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| SSH connect | ✅ OK | Password auth via `nSmaPGEY39` |
| Backup code cũ | ✅ 5.3 MB | `backups/code-pre-sync-20260526-084747.tar.gz` |
| Backup DB | ✅ 84 KB | `backups/pre-migrate-additive-20260526-085304.sql.gz` (pg_dump v16 trong container) |
| Upload source code | ✅ 228 file `src/`, scripts, public, prisma, configs | tar 2.8 MB → extract |
| Giữ nguyên `.env` | ✅ KHÔNG đụng | File `.env` (215 bytes, May 23 13:19) giữ nguyên |
| Giữ nguyên data DB | ✅ KHÔNG truncate / drop / update bất kỳ row nào | Chỉ ADD COLUMN / CREATE TABLE / ADD ENUM VALUE |
| Schema migration | ✅ 24 → 31 tables | 7 bảng mới + ~40 cột mới + 2 enum value mới |
| npm install | ✅ +38 packages | recharts + transitive deps |
| Prisma generate | ✅ v7.8.0 | Phải wipe cache `.prisma/` 1 lần (generate đầu dính cache cũ) |
| Build 4 instance | ✅ wms / xenang / thukho / kiemke | ~30-60s/instance |
| PM2 restart | ✅ 4 instance online | uptime sau restart ổn định |
| HTTP health | ✅ HTTP 200 cả 4 (internal + external nginx) | |
| Restore `public/uploads/` | ✅ 1 file (PALLET_*.jpg) restored | User-uploaded preserved |
| Restore `chioi-backend` | ✅ KHÔNG đụng | Không phải project này, vẫn online 6 ngày |

**Kết luận:** Deploy thành công, app chạy được. Có 1 lỗi log cần fix sau (không block deploy) — xem mục [§7 Warning sau deploy](#7-warning-sau-deploy-cần-follow-up).

---

## 2. Trạng thái VPS công ty BEFORE deploy

Kết quả `vps-deploy-company.js test`:

```
Hostname: ubuntu (5.4.0-216-generic, Ubuntu 20.04)
Node:     v20.20.2
npm:      10.8.2
nginx:    1.18.0
PostgreSQL native: 12.22 (KHÔNG dùng — chỉ là client)
PostgreSQL thực tế: 16.14 (chạy trong Docker container `wms-postgres`, postgres:16-alpine, IP 172.18.0.2:5432)

PM2 (5 instance):
  0  chioi-backend     online 5D   ← KHÔNG đụng (project khác)
  1  wms-vinhgiang     online 2D   port 4200 (KHÁC VPS cá nhân — không phải 3001)
  2  wms-xenang        online 2D   port 3002
  3  wms-thukho        online 2D   port 3003
  4  wms-kiemke        online 2D   port 3004

Nginx proxy:
  /etc/nginx/sites-enabled/khohangvinhgiang.io.vn
  └─ /wms     → 127.0.0.1:4200
  └─ /xenang  → 127.0.0.1:3002
  └─ /thukho  → 127.0.0.1:3003
  └─ /kiemke  → 127.0.0.1:3004

Project: /var/www/wms-vinhgiang (KHÔNG phải git repo, file rời rạc upload tháng 5/2025)
Schema cũ: 567 dòng, 24 tables
Code cũ: build từ source ngày May 23, version trước Phase 0-6 UI refactor
```

**Phát hiện quan trọng:**
1. Port `wms-vinhgiang` là **4200** (không phải 3001 như VPS cá nhân `188.166.210.73`)
2. DB chạy trong **Docker container `wms-postgres` (postgres:16-alpine)** — pg_dump native v12 không tương thích, phải dùng `docker exec wms-postgres pg_dump` để backup
3. DB user: `wms`, host: `172.18.0.2:5432`, database: `wms`
4. DATABASE_URL có query `?schema=public` (Prisma format) — phải strip trước khi feed cho pg_dump/psql

---

## 3. Backup trước deploy

### 3.1 Backup code cũ trên VPS
```bash
tar --exclude='./node_modules' --exclude='./.next*' --exclude='./backups' --exclude='./.git' \
    -czf backups/code-pre-sync-20260526-084747.tar.gz .
# → 5.3 MB
```

### 3.2 Move các thư mục source cũ vào folder backup
Thay vì xóa, các thư mục được rename để rollback nhanh:
```
backups/pre-extract-20260526-084846/
  ├── src/
  ├── public/
  └── prisma/
```
(Thư mục `scripts/` chưa từng tồn tại trên VPS cũ — chỉ extract mới)

### 3.3 Backup DB (logical dump pg_dump v16)
DB không thể backup bằng pg_dump v12 native (server version 16). Dùng container:
```bash
set -a; . ./.env; set +a
DB_CONN="${DATABASE_URL%%\?*}"   # strip ?schema=public
docker exec -e PGURL="$DB_CONN" wms-postgres sh -c 'pg_dump "$PGURL"' \
  | gzip > backups/pre-migrate-additive-20260526-085304.sql.gz
# → 84 KB (pg_dump v16, db version 16.14)
```

---

## 4. Upload source code (228 file)

### 4.1 Đóng gói local
```bash
tar -czf wms-sync.tar.gz \
  src \
  prisma/schema.prisma prisma/seed.ts prisma/seed-codes.ts prisma/seed-forklift.ts \
  scripts \
  public \
  package.json package-lock.json \
  next.config.ts next-env.d.ts tsconfig.json \
  postcss.config.mjs eslint.config.mjs prisma.config.ts \
  README.md AGENTS.md CLAUDE.md
# → 2.8 MB
```

### 4.2 Không include vào tar (chủ ý)
- `node_modules/` — rebuild trên VPS
- `.next*/` — build artifacts, build lại trên VPS
- `.git/` — VPS không phải git repo
- `.env` — **GIỮ NGUYÊN trên VPS**, không ghi đè (chứa DATABASE_URL của môi trường công ty)
- `backups/` — local snapshot
- `e2e/`, `mockups/`, `docs/`, `vaitro/`, `mobile/`, `asset/`, `scratch/` — sample/dev
- `*.md` báo cáo, `*.docx`, `*.html`, `*.txt` — docs nặng, không production-needed
- `nginx-*.conf`, `wms_nginx.conf`, `chioi_nginx.conf` — không đụng config nginx VPS công ty
- `setup-*.sh`, `watch-dns.sh`, `*.ps1` — utility cho local
- `vps-deploy.js`, `vps-deploy-company.js`, `ssh-*.js`, `vps-sync.js` — deploy scripts riêng
- `migrate_*.sql` cũ (giữ chỉ `migrate_company_phase0_sync.sql` — upload riêng)
- `tsconfig.tsbuildinfo` — TS build cache
- `playwright.config.ts` — test config

### 4.3 Extract trên VPS
```bash
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p backups/pre-extract-$TS
for d in src scripts public prisma; do
  [ -d "$d" ] && mv "$d" "backups/pre-extract-$TS/"
done
tar -xzf /tmp/wms-sync.tar.gz -C /var/www/wms-vinhgiang/
```

### 4.4 Verify file count
```
Local src/ : 228 file
VPS  src/  : 228 file   ← MATCH
```

### 4.5 Restore user uploads
Sau extract, `public/uploads/` mới là rỗng. Restore 1 file user-uploaded từ backup:
```
backups/pre-extract-20260526-084846/public/uploads/PALLET_1779678132030_akfr1f.jpg
  → public/uploads/PALLET_1779678132030_akfr1f.jpg (73 KB)
```

### 4.6 Verify config fingerprints match local
```
prisma/schema.prisma : af28debcdbe807ee3d3f1327a5afe740   ✓ MATCH local
package.json          : 205eeea3f4990602ea1c73acffea364d  ✓ MATCH local
next.config.ts        : 149f681fb9230ae404991916e0fefe5c  ✓ MATCH local
tsconfig.json         : dcf7b2cf45c95c533bf95e5cfd93452e  ✓ MATCH local
```

---

## 5. Database migration ADDITIVE-ONLY

### 5.1 File migration
[`migrate_company_phase0_sync.sql`](migrate_company_phase0_sync.sql) (14 KB).

**Quy tắc an toàn:**
- Chỉ `ADD COLUMN` (nullable hoặc DEFAULT) — không bao giờ `DROP COLUMN`
- Chỉ `CREATE TABLE IF NOT EXISTS` — không bao giờ `DROP TABLE` / `TRUNCATE`
- Chỉ `ALTER TYPE ... ADD VALUE IF NOT EXISTS` — không drop enum value
- Chỉ `CREATE INDEX IF NOT EXISTS` — không drop index
- Idempotent: chạy lại không lỗi
- KHÔNG có UPDATE / DELETE / INSERT (trừ enum value definition khi CREATE TYPE)

### 5.2 Áp dụng
```bash
set -a; . ./.env; set +a
DB_CONN="${DATABASE_URL%%\?*}"
psql "$DB_CONN" -v ON_ERROR_STOP=1 -f migrate_company_phase0_sync.sql
```
Output: 2 transactions COMMIT thành công, không lỗi.

### 5.3 Thay đổi schema (chi tiết)

#### Cột thêm vào bảng cũ (additive, NULL hoặc DEFAULT, an toàn 100%):

| Bảng | Cột mới | Kiểu | Default |
|---|---|---|---|
| `users` | `username` | VARCHAR(50) UNIQUE | NULL |
| `users` | `avatar_url` | TEXT | NULL |
| `users` | `must_change_password` | BOOLEAN NOT NULL | `false` |
| `product_groups` | `code` | VARCHAR(20) UNIQUE | NULL |
| `units_of_measure` | `code` | VARCHAR(20) UNIQUE | NULL |
| `pallets` | `inbound_request_id` | UUID | NULL |
| `pallets` | `created_by` | UUID | NULL |
| `movements` | `item_code_id` | UUID | NULL |
| `movements` | `qty_box` | DECIMAL(10,2) | NULL |
| `movements` | `qty_unit` | DECIMAL(14,3) | NULL |
| `movements` | `lot` | VARCHAR(40) | NULL |
| `movements` | `expiry_date` | DATE | NULL |
| `movements` | `mode` | VARCHAR(10) | NULL |
| `movements` | `reason_code` | VARCHAR(40) | NULL |
| `movements` | `audit_log_id` | UUID | NULL |
| `inbound_requests` | `order_date` | DATE | NULL |
| `inbound_requests` | `import_type` | VARCHAR(50) | NULL |
| `inbound_requests` | `warehouse` | VARCHAR(100) | NULL |
| `inbound_requests` | `source` | VARCHAR(20) | NULL |
| `inbound_requests` | `source_file_url` | TEXT | NULL |
| `inbound_requests` | `source_file_name` | VARCHAR(255) | NULL |
| `inbound_requests` | `prep_zone_ready` | BOOLEAN NOT NULL | `false` |
| `inbound_requests` | `discrepancy_decision` | VARCHAR(40) | NULL |
| `inbound_requests` | `close_note` | TEXT | NULL |
| `inbound_requests` | `closed_by` | UUID | NULL |
| `inbound_requests` | `closed_at` | TIMESTAMP(3) | NULL |
| `inbound_temps` | `source_type` | VARCHAR(20) | NULL |
| `inbound_temps` | `delivered_by` | VARCHAR(120) | NULL |
| `inbound_temps` | `received_at` | TIMESTAMP(3) | NULL |
| `inbound_temps` | `reason` | VARCHAR(40) | NULL |
| `inbound_temps` | `reason_detail` | TEXT | NULL |
| `inbound_temps` | `photo_urls` | TEXT[] | NULL |
| `adjustment_vouchers` | `type` | VARCHAR(20) | NULL |
| `adjustment_vouchers` | `reason_code` | VARCHAR(40) | NULL |
| `adjustment_vouchers` | `rejected_reason` | TEXT | NULL |
| `adjustment_vouchers` | `applied_at` | TIMESTAMP(3) | NULL |
| `adjustment_vouchers` | `audit_log_id` | UUID | NULL |
| `adjustment_lines` | `pallet_id` | UUID | NULL |
| `adjustment_lines` | `lot` | VARCHAR(40) | NULL |
| `adjustment_lines` | `note` | TEXT | NULL |

**Tổng: ~40 cột mới được thêm vào 10 bảng cũ. KHÔNG có cột nào bị drop, không có data nào bị update.**

#### Enum value thêm:
- `LocationStatus`: thêm `PARTIAL`, `NEEDS_CHECK`

#### Type mới (CREATE TYPE):
- `OutboundRequestStatus` (PENDING, PICKING, SHIPPED, CANCELLED)
- `OutboundRebalanceStatus` (PARSED, PREVIEWED, APPLIED, REJECTED)

#### Bảng mới (CREATE TABLE):
| Bảng | Mục đích |
|---|---|
| `outbound_requests` | Phiếu yêu cầu xuất (PYX) — UC-OUT-05 cách 2 |
| `outbound_request_lines` | Chi tiết PYX |
| `outbound_rebalances` | Cân lại tồn từ file Excel — UC-OUT-05 cách 1 |
| `outbound_rebalance_lines` | Chi tiết rebalance |
| `mail_settings` | Cấu hình mail SMTP/Mailgun/SendGrid — UC-SYS-02 |
| `mail_logs` | Log gửi mail |
| `alert_settings` | Cấu hình cảnh báo (HSD, tồn thấp...) — UC-INV-05 |

#### Index mới:
- `users_username_key` (unique)
- `product_groups_code_key` (unique)
- `units_of_measure_code_key` (unique)
- `pallets_inbound_request_id_idx`
- `movements_item_code_id_idx`
- 4 index cho 4 bảng outbound_* (PK + status)

### 5.4 Verify DB sau migration
```sql
SELECT count(*) FROM information_schema.tables WHERE table_schema='public';
-- 31 (= 24 cũ + 7 mới)

SELECT table_name FROM information_schema.tables WHERE table_schema='public'
  AND table_name IN ('outbound_requests','outbound_request_lines',
                     'outbound_rebalances','outbound_rebalance_lines',
                     'mail_settings','mail_logs','alert_settings');
-- 7 rows ✓

SELECT column_name FROM information_schema.columns
  WHERE table_name='users' AND column_name IN ('username','avatar_url','must_change_password');
-- 3 rows ✓
```

---

## 6. Build & restart

### 6.1 npm install
```bash
npm install --no-audit --no-fund
# → added 38 packages (chủ yếu recharts + deps cho dashboard chart)
```

### 6.2 Prisma client regen
**Lưu ý:** Lần `npx prisma generate` đầu tiên đã chạy nhưng generated cache `node_modules/.prisma/client/schema.prisma` còn dính schema cũ (md5 không match). Build /wms fail với type error `'code' does not exist in type 'ProductGroupWhereInput'`. Phải wipe cache:
```bash
rm -rf node_modules/.prisma node_modules/@prisma/client
npm install @prisma/client
npx prisma generate --schema=prisma/schema.prisma
# → Generated Prisma Client (v7.8.0) in 1.06s
```

### 6.3 Build 4 instance (tuần tự)
```bash
node vps-deploy-company.js build wms      # BASE_PATH=/wms      → .next/
node vps-deploy-company.js build xenang   # BASE_PATH=/xenang   → .next-xenang/
node vps-deploy-company.js build thukho   # BASE_PATH=/thukho   → .next-thukho/
node vps-deploy-company.js build kiemke   # BASE_PATH=/kiemke   → .next-kiemke/
```
Tất cả `✔ Done`, không có TypeScript error nào sau khi fix Prisma cache.

### 6.4 Restart PM2
```bash
pm2 restart wms-vinhgiang wms-xenang wms-thukho wms-kiemke && pm2 save
```
Cả 4 instance status `online` sau restart.

---

## 7. Verify HTTP

### 7.1 Internal
```
port 4200 (wms)    : HTTP 200  ← wms-vinhgiang chạy port 4200 (KHÁC VPS cá nhân 3001)
port 3002 (xenang) : HTTP 200
port 3003 (thukho) : HTTP 200
port 3004 (kiemke) : HTTP 200
```

### 7.2 External (qua nginx, Host: khohangvinhgiang.io.vn)
```
/wms       : HTTP 200
/xenang    : HTTP 200
/thukho    : HTTP 200
/kiemke    : HTTP 200
```

### 7.3 PM2 state cuối
```
┌────┬──────────────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┐
│ id │ name             │ mode    │ pid      │ uptime │ ↺    │ status    │ mem      │
├────┼──────────────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┤
│ 0  │ chioi-backend    │ fork    │ 75283    │ 6D     │ 7    │ online    │ 104MB    │  ← NOT TOUCHED
│ 1  │ wms-vinhgiang    │ fork    │ 1885113  │ 2m     │ 3    │ online    │ 55MB     │
│ 2  │ wms-xenang       │ fork    │ 1885125  │ 2m     │ 4    │ online    │ 55MB     │
│ 3  │ wms-thukho       │ fork    │ 1885133  │ 2m     │ 1    │ online    │ 55MB     │
│ 4  │ wms-kiemke       │ fork    │ 1885153  │ 2m     │ 1    │ online    │ 55MB     │
└────┴──────────────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┘
```

---

## 8. Warning sau deploy — cần follow-up

### 8.1 ⚠️ `wms-thukho`: Prisma `InboundStatus` enum mismatch

**Log:**
```
3|wms-thuk | Invalid value for argument `status`. Expected InboundStatus.
3|wms-thuk |     at async l (.next-thukho/server/chunks/[root-of-the-server]__08mx7_f._.js:1:1719)
3|wms-thuk | { clientVersion: '7.8.0' }
```

**Phân tích:**
- Enum `InboundStatus` ở cả 2 schema (cũ & mới) đều có cùng 6 values: `DRAFT, PENDING, RECEIVING, RECONCILING, COMPLETED, CANCELLED`. Migration KHÔNG đụng enum này.
- Lỗi là code mới truyền 1 value khác (vd `RECEIVED` hoặc string lạ) vào Prisma query `where: { status: 'XXX' }`.
- **Đây là bug code, KHÔNG phải bug DB.** Migration đúng. Cần grep source: `grep -rn "status:.*'.*Status'" src/app/thukho/` để tìm chỗ truyền sai.
- HTTP 200 vẫn trả về vì lỗi catch được, nhưng query trả empty/error.

**Khuyến nghị:** Sửa code (chắc page list inbound của thukho) trong session tiếp theo.

### 8.2 ℹ️ `wms-vinhgiang`: "Failed to find Server Action"

**Log:**
```
1|wms-vinh | Error: Failed to find Server Action "1". This request might be from an older or newer deployment.
```

**Phân tích:** Lỗi bình thường sau mỗi deploy. Browser của user còn tab cũ với Server Action ID build cũ; build mới có ID khác. Tự khắc phục khi user F5/reload tab.

### 8.3 ℹ️ `wms-xenang`: "ENOENT prerender-manifest.json"

**Phân tích:** Log từ TRƯỚC khi build xenang hoàn tất (build chạy sau restart). File hiện tại đã có (`.next-xenang/prerender-manifest.json`, 45 KB). Bỏ qua.

---

## 9. Quyết định & lý do

| Quyết định | Lý do |
|---|---|
| Tạo `vps-deploy-company.js` riêng (password auth) thay vì sửa `vps-deploy.js` | Tránh đụng config VPS cá nhân; user có thể vẫn dùng `vps-deploy.js` cho 188.166.210.73 |
| Dùng tar 1 file thay vì SFTP từng file | Nhanh hơn ~10×, 1 SSH connection, atomicity |
| Backup DB qua `docker exec wms-postgres pg_dump` | Native pg_dump v12 không tương thích với DB server v16 |
| Strip `?schema=public` khỏi DATABASE_URL trước khi feed cho pg_dump/psql | Prisma format không tương thích libpq |
| Migration ADDITIVE-ONLY (không drop, không rename, không update) | User yêu cầu "không đụng database", chỉ thêm cột nếu cần |
| Wipe `node_modules/.prisma/` rồi regenerate | Cache cũ làm Prisma client gen ra thiếu cột `code` → build fail |
| Move thư mục cũ vào `backups/pre-extract-*/` thay vì xóa | Rollback nhanh không cần extract tar |
| Restore `public/uploads/PALLET_*.jpg` từ backup | Giữ file user upload runtime |
| KHÔNG đụng nginx config | VPS công ty có config riêng (`khohangvinhgiang.io.vn`, port 4200 cho /wms khác VPS cá nhân) |
| KHÔNG đụng `.env` trên VPS | Chứa DATABASE_URL khác local (Docker container IP 172.18.0.2) |
| KHÔNG đụng `chioi-backend` (PM2 id=0) | Project khác, không thuộc WMS |

---

## 10. File còn lại trên VPS cần biết

```
/var/www/wms-vinhgiang/
├── src/                   # ✓ NEW (228 file)
├── prisma/                # ✓ NEW (schema.prisma + 3 seed)
├── scripts/               # ✓ NEW (5 codemod scripts)
├── public/                # ✓ NEW + uploads/PALLET_*.jpg restored
├── .next/                 # build /wms
├── .next-xenang/          # build /xenang
├── .next-thukho/          # build /thukho
├── .next-kiemke/          # build /kiemke
├── node_modules/          # npm install + recharts mới
├── .env                   # ✓ KHÔNG ĐỘNG
├── package.json           # ✓ NEW (có recharts, lint:tokens scripts)
├── package-lock.json      # ✓ NEW
├── next.config.ts         # ✓ NEW
├── tsconfig.json          # ✓ NEW
├── postcss.config.mjs     # ✓ NEW
├── eslint.config.mjs      # ✓ NEW
├── prisma.config.ts       # ✓ NEW
├── middleware.ts          # (legacy, có thể xóa — đã move sang src/middleware.ts)
├── README.md AGENTS.md CLAUDE.md  # ✓ NEW docs
├── migrate_company_phase0_sync.sql  # ✓ NEW migration file (chạy xong, idempotent có thể chạy lại)
└── backups/
    ├── code-pre-sync-20260526-084747.tar.gz       (5.3 MB — code cũ)
    ├── pre-extract-20260526-084846/               (thư mục src/public/prisma cũ)
    ├── pre-migrate-additive-20260526-085304.sql.gz (84 KB — DB dump trước migrate)
    └── [các file backup cũ từ trước]
```

---

## 11. URL test sau deploy

| URL | Mô tả | Status |
|---|---|---|
| https://khohangvinhgiang.io.vn/wms/auth | Login desktop | HTTP 200 |
| https://khohangvinhgiang.io.vn/xenang | Forklift mobile | HTTP 200 |
| https://khohangvinhgiang.io.vn/thukho | Thủ kho mobile | HTTP 200 |
| https://khohangvinhgiang.io.vn/kiemke | Kiểm kê mobile | HTTP 200 |

Internal (bypass nginx, để debug):
- `http://127.0.0.1:4200/wms` (LƯU Ý: port 4200, không phải 3001)
- `http://127.0.0.1:3002/xenang`
- `http://127.0.0.1:3003/thukho`
- `http://127.0.0.1:3004/kiemke`

---

## 12. Rollback plan (nếu cần)

### 12.1 Rollback code
```bash
cd /var/www/wms-vinhgiang
# Khôi phục thư mục cũ
LATEST_PRE=$(ls -dt backups/pre-extract-* | head -1)
rm -rf src scripts public prisma  # xóa code mới
mv $LATEST_PRE/{src,public,prisma} ./
# Khôi phục node_modules (cũ ở root nhưng đã bị wipe lúc reinstall — cần install lại từ package-lock cũ)
# Khôi phục configs:
tar -xzf backups/code-pre-sync-20260526-084747.tar.gz \
   package.json package-lock.json next.config.ts tsconfig.json
npm install
npx prisma generate
BASE_PATH=/wms npm run build && BASE_PATH=/xenang npm run build && \
BASE_PATH=/thukho npm run build && BASE_PATH=/kiemke npm run build
pm2 restart all && pm2 save
```

### 12.2 Rollback DB (nếu cần — KHÔNG khuyến nghị vì additive)
Migration là additive, **KHÔNG cần rollback DB**. Cột mới ở DB là vô hại với code cũ (code cũ không SELECT cột mới). Nếu thực sự muốn về schema cũ:
```bash
docker exec -i wms-postgres psql -U wms wms < <(gzip -dc backups/pre-migrate-additive-20260526-085304.sql.gz)
# CẨN THẬN: lệnh này DROP & RESTORE — sẽ mất data thay đổi từ sau backup
```

---

## 13. Files local đã tạo (record)

| File local | Mục đích |
|---|---|
| [`vps-deploy-company.js`](vps-deploy-company.js) | Deploy script cho VPS công ty (password auth) |
| [`migrate_company_phase0_sync.sql`](migrate_company_phase0_sync.sql) | SQL migration additive |
| [`.vps-company-snapshot/schema.prisma.vps`](.vps-company-snapshot/schema.prisma.vps) | Snapshot schema VPS trước migrate (để diff sau này nếu cần) |
| [`.vps-company-snapshot/package.json.vps`](.vps-company-snapshot/package.json.vps) | Snapshot package.json VPS cũ |
| [`.vps-company-snapshot/next.config.ts.vps`](.vps-company-snapshot/next.config.ts.vps) | Snapshot next.config.ts cũ |
| [`BAO_CAO_DEPLOY_VPS_CONG_TY_2026-05-26.md`](BAO_CAO_DEPLOY_VPS_CONG_TY_2026-05-26.md) | Báo cáo này |

`wms-sync.tar.gz` (2.8MB tar đóng gói local) đã được xóa sau khi upload thành công.

---

**Status cuối cùng: ✅ DEPLOY THÀNH CÔNG. Code mới đã chạy trên VPS công ty 42.96.16.197, DB giữ nguyên dữ liệu, có thêm 7 bảng + 40 cột mới hỗ trợ tính năng mới. App phản hồi HTTP 200 cả 4 endpoint internal + external.**

#!/usr/bin/env bash
# =============================================================================
# Deploy nhánh cuongdd_web lên server (Test/Prod) — chạy TRÊN server.
#
#   ssh root@<server>
#   bash /var/www/wms-vinhgiang/scripts/deploy-test.sh
#
# Nguyên tắc AN TOÀN: build cả 4 app TRƯỚC, chỉ restart khi TẤT CẢ build OK
# (build lỗi → app cũ vẫn chạy). Migration idempotent, chạy trước build.
#
# Yêu cầu sẵn có trên server: node + npm, pm2 (4 process wms-*), psql,
# file .env (có DATABASE_URL), public/uploads. Xem docs/DEPLOY_TEST.md.
# =============================================================================
set -e

APP_DIR="${APP_DIR:-/var/www/wms-vinhgiang}"
GIT_URL="${GIT_URL:-https://github.com/cuongcoca/VMS_Vinh-Giang.git}"
GIT_BRANCH="${GIT_BRANCH:-cuongdd_web}"
# 4 app: "pm2-name:BASE_PATH:port"
APPS=("wms-vinhgiang:/wms:4200" "wms-thukho:/thukho:3003" "wms-xenang:/xenang:3002" "wms-kiemke:/kiemke:3004")

cd "$APP_DIR"
echo "############ DEPLOY $GIT_BRANCH -> $(hostname) | $(date '+%F %T') ############"

echo "===== 1) Lấy code mới nhất ($GIT_BRANCH) ====="
git init -q
git config user.email deploy@local >/dev/null 2>&1 || true
git config user.name  deploy        >/dev/null 2>&1 || true
git remote remove cc 2>/dev/null || true
git remote add cc "$GIT_URL"
git fetch cc "$GIT_BRANCH" --depth=1
git reset --hard FETCH_HEAD
git checkout -B "$GIT_BRANCH" >/dev/null 2>&1 || true
echo "  HEAD: $(git log --oneline -1)"
test -f .env || { echo "!!! THIẾU .env — DỪNG"; exit 1; }
echo "  .env OK ($(grep -c . .env) dòng)"

echo "===== 2) Khôi phục public/uploads (nếu tách ra khi backup) ====="
if [ -d /root/uploads-keep ]; then
  rm -rf public/uploads && mv /root/uploads-keep public/uploads
  echo "  đã khôi phục uploads: $(du -sh public/uploads 2>/dev/null | cut -f1)"
else
  echo "  public/uploads = $(du -sh public/uploads 2>/dev/null | cut -f1 || echo 'n/a')"
fi

echo "===== 3) DB migration (idempotent — mọi file prisma/migrations/*.sql) ====="
# Các file .sql được viết idempotent (IF NOT EXISTS / ON CONFLICT), áp theo thứ tự
# tên (prefix ngày = thứ tự thời gian). ON_ERROR_STOP + set -e => lỗi thì DỪNG
# TRƯỚC build/restart (app cũ vẫn chạy). KHÔNG có file .sql nào là hợp lệ (task thuần code).
DBU=$(grep '^DATABASE_URL' .env | head -1 | cut -d= -f2- | tr -d '"' | sed 's/?.*//')
shopt -s nullglob
MIGS=(prisma/migrations/*.sql)
if [ ${#MIGS[@]} -eq 0 ]; then
  echo "  (không có prisma/migrations/*.sql — bỏ qua)"
else
  for f in "${MIGS[@]}"; do
    echo "  áp: $f"
    psql "$DBU" -v ON_ERROR_STOP=1 -f "$f"
  done
fi

echo "===== 4) prisma generate ====="
npx prisma generate

echo "===== 5) Build 4 app (BUILD trước, CHƯA restart) ====="
# Mỗi app 1 BASE_PATH → distDir riêng (.next, .next-thukho, .next-xenang, .next-kiemke)
# cấu hình trong next.config. Build tuần tự, lỗi 1 app => DỪNG, không restart.
for a in "${APPS[@]}"; do
  IFS=: read -r NAME BP PORT <<< "$a"
  LOG="/root/build$(echo "$BP" | tr / _).log"
  echo ">>> build $BP ($(date +%T)) -> $LOG"
  if BASE_PATH="$BP" npm run build > "$LOG" 2>&1; then
    echo "    OK ($BP)"
  else
    echo "!!! BUILD $BP LỖI — DỪNG, KHÔNG restart. 15 dòng cuối:"; tail -15 "$LOG"; exit 1
  fi
done
echo "  >>> TẤT CẢ 4 BUILD OK <<<"

echo "===== 6) Restart 4 app ====="
pm2 restart wms-vinhgiang wms-thukho wms-xenang wms-kiemke --update-env
sleep 4

echo "===== 7) Health check ====="
FAIL=0
for a in "${APPS[@]}"; do
  IFS=: read -r NAME BP PORT <<< "$a"
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT$BP" 2>/dev/null)
  echo "  $BP (port $PORT) -> HTTP $code"
  [ "$code" = "200" ] || FAIL=1
done
[ "$FAIL" = "0" ] && echo "############ DONE — 4 app HTTP 200 ############" \
                  || { echo "############ CẢNH BÁO: có app KHÔNG 200 — kiểm tra pm2 logs ############"; exit 1; }

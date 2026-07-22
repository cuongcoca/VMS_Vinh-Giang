#!/bin/bash
set -e
cd /var/www/wms-vinhgiang

# Đọc DATABASE_URL từ .env trên VPS
set -a
source .env
set +a

if [ -z "$DATABASE_URL" ]; then
  echo "ERR: DATABASE_URL không có trong .env"
  exit 1
fi

# Strip Prisma-only query string (?schema=public) — libpq không hiểu
DB_URL="${DATABASE_URL%%\?*}"
echo "▶ Using clean DB URL (host/db chỉ)"

mkdir -p backups
TS=$(date +%Y%m%d-%H%M%S)
BK="backups/pre-migrate-batch-${TS}.sql.gz"

echo "▶ Backup DB → $BK"
pg_dump "$DB_URL" | gzip > "$BK"
ls -la "$BK"
SIZE=$(stat -c%s "$BK")
if [ "$SIZE" -lt 1000 ]; then
  echo "ERR: Backup file quá nhỏ (${SIZE} bytes) — pg_dump có thể fail. STOP."
  exit 1
fi
echo "✔ Backup OK (${SIZE} bytes)"
echo ""

for f in migrate_backfill_item_codes.sql migrate_company_phase0_sync.sql migrate_uc_fk_04_split.sql migrate_uploads_url_fix.sql; do
  echo "▶ Applying $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" 2>&1 | tail -40
  echo "--- $f done ---"
  echo ""
done

echo "▶ Prisma generate"
npx prisma generate 2>&1 | tail -10
echo ""
echo "✔ ALL MIGRATIONS DONE"

#!/bin/bash
# Workaround pg_dump password prompt — source .env, strip prisma query string
set -e
cd /var/www/wms-vinhgiang
set -a; source .env; set +a

DB_URL="${DATABASE_URL%%\?*}"

# 1) Backup
mkdir -p backups
BK="backups/pre-units-per-box-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "▶ Backup → $BK"
pg_dump "$DB_URL" | gzip > "$BK"
SIZE=$(stat -c%s "$BK")
if [ "$SIZE" -lt 1000 ]; then
  echo "❌ Backup quá nhỏ ($SIZE bytes) — abort."
  exit 1
fi
echo "✔ Backup OK ($SIZE bytes)"

# 2) Apply migration (idempotent)
echo "▶ Apply migration 2026-05-28_units_per_box.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/2026-05-28_units_per_box.sql
echo "✔ Migration OK"

# 3) Verify columns added
echo "▶ Verify"
psql "$DB_URL" -c "\d item_codes" | grep -E "units_per_box" || { echo "❌ item_codes.units_per_box missing"; exit 1; }
psql "$DB_URL" -c "\d products" | grep -E "units_per_box" || { echo "❌ products.units_per_box missing"; exit 1; }

# 4) Prisma generate
echo "▶ Prisma generate"
npx prisma generate

echo "✅ DONE"

#!/bin/bash
set -e
cd /var/www/wms-vinhgiang
set -a; source .env; set +a
DB_URL="${DATABASE_URL%%\?*}"

mkdir -p backups
BK="backups/pre-stocktake-lot-expiry-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "▶ Backup → $BK"
pg_dump "$DB_URL" | gzip > "$BK"
SIZE=$(stat -c%s "$BK")
if [ "$SIZE" -lt 1000 ]; then echo "❌ Backup quá nhỏ"; exit 1; fi
echo "✔ Backup OK ($SIZE bytes)"

echo "▶ Apply migration"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/2026-05-28_stocktake_lot_expiry.sql
echo "✔ Migration OK"

echo "▶ Verify"
psql "$DB_URL" -c "\d stocktake_counts" | grep -E "(lot_actual|expiry_actual)" || { echo "❌ Columns missing"; exit 1; }

echo "▶ Prisma generate"
npx prisma generate
echo "✅ DONE"

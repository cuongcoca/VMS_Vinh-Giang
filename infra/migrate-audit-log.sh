#!/bin/bash
# Workaround pg_dump password prompt — source .env, strip prisma query string
set -e
cd /var/www/wms-vinhgiang
set -a; source .env; set +a

# DATABASE_URL Prisma có `?schema=public` — libpq không hiểu, strip ra
DB_URL="${DATABASE_URL%%\?*}"

# 1) Backup
mkdir -p backups
BK="backups/pre-audit-log-extend-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "▶ Backup → $BK"
pg_dump "$DB_URL" | gzip > "$BK"
# Validate backup size > 1KB (gzip empty header ~20 bytes nếu pg_dump fail)
SIZE=$(stat -c%s "$BK")
if [ "$SIZE" -lt 1000 ]; then
  echo "❌ Backup quá nhỏ ($SIZE bytes) — pg_dump có thể đã fail. Abort."
  exit 1
fi
echo "✔ Backup OK ($SIZE bytes)"

# 2) Apply migration (idempotent: ALTER TABLE ... ADD COLUMN IF NOT EXISTS)
echo "▶ Apply migration 2026-05-27_audit_log_extend.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f prisma/migrations/2026-05-27_audit_log_extend.sql
echo "✔ Migration OK"

# 3) Verify columns added
echo "▶ Verify columns"
psql "$DB_URL" -c "\d audit_logs" | grep -E "(performed_by_role|ip_address|user_agent)" || {
  echo "❌ Verify failed — columns không thấy"
  exit 1
}

# 4) Prisma generate
echo "▶ Prisma generate"
npx prisma generate

echo "✅ DONE"

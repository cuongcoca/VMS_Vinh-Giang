#!/bin/bash
# Reset DB — XÓA tất cả dữ liệu nghiệp vụ + master, GIỮ users + system configs.
# Backup TRƯỚC khi reset. Nếu reset sai → restore từ backup.
set -e
cd /var/www/wms-vinhgiang
set -a; source .env; set +a

DB_URL="${DATABASE_URL%%\?*}"

# ─── 1. Backup ───────────────────────────────────────────────
mkdir -p backups
BK="backups/pre-reset-data-$(date +%Y%m%d-%H%M%S).sql.gz"
echo "▶ Backup full DB → $BK"
pg_dump "$DB_URL" | gzip > "$BK"
SIZE=$(stat -c%s "$BK")
if [ "$SIZE" -lt 1000 ]; then
  echo "❌ Backup quá nhỏ ($SIZE bytes) — abort, không reset."
  exit 1
fi
echo "✔ Backup OK ($SIZE bytes)"
echo ""

# ─── 2. Đếm trước khi xóa ────────────────────────────────────
echo "▶ Đếm bản ghi trước khi reset:"
psql "$DB_URL" -tA -c "
SELECT 'users: ' || COUNT(*) FROM users
UNION ALL SELECT 'pallets: ' || COUNT(*) FROM pallets
UNION ALL SELECT 'inbound_requests: ' || COUNT(*) FROM inbound_requests
UNION ALL SELECT 'movements: ' || COUNT(*) FROM movements
UNION ALL SELECT 'products: ' || COUNT(*) FROM products
UNION ALL SELECT 'item_codes: ' || COUNT(*) FROM item_codes
UNION ALL SELECT 'locations: ' || COUNT(*) FROM locations
UNION ALL SELECT 'suppliers: ' || COUNT(*) FROM suppliers
UNION ALL SELECT 'audit_logs: ' || COUNT(*) FROM audit_logs;
"
echo ""

# ─── 3. TRUNCATE — sạch hết + reset sequence ─────────────────
# Dùng CASCADE để Postgres auto-handle FK
# RESTART IDENTITY để reset auto-increment (mã pallet sẽ về STT 001)
echo "▶ TRUNCATE tất cả bảng nghiệp vụ + master (CASCADE)"
psql "$DB_URL" -v ON_ERROR_STOP=1 <<'EOF'
BEGIN;

TRUNCATE TABLE
  -- Logs / notifications / attachments
  audit_logs,
  notifications,
  attachments,
  mail_logs,

  -- Outbound
  outbound_rebalance_lines,
  outbound_rebalances,
  outbound_request_lines,
  outbound_requests,

  -- Adjustment + Stocktake
  adjustment_lines,
  adjustment_vouchers,
  stocktake_counts,
  stocktake_sessions,

  -- Movements + Pallet
  movements,
  pallet_lines,
  pallets,

  -- Inbound
  inbound_temp_lines,
  inbound_temps,
  inbound_lines,
  inbound_requests,

  -- Master data
  item_codes,
  products,
  product_groups,
  units_of_measure,
  suppliers,
  locations
RESTART IDENTITY CASCADE;

COMMIT;
EOF
echo "✔ TRUNCATE DONE"
echo ""

# ─── 4. Verify ───────────────────────────────────────────────
echo "▶ Đếm sau khi reset:"
psql "$DB_URL" -tA -c "
SELECT 'users (KEEP): ' || COUNT(*) FROM users
UNION ALL SELECT 'sessions (KEEP): ' || COUNT(*) FROM sessions
UNION ALL SELECT 'system_configs (KEEP): ' || COUNT(*) FROM system_configs
UNION ALL SELECT 'mail_settings (KEEP): ' || COUNT(*) FROM mail_settings
UNION ALL SELECT '---' AS s
UNION ALL SELECT 'pallets (=0): ' || COUNT(*) FROM pallets
UNION ALL SELECT 'inbound_requests (=0): ' || COUNT(*) FROM inbound_requests
UNION ALL SELECT 'movements (=0): ' || COUNT(*) FROM movements
UNION ALL SELECT 'products (=0): ' || COUNT(*) FROM products
UNION ALL SELECT 'item_codes (=0): ' || COUNT(*) FROM item_codes
UNION ALL SELECT 'locations (=0): ' || COUNT(*) FROM locations
UNION ALL SELECT 'suppliers (=0): ' || COUNT(*) FROM suppliers
UNION ALL SELECT 'audit_logs (=0): ' || COUNT(*) FROM audit_logs;
"

echo ""
echo "✅ Reset DONE. Backup tại: $BK"
echo "   Nếu cần khôi phục: gunzip -c $BK | psql \"\$DATABASE_URL\""

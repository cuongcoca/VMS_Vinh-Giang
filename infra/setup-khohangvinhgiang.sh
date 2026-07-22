#!/bin/bash
# Cài đặt domain khohangvinhgiang.io.vn cho WMS Vĩnh Giang
# Chạy trên VPS khi DNS A record đã trỏ về 42.96.16.197
#
# KHÔNG ảnh hưởng: database, code, dữ liệu, cấu hình nginx/domain khác.
# Chỉ thêm 1 nginx server block mới + SSL cert cho domain mới.

set -e

DOMAIN="khohangvinhgiang.io.vn"
EXPECTED_IP="42.96.16.197"
EMAIL="admin@vinhgiang.com"  # email cho Let's Encrypt

echo "============================================"
echo "  Cài đặt domain: $DOMAIN"
echo "============================================"

# --- Bước 1: Kiểm tra DNS ---
echo ""
echo "== [1/4] Kiểm tra DNS cho $DOMAIN =="
RESOLVED=$(dig +short $DOMAIN A @8.8.8.8 | tail -1)
echo "Resolved: '$RESOLVED'  (expected: $EXPECTED_IP)"

if [ "$RESOLVED" != "$EXPECTED_IP" ]; then
  echo "❌ DNS chưa trỏ đúng!"
  echo "   Cần thêm A record: $DOMAIN → $EXPECTED_IP"
  echo "   Đợi DNS propagate (5-30 phút) rồi chạy lại script này."
  exit 1
fi
echo "✓ DNS OK"

# --- Bước 2: Cài đặt nginx site ---
echo ""
echo "== [2/4] Cài đặt nginx site =="

# Copy config nếu chưa có
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
  cp /var/www/wms-vinhgiang/nginx-khohangvinhgiang.conf /etc/nginx/sites-available/$DOMAIN
  echo "✓ Copied config → /etc/nginx/sites-available/$DOMAIN"
else
  echo "⚠ Config đã tồn tại, giữ nguyên."
fi

# Enable site
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN
echo "✓ Enabled site: $DOMAIN"

# --- Bước 3: Test & reload nginx ---
echo ""
echo "== [3/4] Test nginx config =="
nginx -t
systemctl reload nginx
echo "✓ Nginx reloaded"

# --- Bước 4: SSL cert ---
echo ""
echo "== [4/4] Lấy SSL cert (Let's Encrypt) =="

# Tạo thư mục ACME challenge nếu chưa có
mkdir -p /var/www/letsencrypt

certbot --nginx -d $DOMAIN \
  --non-interactive --agree-tos \
  -m $EMAIL \
  --redirect

systemctl reload nginx

echo ""
echo "============================================"
echo "✓ Hoàn tất! Domain $DOMAIN đã hoạt động."
echo ""
echo "  Truy cập:"
echo "    https://$DOMAIN/"
echo "    https://$DOMAIN/wms"
echo ""
echo "  Kiểm tra cert renewal:"
echo "    certbot renew --dry-run"
echo "============================================"

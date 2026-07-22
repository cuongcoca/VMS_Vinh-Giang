-- Fix: Next.js 16 production không serve runtime files trong public/uploads.
-- Đổi URL pattern từ /uploads/ → /api/uploads/ (route handler tự đọc filesystem).

BEGIN;

-- Attachments: file_url lưu dạng "/uploads/X.png"
UPDATE attachments
SET file_url = REPLACE(file_url, '/uploads/', '/api/uploads/')
WHERE file_url LIKE '/uploads/%';

-- System config: logo_url / favicon_url lưu dạng "/wms/uploads/X.png" (đã include basePath)
UPDATE system_configs
SET value = REPLACE(value, '/wms/uploads/', '/wms/api/uploads/')
WHERE key IN ('logo_url', 'favicon_url') AND value LIKE '%/wms/uploads/%';

COMMIT;

-- Phương án A: Backfill ItemCode cho mọi Product chưa có ItemCode tương ứng
-- (item_code.code = product.sku). Đảm bảo các module nghiệp vụ tìm thấy SP đã thêm
-- ở /master-data trước khi fix code.

BEGIN;

-- 1) Với Product chưa có bất kỳ ItemCode nào trỏ tới (qua product_id),
--    và chưa có ItemCode nào trùng code = sku → tạo mới ItemCode (standardized).
INSERT INTO item_codes (
  id, code, short_name, full_name, unit_id, specification,
  weight_per_box, group_id, product_id, status, standardized_at,
  created_at, updated_at
)
SELECT
  gen_random_uuid(),
  p.sku,
  COALESCE(p.short_name, p.name),
  p.name,
  p.unit_id,
  p.specification,
  p.weight_per_box,
  p.group_id,
  p.id,
  'standardized',
  NOW(),
  NOW(),
  NOW()
FROM products p
WHERE NOT EXISTS (
  SELECT 1 FROM item_codes ic WHERE ic.product_id = p.id
)
AND NOT EXISTS (
  SELECT 1 FROM item_codes ic WHERE ic.code = p.sku
);

-- 2) Với ItemCode đã tồn tại theo code = sku nhưng chưa link product_id → link luôn
--    và nâng status thành standardized.
UPDATE item_codes ic
SET
  product_id = p.id,
  status = 'standardized',
  standardized_at = COALESCE(ic.standardized_at, NOW()),
  updated_at = NOW()
FROM products p
WHERE ic.code = p.sku
  AND ic.product_id IS NULL;

COMMIT;

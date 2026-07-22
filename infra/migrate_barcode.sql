-- Migration: Add barcode column to products table
-- UC-MD-01: Thêm trường mã vạch theo docx WMS_VinhGiang_UseCases_ByRole1

ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode VARCHAR(100) UNIQUE;

-- Update existing seed data with sample barcodes
UPDATE products SET barcode = '8934673001001' WHERE sku = 'SKU-VG-8821';
UPDATE products SET barcode = '8934673001002' WHERE sku = 'SKU-VG-1042';
UPDATE products SET barcode = '8934673001003' WHERE sku = 'SKU-VG-5531';
UPDATE products SET barcode = '8934673001004' WHERE sku = 'SKU-VG-0012';
UPDATE products SET barcode = '8934673001005' WHERE sku = 'SKU-VG-9112';
UPDATE products SET barcode = '8934673001006' WHERE sku = 'SKU-VG-3304';

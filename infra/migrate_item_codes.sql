-- Migration: UC-MD-02 — Quản lý Mã hàng
-- Tạo bảng item_codes + seed data mẫu

CREATE TABLE IF NOT EXISTS item_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  short_name VARCHAR(100) NOT NULL,
  full_name VARCHAR(200),
  unit_id UUID REFERENCES units_of_measure(id),
  specification VARCHAR(200),
  weight_per_box DECIMAL(10,3),
  group_id UUID REFERENCES product_groups(id),
  product_id UUID REFERENCES products(id),
  photo_url TEXT,
  note TEXT,
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  created_by UUID REFERENCES users(id),
  standardized_by UUID REFERENCES users(id),
  standardized_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed data: Mã hàng chờ xử lý (Thủ kho tạo)
INSERT INTO item_codes (code, short_name, unit_id, specification, weight_per_box, status, note)
SELECT 'UNI-2024-A001', 'Omo Matic 4.2kg', u.id, 'Thùng 3 túi', 12.600, 'pending', 'Hàng Unilever đợt 1'
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

INSERT INTO item_codes (code, short_name, unit_id, specification, weight_per_box, status, note)
SELECT 'UNI-2024-A002', 'Comfort 3.8L', u.id, 'Thùng 4 chai', 15.200, 'pending', 'Hàng Unilever đợt 1'
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

INSERT INTO item_codes (code, short_name, unit_id, specification, weight_per_box, status, note)
SELECT 'VG-NCC-003', 'Nước rửa chén Sunlight', u.id, 'Thùng 12 chai 750ml', 9.000, 'pending', NULL
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

INSERT INTO item_codes (code, short_name, unit_id, specification, weight_per_box, status, note)
SELECT 'P/G-2024-001', 'Head Shoulders 650ml', u.id, 'Thùng 12 chai', 7.800, 'pending', 'Hàng P&G mới'
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

-- Seed data: Mã hàng đã chuẩn hóa (Kế toán đã xử lý)
INSERT INTO item_codes (code, short_name, full_name, unit_id, specification, weight_per_box, group_id, product_id, status, standardized_at)
SELECT 'UNI-2023-B001', 'Vim Đa năng', 'Nước tẩy đa năng Vim 3.8L', u.id, 'Thùng 4 chai', 15.200,
       (SELECT id FROM product_groups LIMIT 1),
       (SELECT id FROM products LIMIT 1),
       'standardized', NOW() - INTERVAL '30 days'
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

INSERT INTO item_codes (code, short_name, full_name, unit_id, specification, weight_per_box, status, standardized_at)
SELECT 'UNI-2023-B002', 'Lifebuoy 500g', 'Xà phòng tắm Lifebuoy bảo vệ vượt trội 500g', u.id, 'Thùng 24 cục', 12.000,
       'standardized', NOW() - INTERVAL '15 days'
FROM units_of_measure u WHERE u.name = 'Thùng' LIMIT 1;

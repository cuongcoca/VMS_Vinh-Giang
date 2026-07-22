-- ============================
-- UC-MD-01: Master Data Tables
-- ============================

-- 1. Product Groups (Nhóm hàng)
CREATE TABLE IF NOT EXISTS product_groups (
    id UUID NOT NULL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Units of Measure (Đơn vị tính)
CREATE TABLE IF NOT EXISTS units_of_measure (
    id UUID NOT NULL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(10),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Products (Sản phẩm)
CREATE TABLE IF NOT EXISTS products (
    id UUID NOT NULL PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(100),
    group_id UUID REFERENCES product_groups(id),
    unit_id UUID REFERENCES units_of_measure(id),
    specification VARCHAR(200),
    weight_per_box DECIMAL(10,3),
    volume_per_box DECIMAL(10,3),
    manage_lot BOOLEAN NOT NULL DEFAULT FALSE,
    manage_expiry BOOLEAN NOT NULL DEFAULT FALSE,
    min_stock INT NOT NULL DEFAULT 0,
    max_stock INT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- GRANT quyền
GRANT ALL PRIVILEGES ON TABLE product_groups TO wms_user;
GRANT ALL PRIVILEGES ON TABLE units_of_measure TO wms_user;
GRANT ALL PRIVILEGES ON TABLE products TO wms_user;

-- ============================
-- SEED DATA
-- ============================

-- Nhóm hàng
INSERT INTO product_groups (id, name, description) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Gỗ công nghiệp', 'MDF, HDF, Ván ép, Gỗ ghép'),
  ('a1000000-0000-0000-0000-000000000002', 'Phụ kiện cơ khí', 'Bản lề, ray trượt, vít, ốc'),
  ('a1000000-0000-0000-0000-000000000003', 'Vật liệu bề mặt', 'Chỉ dán cạnh, veneer, laminate'),
  ('a1000000-0000-0000-0000-000000000004', 'Keo & Hóa chất', 'Keo sữa, keo nóng, dung môi'),
  ('a1000000-0000-0000-0000-000000000005', 'Phụ kiện trang trí', 'Tay nắm, núm, chân bàn')
ON CONFLICT (id) DO NOTHING;

-- Đơn vị tính
INSERT INTO units_of_measure (id, name, symbol) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Tấm', 'tấm'),
  ('b1000000-0000-0000-0000-000000000002', 'Cái', 'cái'),
  ('b1000000-0000-0000-0000-000000000003', 'Cuộn', 'cuộn'),
  ('b1000000-0000-0000-0000-000000000004', 'Thùng', 'thùng'),
  ('b1000000-0000-0000-0000-000000000005', 'Bộ', 'bộ'),
  ('b1000000-0000-0000-0000-000000000006', 'Hộp', 'hộp'),
  ('b1000000-0000-0000-0000-000000000007', 'Kg', 'kg'),
  ('b1000000-0000-0000-0000-000000000008', 'Mét', 'm')
ON CONFLICT (id) DO NOTHING;

-- Sản phẩm mẫu
INSERT INTO products (id, sku, name, short_name, group_id, unit_id, specification, weight_per_box, volume_per_box, manage_lot, manage_expiry, min_stock, max_stock) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'SKU-VG-8821', 'Gỗ MDF Phủ Melamine 18mm - Oak', 'MDF 18 Oak', 'a1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', '2440x1220x18mm', 35.000, 0.054, false, false, 100, 5000),
  ('c1000000-0000-0000-0000-000000000002', 'SKU-VG-1042', 'Bản lề giảm chấn Inox 304 - A2', 'BL Inox A2', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000002', 'Full overlay, 110°', 0.250, NULL, true, false, 50, 2000),
  ('c1000000-0000-0000-0000-000000000003', 'SKU-VG-5531', 'Chỉ dán cạnh PVC 0.45mm x 21mm', 'PVC 0.45x21', 'a1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000003', '0.45mm x 21mm x 100m', 2.500, 0.003, true, false, 200, NULL),
  ('c1000000-0000-0000-0000-000000000004', 'SKU-VG-0012', 'Keo sữa AB - Thùng 20kg', 'Keo sữa 20kg', 'a1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000004', 'Thùng 20kg', 20.000, 0.022, true, true, 10, 200),
  ('c1000000-0000-0000-0000-000000000005', 'SKU-VG-9112', 'Ray trượt bi 3 tầng - 450mm', 'Ray 450', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000005', '450mm, tải 45kg/cặp', 1.200, NULL, false, false, 500, 10000),
  ('c1000000-0000-0000-0000-000000000006', 'SKU-VG-3304', 'Vít gỗ tự khoan 4x40mm - Hộp 500c', 'Vít 4x40 H500', 'a1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000006', '4x40mm, Inox 304, 500c/hộp', 2.800, 0.002, true, false, 100, 5000)
ON CONFLICT (id) DO NOTHING;

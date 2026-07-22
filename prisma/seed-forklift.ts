import * as dotenv from "dotenv";
dotenv.config();

import { LocationType, LocationStatus, PalletStatus, MovementType, PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import * as bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("=== START SEEDING FORKLIFT DEMO DATA ===");
  console.log("DATABASE_URL in main:", process.env.DATABASE_URL);

  // 1. Create Supplier
  console.log("Seeding Supplier...");
  const supplier = await prisma.supplier.upsert({
    where: { code: "NCC-VG" },
    update: { is_active: true },
    create: {
      code: "NCC-VG",
      name: "Công ty TNHH Vĩnh Giang",
      tax_code: "0102030405",
      contact_person: "Nguyễn Văn A",
      phone: "0912345678",
      email: "supplier@vinhgiang.vn",
      address: "123 Đường Vĩnh Giang, Hà Nội",
      note: "Nhà cung cấp chính phục vụ UAT và Demo",
      is_active: true,
    },
  });
  console.log(`Supplier seeded: ${supplier.name} (${supplier.id})`);

  // 2. Create Units of Measure
  console.log("Seeding Units of Measure...");
  const unitThung = await prisma.unitOfMeasure.upsert({
    where: { name: "Thùng" },
    update: {},
    create: { name: "Thùng", symbol: "THG", is_active: true },
  });
  const unitChai = await prisma.unitOfMeasure.upsert({
    where: { name: "Chai" },
    update: {},
    create: { name: "Chai", symbol: "CH", is_active: true },
  });

  // 3. Create Product Group
  console.log("Seeding Product Group...");
  const groupGiaVi = await prisma.productGroup.upsert({
    where: { name: "Gia vị" },
    update: { is_active: true },
    create: { name: "Gia vị", description: "Nhóm hàng gia vị", is_active: true },
  });

  // 4. Create Products
  console.log("Seeding Products...");
  const productNM = await prisma.product.upsert({
    where: { sku: "VG-NM-500" },
    update: { is_active: true },
    create: {
      sku: "VG-NM-500",
      barcode: "893000000001",
      name: "Nước mắm Vĩnh Giang 500ml",
      short_name: "NM 500ml",
      group_id: groupGiaVi.id,
      unit_id: unitChai.id,
      specification: "24 chai/thùng",
      weight_per_box: 13.2,
      volume_per_box: 0.015,
      manage_lot: true,
      manage_expiry: true,
      min_stock: 5,
      max_stock: 100,
      is_active: true,
    },
  });

  const productDA = await prisma.product.upsert({
    where: { sku: "VG-DA-1000" },
    update: { is_active: true },
    create: {
      sku: "VG-DA-1000",
      barcode: "893000000002",
      name: "Dầu ăn Vĩnh Giang 1L",
      short_name: "DA 1L",
      group_id: groupGiaVi.id,
      unit_id: unitChai.id,
      specification: "12 chai/thùng",
      weight_per_box: 11.5,
      volume_per_box: 0.012,
      manage_lot: true,
      manage_expiry: true,
      min_stock: 5,
      max_stock: 100,
      is_active: true,
    },
  });

  // 5. Create Item Codes
  console.log("Seeding Item Codes...");
  const itemNM = await prisma.itemCode.upsert({
    where: { code: "VG-NM-500" },
    update: { status: "standardized" },
    create: {
      code: "VG-NM-500",
      short_name: "NM 500ml",
      full_name: "Nước mắm Vĩnh Giang 500ml",
      unit_id: unitThung.id,
      specification: "24 chai/thùng",
      weight_per_box: 13.2,
      group_id: groupGiaVi.id,
      product_id: productNM.id,
      status: "standardized",
      note: "Mã chuẩn hóa dùng cho xe nâng",
    },
  });

  const itemDA = await prisma.itemCode.upsert({
    where: { code: "VG-DA-1000" },
    update: { status: "standardized" },
    create: {
      code: "VG-DA-1000",
      short_name: "DA 1L",
      full_name: "Dầu ăn Vĩnh Giang 1L",
      unit_id: unitThung.id,
      specification: "12 chai/thùng",
      weight_per_box: 11.5,
      group_id: groupGiaVi.id,
      product_id: productDA.id,
      status: "standardized",
      note: "Mã chuẩn hóa dùng cho xe nâng",
    },
  });

  // 6. Clean up existing demo pallets, locations, movements to avoid duplication conflicts
  console.log("Cleaning up previous demo data to ensure a fresh, consistent state...");
  
  const demoPalletCodes = [
    "PL260522.001",
    "PL260522.002",
    "PL260520.001",
    "PL260520.002",
    "PL260521.001"
  ];

  const demoLocationCodes = [
    "A-01-01", "A-01-02", "A-01-03",
    "A-02-01", "A-02-02", "A-02-03",
    "A-03-01", "A-03-02",
    "STG-IN-01", "STG-IN-02",
    "STG-OUT-01", "STG-OUT-02"
  ];

  // Retrieve existing pallets for cleanup
  const existingPallets = await prisma.pallet.findMany({
    where: { code: { in: demoPalletCodes } }
  });
  const existingPalletIds = existingPallets.map(p => p.id);

  if (existingPalletIds.length > 0) {
    // Delete movements
    await prisma.movement.deleteMany({
      where: { pallet_id: { in: existingPalletIds } }
    });
    // Delete pallet lines
    await prisma.palletLine.deleteMany({
      where: { pallet_id: { in: existingPalletIds } }
    });
    // Delete audit logs
    await prisma.auditLog.deleteMany({
      where: { entity_id: { in: existingPalletIds }, entity_type: "pallet" }
    });
    // Delete pallets
    await prisma.pallet.deleteMany({
      where: { id: { in: existingPalletIds } }
    });
  }

  // Retrieve existing locations for cleanup
  const existingLocations = await prisma.location.findMany({
    where: { code: { in: demoLocationCodes } }
  });
  const existingLocationIds = existingLocations.map(l => l.id);

  // 7. Create/Upsert Locations
  console.log("Seeding Locations...");
  const locationsMap: Record<string, any> = {};

  for (const code of demoLocationCodes) {
    const parts = code.split("-");
    let zone = "A";
    let rack = "01";
    let level = "01";
    let type: LocationType = LocationType.STORAGE;

    if (parts.length === 3) {
      [zone, rack, level] = parts;
    } else if (code.startsWith("STG-IN")) {
      zone = "STG";
      rack = "IN";
      level = code.endsWith("01") ? "01" : "02";
      type = LocationType.INBOUND_STAGING;
    } else if (code.startsWith("STG-OUT")) {
      zone = "STG";
      rack = "OUT";
      level = code.endsWith("01") ? "01" : "02";
      type = LocationType.OUTBOUND_STAGING;
    }

    const loc = await prisma.location.upsert({
      where: { code },
      update: {
        status: LocationStatus.EMPTY, // Will be updated when placing pallets
        type,
        is_active: true,
      },
      create: {
        code,
        zone,
        rack,
        level,
        type,
        status: LocationStatus.EMPTY,
        max_weight_kg: 1000.0,
        max_pallets: 4,
        is_active: true,
      },
    });
    locationsMap[code] = loc;
  }
  console.log(`Locations seeded: ${Object.keys(locationsMap).length} locations.`);

  // 8. Create Pallets & Lines
  console.log("Seeding Pallets...");
  
  const today = new Date();
  
  // Expiry dates
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(today.getFullYear() + 1);

  const oneAndHalfYearsFromNow = new Date();
  oneAndHalfYearsFromNow.setMonth(today.getMonth() + 18);

  const expiryOld = new Date("2026-12-31");
  const expiryNew = new Date("2027-06-30");
  const expiryReturn = new Date("2026-10-31");

  // PALLET 1: CONFIRMED - Put-Away Queue
  console.log("Pallet 1: PL260522.001 (CONFIRMED)");
  const p1 = await prisma.pallet.create({
    data: {
      code: "PL260522.001",
      code_date: today,
      code_seq: 1,
      status: PalletStatus.CONFIRMED,
      supplier_id: supplier.id,
      inbound_date: today,
      note: "Hàng nước mắm chờ xếp vị trí",
      total_lines: 1,
      total_weight_kg: 264.0,
      confirmed_at: new Date(Date.now() - 15 * 60000), // 15 mins ago
      lines: {
        create: {
          item_code_id: itemNM.id,
          qty_box: 20.0,
          qty_unit: 480.0,
          lot: "LOT-NM-01",
          expiry_date: oneYearFromNow,
          weight_kg: 264.0,
          note: "Hàng nhập UAT",
        }
      }
    }
  });

  // PALLET 2: CONFIRMED - Put-Away Queue
  console.log("Pallet 2: PL260522.002 (CONFIRMED)");
  const p2 = await prisma.pallet.create({
    data: {
      code: "PL260522.002",
      code_date: today,
      code_seq: 2,
      status: PalletStatus.CONFIRMED,
      supplier_id: supplier.id,
      inbound_date: today,
      note: "Hàng dầu ăn chờ xếp vị trí",
      total_lines: 1,
      total_weight_kg: 172.5,
      confirmed_at: new Date(Date.now() - 5 * 60000), // 5 mins ago
      lines: {
        create: {
          item_code_id: itemDA.id,
          qty_box: 15.0,
          qty_unit: 180.0,
          lot: "LOT-DA-01",
          expiry_date: oneAndHalfYearsFromNow,
          weight_kg: 172.5,
          note: "Hàng nhập UAT",
        }
      }
    }
  });

  // PALLET 3: IN_STORAGE - ready for Relocate / FEFO Stage Out (Expires earlier)
  console.log("Pallet 3: PL260520.001 (IN_STORAGE at A-02-01)");
  const p3 = await prisma.pallet.create({
    data: {
      code: "PL260520.001",
      code_date: today,
      code_seq: 3,
      status: PalletStatus.IN_STORAGE,
      supplier_id: supplier.id,
      location_id: locationsMap["A-02-01"].id,
      inbound_date: today,
      note: "Pallet lưu kho A-02-01 (HSD ngắn hơn - Ưu tiên FEFO)",
      total_lines: 1,
      total_weight_kg: 132.0,
      confirmed_at: new Date(Date.now() - 2 * 24 * 3600000), // 2 days ago
      lines: {
        create: {
          item_code_id: itemNM.id,
          qty_box: 10.0,
          qty_unit: 240.0,
          lot: "LOT-NM-02",
          expiry_date: expiryOld,
          weight_kg: 132.0,
        }
      }
    }
  });
  await prisma.location.update({
    where: { id: locationsMap["A-02-01"].id },
    data: { status: LocationStatus.USING }
  });

  // PALLET 4: IN_STORAGE - ready for Relocate / FEFO Stage Out (Expires later)
  console.log("Pallet 4: PL260520.002 (IN_STORAGE at A-02-02)");
  const p4 = await prisma.pallet.create({
    data: {
      code: "PL260520.002",
      code_date: today,
      code_seq: 4,
      status: PalletStatus.IN_STORAGE,
      supplier_id: supplier.id,
      location_id: locationsMap["A-02-02"].id,
      inbound_date: today,
      note: "Pallet lưu kho A-02-02 (HSD dài hơn)",
      total_lines: 1,
      total_weight_kg: 132.0,
      confirmed_at: new Date(Date.now() - 2 * 24 * 3600000), // 2 days ago
      lines: {
        create: {
          item_code_id: itemNM.id,
          qty_box: 10.0,
          qty_unit: 240.0,
          lot: "LOT-NM-03",
          expiry_date: expiryNew,
          weight_kg: 132.0,
        }
      }
    }
  });
  await prisma.location.update({
    where: { id: locationsMap["A-02-02"].id },
    data: { status: LocationStatus.USING }
  });

  // PALLET 5: IN_STAGING - ready for Return Flow
  console.log("Pallet 5: PL260521.001 (IN_STAGING at STG-OUT-01)");
  const p5 = await prisma.pallet.create({
    data: {
      code: "PL260521.001",
      code_date: today,
      code_seq: 5,
      status: PalletStatus.IN_STAGING,
      supplier_id: supplier.id,
      location_id: locationsMap["STG-OUT-01"].id,
      inbound_date: today,
      note: "Pallet đang ở khu chờ xuất STG-OUT-01",
      total_lines: 1,
      total_weight_kg: 92.0,
      confirmed_at: new Date(Date.now() - 24 * 3600000), // 1 day ago
      lines: {
        create: {
          item_code_id: itemDA.id,
          qty_box: 8.0,
          qty_unit: 96.0,
          lot: "LOT-DA-02",
          expiry_date: expiryReturn,
          weight_kg: 92.0,
        }
      }
    }
  });
  await prisma.location.update({
    where: { id: locationsMap["STG-OUT-01"].id },
    data: { status: LocationStatus.USING }
  });

  // 9. Seeding Movements (Lịch sử)
  console.log("Seeding Movement Logs...");
  // Movement 1: Put-Away for Pallet 3
  await prisma.movement.create({
    data: {
      pallet_id: p3.id,
      movement_type: MovementType.PUT_AWAY,
      from_location_id: null,
      to_location_id: locationsMap["A-02-01"].id,
      reason: "Xếp kho ban đầu sau khi nhận hàng",
      performed_at: new Date(Date.now() - 2 * 24 * 3600000 + 30 * 60000), // 2 days ago + 30m
    }
  });

  // Movement 2: Put-Away for Pallet 4
  await prisma.movement.create({
    data: {
      pallet_id: p4.id,
      movement_type: MovementType.PUT_AWAY,
      from_location_id: null,
      to_location_id: locationsMap["A-02-02"].id,
      reason: "Xếp kho ban đầu sau khi nhận hàng",
      performed_at: new Date(Date.now() - 2 * 24 * 3600000 + 40 * 60000), // 2 days ago + 40m
    }
  });

  // Movement 3: Stage-Out for Pallet 5 (originally in A-02-03)
  const locTempSource = locationsMap["A-02-03"];
  await prisma.movement.create({
    data: {
      pallet_id: p5.id,
      movement_type: MovementType.STAGE_OUT,
      from_location_id: locTempSource.id,
      to_location_id: locationsMap["STG-OUT-01"].id,
      reason: "Rút FEFO xuất kho theo đơn hàng SO-002",
      performed_at: new Date(Date.now() - 12 * 3600000), // 12 hours ago
    }
  });

  // 10. Create Forklift Driver User
  console.log("Seeding Forklift Driver User...");
  const hashedPassword = await bcrypt.hash("Aa@123456", 10);
  const driver = await prisma.user.upsert({
    where: { phone: "0911223344" },
    update: { role: "XE_NANG", is_locked: false },
    create: {
      phone: "0911223344",
      email: "driver@vinhgiang.vn",
      password_hash: hashedPassword,
      full_name: "Tài xế Xe Nâng",
      role: "XE_NANG",
      is_locked: false,
    }
  });
  console.log(`Forklift driver user seeded: ${driver.full_name} (phone: ${driver.phone})`);

  console.log("=== SEEDING FORKLIFT DEMO DATA COMPLETED SUCCESSFULLY ===");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

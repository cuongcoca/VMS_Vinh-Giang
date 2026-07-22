/**
 * P0.SEED.01 — Seed mã `code` cho các bảng master data
 *
 * Idempotent: chỉ update khi code đang NULL hoặc rỗng.
 * Run: npx tsx prisma/seed-codes.ts
 */
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function seedProductGroupCodes() {
  const groups = await prisma.productGroup.findMany({
    where: { OR: [{ code: null }, { code: "" }] },
    orderBy: { created_at: "asc" },
  });

  if (groups.length === 0) {
    console.log("ProductGroup: tất cả đã có code.");
    return;
  }

  // Tìm max seq hiện có để tránh đè
  const allCodes = await prisma.productGroup.findMany({
    where: { code: { not: null } },
    select: { code: true },
  });
  let maxSeq = 0;
  for (const g of allCodes) {
    const m = g.code?.match(/^NH-(\d+)$/);
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  }

  for (const g of groups) {
    maxSeq++;
    const code = `NH-${String(maxSeq).padStart(2, "0")}`;
    await prisma.productGroup.update({
      where: { id: g.id },
      data: { code },
    });
    console.log(`ProductGroup ${g.name} → ${code}`);
  }
}

async function seedUnitCodes() {
  const units = await prisma.unitOfMeasure.findMany({
    where: { OR: [{ code: null }, { code: "" }] },
    orderBy: { created_at: "asc" },
  });

  if (units.length === 0) {
    console.log("UnitOfMeasure: tất cả đã có code.");
    return;
  }

  // Map sẵn tên VN → code
  const NAME_TO_CODE: Record<string, string> = {
    "thùng": "THUNG",
    "chai": "CHAI",
    "gói": "GOI",
    "lon": "LON",
    "hộp": "HOP",
    "túi": "TUI",
    "kg": "KG",
    "lít": "LIT",
    "cái": "CAI",
    "bộ": "BO",
  };

  for (const u of units) {
    const nameLower = u.name.toLowerCase().trim();
    let code = NAME_TO_CODE[nameLower];
    if (!code) {
      // fallback: bỏ dấu + uppercase
      code = u.name
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 20);
    }

    // Chống trùng: nếu trùng → thêm seq
    let final = code;
    let seq = 1;
    while (true) {
      const existing = await prisma.unitOfMeasure.findUnique({ where: { code: final } });
      if (!existing || existing.id === u.id) break;
      seq++;
      final = `${code}${seq}`;
    }

    await prisma.unitOfMeasure.update({
      where: { id: u.id },
      data: { code: final },
    });
    console.log(`UnitOfMeasure ${u.name} → ${final}`);
  }
}

(async () => {
  try {
    console.log("=== P0.SEED.01: Seed codes for master data ===");
    await seedProductGroupCodes();
    await seedUnitCodes();
    console.log("Done.");
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
})();

#!/usr/bin/env node
/**
 * DATA TEST cho màn "Cân lại tồn khu chờ xuất" (UC-OUT-05) — chỉ dùng trên VPS DEV 188.
 * Tạo 1 pallet IN_STAGING có 2 dòng để test luồng Khớp → Áp dụng → trừ tồn + badge trạng thái.
 *
 *   node scripts/seed-staging-test.js            → tạo (xoá PLTEST* cũ trước)
 *   node scripts/seed-staging-test.js --cleanup  → xoá hết pallet test (code LIKE 'PLTEST%')
 *
 * Dùng driver adapter giống src/lib/prisma.ts vì datasource url nằm ở prisma.config.ts.
 */
require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function ensureItem(code, short_name) {
  let it = await prisma.itemCode.findUnique({ where: { code } });
  if (!it) {
    it = await prisma.itemCode.create({ data: { code, short_name, status: "standardized" } });
    console.log(`  + tạo item_code ${code} (${it.id})`);
  } else {
    console.log(`  = item_code có sẵn ${code} (${it.id})`);
  }
  return it;
}

async function main() {
  if (process.argv.includes("--cleanup")) {
    const del = await prisma.pallet.deleteMany({ where: { code: { startsWith: "PLTEST" } } });
    console.log(`Đã xoá ${del.count} pallet test (PLTEST*).`);
    return;
  }

  const coca = await ensureItem("COCA-LON-330", "Coca lon");
  const gao = await ensureItem("GAO-ST25-5KG", "Gạo ST25 5kg");

  // xoá pallet test cũ để tránh trùng code
  await prisma.pallet.deleteMany({ where: { code: { startsWith: "PLTEST" } } });

  const pallet = await prisma.pallet.create({
    data: {
      code: "PLTEST.001-T1",
      code_date: new Date(),
      code_seq: 901,
      status: "IN_STAGING",
      total_lines: 2,
      note: "DATA TEST cân lại tồn — xoá được bằng --cleanup",
      lines: {
        create: [
          { item_code_id: coca.id, qty_box: 50, qty_unit: 0, weight_kg: 0 },
          { item_code_id: gao.id, qty_box: 30, qty_unit: 0, weight_kg: 0 },
        ],
      },
    },
    include: { lines: { include: { item_code: true } } },
  });

  console.log(`\nĐã tạo pallet ${pallet.code} [IN_STAGING] với ${pallet.lines.length} dòng:`);
  for (const l of pallet.lines) console.log(`   - ${l.item_code.code} · tồn ${String(l.qty_box)}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });

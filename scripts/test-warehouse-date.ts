/**
 * WVG-98 / WMS-009 — Unit test ngày kho GMT+7 (mã pallet không lệch ngày).
 * Chạy: npx tsx scripts/test-warehouse-date.ts
 */
import assert from "node:assert";
import { warehouseDateParts } from "../src/lib/warehouse-date";

let passed = 0;
function ok(desc: string, cond: boolean) {
  assert.ok(cond, desc);
  passed++;
  console.log("  ✓", desc);
}

console.log("warehouse-date — unit tests (GMT+7)\n");

// === CA LỖI GỐC: 22/07 17:30 UTC = 23/07 00:30 giờ VN ===
const p = warehouseDateParts(new Date("2026-07-22T17:30:00Z"));
ok('22/07 17:30Z → VN 23/07: dd="23" (KHÔNG phải "22")', p.dd === "23");
ok("  → mm=07, yy=26", p.mm === "07" && p.yy === "26");
ok("  → dayKey=pallet_seq_260723", p.dayKey === "pallet_seq_260723");
ok("  → codeDate = 2026-07-23 (UTC midnight)", p.codeDate.toISOString() === "2026-07-23T00:00:00.000Z");
ok("  → year=2026", p.year === 2026);

// === BIÊN nửa đêm VN ===
ok('16:59Z (VN 22/07 23:59) → dd="22"', warehouseDateParts(new Date("2026-07-22T16:59:00Z")).dd === "22");
ok('17:00Z (VN 23/07 00:00) → dd="23"', warehouseDateParts(new Date("2026-07-22T17:00:00Z")).dd === "23");

// === BIÊN năm: 31/12 17:30Z = 01/01 00:30 VN năm sau ===
const y = warehouseDateParts(new Date("2025-12-31T17:30:00Z"));
ok("31/12 17:30Z → VN 01/01 năm sau: year=2026", y.year === 2026);
ok('  → mm=01, dd=01, yy=26', y.mm === "01" && y.dd === "01" && y.yy === "26");

// === Giữa ngày (không biên) ===
const noon = warehouseDateParts(new Date("2026-07-23T05:00:00Z")); // VN 12:00 23/07
ok('12:00 VN 23/07 → dd="23"', noon.dd === "23");

console.log(`\n✅ ${passed}/${passed} assertions passed`);

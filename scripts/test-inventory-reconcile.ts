// WVG-238 — Unit test buildReconciliation (thuần, không cần DB).
// Chạy: npx tsx scripts/test-inventory-reconcile.ts
import { buildReconciliation, type ReconLine, type ReconPallet, type ReconMovement } from "../src/lib/inventory-reconcile";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`, extra ?? ""); }
}
const has = (arr: { code: string }[], code: string) => arr.some((d) => d.code === code);

const asOf = new Date("2026-07-29T03:00:00Z"); // 10:00 VN 29/07

function line(over: Partial<ReconLine>): ReconLine {
  return {
    id: "L", item_code_id: "IC1", item_code: "SKU1", pallet_id: "P1", pallet_code: "PL1",
    pallet_status: "IN_STORAGE", location_id: "LOC1", location_code: "A-01-01",
    lot: "LOT1", expiry_date: new Date("2027-01-01T00:00:00Z"),
    qty_box: 10, qty_unit: 240, units_per_box: 24, ...over,
  };
}

console.log("WVG-238 buildReconciliation");

// 1) Bộ dữ liệu SẠCH → khớp, không ERROR.
{
  const lines: ReconLine[] = [
    line({ id: "L1", pallet_id: "P1", pallet_code: "PL1", qty_box: 10, qty_unit: 240 }),
    line({ id: "L2", pallet_id: "P2", pallet_code: "PL2", item_code_id: "IC2", item_code: "SKU2", location_id: "LOC2", qty_box: 5, qty_unit: 120 }),
  ];
  const pallets: ReconPallet[] = [
    { id: "P1", code: "PL1", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
    { id: "P2", code: "PL2", status: "IN_STORAGE", location_id: "LOC2", line_count: 1 },
  ];
  const r = buildReconciliation({ lines, pallets, movements: [], asOf });
  check("grand = 15", r.grand_total_box === 15, r.grand_total_box);
  check("D1 SKU total = 15, 2 mã", r.dimensions.by_sku.total === 15 && r.dimensions.by_sku.groups === 2);
  check("D2 pallet total = 15, 2 pallet", r.dimensions.by_pallet.total === 15 && r.dimensions.by_pallet.groups === 2);
  check("D3 location total = 15, unlocated 0", r.dimensions.by_location.total === 15 && r.dimensions.by_location.unlocated_total === 0);
  check("D4 lot total = 15", r.dimensions.by_lot.total === 15);
  check("D5 available 15, blocked 0", r.dimensions.available_blocked.available === 15 && r.dimensions.available_blocked.blocked === 0);
  check("mọi cross-check ✓", r.checks.every((c) => c.ok));
  check("ok = true (0 ERROR)", r.ok === true);
  check("0 discrepancy", r.discrepancies.length === 0, r.discrepancies);
}

// 2) Hàng hết hạn → blocked, available loại.
{
  const lines: ReconLine[] = [
    line({ id: "L1", qty_box: 10, expiry_date: new Date("2020-01-01T00:00:00Z") }), // hết hạn
    line({ id: "L2", pallet_id: "P2", qty_box: 4, expiry_date: null }), // không HSD
  ];
  const pallets: ReconPallet[] = [
    { id: "P1", code: "PL1", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
    { id: "P2", code: "PL2", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
  ];
  const r = buildReconciliation({ lines, pallets, movements: [], asOf });
  check("blocked = 10 (lô hết hạn)", r.dimensions.available_blocked.blocked === 10, r.dimensions.available_blocked.blocked);
  check("available = 4", r.dimensions.available_blocked.available === 4);
  check("available+blocked = physical = grand", r.dimensions.available_blocked.physical === r.grand_total_box);
  check("D5 cross-check ✓", r.checks.find((c) => c.name.includes("available"))!.ok);
  check("no_expiry_total = 4", r.dimensions.by_lot.no_expiry_total === 4);
}

// 3) Các orphan/cảnh báo được bắt.
{
  const lines: ReconLine[] = [
    line({ id: "L1", item_code_id: null, item_code: null }),                 // thiếu mã
    line({ id: "L2", pallet_id: "P2", qty_box: -3, qty_unit: -72 }),          // qty âm
    line({ id: "L3", pallet_id: "P3", qty_box: 10, qty_unit: 200 }),          // sai quy đổi (kỳ vọng 240)
    line({ id: "L4", pallet_id: "P4", location_id: null, pallet_status: "IN_STORAGE" }), // IN_STORAGE thiếu vị trí
  ];
  const pallets: ReconPallet[] = [
    { id: "P1", code: "PL1", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
    { id: "P2", code: "PL2", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
    { id: "P3", code: "PL3", status: "IN_STORAGE", location_id: "LOC1", line_count: 1 },
    { id: "P4", code: "PL4", status: "IN_STORAGE", location_id: null, line_count: 1 },
    { id: "P5", code: "PL5", status: "CONFIRMED", location_id: null, line_count: 0 }, // pallet rỗng
  ];
  const movements: ReconMovement[] = [
    { movement_type: "SHIP", qty_box: 5 },
    { movement_type: "PUT_AWAY", qty_box: null }, // cũ, null qty
  ];
  const r = buildReconciliation({ lines, pallets, movements, asOf });
  check("bắt LINE_NO_ITEM", has(r.discrepancies, "LINE_NO_ITEM"));
  check("bắt LINE_NEG_QTY", has(r.discrepancies, "LINE_NEG_QTY"));
  check("bắt UNIT_CONV_MISMATCH", has(r.discrepancies, "UNIT_CONV_MISMATCH"));
  check("bắt IN_STORAGE_NO_LOCATION", has(r.discrepancies, "IN_STORAGE_NO_LOCATION"));
  check("bắt STOCK_PALLET_EMPTY", has(r.discrepancies, "STOCK_PALLET_EMPTY"));
  check("bắt MOVEMENT_NULL_QTY (1)", has(r.discrepancies, "MOVEMENT_NULL_QTY") && r.dimensions.movement.null_qty_count === 1);
  check("D6 movement SHIP = 5", r.dimensions.movement.by_type["SHIP"] === 5);
  check("ok = false (có ERROR)", r.ok === false);
  check("unlocated_total = 10 (dòng L4)", r.dimensions.by_location.unlocated_total === 10, r.dimensions.by_location.unlocated_total);
}

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

// WVG-238 / WVG-DATA-001 — Baseline reconciliation tồn kho (READ-ONLY).
//
// Đối chiếu tổng tồn on-hand theo 5 chiều tại CÙNG thời điểm + phát hiện chênh
// lệch (root cause/owner/disposition). KHÔNG ghi/sửa DB.
//
// Chạy (từ thư mục dự án, nạp .env):
//   export $(grep '^DATABASE_URL=' .env | xargs) && npx tsx scripts/reconcile-inventory.ts
// Xuất JSON + Markdown ra docs/reports/reconciliation/.
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";
import { STOCK_PALLET_STATUSES } from "../src/lib/inventory-constants";
import { buildReconciliation, type ReconLine, type ReconPallet, type ReconMovement } from "../src/lib/inventory-reconcile";

async function main() {
  const asOf = new Date();

  // ── Truy vấn snapshot (read-only) ──
  const rawLines = await prisma.palletLine.findMany({
    where: { pallet: { status: { in: STOCK_PALLET_STATUSES } } },
    select: {
      id: true, item_code_id: true, lot: true, expiry_date: true, qty_box: true, qty_unit: true,
      item_code: { select: { code: true, units_per_box: true } },
      pallet: { select: { id: true, code: true, status: true, location_id: true, location: { select: { code: true } } } },
    },
  });

  const rawPallets = await prisma.pallet.findMany({
    where: { status: { in: STOCK_PALLET_STATUSES } },
    select: { id: true, code: true, status: true, location_id: true, _count: { select: { lines: true } } },
  });

  const rawMovements = await prisma.movement.findMany({ select: { movement_type: true, qty_box: true } });

  // ── Map sang input thuần ──
  const lines: ReconLine[] = rawLines.map((l) => ({
    id: l.id,
    item_code_id: l.item_code_id ?? null,
    item_code: l.item_code?.code ?? null,
    pallet_id: l.pallet.id,
    pallet_code: l.pallet.code,
    pallet_status: String(l.pallet.status),
    location_id: l.pallet.location_id ?? null,
    location_code: l.pallet.location?.code ?? null,
    lot: l.lot ?? null,
    expiry_date: l.expiry_date ?? null,
    qty_box: Number(l.qty_box ?? 0),
    qty_unit: Number(l.qty_unit ?? 0),
    units_per_box: l.item_code?.units_per_box ?? 1,
  }));
  const pallets: ReconPallet[] = rawPallets.map((p) => ({
    id: p.id, code: p.code, status: String(p.status), location_id: p.location_id ?? null, line_count: p._count.lines,
  }));
  const movements: ReconMovement[] = rawMovements.map((m) => ({
    movement_type: String(m.movement_type), qty_box: m.qty_box == null ? null : Number(m.qty_box),
  }));

  const result = buildReconciliation({ lines, pallets, movements, asOf });

  // ── In console ──
  const D = result.dimensions;
  console.log(`\nWVG-238 — Reconciliation tồn kho @ ${result.as_of}`);
  console.log(`Universe: pallet ∈ [${STOCK_PALLET_STATUSES.join(", ")}] · ${lines.length} dòng · ${pallets.length} pallet\n`);
  console.log(`Tổng chung (grand): ${result.grand_total_box} thùng`);
  console.log(`  D1 SKU      : ${D.by_sku.total} (${D.by_sku.groups} mã)`);
  console.log(`  D2 pallet   : ${D.by_pallet.total} (${D.by_pallet.groups} pallet)`);
  console.log(`  D3 location : ${D.by_location.total} (${D.by_location.groups} vị trí, unlocated ${D.by_location.unlocated_total})`);
  console.log(`  D4 lot/HSD  : ${D.by_lot.total} (${D.by_lot.groups} lô, không HSD ${D.by_lot.no_expiry_total})`);
  console.log(`  D5 avail/blk: available ${D.available_blocked.available} + blocked ${D.available_blocked.blocked} = ${D.available_blocked.physical}`);
  console.log(`  D6 movement : ${JSON.stringify(D.movement.by_type)} · null-qty ${D.movement.null_qty_count}`);
  console.log(`\nCross-check:`);
  for (const c of result.checks) console.log(`  ${c.ok ? "✓" : "✗"} ${c.name} (kỳ vọng ${c.expected}, thực tế ${c.actual})`);
  console.log(`\nDiscrepancy: ${result.discrepancies.length} (ERROR ${result.discrepancies.filter(d => d.severity === "ERROR").length} · WARN ${result.discrepancies.filter(d => d.severity === "WARN").length} · INFO ${result.discrepancies.filter(d => d.severity === "INFO").length})`);
  console.log(`Kết luận: ${result.ok ? "✓ KHỚP (không có ERROR)" : "✗ CÓ CHÊNH LỆCH MỨC ERROR"}`);

  // ── Xuất file ──
  const outDir = join(process.cwd(), "docs", "reports", "reconciliation");
  mkdirSync(outDir, { recursive: true });
  const stamp = result.as_of.replace(/[:.]/g, "-").slice(0, 16);
  const jsonPath = join(outDir, `reconcile-${stamp}.json`);
  const mdPath = join(outDir, `reconcile-${stamp}.md`);
  writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf8");
  writeFileSync(mdPath, toMarkdown(result, lines.length, pallets.length), "utf8");
  console.log(`\nĐã xuất:\n  ${jsonPath}\n  ${mdPath}`);
}

function toMarkdown(r: ReturnType<typeof buildReconciliation>, lineCount: number, palletCount: number): string {
  const D = r.dimensions;
  const disRows = r.discrepancies.length
    ? r.discrepancies.map((d) => `| ${d.severity} | \`${d.code}\` | ${d.entity} | ${d.detail} | ${d.root_cause} | ${d.owner} | ${d.disposition} |`).join("\n")
    : "| — | — | — | Không có chênh lệch | — | — | — |";
  return `# Reconciliation tồn kho — ${r.as_of}

Universe: pallet ∈ [${STOCK_PALLET_STATUSES.join(", ")}] · ${lineCount} dòng · ${palletCount} pallet.
**Tổng chung (grand): ${r.grand_total_box} thùng.** Kết luận: ${r.ok ? "✓ KHỚP (không ERROR)" : "✗ CÓ ERROR"}.

## Đối chiếu 5 chiều
| Chiều | Tổng | Nhóm |
|---|---|---|
| D1 — theo SKU | ${D.by_sku.total} | ${D.by_sku.groups} mã |
| D2 — theo pallet | ${D.by_pallet.total} | ${D.by_pallet.groups} pallet |
| D3 — theo location | ${D.by_location.total} | ${D.by_location.groups} vị trí (unlocated ${D.by_location.unlocated_total}) |
| D4 — theo lot/HSD | ${D.by_lot.total} | ${D.by_lot.groups} lô (không HSD ${D.by_lot.no_expiry_total}) |
| D5 — available/blocked | ${D.available_blocked.physical} | available ${D.available_blocked.available} + blocked ${D.available_blocked.blocked} |
| D6 — movement (ledger) | ${Object.entries(D.movement.by_type).map(([k, v]) => `${k}:${v}`).join(", ") || "—"} | null-qty ${D.movement.null_qty_count} |

## Cross-check toàn vẹn
| Kiểm tra | Kỳ vọng | Thực tế | Kết quả |
|---|---|---|---|
${r.checks.map((c) => `| ${c.name} | ${c.expected} | ${c.actual} | ${c.ok ? "✓" : "✗ lệch " + Math.round(c.delta * 100) / 100} |`).join("\n")}

## Chênh lệch (root cause · owner · disposition)
| Mức | Mã | Entity | Chi tiết | Root cause | Owner | Disposition |
|---|---|---|---|---|---|---|
${disRows}

> Nguyên tắc: **không chỉnh balance trực tiếp** — mọi chênh lệch xử lý qua điều tra + quy trình Điều chỉnh, gắn owner/disposition.
`;
}

main().catch((e) => { console.error("Lỗi:", e); process.exit(1); }).finally(() => prisma.$disconnect());

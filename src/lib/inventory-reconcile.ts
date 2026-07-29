// WVG-238 / WVG-DATA-001 — Baseline reconciliation tồn kho (READ-ONLY, thuần).
//
// Đối chiếu tổng tồn on-hand theo 5 chiều độc lập tại CÙNG một thời điểm:
//   D1 theo SKU · D2 theo pallet · D3 theo location · D4 theo lot/HSD ·
//   D5 available/blocked (WVG-239) · D6 theo movement (ledger — drift check).
// D1–D4 lấy từ CÙNG bảng pallet_lines nên BẮT BUỘC bằng nhau; lệch = lỗi dữ liệu.
// Hàm này KHÔNG chạm DB — nhận sẵn rows để dễ unit-test; script truy vấn rồi gọi.
// Tuyệt đối KHÔNG chỉnh balance — chỉ tính & liệt kê chênh lệch + root cause.

import { isExpired } from "@/lib/inventory-expiry";

export interface ReconLine {
  id: string;
  item_code_id: string | null;
  item_code?: string | null;
  pallet_id: string;
  pallet_code?: string | null;
  pallet_status: string;
  location_id: string | null;
  location_code?: string | null;
  lot: string | null;
  expiry_date: Date | null;
  qty_box: number;
  qty_unit: number;
  units_per_box: number;
}

export interface ReconPallet {
  id: string;
  code: string;
  status: string;
  location_id: string | null;
  line_count: number;
}

export interface ReconMovement {
  movement_type: string;
  qty_box: number | null;
}

export type Severity = "ERROR" | "WARN" | "INFO";

export interface Discrepancy {
  code: string; // slug ngắn
  severity: Severity;
  entity: string; // pallet/sku/location cụ thể (để BA/QA truy)
  detail: string;
  root_cause: string;
  owner: string;
  disposition: string;
}

export interface ReconCheck {
  name: string;
  expected: number;
  actual: number;
  ok: boolean;
  delta: number;
}

export interface ReconResult {
  as_of: string;
  grand_total_box: number;
  dimensions: {
    by_sku: { groups: number; total: number };
    by_pallet: { groups: number; total: number };
    by_location: { groups: number; total: number; unlocated_total: number };
    by_lot: { groups: number; total: number; no_expiry_total: number };
    available_blocked: { available: number; blocked: number; physical: number };
    movement: { by_type: Record<string, number>; null_qty_count: number };
  };
  checks: ReconCheck[];
  discrepancies: Discrepancy[];
  ok: boolean; // true nếu không có discrepancy mức ERROR
}

const round2 = (n: number) => Math.round(n * 100) / 100;
// So khớp số thực với dung sai nhỏ (Decimal(10,2) → 0.01).
const EPS = 0.005;
const eq = (a: number, b: number) => Math.abs(a - b) < EPS;

export function buildReconciliation(input: {
  lines: ReconLine[];
  pallets: ReconPallet[];
  movements: ReconMovement[];
  asOf: Date;
}): ReconResult {
  const { lines, pallets, movements, asOf } = input;
  const discrepancies: Discrepancy[] = [];

  // ── Tổng chung (nguồn chân lý = Σ qty_box mọi dòng tồn) ──
  const grand = round2(lines.reduce((s, l) => s + l.qty_box, 0));

  // ── D1 theo SKU ──
  const skuMap = new Map<string, number>();
  for (const l of lines) {
    const k = l.item_code_id ?? "__NULL__";
    skuMap.set(k, (skuMap.get(k) ?? 0) + l.qty_box);
  }
  const bySku = { groups: skuMap.size, total: round2([...skuMap.values()].reduce((a, b) => a + b, 0)) };

  // ── D2 theo pallet ──
  const palletMap = new Map<string, number>();
  for (const l of lines) palletMap.set(l.pallet_id, (palletMap.get(l.pallet_id) ?? 0) + l.qty_box);
  const byPallet = { groups: palletMap.size, total: round2([...palletMap.values()].reduce((a, b) => a + b, 0)) };

  // ── D3 theo location (null = UNLOCATED, vd CONFIRMED chưa put-away) ──
  const locMap = new Map<string, number>();
  let unlocated = 0;
  for (const l of lines) {
    if (l.location_id == null) unlocated += l.qty_box;
    else locMap.set(l.location_id, (locMap.get(l.location_id) ?? 0) + l.qty_box);
  }
  const byLocation = {
    groups: locMap.size,
    total: round2([...locMap.values()].reduce((a, b) => a + b, 0) + unlocated),
    unlocated_total: round2(unlocated),
  };

  // ── D4 theo lot/HSD ──
  const lotMap = new Map<string, number>();
  let noExpiry = 0;
  for (const l of lines) {
    const k = `${l.item_code_id ?? "?"}|${l.lot ?? ""}|${l.expiry_date ? l.expiry_date.toISOString().slice(0, 10) : ""}`;
    lotMap.set(k, (lotMap.get(k) ?? 0) + l.qty_box);
    if (l.expiry_date == null) noExpiry += l.qty_box;
  }
  const byLot = { groups: lotMap.size, total: round2([...lotMap.values()].reduce((a, b) => a + b, 0)), no_expiry_total: round2(noExpiry) };

  // ── D5 available / blocked (WVG-239) ──
  let available = 0;
  let blocked = 0;
  for (const l of lines) {
    if (isExpired(l.expiry_date, asOf)) blocked += l.qty_box;
    else available += l.qty_box;
  }
  const availableBlocked = { available: round2(available), blocked: round2(blocked), physical: round2(available + blocked) };

  // ── D6 theo movement (ledger) ──
  const byType: Record<string, number> = {};
  let nullQty = 0;
  for (const m of movements) {
    if (m.qty_box == null) { nullQty++; continue; }
    byType[m.movement_type] = round2((byType[m.movement_type] ?? 0) + Number(m.qty_box));
  }

  // ── Cross-check toàn vẹn ──
  const checks: ReconCheck[] = [
    mkCheck("D1 SKU = tổng chung", grand, bySku.total),
    mkCheck("D2 pallet = tổng chung", grand, byPallet.total),
    mkCheck("D3 location(+unlocated) = tổng chung", grand, byLocation.total),
    mkCheck("D4 lot/HSD = tổng chung", grand, byLot.total),
    mkCheck("D5 available+blocked = tổng vật lý", grand, availableBlocked.physical),
  ];
  for (const c of checks) {
    if (!c.ok) {
      discrepancies.push({
        code: "INTEG_MISMATCH",
        severity: "ERROR",
        entity: c.name,
        detail: `Kỳ vọng ${c.expected}, thực tế ${c.actual} (lệch ${round2(c.delta)}).`,
        root_cause: "Các chiều lấy cùng bảng pallet_lines nhưng tổng lệch → nghi group-by sót dòng hoặc dữ liệu mồ côi.",
        owner: "BE",
        disposition: "Điều tra query/dữ liệu; KHÔNG chỉnh balance trực tiếp.",
      });
    }
  }

  // ── ORPHAN / cảnh báo dữ liệu ──
  for (const l of lines) {
    if (l.item_code_id == null) {
      discrepancies.push({
        code: "LINE_NO_ITEM", severity: "ERROR",
        entity: `line ${l.id} @ pallet ${l.pallet_code ?? l.pallet_id}`,
        detail: `Dòng tồn ${l.qty_box} thùng nhưng thiếu item_code_id.`,
        root_cause: "Dòng pallet mồ côi mã hàng (import lỗi hoặc xoá mã).",
        owner: "BE/OPS", disposition: "Truy nguồn & gán lại mã; không xoá tồn.",
      });
    }
    if (l.qty_box < 0) {
      discrepancies.push({
        code: "LINE_NEG_QTY", severity: "ERROR",
        entity: `line ${l.id} @ pallet ${l.pallet_code ?? l.pallet_id}`,
        detail: `qty_box âm: ${l.qty_box}.`,
        root_cause: "Trừ tồn quá tay / lỗi ghi.", owner: "BE",
        disposition: "Điều tra movement liên quan; xử lý qua Điều chỉnh, không set tay.",
      });
    }
    // Sai quy đổi thùng ↔ đơn vị lẻ. Phân biệt 2 nguyên nhân:
    //  (a) units_per_box CHƯA cấu hình (=1) nhưng qty_unit mang số lẻ thật → lỗi cấu hình mã hàng.
    //  (b) còn lại → lệch dữ liệu qty_unit thực sự.
    if (l.item_code_id != null && l.units_per_box > 0 && !eq(l.qty_unit, l.qty_box * l.units_per_box)) {
      const unconfigured = l.units_per_box === 1 && l.qty_box > 0 && l.qty_unit > l.qty_box && eq(l.qty_unit % l.qty_box, 0);
      discrepancies.push({
        code: unconfigured ? "UNITS_PER_BOX_UNCONFIGURED" : "UNIT_CONV_MISMATCH",
        severity: "WARN",
        entity: `line ${l.id} @ pallet ${l.pallet_code ?? l.pallet_id} (${l.item_code ?? l.item_code_id})`,
        detail: unconfigured
          ? `units_per_box=1 nhưng qty_unit=${round2(l.qty_unit)} = qty_box×${round2(l.qty_unit / l.qty_box)} → hệ số quy đổi thực có vẻ là ${round2(l.qty_unit / l.qty_box)}.`
          : `qty_unit=${round2(l.qty_unit)} ≠ qty_box×units_per_box=${round2(l.qty_box * l.units_per_box)} (upb=${l.units_per_box}).`,
        root_cause: unconfigured
          ? "ItemCode.units_per_box chưa cấu hình (mặc định 1) trong khi qty_unit đã mang số đơn vị lẻ thật."
          : "Lệch dữ liệu qty_unit ↔ qty_box (rút lẻ/nhập liệu).",
        owner: "OPS/BE",
        disposition: unconfigured
          ? "Cấu hình lại units_per_box cho mã hàng (không đổi tồn thùng qty_box → không ảnh hưởng tổng tồn)."
          : "Chuẩn hoá qty_unit theo qty_box; xử lý qua Điều chỉnh nếu ảnh hưởng tồn.",
      });
    }
    // Tồn trong kho nhưng thiếu vị trí vật lý
    if (l.pallet_status === "IN_STORAGE" && l.location_id == null) {
      discrepancies.push({
        code: "IN_STORAGE_NO_LOCATION", severity: "WARN",
        entity: `pallet ${l.pallet_code ?? l.pallet_id}`,
        detail: `Pallet IN_STORAGE nhưng location_id = null (${l.qty_box} thùng).`,
        root_cause: "Đặt trạng thái IN_STORAGE mà chưa gán ô vị trí.", owner: "OPS",
        disposition: "Gán vị trí thực tế — ref WVG-OPS-001; không đổi tồn.",
      });
    }
  }

  // Pallet trong kho nhưng KHÔNG có dòng hàng
  for (const p of pallets) {
    if (p.line_count === 0) {
      discrepancies.push({
        code: "STOCK_PALLET_EMPTY", severity: "INFO",
        entity: `pallet ${p.code} [${p.status}]`,
        detail: "Pallet ở trạng thái tồn nhưng không có dòng hàng.",
        root_cause: "Rút sạch nhưng chưa RELEASED, hoặc pallet vỏ.", owner: "OPS",
        disposition: "Rà soát đóng/RELEASED; không ảnh hưởng tổng tồn.",
      });
    }
  }

  // Movement thiếu qty (dữ liệu cũ trước WVG-179)
  if (nullQty > 0) {
    discrepancies.push({
      code: "MOVEMENT_NULL_QTY", severity: "INFO",
      entity: `movement ledger`,
      detail: `${nullQty} movement thiếu qty_box (thường là bản ghi cũ).`,
      root_cause: "Trước WVG-179 movement nguyên-pallet ghi qty=null.", owner: "BE",
      disposition: "Đã chuẩn hoá từ WVG-179 trở đi; KHÔNG truy hồi sửa bản ghi cũ (append-only).",
    });
  }

  const hasError = discrepancies.some((d) => d.severity === "ERROR");

  return {
    as_of: asOf.toISOString(),
    grand_total_box: grand,
    dimensions: { by_sku: bySku, by_pallet: byPallet, by_location: byLocation, by_lot: byLot, available_blocked: availableBlocked, movement: { by_type: byType, null_qty_count: nullQty } },
    checks,
    discrepancies,
    ok: !hasError,
  };
}

function mkCheck(name: string, expected: number, actual: number): ReconCheck {
  return { name, expected: round2(expected), actual: round2(actual), ok: eq(expected, actual), delta: expected - actual };
}

/**
 * P0.LIB.01 — Helper quy đổi giữa thùng (qty_box) và đơn vị lẻ (qty_unit).
 *
 * Quy ước nghiệp vụ (xem docs/ARCHITECTURE.md):
 * - Đơn vị nhập liệu = THÙNG
 * - Hệ thống quy đổi sang lẻ (chai/gói/lon) theo `quy_cach` trong ItemCode / Product
 * - Dùng DECIMAL không float
 */

export interface ItemSpec {
  /** Số đơn vị lẻ trong 1 thùng. VD `24` nghĩa là 24 chai/thùng. */
  qty_per_box?: number | null;
  /** Trọng lượng (kg) của 1 thùng. */
  weight_per_box?: number | null;
  /** Tên đơn vị lẻ hiển thị, vd "chai", "gói". */
  unit_name?: string | null;
  /** Symbol đơn vị lẻ, vd "c", "g". */
  unit_symbol?: string | null;
}

/** Quy đổi số thùng → số đơn vị lẻ. */
export function boxToUnit(qtyBox: number, qtyPerBox: number | null | undefined): number {
  if (!qtyPerBox || qtyPerBox <= 0) return 0;
  return qtyBox * qtyPerBox;
}

/** Tính tổng trọng lượng (kg) cho số thùng. */
export function weightOfBox(qtyBox: number, weightPerBox: number | null | undefined): number {
  if (!weightPerBox || weightPerBox <= 0) return 0;
  return qtyBox * weightPerBox;
}

/** Số đơn vị lẻ → số thùng (làm tròn xuống). */
export function unitToBox(qtyUnit: number, qtyPerBox: number | null | undefined): number {
  if (!qtyPerBox || qtyPerBox <= 0) return 0;
  return Math.floor(qtyUnit / qtyPerBox);
}

/** Format số với separator nghìn (vi-VN), tối đa 3 chữ số thập phân. */
export function formatNumber(n: number, maxDecimals = 3): string {
  return new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: maxDecimals,
  }).format(n);
}

/** Format trọng lượng kèm đơn vị kg. */
export function formatWeight(kg: number): string {
  return `${formatNumber(kg, 2)} kg`;
}

/**
 * Format dòng quy đổi đầy đủ cho hiển thị trên form thêm dòng pallet (UC-PAL-02):
 *   "5 thùng × 24 chai = 120 chai · Tải trọng: 66 kg"
 *
 * Nếu thiếu qty_per_box → trả về `"{qtyBox} thùng"` đơn giản.
 */
export function formatConversion(qtyBox: number, spec: ItemSpec): string {
  const unitLabel = spec.unit_name || spec.unit_symbol || "đv";
  const parts: string[] = [];

  if (spec.qty_per_box && spec.qty_per_box > 0) {
    const totalUnit = boxToUnit(qtyBox, spec.qty_per_box);
    parts.push(
      `${formatNumber(qtyBox)} thùng × ${formatNumber(spec.qty_per_box)} ${unitLabel} = ${formatNumber(totalUnit)} ${unitLabel}`,
    );
  } else {
    parts.push(`${formatNumber(qtyBox)} thùng`);
  }

  if (spec.weight_per_box && spec.weight_per_box > 0) {
    const totalKg = weightOfBox(qtyBox, spec.weight_per_box);
    parts.push(`Tải trọng: ${formatWeight(totalKg)}`);
  }

  return parts.join(" · ");
}

/**
 * Format quy cách ngắn gọn cho hiển thị sau khi chọn mã hàng:
 *   "Quy cách: 24 chai/thùng · Trọng lượng: 13.2 kg/thùng"
 */
export function formatSpec(spec: ItemSpec): string {
  const unitLabel = spec.unit_name || spec.unit_symbol || "đv";
  const parts: string[] = [];

  if (spec.qty_per_box && spec.qty_per_box > 0) {
    parts.push(`Quy cách: ${formatNumber(spec.qty_per_box)} ${unitLabel}/thùng`);
  }

  if (spec.weight_per_box && spec.weight_per_box > 0) {
    parts.push(`Trọng lượng: ${formatNumber(spec.weight_per_box, 2)} kg/thùng`);
  }

  return parts.join(" · ");
}

/**
 * Format SL đơn vị lẻ hiển thị trên card dòng pallet (UC-PAL-06):
 *   "120 chai" hoặc "5 thùng" nếu không có qty_per_box
 */
export function formatQtyDisplay(qtyBox: number, spec: ItemSpec): string {
  const unitLabel = spec.unit_name || spec.unit_symbol || "đv";
  if (spec.qty_per_box && spec.qty_per_box > 0) {
    return `${formatNumber(boxToUnit(qtyBox, spec.qty_per_box))} ${unitLabel}`;
  }
  return `${formatNumber(qtyBox)} thùng`;
}

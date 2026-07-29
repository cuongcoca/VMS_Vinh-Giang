// WVG-179 / WMS-006 — Movement ledger đủ dữ liệu truy vết (append-only, SNAPSHOT).
// Move NGUYÊN pallet (nhiều dòng) trước đây tạo 1 movement với item/lot/qty = null.
// Hướng (A): tạo 1 movement / MỖI dòng pallet, snapshot item/lot/qty/expiry TẠI THỜI
// ĐIỂM move (không suy diễn lại từ state hiện tại). Pallet rỗng → 1 dòng mức-pallet.

import { Prisma, MovementType } from "@prisma/client";

export interface MovementContext {
  pallet_id: string;
  movement_type: MovementType;
  from_location_id?: string | null;
  to_location_id?: string | null;
  performed_by?: string | null; // actor — luôn truyền
  reason?: string | null;
  reason_code?: string | null;
  mode?: string | null;
  audit_log_id?: string | null;
}

// Ảnh chụp 1 dòng hàng của pallet tại thời điểm move.
export interface LineSnapshot {
  item_code_id: string;
  lot?: string | null;
  expiry_date?: Date | null;
  qty_box: Prisma.Decimal | number;
  qty_unit?: Prisma.Decimal | number | null;
}

/**
 * Sinh mảng data movement (dùng cho `movement.createMany`): 1 dòng / mỗi line pallet,
 * đủ trường truy vết. Nếu pallet KHÔNG có dòng → 1 movement mức-pallet (item/qty null).
 */
export function buildMovementSnapshot(
  ctx: MovementContext,
  lines: LineSnapshot[]
): Prisma.MovementCreateManyInput[] {
  const base = {
    pallet_id: ctx.pallet_id,
    movement_type: ctx.movement_type,
    from_location_id: ctx.from_location_id ?? null,
    to_location_id: ctx.to_location_id ?? null,
    performed_by: ctx.performed_by ?? null,
    reason: ctx.reason ?? null,
    reason_code: ctx.reason_code ?? null,
    mode: ctx.mode ?? null,
    audit_log_id: ctx.audit_log_id ?? null,
  };
  if (!lines.length) {
    return [{ ...base, item_code_id: null, qty_box: null, qty_unit: null, lot: null, expiry_date: null }];
  }
  return lines.map((l) => ({
    ...base,
    item_code_id: l.item_code_id,
    qty_box: l.qty_box,
    qty_unit: l.qty_unit ?? null,
    lot: l.lot ?? null,
    expiry_date: l.expiry_date ?? null,
  }));
}

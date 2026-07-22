/**
 * Single source of truth cho status enum + label + color + icon.
 *
 * Replace 5+ STATUS_MAP duplicate trong codebase.
 *
 * Sử dụng:
 *   import { PALLET_STATUS_META } from "@/lib/status-meta";
 *   const meta = PALLET_STATUS_META["COUNTING"];
 *   <span className={`${meta.chipBg} ${meta.chipText}`}>{meta.label}</span>
 */

// ═══════════════════════════════════════════════════════════════
// PALLET
// ═══════════════════════════════════════════════════════════════

export type PalletStatus =
  | "EMPTY"
  | "COUNTING"
  | "CONFIRMED"
  | "IN_STORAGE"
  | "IN_STAGING"
  | "RELEASED"
  | "CANCELLED";

export const PALLET_STATUS_META: Record<
  PalletStatus,
  {
    label: string;
    chipBg: string;
    chipText: string;
    borderLeft: string;
    icon: string;
  }
> = {
  EMPTY: {
    label: "Đang thêm hàng",
    chipBg: "bg-surface-low",
    chipText: "text-on-surface-variant",
    borderLeft: "bg-surface-mid",
    icon: "package_2",
  },
  COUNTING: {
    label: "Đang thêm hàng",
    chipBg: "bg-amber-100",
    chipText: "text-amber-700",
    borderLeft: "bg-amber-500",
    icon: "hourglass_top",
  },
  CONFIRMED: {
    label: "Chờ xe nâng",
    chipBg: "bg-blue-100",
    chipText: "text-blue-700",
    borderLeft: "bg-blue-500",
    icon: "check_circle",
  },
  IN_STORAGE: {
    label: "Trong kho",
    chipBg: "bg-emerald-100",
    chipText: "text-emerald-700",
    borderLeft: "bg-emerald-500",
    icon: "shelves",
  },
  IN_STAGING: {
    label: "Chờ xuất",
    chipBg: "bg-purple-100",
    chipText: "text-purple-700",
    borderLeft: "bg-purple-500",
    icon: "outbox",
  },
  RELEASED: {
    label: "Đã giải phóng",
    chipBg: "bg-surface-low",
    chipText: "text-on-surface-variant/50",
    borderLeft: "bg-surface-mid",
    icon: "task_alt",
  },
  CANCELLED: {
    label: "Đã hủy",
    chipBg: "bg-error-container",
    chipText: "text-error",
    borderLeft: "bg-error/50",
    icon: "cancel",
  },
};

// ═══════════════════════════════════════════════════════════════
// INBOUND REQUEST
// ═══════════════════════════════════════════════════════════════

export type InboundStatus =
  | "DRAFT"
  | "PENDING"
  | "RECEIVING"
  | "RECONCILING"
  | "COMPLETED"
  | "CANCELLED";

export const INBOUND_STATUS_META: Record<
  InboundStatus,
  {
    label: string;
    chipBg: string;
    chipText: string;
    icon: string;
    /** Step 1-8 cho stepper UC-IN-05 */
    step: number;
  }
> = {
  DRAFT: { label: "Nháp", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", icon: "edit_note", step: 1 },
  PENDING: { label: "Chờ tiếp nhận", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "hourglass_top", step: 2 },
  RECEIVING: { label: "Đang nhận hàng", chipBg: "bg-blue-50", chipText: "text-blue-700", icon: "inventory", step: 4 },
  RECONCILING: { label: "Đang đối chiếu", chipBg: "bg-purple-50", chipText: "text-purple-700", icon: "compare_arrows", step: 7 },
  COMPLETED: { label: "Hoàn tất", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "check_circle", step: 8 },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error", icon: "cancel", step: 0 },
};

// ═══════════════════════════════════════════════════════════════
// OUTBOUND REQUEST (PYX)
// ═══════════════════════════════════════════════════════════════

export type OutboundStatus = "PENDING" | "PICKING" | "SHIPPED" | "CANCELLED";

export const OUTBOUND_STATUS_META: Record<
  OutboundStatus,
  { label: string; chipBg: string; chipText: string; icon: string }
> = {
  PENDING: { label: "Chờ xuất", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "hourglass_top" },
  PICKING: { label: "Đang lấy hàng", chipBg: "bg-blue-50", chipText: "text-blue-700", icon: "shopping_basket" },
  SHIPPED: { label: "Đã xuất", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "local_shipping" },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error", icon: "cancel" },
};

// ═══════════════════════════════════════════════════════════════
// STOCKTAKE SESSION
// ═══════════════════════════════════════════════════════════════

export type StocktakeStatus = "OPEN" | "COUNTING" | "COMPLETED" | "CANCELLED";

export const STOCKCOUNT_STATUS_META: Record<
  StocktakeStatus,
  { label: string; chipBg: string; chipText: string; icon: string }
> = {
  OPEN: { label: "Mới tạo", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", icon: "edit_note" },
  COUNTING: { label: "Đang kiểm", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "hourglass_top" },
  COMPLETED: { label: "Hoàn tất", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "check_circle" },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error", icon: "cancel" },
};

// ═══════════════════════════════════════════════════════════════
// ADJUSTMENT VOUCHER
// ═══════════════════════════════════════════════════════════════

export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

export const ADJUSTMENT_STATUS_META: Record<
  AdjustmentStatus,
  { label: string; chipBg: string; chipText: string; icon: string }
> = {
  PENDING: { label: "Chờ duyệt", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "hourglass_top" },
  APPROVED: { label: "Đã duyệt", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "check_circle" },
  REJECTED: { label: "Từ chối", chipBg: "bg-error-container", chipText: "text-error", icon: "cancel" },
};

// ═══════════════════════════════════════════════════════════════
// MOVEMENT TYPE
// ═══════════════════════════════════════════════════════════════

export type MovementType = "PUT_AWAY" | "RELOCATE" | "STAGE_OUT" | "RETURN";

export const MOVEMENT_TYPE_META: Record<
  MovementType,
  { label: string; chipBg: string; chipText: string; icon: string }
> = {
  PUT_AWAY: { label: "Đưa vào VT", chipBg: "bg-blue-50", chipText: "text-blue-700", icon: "input" },
  RELOCATE: { label: "Chuyển VT", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "swap_horiz" },
  STAGE_OUT: { label: "Sang chờ xuất", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "outbox" },
  RETURN: { label: "Hoàn trả", chipBg: "bg-error-container", chipText: "text-error", icon: "undo" },
};

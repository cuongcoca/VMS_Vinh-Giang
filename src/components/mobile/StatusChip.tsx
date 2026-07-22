"use client";

/**
 * Mobile/StatusChip — Replace 8 phiên bản status chip rải rác.
 *
 * Lookup từ src/lib/status-meta.ts qua type + value.
 *
 * Sử dụng:
 *   <StatusChip type="PALLET" value="COUNTING" />
 *   <StatusChip type="INBOUND" value="PENDING" />
 */

import React from "react";
import {
  PALLET_STATUS_META,
  INBOUND_STATUS_META,
  OUTBOUND_STATUS_META,
  STOCKCOUNT_STATUS_META,
  ADJUSTMENT_STATUS_META,
  type PalletStatus,
  type InboundStatus,
  type OutboundStatus,
  type StocktakeStatus,
  type AdjustmentStatus,
} from "@/lib/status-meta";

export type StatusChipType = "PALLET" | "INBOUND" | "OUTBOUND" | "STOCKCOUNT" | "ADJUSTMENT";

type StatusChipProps = {
  type: StatusChipType;
  value: string;
  className?: string;
  /** Hiển thị icon kèm label */
  withIcon?: boolean;
};

const META_MAP = {
  PALLET: PALLET_STATUS_META,
  INBOUND: INBOUND_STATUS_META,
  OUTBOUND: OUTBOUND_STATUS_META,
  STOCKCOUNT: STOCKCOUNT_STATUS_META,
  ADJUSTMENT: ADJUSTMENT_STATUS_META,
} as const;

export function StatusChip({ type, value, className = "", withIcon }: StatusChipProps) {
  const meta = (META_MAP[type] as Record<string, { label: string; chipBg: string; chipText: string; icon?: string }>)?.[value];

  if (!meta) {
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold bg-surface-low text-on-surface-variant ${className}`}>
        {value}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] md:text-xs font-bold ${meta.chipBg} ${meta.chipText} ${className}`}
    >
      {withIcon && meta.icon && (
        <span className="material-symbols-outlined text-[12px]">{meta.icon}</span>
      )}
      {meta.label}
    </span>
  );
}

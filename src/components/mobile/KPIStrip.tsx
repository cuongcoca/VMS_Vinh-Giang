"use client";

/**
 * Mobile/KPIStrip — Grid hoặc strip cuộn ngang chứa các KPI card nhỏ.
 *
 * Sử dụng:
 *   <KPIStrip cols={4}>
 *     <KPIStrip.Item label="Phiếu chờ" value={3} icon="hourglass_top" color="text-primary" />
 *     <KPIStrip.Item label="Pallet" value={5} icon="inventory_2" color="text-amber-600" />
 *     ...
 *   </KPIStrip>
 */

import React from "react";

type KPIStripProps = {
  /** Số cột grid. Default 2. Cho 4+ → dùng scroll x */
  cols?: 2 | 3 | 4;
  /** Layout: grid (default) hoặc scroll ngang */
  layout?: "grid" | "scroll";
  children: React.ReactNode;
  className?: string;
};

const COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function KPIStrip({ cols = 2, layout = "grid", children, className = "" }: KPIStripProps) {
  if (layout === "scroll") {
    return (
      <div className={`flex gap-3 overflow-x-auto pb-1 -mx-margin-mobile px-margin-mobile ${className}`}>
        {children}
      </div>
    );
  }
  return (
    <div className={`grid ${COLS[cols]} gap-3 ${className}`}>
      {children}
    </div>
  );
}

type KPIItemProps = {
  label: string;
  value: React.ReactNode;
  /** Material symbol name */
  icon?: string;
  /** Tailwind text color, vd "text-primary", "text-amber-600" */
  color?: string;
  /** Sub-text dưới value */
  sub?: string;
};

function KPIItem({ label, value, icon, color = "text-primary", sub }: KPIItemProps) {
  return (
    <div className="bg-white rounded-xl border border-outline-variant shadow-sm p-3 min-w-[140px] flex-shrink-0">
      <div className="flex items-start gap-2">
        {icon && (
          <span className={`material-symbols-outlined text-[18px] ${color} flex-shrink-0`}>{icon}</span>
        )}
        <div className="min-w-0">
          <p className="text-[11px] md:text-xs font-semibold text-on-surface-variant uppercase tracking-wider truncate">
            {label}
          </p>
          <p className={`text-xl font-bold mt-0.5 font-mono leading-tight ${color}`}>{value}</p>
          {sub && <p className="text-[11px] md:text-xs text-on-surface-variant/70 mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

KPIStrip.Item = KPIItem;

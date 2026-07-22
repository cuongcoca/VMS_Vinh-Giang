"use client";

/**
 * Mobile/QuickAction — Card icon + label + link (truy cập nhanh trên dashboard mobile).
 *
 * Sử dụng:
 *   <QuickAction icon="inventory_2" label="Pallet" href="/thukho/pallet" />
 */

import React from "react";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";

type QuickActionProps = {
  /** Material symbol name */
  icon: string;
  label: string;
  href: string;
  /** Sub label */
  sub?: string;
  /** Tailwind background class cho icon container. Default "bg-primary/10 text-primary" */
  iconColor?: string;
  /** Number badge nhỏ ở góc trên phải, vd số task chờ */
  badge?: number;
  className?: string;
};

export function QuickAction({
  icon,
  label,
  href,
  sub,
  iconColor = "bg-primary/10 text-primary",
  badge,
  className = "",
}: QuickActionProps) {
  return (
    <Link
      href={mobileHref(href)}
      className={`industrial-card relative flex flex-col items-center justify-center py-lg gap-sm rounded-xl active:bg-surface-variant/30 hover:border-primary/50 transition-all text-center ${className}`}
    >
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute top-2 right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[11px] md:text-xs font-bold flex items-center justify-center">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconColor}`}>
        <span className="material-symbols-outlined text-[24px]">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-on-surface">{label}</p>
        {sub && <p className="text-[11px] md:text-xs text-on-surface-variant mt-0.5">{sub}</p>}
      </div>
    </Link>
  );
}

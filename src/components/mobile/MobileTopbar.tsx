"use client";

/**
 * Mobile/MobileTopbar — Topbar role-aware cho mobile.
 *
 * Replace topbar custom inline trong các page mobile.
 * Color theo role: thukho=primary, xenang=forklift cam, kiemke=violet.
 *
 * Sử dụng:
 *   <MobileTopbar role="xenang" title="Xe nâng — Việc của tôi" right={<RefreshButton />} />
 */

import React from "react";

export type TopbarRole = "thukho" | "xenang" | "kiemke" | "default";

const ROLE_COLOR: Record<TopbarRole, string> = {
  thukho: "bg-primary",
  xenang: "bg-[var(--color-forklift,#ea580c)]",
  kiemke: "bg-[var(--color-kiemke,#7c3aed)]",
  default: "bg-surface",
};

const ROLE_TEXT: Record<TopbarRole, string> = {
  thukho: "text-white",
  xenang: "text-white",
  kiemke: "text-white",
  default: "text-on-surface",
};

type MobileTopbarProps = {
  role?: TopbarRole;
  title: string;
  subtitle?: string;
  icon?: string;
  /** Slot cho action button bên phải (vd: refresh, scan) */
  right?: React.ReactNode;
  /** Slot back arrow bên trái */
  back?: React.ReactNode;
  className?: string;
};

export function MobileTopbar({
  role = "default",
  title,
  subtitle,
  icon,
  right,
  back,
  className = "",
}: MobileTopbarProps) {
  return (
    <div
      className={`-mx-margin-mobile px-margin-mobile py-3 ${ROLE_COLOR[role]} ${ROLE_TEXT[role]} flex items-center justify-between sticky top-0 z-10 shadow-sm ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {back}
        {icon && <span className="material-symbols-outlined text-[20px] flex-shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h1 className="text-sm font-bold truncate">{title}</h1>
          {subtitle && <p className="text-[11px] md:text-xs opacity-80 truncate">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="flex items-center gap-1 flex-shrink-0">{right}</div>}
    </div>
  );
}

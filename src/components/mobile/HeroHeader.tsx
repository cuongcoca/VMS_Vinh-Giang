"use client";

/**
 * Mobile/HeroHeader — Gradient hero card với title + sub + icon, color theo role.
 *
 * Replace hero card outlier trong adhoc/[id] và các profile/dashboard.
 *
 * Sử dụng:
 *   <HeroHeader role="thukho" title={user.name} subtitle="Thủ kho" />
 */

import React from "react";

export type HeroRole = "thukho" | "xenang" | "kiemke" | "default";

const ROLE_GRADIENT: Record<HeroRole, string> = {
  thukho: "from-primary to-primary-hover",
  xenang: "from-[#ea580c] to-[#f97316]",
  kiemke: "from-[#7c3aed] to-[#a855f7]",
  default: "from-primary to-primary-hover",
};

type HeroHeaderProps = {
  role?: HeroRole;
  title: string;
  subtitle?: string;
  icon?: string;
  right?: React.ReactNode;
  className?: string;
};

export function HeroHeader({
  role = "default",
  title,
  subtitle,
  icon,
  right,
  className = "",
}: HeroHeaderProps) {
  return (
    <div
      className={`bg-gradient-to-br ${ROLE_GRADIENT[role]} text-white rounded-2xl p-lg shadow-lg relative overflow-hidden ${className}`}
    >
      <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{title}</h2>
            {subtitle && <p className="text-xs text-white/80 mt-0.5 truncate">{subtitle}</p>}
          </div>
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </div>
  );
}

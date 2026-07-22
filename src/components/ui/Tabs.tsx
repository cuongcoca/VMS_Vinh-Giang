"use client";

/**
 * UI/Tabs — Replace inline tabs trong các page (inbound/new tabs + pallet detail tabs + ...).
 *
 * Variants:
 *   - pill      : Pill rounded-full (filter tabs)
 *   - underline : Underline border-b (content tabs)
 */

import React from "react";

export type TabItem = {
  key: string;
  label: string;
  /** Material symbol name */
  icon?: string;
  /** Số count hiển thị bên cạnh label */
  count?: number;
};

type TabsProps = {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  variant?: "pill" | "underline";
  className?: string;
};

export function Tabs({ tabs, active, onChange, variant = "pill", className = "" }: TabsProps) {
  if (variant === "underline") {
    return (
      <div className={`flex gap-1 border-b border-outline-variant ${className}`} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => onChange(t.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              active === t.key
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.icon && <span className="material-symbols-outlined text-[16px]">{t.icon}</span>}
            {t.label}
            {typeof t.count === "number" && (
              <span className="text-[10px] opacity-70">({t.count})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Pill variant
  return (
    <div className={`flex gap-2 overflow-x-auto ${className}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            active === t.key
              ? "bg-primary text-white shadow-sm"
              : "bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-low"
          }`}
        >
          {t.icon && <span className="material-symbols-outlined text-[14px]">{t.icon}</span>}
          {t.label}
          {typeof t.count === "number" && (
            <span
              className={`text-[10px] font-bold ${
                active === t.key ? "text-white/80" : "text-on-surface-variant/60"
              }`}
            >
              ({t.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

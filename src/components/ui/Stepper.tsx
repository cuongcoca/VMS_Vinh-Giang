"use client";

/**
 * UI/Stepper — Replace inline stepper trong inbound/page.tsx + import/page.tsx + inbound-adhoc/[id]/page.tsx.
 *
 * Variants:
 *   - linear : Step dạng pill ngang có label (3-5 bước, UC-IN-06 wizard, UC-INTMP-02)
 *   - dots   : Step dạng 8 dot màu (UC-IN-05 stepper 8 trạng thái phiếu nhập)
 */

import React from "react";

export type StepperStep = {
  label: string;
  icon?: string;
  /** Sub-text gắn sau label, vd " (3/5)" */
  sub?: string;
};

type StepperProps = {
  steps: StepperStep[];
  /** Index 1-based: 1 = bước đầu */
  current: number;
  variant?: "linear" | "dots";
  className?: string;
};

export function Stepper({ steps, current, variant = "linear", className = "" }: StepperProps) {
  if (variant === "dots") {
    return (
      <div className={`flex gap-1 ${className}`}>
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors ${
              i < current - 1
                ? "bg-emerald-500"
                : i === current - 1
                  ? (current === steps.length ? "bg-emerald-500" : "bg-amber-500 animate-pulse")
                  : "bg-surface-mid"
            }`}
            aria-current={i === current - 1 ? "step" : undefined}
          />
        ))}
      </div>
    );
  }

  // Linear variant
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`} role="list">
      {steps.map((s, i) => {
        const done = i < current - 1;
        const active = i === current - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 min-w-[20px] ${done ? "bg-primary" : "bg-surface-mid"}`} />
            )}
            <div
              role="listitem"
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : active
                    ? "bg-primary text-white shadow-sm"
                    : "bg-surface-low text-on-surface-variant"
              }`}
            >
              {s.icon && (
                <span className="material-symbols-outlined text-[16px]">
                  {done ? "check_circle" : s.icon}
                </span>
              )}
              <span>
                Bước {i + 1} · {s.label}{s.sub}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

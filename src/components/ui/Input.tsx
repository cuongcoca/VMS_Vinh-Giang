"use client";

/**
 * UI/Input — Input chuẩn của hệ thống.
 *
 * Variants:
 *   - default : bg trắng + border outline-variant (form chính)
 *   - filled  : bg surface-low, KHÔNG border (search/filter)
 *
 * Sizes:
 *   - sm : h-8 (filter / inline)
 *   - md : h-10 (form chuẩn)
 */

import React from "react";

export type InputVariant = "default" | "filled";
export type InputSize = "sm" | "md";

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  variant?: InputVariant;
  size?: InputSize;
  /** Material symbol name, vd "search" */
  iconLeft?: string;
  /** Material symbol name */
  iconRight?: string;
  error?: boolean;
};

const VARIANT_CLASSES: Record<InputVariant, string> = {
  default: "bg-white border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20",
  filled: "bg-surface-low border-0 focus:bg-white focus:ring-2 focus:ring-primary/20",
};

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-10 px-3 text-sm rounded-lg",
};

const ICON_PAD_LEFT: Record<InputSize, string> = { sm: "pl-8", md: "pl-10" };
const ICON_PAD_RIGHT: Record<InputSize, string> = { sm: "pr-8", md: "pr-10" };
const ICON_POS_LEFT: Record<InputSize, string> = { sm: "left-2.5", md: "left-3" };
const ICON_POS_RIGHT: Record<InputSize, string> = { sm: "right-2.5", md: "right-3" };
const ICON_FONT: Record<InputSize, string> = { sm: "text-[14px]", md: "text-[18px]" };

export function Input({
  variant = "default",
  size = "md",
  iconLeft,
  iconRight,
  error,
  className = "",
  ...rest
}: InputProps) {
  const errorClass = error
    ? "border-error focus:border-error focus:ring-error/30"
    : "";
  const inputClass = `w-full ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${iconLeft ? ICON_PAD_LEFT[size] : ""} ${iconRight ? ICON_PAD_RIGHT[size] : ""} ${errorClass} focus:outline-none transition-colors disabled:bg-surface-low disabled:cursor-not-allowed ${className}`;

  if (!iconLeft && !iconRight) {
    return <input {...rest} className={inputClass} />;
  }

  return (
    <div className="relative">
      {iconLeft && (
        <span
          className={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none ${ICON_POS_LEFT[size]} ${ICON_FONT[size]}`}
        >
          {iconLeft}
        </span>
      )}
      <input {...rest} className={inputClass} />
      {iconRight && (
        <span
          className={`material-symbols-outlined absolute top-1/2 -translate-y-1/2 text-on-surface-variant ${ICON_POS_RIGHT[size]} ${ICON_FONT[size]}`}
        >
          {iconRight}
        </span>
      )}
    </div>
  );
}

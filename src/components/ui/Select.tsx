"use client";

/**
 * UI/Select — Native select với style đồng nhất Input.
 */

import React from "react";

export type SelectVariant = "default" | "filled";
export type SelectSize = "sm" | "md";

type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  variant?: SelectVariant;
  size?: SelectSize;
  error?: boolean;
};

const VARIANT_CLASSES: Record<SelectVariant, string> = {
  default: "bg-white border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20",
  filled: "bg-surface-low border-0 focus:bg-white focus:ring-2 focus:ring-primary/20",
};

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "h-8 px-2.5 text-xs rounded-md",
  md: "h-10 px-3 text-sm rounded-lg",
};

export function Select({
  variant = "default",
  size = "md",
  error,
  className = "",
  children,
  ...rest
}: SelectProps) {
  const errorClass = error
    ? "border-error focus:border-error focus:ring-error/30"
    : "";
  return (
    <select
      className={`w-full ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${errorClass} focus:outline-none transition-colors disabled:bg-surface-low disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

"use client";

/**
 * UI/Spinner + PageLoader — Replace 7 size khác nhau của spinner trong codebase.
 * Chỉ 1 implementation duy nhất: Material symbol `progress_activity`.
 */

import React from "react";

export type SpinnerSize = "xs" | "sm" | "md" | "lg";

const SIZE: Record<SpinnerSize, string> = {
  xs: "text-[16px]",
  sm: "text-[20px]",
  md: "text-[24px]",
  lg: "text-[32px]",
};

export function Spinner({
  size = "md",
  className = "",
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <span
      className={`material-symbols-outlined animate-spin text-primary ${SIZE[size]} ${className}`}
      role="status"
      aria-label="Đang tải"
    >
      progress_activity
    </span>
  );
}

export function PageLoader({ message = "Đang tải..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <Spinner size="lg" />
      <span className="text-sm text-on-surface-variant">{message}</span>
    </div>
  );
}

"use client";

/**
 * BackButton — Quay lại trang trước cho desktop / page chính.
 *
 * - Click → router.back() (về trang user vừa rời khỏi)
 * - Fallback: nếu không có history (deep link / mở tab mới) → navigate đến `fallback`
 * - Variant `default` (desktop primary), `subtle` (xám), `link` (text-link)
 *
 * Sử dụng:
 *   <BackButton fallback="/pallets">Quay lại</BackButton>
 *   <BackButton fallback="/inventory" variant="subtle">Quay lại tồn kho</BackButton>
 */

import React from "react";
import { useRouter } from "next/navigation";

type Variant = "default" | "subtle" | "link";

type BackButtonProps = {
  fallback: string;                  // href fallback khi không có history
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  iconSize?: number;                 // px, default 16
};

const VARIANT_CLASS: Record<Variant, string> = {
  default: "text-sm text-primary hover:underline flex items-center gap-1",
  subtle:  "text-sm text-on-surface-variant hover:underline flex items-center gap-1",
  link:    "text-xs text-secondary hover:underline flex items-center gap-1 font-semibold",
};

export function BackButton({
  fallback,
  children,
  variant = "default",
  className = "",
  iconSize = 16,
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <a
      href={fallback}
      onClick={handleClick}
      className={`${VARIANT_CLASS[variant]} cursor-pointer w-fit ${className}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: iconSize }}>arrow_back</span>
      {children}
    </a>
  );
}

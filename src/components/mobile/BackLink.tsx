"use client";

/**
 * Mobile/BackLink — Quay lại trang trước (router.back) với fallback khi không có history.
 *
 * - Mặc định: click → router.back() (quay về trang user vừa rời khỏi)
 * - Fallback: nếu window.history.length <= 1 (mở tab mới, deep link) → navigate đến `href`
 *
 * Sử dụng:
 *   <BackLink href="/thukho/pallet">Danh sách pallet</BackLink>
 */

import React from "react";
import { useRouter } from "next/navigation";
import { mobileHref } from "@/lib/mobile-href";

type BackLinkProps = {
  href: string;        // Fallback khi không có history
  children: React.ReactNode;
  className?: string;
};

export function BackLink({ href, children, className = "" }: BackLinkProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(mobileHref(href));
    }
  };

  return (
    <a
      href={mobileHref(href)}
      onClick={handleClick}
      className={`text-xs text-secondary hover:underline flex items-center gap-1 font-semibold cursor-pointer ${className}`}
    >
      <span className="material-symbols-outlined text-[14px]">arrow_back</span>
      {children}
    </a>
  );
}

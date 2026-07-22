"use client";

/**
 * Mobile/MobileTabbar — Bottom navigation 4-5 tab cho mobile.
 *
 * Sử dụng trong layout mobile:
 *   <MobileTabbar
 *     active="pallet"
 *     items={[
 *       { key: "home", label: "Trang chủ", icon: "home", href: "/thukho" },
 *       { key: "pallet", label: "Pallet", icon: "inventory_2", href: "/thukho/pallet" },
 *       ...
 *     ]}
 *   />
 */

import React from "react";
import Link from "next/link";
import { mobileHref } from "@/lib/mobile-href";

export type TabbarItem = {
  key: string;
  label: string;
  /** Material symbol name */
  icon: string;
  href: string;
  /** Optional badge count */
  badge?: number;
};

type MobileTabbarProps = {
  items: TabbarItem[];
  active: string;
  className?: string;
};

export function MobileTabbar({ items, active, className = "" }: MobileTabbarProps) {
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-outline-variant flex justify-around items-center h-[64px] safe-area-bottom ${className}`}
      role="navigation"
      aria-label="Tabbar"
    >
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <Link
            key={item.key}
            href={mobileHref(item.href)}
            aria-current={isActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors active:bg-surface-low"
          >
            {typeof item.badge === "number" && item.badge > 0 && (
              <span className="absolute top-1 right-1/4 min-w-[16px] h-[16px] px-1 rounded-full bg-error text-white text-[11px] md:text-xs font-bold flex items-center justify-center">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
            <span
              className={`material-symbols-outlined text-[22px] ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`text-[11px] md:text-xs font-semibold ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

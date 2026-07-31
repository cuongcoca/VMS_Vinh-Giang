"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileHref, isMobileActive } from "@/lib/mobile-href";

// Bottom nav dùng chung cho các trang (app) mở TRÊN build mobile (/xenang, /thukho,
// /kiemke) mà KHÔNG nằm trong layout luồng (vd Trung tâm cảnh báo /inventory/alerts).
// Nav item lấy đúng theo build hiện tại — khớp với nav trong từng layout luồng.
type NavItem = { raw: string; icon: string; label: string };
type Flow = { prefix: string; items: NavItem[] };

const FLOWS: Record<string, Flow> = {
  "/xenang": {
    prefix: "/forklift",
    items: [
      { raw: "/forklift", icon: "home", label: "Trang chủ" },
      { raw: "/forklift/pallet", icon: "inventory_2", label: "Pallet" },
      { raw: "/forklift/relocate", icon: "swap_horiz", label: "Luân chuyển" },
      { raw: "/forklift/stage-out", icon: "timer", label: "FEFO" },
      { raw: "/forklift/profile", icon: "person", label: "Tài khoản" },
    ],
  },
  "/thukho": {
    prefix: "/thukho",
    items: [
      { raw: "/thukho", icon: "home", label: "Trang chủ" },
      { raw: "/thukho/inbound", icon: "input", label: "Nhập kho" },
      { raw: "/thukho/pallet", icon: "inventory_2", label: "Pallet" },
      { raw: "/thukho/warehouse", icon: "local_shipping", label: "Kho hàng" },
      { raw: "/thukho/profile", icon: "person", label: "Tài khoản" },
    ],
  },
  "/kiemke": {
    prefix: "/kiemke",
    items: [
      { raw: "/kiemke", icon: "home", label: "Trang chủ" },
      { raw: "/kiemke/tasks", icon: "assignment", label: "Kiểm kê" },
      { raw: "/kiemke/history", icon: "history", label: "Tra cứu" },
      { raw: "/kiemke/scan", icon: "qr_code_scanner", label: "Quét & Đếm" },
      { raw: "/kiemke/profile", icon: "person", label: "Tài khoản" },
    ],
  },
};

export function MobileFlowNav() {
  const pathname = usePathname() || "";
  const bp = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const flow = FLOWS[bp];
  if (!flow) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 w-full flex justify-around items-center px-sm border-t border-outline-variant z-50 bg-surface shadow-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(72px + env(safe-area-inset-bottom))" }}
    >
      {flow.items.map((item) => {
        const isActive = isMobileActive(pathname, item.raw, flow.prefix);
        return (
          <Link
            key={item.raw}
            href={mobileHref(item.raw)}
            aria-label={item.label}
            className={`flex flex-col items-center justify-center px-3 py-3 min-h-[44px] transition-all ${
              isActive ? "text-primary font-bold scale-105" : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

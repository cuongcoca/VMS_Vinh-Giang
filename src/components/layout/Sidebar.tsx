"use client";

/**
 * Sidebar — refactor sau Phase 6: gộp 2 cột (64+224=288px) thành 1 cột 240px.
 *
 * Tính năng:
 *   - Active state rõ ràng (background primary container + indicator bên trái)
 *   - Hover smooth transition
 *   - Sections với label-caps headers
 *   - Logo + app name dynamic từ useSystemConfig
 *   - Footer: user info + warehouse selector + logout
 *   - Scroll container cho nav list (overflow gọn)
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { auth, type AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { useSystemConfig } from "@/lib/use-system-config";
import { ROLE_THEME } from "@/lib/role-theme";
import { useSidebar } from "./sidebar-context";

type NavItem = {
  href: string;
  icon: string;
  label: string;
};

type NavSection = {
  /** undefined = group đầu (không hiện label) */
  label?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/", icon: "dashboard", label: "Tổng quan" },
    ],
  },
  {
    label: "Dữ liệu gốc",
    items: [
      { href: "/master-data", icon: "inventory_2", label: "Danh mục sản phẩm" },
      { href: "/product-groups", icon: "category", label: "Nhóm hàng" },
      { href: "/units", icon: "straighten", label: "Đơn vị tính" },
      { href: "/item-codes", icon: "qr_code_2", label: "Mã hàng" },
      { href: "/locations", icon: "grid_view", label: "Vị trí kho" },
      { href: "/suppliers", icon: "local_shipping", label: "Nhà cung cấp" },
    ],
  },
  {
    label: "Vận hành kho",
    items: [
      { href: "/pallets", icon: "pallet", label: "Pallet" },
      { href: "/forklift", icon: "forklift", label: "Xe nâng" },
    ],
  },
  {
    label: "Nhập kho",
    items: [
      { href: "/inbound", icon: "move_to_inbox", label: "Phiếu nhập" },
      { href: "/inbound/import", icon: "upload_file", label: "Nhập từ Excel" },
      { href: "/inbound-adhoc", icon: "pending_actions", label: "Tồn tạm" },
      { href: "/inbound/temp/inventory", icon: "monitoring", label: "Theo dõi tồn tạm" },
    ],
  },
  {
    label: "Xuất kho",
    items: [
      { href: "/outbound", icon: "output", label: "Xuất kho" },
      { href: "/outbound/report", icon: "bar_chart", label: "Báo cáo xuất" },
      { href: "/movements", icon: "history", label: "Lịch sử luân chuyển" },
    ],
  },
  {
    label: "Tồn kho",
    items: [
      { href: "/inventory", icon: "inventory", label: "Tồn kho" },
      { href: "/inventory/alerts", icon: "warning", label: "Cảnh báo HSD" },
      { href: "/stock-count", icon: "fact_check", label: "Kiểm kê" },
      { href: "/inventory/adjustments", icon: "edit_note", label: "Phiếu điều chỉnh" },
    ],
  },
  {
    label: "Quản trị hệ thống",
    items: [
      { href: "/dashboard", icon: "analytics", label: "Dashboard" },
      { href: "/system/users", icon: "group", label: "Người dùng" },
      { href: "/system/rbac", icon: "admin_panel_settings", label: "Phân quyền" },
      { href: "/system/config", icon: "settings", label: "Cấu hình" },
      { href: "/system/mail", icon: "mail", label: "Cấu hình mail" },
      { href: "/system/audit-log", icon: "history", label: "Nhật ký" },
    ],
  },
];

export const SIDEBAR_WIDTH = 240;

// Cờ: đã qua lần hydrate đầu chưa. Lần render SSR + hydrate đầu phải để user=null
// (khớp HTML server, tránh hydration mismatch); các lần MOUNT sau (điều hướng SPA)
// đọc user ngay từ localStorage → không nháy về mặc định.
let clientReady = false;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  // Đọc user ĐỒNG BỘ khi mount (client-nav đã có localStorage) → không nháy
  // tên/vai/logo về mặc định mỗi lần điều hướng.
  const [user, setUser] = useState<AuthUser | null>(() =>
    clientReady && typeof window !== "undefined" ? auth.getUser() : null
  );
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { config } = useSystemConfig();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const { open, setOpen } = useSidebar(); // drawer mobile (< lg)

  useEffect(() => {
    clientReady = true;
    setUser(auth.getUser());
  }, []);

  const role = user?.role;
  const logoUrl = config.logo_url || `${basePath}/logo.png`;
  const appShort = config.app_short_name || "Vĩnh Giang";
  const appName = config.app_name || "WMS Vĩnh Giang";

  const showLink = (href: string) => {
    if (!role) return false;
    return canAccess(role, href);
  };

  // Mục active = href KHỚP DÀI NHẤT với pathname (trong các mục đang hiển thị).
  // Tránh lỗi "2 menu cùng sáng": route con (vd /inbound/import) trước đây làm cả
  // mục cha (/inbound) lẫn mục con cùng active vì dùng startsWith. Nay chỉ mục khớp
  // dài nhất mới sáng → cha nhường con.
  const matchesPath = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname?.startsWith(href + "/") || false;

  let activeHref = "";
  for (const section of NAV_SECTIONS) {
    for (const it of section.items) {
      if (!showLink(it.href)) continue;
      if (matchesPath(it.href) && it.href.length > activeHref.length) activeHref = it.href;
    }
  }

  const isActive = (href: string) => href === activeHref;

  const handleLogout = () => {
    auth.removeToken();
    router.push("/auth");
  };

  const userInitials = user?.fullName?.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase() || "VG";
  const roleLabel = role ? ROLE_THEME[role]?.label || role : "";

  return (
    <>
    {/* Backdrop — chỉ mobile khi drawer mở; chạm để đóng */}
    {open && (
      <div
        className="fixed inset-0 bg-black/40 z-30 lg:hidden"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
    )}
    <aside
      className={`fixed left-0 top-0 h-screen bg-primary text-white flex flex-col z-40 shadow-xl transition-transform duration-200 lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
      style={{ width: `${SIDEBAR_WIDTH}px` }}
    >
      {/* Header: Logo + Brand — nền trắng, chữ đen */}
      <div className="h-20 flex items-center gap-3 px-4 bg-white border-b border-outline-variant flex-shrink-0">
        <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${appShort} Logo`}
            className="w-12 h-12 object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `${basePath}/logo.png`;
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono font-semibold tracking-wider uppercase text-on-surface-variant leading-tight">
            {appName}
          </p>
          <p className="text-sm font-bold text-on-surface truncate leading-tight">{appShort}</p>
        </div>
        {/* Nút đóng drawer — chỉ mobile */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="lg:hidden w-9 h-9 -mr-1 flex items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-low flex-shrink-0"
          aria-label="Đóng menu"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>
      </div>

      {/* Nav scrollable — giữ vị trí cuộn qua các lần điều hướng (sidebar remount
          nhưng khôi phục scrollTop tức thì → cảm giác liền mạch như mount 1 lần). */}
      <nav
        ref={(el) => {
          if (el && typeof window !== "undefined") {
            const s = sessionStorage.getItem("vg_sidebar_scroll");
            if (s) el.scrollTop = parseInt(s, 10) || 0;
          }
        }}
        onScroll={(e) => {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("vg_sidebar_scroll", String(e.currentTarget.scrollTop));
          }
        }}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2 sidebar-scroll"
      >
        {NAV_SECTIONS.map((section, idx) => {
          const visibleItems = section.items.filter((it) => showLink(it.href));
          if (visibleItems.length === 0) return null;
          return (
            <div key={idx} className={idx > 0 ? "mt-3" : ""}>
              {section.label && (
                <p className="px-4 mb-1 text-[10px] font-mono font-bold uppercase tracking-wider opacity-50">
                  {section.label}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={`relative flex items-center gap-3 px-4 py-2 text-sm font-medium transition-colors ${
                          active
                            ? "bg-white/15 text-white"
                            : "text-white/75 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        {active && (
                          <span className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full" />
                        )}
                        <span className={`material-symbols-outlined text-[20px] flex-shrink-0 ${active ? "opacity-100" : "opacity-80"}`}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Footer: warehouse selector + user */}
      <div className="border-t border-white/10 flex-shrink-0">
        {/* Warehouse selector */}
        <button
          type="button"
          className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-mono font-semibold text-white/80 hover:bg-white/5 transition-colors"
          aria-label="Chọn kho"
        >
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] opacity-70">location_on</span>
            WH-BÌNH_DƯƠNG
          </span>
          <span className="material-symbols-outlined text-[16px] opacity-70">unfold_more</span>
        </button>

        {/* User menu */}
        <div className="relative border-t border-white/10">
          <button
            type="button"
            onClick={() => setShowUserMenu((v) => !v)}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors"
            aria-label="Tài khoản"
            aria-expanded={showUserMenu}
          >
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold truncate">{user?.fullName || "Người dùng"}</p>
              <p className="text-[10px] font-mono uppercase opacity-60 truncate">{roleLabel}</p>
            </div>
            <span className={`material-symbols-outlined text-[18px] opacity-70 transition-transform ${showUserMenu ? "rotate-180" : ""}`}>
              expand_less
            </span>
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-full left-2 right-2 mb-2 bg-white rounded-lg shadow-2xl py-1 text-on-surface animate-slide-up-fade origin-bottom">
              <Link
                href="/system/profile"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-low transition-colors"
                onClick={() => setShowUserMenu(false)}
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
                Tài khoản của tôi
              </Link>
              <Link
                href="/system/change-password"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-low transition-colors"
                onClick={() => setShowUserMenu(false)}
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">lock_reset</span>
                Đổi mật khẩu
              </Link>
              <div className="border-t border-outline-variant my-1" />
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); handleLogout(); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-error-container/50 transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
    </>
  );
}

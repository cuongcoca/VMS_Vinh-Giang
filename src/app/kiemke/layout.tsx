"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth, AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";
import { mobileHref, isMobileActive } from "@/lib/mobile-href";
import { NotificationBell } from "@/components/shared/NotificationBell";

// Giải mã role từ payload JWT (không verify — chỉ để gate giao diện; quyền thật do server
// enforce trên mọi API qua requireAuth). Dùng khi mở lại app mà cache user (localStorage) bị
// mất, để KHÔNG hiện nhầm màn "không có quyền" và không bắt người dùng đăng nhập lại.
function getRoleFromToken(): string | null {
  try {
    const token = auth.getToken();
    if (!token) return null;
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export default function KiemkeLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    if (!auth.isAuthenticated()) { window.location.href = "/wms/auth"; return; }
    let currentUser = auth.getUser();
    if (!currentUser) { const rt = getRoleFromToken(); if (rt) currentUser = { id: "", fullName: "", role: rt as AuthUser["role"] }; }
    // Vai trò mobile KHÁC (thủ kho / xe nâng) mở nhầm /kiemke → chuyển về đúng app của họ.
    const OTHER_MOBILE_HOME: Record<string, string> = { THU_KHO: "/thukho", XE_NANG: "/xenang/forklift" };
    if (currentUser?.role && OTHER_MOBILE_HOME[currentUser.role]) { window.location.href = OTHER_MOBILE_HOME[currentUser.role]; return; }
    setUser(currentUser);
    apiFetch(`${basePath}/api/system/rbac`).then(r => r.json()).then(r => { if (r.success && r.data?.roleRoutes) localStorage.setItem("vinhgiang_wms_role_routes", JSON.stringify(r.data.roleRoutes)); }).catch(console.error)
      .finally(() => { const role = currentUser?.role || getRoleFromToken() || undefined; if (role && !canAccess(role, "/kiemke")) setAccessDenied(true); else setAccessDenied(false); setIsChecking(false); });
  }, [pathname, router, basePath]);

  if (process.env.NEXT_PUBLIC_BASE_PATH === "/wms") return <>{children}</>;
  if (isChecking) return <div className="min-h-screen flex items-center justify-center bg-bg"><div className="text-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div><p className="text-sm text-on-surface-variant font-medium">Đang tải cấu hình kiểm kê...</p></div></div>;
  if (accessDenied || !user) return <div className="max-w-md mx-auto min-h-screen bg-bg shadow-lg flex flex-col items-center justify-center p-6 text-center"><span className="material-symbols-outlined text-[72px] text-rose-500 mb-4">block</span><h2 className="text-xl font-bold text-primary mb-2">Không có quyền truy cập</h2><p className="text-sm text-on-surface-variant mb-6">Tài khoản của bạn không được phân quyền kiểm kê.</p><button onClick={() => { auth.removeToken(); window.location.href = "/wms/auth"; }} className="w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold">Đăng nhập tài khoản khác</button></div>;

  const navItems = [
    { href: mobileHref("/kiemke"), icon: "home", label: "Trang chủ", raw: "/kiemke" },
    { href: mobileHref("/kiemke/tasks"), icon: "assignment", label: "Kiểm kê", raw: "/kiemke/tasks" },
    { href: mobileHref("/kiemke/history"), icon: "history", label: "Tra cứu", raw: "/kiemke/history" },
    { href: mobileHref("/kiemke/scan"), icon: "qr_code_scanner", label: "Quét & Đếm", raw: "/kiemke/scan" },
    { href: mobileHref("/kiemke/profile"), icon: "person", label: "Tài khoản", raw: "/kiemke/profile" },
  ];

  return (
    <div className="min-h-screen bg-surface-variant/20 py-0 sm:py-4">
      <div
        className="w-full max-w-md sm:max-w-none sm:mx-0 mx-auto h-dvh sm:h-auto sm:min-h-screen bg-bg flex flex-col relative overflow-hidden"
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >
        <header
          className="w-full top-0 sticky bg-surface z-40 border-b border-outline-variant flex justify-between items-center px-margin-mobile py-sm shadow-sm"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)", minHeight: "calc(4rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-sm">
            <div className="w-11 h-11 rounded-full bg-primary-container flex items-center justify-center overflow-hidden border border-outline-variant">
              {user?.avatarUrl || user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl || user.avatar_url || ""} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-primary text-xl">fact_check</span>
              )}
            </div>
            <div className="flex flex-col"><span className="text-headline-md-mobile text-primary font-bold leading-tight">{user.fullName}</span><span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase tracking-wider">Kiểm kê · Kho A</span></div>
          </div>
          <div className="flex items-center gap-xs"><NotificationBell /></div>
        </header>
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain w-full">{children}</main>
        <nav
          className="fixed bottom-0 left-0 right-0 w-full flex justify-around items-center px-sm border-t border-outline-variant z-50 bg-surface shadow-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(72px + env(safe-area-inset-bottom))" }}
        >
          {navItems.map(item => { const isActive = isMobileActive(pathname, item.raw, "/kiemke"); return (
            <Link key={item.href} href={item.href} className={`flex flex-col items-center justify-center px-3 py-3 min-h-[44px] transition-all ${isActive ? "text-primary font-bold scale-105" : "text-on-surface-variant/60"}`} aria-label={item.label}>
              <span className="material-symbols-outlined mb-0.5 text-[22px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
              <span className="text-[11px] md:text-xs tracking-tight">{item.label}</span>
            </Link>); })}
        </nav>
      </div>
    </div>
  );
}

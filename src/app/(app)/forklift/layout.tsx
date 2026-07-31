"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { auth, AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";
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

export default function ForkliftLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  useEffect(() => {
    if (!auth.isAuthenticated()) {
      window.location.href = "/wms/auth";
      return;
    }

    // Mở lại app: đôi khi cache user (localStorage) bị mất nhưng token vẫn còn hạn.
    // Khôi phục role từ JWT để không báo nhầm "không có quyền" và khỏi phải đăng nhập lại.
    let currentUser = auth.getUser();
    if (!currentUser) {
      const roleFromToken = getRoleFromToken();
      if (roleFromToken) {
        currentUser = { id: "", fullName: "", role: roleFromToken as AuthUser["role"] };
      }
    }
    // Nếu người dùng thuộc app mobile KHÁC (thủ kho / kiểm kê) → đưa họ về đúng app của họ,
    // thay vì chặn "không có quyền". Xử lý ca mở lại app / shortcut màn hình chính vào nhầm /forklift.
    const roleNow = currentUser?.role;
    const OTHER_MOBILE_HOME: Record<string, string> = {
      THU_KHO: "/thukho",
      KIEM_KE: "/kiemke",
    };
    if (roleNow && OTHER_MOBILE_HOME[roleNow]) {
      window.location.href = OTHER_MOBILE_HOME[roleNow];
      return;
    }

    setUser(currentUser);

    // Sync RBAC rules
    apiFetch(`${basePath}/api/system/rbac`)
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data && res.data.roleRoutes) {
          localStorage.setItem("vinhgiang_wms_role_routes", JSON.stringify(res.data.roleRoutes));
        }
      })
      .catch((err) => console.error("Error syncing RBAC:", err))
      .finally(() => {
        // Chỉ chặn khi xác định CHẮC CHẮN role không được vào /forklift.
        // Nếu chưa xác định được role (mất cache, token lạ) → KHÔNG chặn; server vẫn tự enforce.
        const role = currentUser?.role || getRoleFromToken() || undefined;
        if (role && !canAccess(role, "/forklift")) {
          setAccessDenied(true);
        } else {
          setAccessDenied(false);
        }
        setIsChecking(false);
      });
  }, [pathname, router, basePath]);

  if (process.env.NEXT_PUBLIC_BASE_PATH === "/wms") {
    return <>{children}</>;
  }

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm text-on-surface-variant font-medium">Đang tải cấu hình xe nâng...</p>
        </div>
      </div>
    );
  }

  if (accessDenied || !user) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-bg shadow-lg flex flex-col items-center justify-center p-6 text-center">
        <span className="material-symbols-outlined text-[72px] text-rose-500 mb-4">block</span>
        <h2 className="text-xl font-bold text-primary mb-2">Không có quyền truy cập</h2>
        <p className="text-sm text-on-surface-variant mb-6">
          Tài khoản của bạn không được phân quyền truy cập chức năng xe nâng.
        </p>
        <button
          onClick={() => {
            auth.removeToken();
            window.location.href = "/wms/auth";
          }}
          className="w-full px-5 py-3 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors"
        >
          Đăng nhập tài khoản khác
        </button>
      </div>
    );
  }

  const navItems = [
    { href: "/forklift", icon: "home", label: "Trang chủ" },
    { href: "/forklift/pallet", icon: "inventory_2", label: "Pallet" },
    { href: "/forklift/relocate", icon: "swap_horiz", label: "Luân chuyển" },
    { href: "/forklift/stage-out", icon: "timer", label: "FEFO" },
    { href: "/forklift/profile", icon: "person", label: "Tài khoản" },
  ];

  return (
    <div className="h-dvh bg-surface-variant/20 overflow-hidden">
      {/*
        Chiều cao = đúng 1 màn (h-dvh) ở MỌI kích thước → header cố định trên,
        main cuộn ở giữa, nav cố định dưới. TRƯỚC dùng sm:h-auto sm:min-h-screen
        cho desktop → main không còn bị giới hạn chiều cao nên KHÔNG phải vùng cuộn
        thật, cộng overscroll-contain chặn wheel lan lên trang → lăn chuột không
        cuộn được trên trình duyệt. Nay giữ h-dvh + main là scroller thật → wheel
        và cảm ứng đều cuộn nhất quán.
      */}
      <div
        className="w-full max-w-md sm:max-w-none sm:mx-0 mx-auto h-dvh bg-bg flex flex-col relative overflow-hidden"
        style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
      >

        {/* Top Bar */}
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
                <span className="material-symbols-outlined text-primary text-xl">forklift</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-headline-md-mobile text-primary font-bold leading-tight">
                {user.fullName}
              </span>
              <span className="text-[11px] md:text-xs font-bold text-on-surface-variant/80 uppercase tracking-wider">
                Ca sáng · Kho A
              </span>
            </div>
          </div>
          <div className="flex items-center gap-xs">
            <NotificationBell />
            <Link
              href="/forklift/pallet?scan=true"
              className="w-11 h-11 flex items-center justify-center rounded-lg bg-secondary text-white hover:bg-on-secondary-container active:scale-95 transition-all"
              title="Quét QR nhanh"
              aria-label="Quét QR nhanh"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area — min-h-0 BẮT BUỘC để flex-child tạo vùng cuộn
            thật (1 ngón) thay vì giãn theo nội dung; overscroll-contain chặn
            cuộn lan ra ngoài. */}
        <main className="flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain w-full">
          {children}
        </main>

        {/* Bottom Nav Bar — full width tablet + safe-area iPad Pro */}
        <nav
          className="fixed bottom-0 left-0 right-0 w-full flex justify-around items-center px-sm border-t border-outline-variant z-50 bg-surface shadow-lg"
          style={{ paddingBottom: "env(safe-area-inset-bottom)", height: "calc(72px + env(safe-area-inset-bottom))" }}
        >
          {navItems.map((item) => {
            const isActive =
              item.href === "/forklift"
                ? pathname === "/forklift"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center px-3 py-3 min-h-[44px] transition-all ${
                  isActive
                    ? "text-primary font-bold scale-105"
                    : "text-on-surface-variant/60 hover:text-on-surface-variant"
                }`}
                aria-label={item.label}
              >
                <span
                  className="material-symbols-outlined mb-0.5 text-[22px]"
                  style={{
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-[11px] md:text-xs tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

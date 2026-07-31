"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarContext } from "@/components/layout/sidebar-context";
import { UcHeader } from "@/components/layout/UcHeader";
import { auth, type AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";

/**
 * (app)/layout — KHUNG DESKTOP DÙNG CHUNG (persist).
 *
 * A2 cấu trúc: đây là App Router layout của route-group (app). Sidebar + guard nằm
 * ở ĐÂY nên chỉ MOUNT 1 LẦN; khi điều hướng giữa các trang trong nhóm, chỉ phần
 * {children} đổi — Sidebar KHÔNG remount (không nháy, giữ nguyên vị trí cuộn).
 * Header (UcHeader) vẫn nằm trong từng trang (qua <AppLayout title>) để giữ tiêu đề
 * riêng, remount rẻ.
 *
 * Trang KHÔNG cần khung (in QR *\/qr-print) → render bare.
 */

// Đồng bộ ma trận phân quyền động: chỉ 1 lần/phiên (nền), không chặn render.
let rbacSyncedThisSession = false;

const MOBILE_REDIRECTS: Record<string, string> = {
  XE_NANG: "/xenang/forklift",
  THU_KHO: "/thukho",
  KIEM_KE: "/kiemke",
};

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  // Trong build mobile (nếu route-group vô tình được include) → không dựng khung desktop.
  if (
    process.env.NEXT_PUBLIC_BASE_PATH === "/xenang" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/thukho" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/kiemke"
  ) {
    return <>{children}</>;
  }

  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<AuthUser | null>(() =>
    typeof window !== "undefined" ? auth.getUser() : null
  );
  // Drawer sidebar (chỉ tác dụng < lg). Đóng lại mỗi khi điều hướng.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setUser(auth.getUser());
    setSidebarOpen(false);
  }, [pathname]);

  // Chuyển hướng đăng nhập / vai mobile — chạy sau render, không chặn hiển thị.
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    const u = auth.getUser();
    const target = u ? MOBILE_REDIRECTS[u.role] : undefined;
    if (target) window.location.href = target;
  }, [pathname, router]);

  // Refresh ma trận phân quyền 1 lần/phiên, ở NỀN.
  useEffect(() => {
    if (rbacSyncedThisSession) return;
    rbacSyncedThisSession = true;
    apiFetch("/wms/api/system/rbac")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.data?.roleRoutes) {
          localStorage.setItem(
            "vinhgiang_wms_role_routes",
            JSON.stringify(res.data.roleRoutes)
          );
        }
      })
      .catch(() => {
        /* im lặng — dùng cache/mặc định */
      });
  }, []);

  // Trang in QR (Ctrl+P) — full màn, KHÔNG khung.
  if (pathname?.endsWith("/qr-print")) {
    return <>{children}</>;
  }

  // Vai mobile: không dựng khung desktop trong lúc chờ redirect (tránh nháy).
  if (user && MOBILE_REDIRECTS[user.role]) {
    return <div className="min-h-screen bg-surface-bright" />;
  }

  const denied = !!user && !canAccess(user.role, pathname);

  return (
    <SidebarContext.Provider value={{ open: sidebarOpen, setOpen: setSidebarOpen }}>
    <div className="flex min-h-screen">
      <Sidebar />
      {/* Mobile: content chiếm toàn bộ ngang (ml-0); từ lg mới chừa chỗ sidebar 240px. */}
      <div className="flex-1 w-0 min-w-0 flex flex-col min-h-screen ml-0 lg:ml-60">
        {denied ? (
          <>
            <UcHeader title="KHÔNG CÓ QUYỀN" />
            <main className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <span className="material-symbols-outlined text-[64px] text-rose-300 block mb-4">
                  block
                </span>
                <h2 className="text-xl font-bold text-on-surface mb-2">
                  Không có quyền truy cập
                </h2>
                <p className="text-sm text-on-surface-variant mb-4">
                  Vai trò của bạn không được phép truy cập trang này.
                </p>
                <a
                  href="/wms/dashboard"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                  Về Dashboard
                </a>
              </div>
            </main>
          </>
        ) : (
          children
        )}
      </div>
    </div>
    </SidebarContext.Provider>
  );
}

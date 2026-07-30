"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar, SIDEBAR_WIDTH } from "./Sidebar";
import { UcHeader } from "./UcHeader";
import { auth, type AuthUser } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";

// Đồng bộ ma trận phân quyền động: chỉ 1 lần/phiên (nền), KHÔNG gọi lại mỗi lần
// điều hướng → hết cảnh "trắng màn → spinner → nội dung" ở mỗi cú click.
let rbacSyncedThisSession = false;

// Cờ: đã qua lần hydrate đầu chưa (xem giải thích trong Sidebar). Lần đầu để user=null
// khớp SSR; các lần mount sau (điều hướng SPA) đọc user ngay → không nháy.
let clientReady = false;

const MOBILE_REDIRECTS: Record<string, string> = {
  XE_NANG: "/xenang/forklift",
  THU_KHO: "/thukho",
  KIEM_KE: "/kiemke",
};

export function AppLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  if (
    process.env.NEXT_PUBLIC_BASE_PATH === "/xenang" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/thukho" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/kiemke"
  ) {
    return <>{children}</>;
  }

  const router = useRouter();
  const pathname = usePathname();

  // Đọc user ĐỒNG BỘ ngay khi mount: ở lần điều hướng client (SPA) localStorage đã
  // sẵn có → sidebar/nội dung hiện tức thì với đúng dữ liệu, KHÔNG nháy về mặc định.
  // (Lần tải trang đầu SSR trả null để khớp hydrate, rồi effect cập nhật — 1 lần.)
  const [user, setUser] = useState<AuthUser | null>(() =>
    clientReady && typeof window !== "undefined" ? auth.getUser() : null
  );

  useEffect(() => {
    clientReady = true;
    setUser(auth.getUser());
  }, [pathname]);

  // Chuyển hướng đăng nhập / vai mobile — chạy sau render, KHÔNG chặn hiển thị.
  useEffect(() => {
    if (pathname === "/auth") return;
    if (!auth.isAuthenticated()) {
      router.replace("/auth");
      return;
    }
    const u = auth.getUser();
    const target = u ? MOBILE_REDIRECTS[u.role] : undefined;
    if (target) window.location.href = target;
  }, [pathname, router]);

  // Refresh ma trận phân quyền 1 lần/phiên, ở NỀN (không chặn render).
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
        /* im lặng — dùng cache/mặc định, không phá trải nghiệm */
      });
  }, []);

  if (pathname === "/auth") return <>{children}</>;

  // Vai mobile: không dựng layout desktop trong lúc chờ redirect (tránh nháy).
  if (user && MOBILE_REDIRECTS[user.role]) {
    return <div className="min-h-screen bg-surface-bright" />;
  }

  // Kiểm tra quyền ĐỒNG BỘ (deny-by-default từ cache/mặc định). Ở lần tải đầu
  // user có thể chưa có → coi như chưa xác định, cho hiển thị (effect sẽ cập nhật).
  const denied = !!user && !canAccess(user.role, pathname);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex-1 w-0 flex flex-col min-h-screen min-w-0"
        style={{ marginLeft: `${SIDEBAR_WIDTH}px` }}
      >
        <UcHeader title={denied ? "KHÔNG CÓ QUYỀN" : title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-container pb-8">
          {denied ? (
            <div className="flex-1 flex items-center justify-center py-20">
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
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

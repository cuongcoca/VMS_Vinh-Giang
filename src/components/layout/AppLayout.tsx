"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar, SIDEBAR_WIDTH } from "./Sidebar";
import { UcHeader } from "./UcHeader";
import { auth } from "@/lib/auth";
import { canAccess } from "@/lib/rbac";
import { apiFetch } from "@/lib/api";

export function AppLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  if (process.env.NEXT_PUBLIC_BASE_PATH === "/xenang" || process.env.NEXT_PUBLIC_BASE_PATH === "/thukho" || process.env.NEXT_PUBLIC_BASE_PATH === "/kiemke") {
    return <>{children}</>;
  }

  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    // Không bảo vệ trang /auth
    if (pathname === "/auth") {
      setIsChecking(false);
      return;
    }

    if (!auth.isAuthenticated()) {
      router.replace("/auth");
    } else {
      // === LỚP BẢO VỆ 3: Mobile roles KHÔNG được vào desktop layout ===
      const currentUser = auth.getUser();
      if (currentUser) {
        const MOBILE_REDIRECTS: Record<string, string> = {
          XE_NANG: "/xenang/forklift",
          THU_KHO: "/thukho",
          KIEM_KE: "/kiemke",
        };
        const target = MOBILE_REDIRECTS[currentUser.role];
        if (target) {
          window.location.href = target;
          return; // Dừng — không render desktop layout
        }
      }

      // Đồng bộ ma trận phân quyền từ API
      apiFetch("/wms/api/system/rbac")
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data && res.data.roleRoutes) {
            localStorage.setItem("vinhgiang_wms_role_routes", JSON.stringify(res.data.roleRoutes));
          }
        })
        .catch(err => console.error("Lỗi đồng bộ phân quyền động:", err))
        .finally(() => {
          // Kiểm tra quyền truy cập
          const user = auth.getUser();
          if (user && !canAccess(user.role, pathname)) {
            setAccessDenied(true);
          } else {
            setAccessDenied(false);
          }
          setIsChecking(false);
        });
    }
  }, [pathname, router]);

  if (isChecking) {
    return <div className="min-h-screen flex items-center justify-center bg-surface-bright"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (accessDenied) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <div
          className="flex-1 w-0 flex flex-col min-h-screen"
          style={{ marginLeft: `${SIDEBAR_WIDTH}px` }}
        >
          <UcHeader title="KHÔNG CÓ QUYỀN" />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <span className="material-symbols-outlined text-[64px] text-rose-300 block mb-4">block</span>
              <h2 className="text-xl font-bold text-on-surface mb-2">Không có quyền truy cập</h2>
              <p className="text-sm text-on-surface-variant mb-4">Vai trò của bạn không được phép truy cập trang này.</p>
              <a href="/wms/dashboard" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                Về Dashboard
              </a>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div
        className="flex-1 w-0 flex flex-col min-h-screen min-w-0"
        style={{ marginLeft: `${SIDEBAR_WIDTH}px` }}
      >
        <UcHeader title={title} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-container pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}

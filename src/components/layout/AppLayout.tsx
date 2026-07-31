"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { UcHeader } from "./UcHeader";
import { MobileFlowNav } from "./MobileFlowNav";

// Trên build mobile, các trang luồng đã được layout luồng bọc khung sẵn → nhận diện
// để KHÔNG bọc khung lần 2 (double bottom nav). Chỉ /xenang có trang luồng (/forklift/*)
// dùng AppLayout; /thukho, /kiemke không có trang nào dùng AppLayout.
const IN_FLOW_PREFIX: Record<string, string> = { "/xenang": "/forklift" };

/**
 * AppLayout — nay CHỈ là phần thân của mỗi trang desktop: header (tiêu đề riêng) + main.
 *
 * A2 cấu trúc: Sidebar + guard + khung marginLeft đã chuyển sang layout dùng chung
 * `src/app/(app)/layout.tsx` (mount 1 lần, không remount khi điều hướng). Vì vậy 52 trang
 * vẫn viết `<AppLayout title="...">...</AppLayout>` như cũ nhưng KHÔNG còn dựng lại sidebar.
 *
 * Giữ early-return cho build mobile (nếu component vô tình được import ở đó).
 */
export function AppLayout({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const pathname = usePathname() || "";
  const bp = process.env.NEXT_PUBLIC_BASE_PATH;

  if (bp === "/xenang" || bp === "/thukho" || bp === "/kiemke") {
    // Trang luồng (vd /forklift/*) đã có khung + bottom nav từ layout luồng → render trần.
    const flowPrefix = IN_FLOW_PREFIX[bp];
    if (flowPrefix && pathname.startsWith(flowPrefix)) {
      return <>{children}</>;
    }
    // Trang (app) dùng chung mở trong app mobile (vd Trung tâm cảnh báo) → giữ trong khung:
    // khung 1 màn (cuộn nội bộ) + safe-area + bottom nav của luồng để không "lạc khỏi app".
    return (
      <div className="h-dvh bg-bg flex flex-col overflow-hidden">
        <main
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain w-full"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
        >
          {children}
        </main>
        <MobileFlowNav />
      </div>
    );
  }

  return (
    <>
      <UcHeader title={title} />
      <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-container pb-8">
        {children}
      </main>
    </>
  );
}

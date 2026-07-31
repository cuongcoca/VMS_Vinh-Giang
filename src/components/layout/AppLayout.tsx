"use client";

import React from "react";
import { UcHeader } from "./UcHeader";

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
  if (
    process.env.NEXT_PUBLIC_BASE_PATH === "/xenang" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/thukho" ||
    process.env.NEXT_PUBLIC_BASE_PATH === "/kiemke"
  ) {
    return <>{children}</>;
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

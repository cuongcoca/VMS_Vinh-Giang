"use client";

import React from "react";

export type MobileToastState = { message: string; type: "success" | "error" } | null;

/**
 * MobileToast — toast chuẩn cho giao diện mobile.
 *
 * Sửa lỗi toast `fixed top-4 right-4` rải rác bị tràn mép / đè status bar trên
 * màn nhỏ (FK-06/09/13/39/41...). Toast được căn an toàn theo safe-area, giới
 * hạn bề ngang và cho xuống dòng nội dung dài.
 *
 * Cách dùng: giữ nguyên state `toast` hiện có của trang, thay khối JSX inline
 * bằng `<MobileToast toast={toast} />`.
 */
export function MobileToast({ toast }: { toast: MobileToastState }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-4 right-4 z-[70] mx-auto w-fit max-w-[calc(100%-2rem)] sm:max-w-sm px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 ${
        toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
      }`}
      style={{ top: "calc(env(safe-area-inset-top) + 1rem)" }}
    >
      <span className="material-symbols-outlined text-[18px] shrink-0">
        {toast.type === "success" ? "check_circle" : "error"}
      </span>
      <span className="min-w-0 break-words">{toast.message}</span>
    </div>
  );
}

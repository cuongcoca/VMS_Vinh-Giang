"use client";

/**
 * UI/Toast + useToast — Replace toàn bộ inline toast state local + alert().
 *
 * Wire ToastProvider trong root layout:
 *   <ToastProvider>{children}</ToastProvider>
 *
 * Sử dụng:
 *   const { toast } = useToast();
 *   toast.success("Đã lưu!");
 *   toast.error("Lỗi mạng");
 *   toast.warning("File quá lớn", { duration: 5000 });
 *   toast.info("Đang tải...");
 */

import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
};

const VARIANT_META: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: "bg-emerald-600", icon: "check_circle" },
  error: { bg: "bg-error", icon: "error" },
  warning: { bg: "bg-amber-500", icon: "warning" },
  info: { bg: "bg-secondary", icon: "info" },
};

type ToastApi = {
  success: (msg: string, opts?: { duration?: number }) => void;
  error: (msg: string, opts?: { duration?: number }) => void;
  warning: (msg: string, opts?: { duration?: number }) => void;
  info: (msg: string, opts?: { duration?: number }) => void;
};

const ToastContext = createContext<{ toast: ToastApi } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback(
    (variant: ToastVariant, message: string, duration = 3500) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { id, variant, message, duration }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const toast: ToastApi = {
    success: (msg, opts) => push("success", msg, opts?.duration),
    error: (msg, opts) => push("error", msg, opts?.duration),
    warning: (msg, opts) => push("warning", msg, opts?.duration),
    info: (msg, opts) => push("info", msg, opts?.duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Stack ở góc phải trên */}
      <div
        className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]"
        aria-live="polite"
        aria-atomic="false"
      >
        {items.map((t) => {
          const meta = VARIANT_META[t.variant];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 text-white animate-slide-in-right ${meta.bg}`}
              role="alert"
            >
              <span className="material-symbols-outlined text-[18px] flex-shrink-0">
                {meta.icon}
              </span>
              <span className="flex-1">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

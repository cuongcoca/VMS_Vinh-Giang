"use client";

/**
 * UI/ConfirmDialog + useConfirm — Replace toàn bộ `window.confirm()` browser-native.
 *
 * Wire ConfirmProvider trong root layout:
 *   <ConfirmProvider>
 *     <ToastProvider>{children}</ToastProvider>
 *   </ConfirmProvider>
 *
 * Sử dụng (Promise-based):
 *   const { confirm } = useConfirm();
 *   const ok = await confirm({
 *     title: "Xóa pallet?",
 *     description: "PL260525.006 sẽ bị xóa vĩnh viễn.",
 *     confirmText: "Xóa",
 *     variant: "danger",
 *   });
 *   if (ok) doDelete();
 */

import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export type ConfirmVariant = "default" | "danger";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
};

type ConfirmContextValue = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );

  const handle = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <Modal open={true} onClose={() => handle(false)} size="sm">
          <Modal.Body>
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  state.opts.variant === "danger"
                    ? "bg-error/10 text-error"
                    : "bg-warning/10 text-warning"
                }`}
              >
                <span className="material-symbols-outlined">
                  {state.opts.variant === "danger" ? "warning" : "help"}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-on-surface">{state.opts.title}</h3>
                {state.opts.description && (
                  <p className="text-sm text-on-surface-variant mt-1">{state.opts.description}</p>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => handle(false)}>
              {state.opts.cancelText || "Hủy"}
            </Button>
            <Button
              variant={state.opts.variant === "danger" ? "danger" : "primary"}
              onClick={() => handle(true)}
            >
              {state.opts.confirmText || "Xác nhận"}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

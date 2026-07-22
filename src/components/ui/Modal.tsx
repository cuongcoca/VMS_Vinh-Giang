"use client";

/**
 * UI/Modal — Modal chuẩn với:
 *   - Portal vào document.body (tránh z-index issue)
 *   - Focus trap (Tab/Shift+Tab loop trong modal)
 *   - ESC để đóng (configurable)
 *   - Click backdrop để đóng (configurable)
 *   - Lock body scroll
 *   - 4 size cố định: sm/md/lg/xl
 *   - Return focus về element trigger khi đóng
 *   - aria-modal + role="dialog"
 *
 * Sử dụng compound:
 *   <Modal open={open} onClose={close} size="md">
 *     <Modal.Header onClose={close}>Tiêu đề</Modal.Header>
 *     <Modal.Body>Nội dung</Modal.Body>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={close}>Hủy</Button>
 *       <Button variant="primary" onClick={submit}>Lưu</Button>
 *     </Modal.Footer>
 *   </Modal>
 */

import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
  /** aria-labelledby reference id để screen reader đọc title */
  ariaLabelledBy?: string;
};

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "w-[420px] max-w-[90vw]",
  md: "w-[560px] max-w-[90vw]",
  lg: "w-[680px] max-w-[95vw]",
  xl: "w-[800px] max-w-[95vw]",
};

export function Modal({
  open,
  onClose,
  size = "md",
  closeOnBackdrop = true,
  closeOnEsc = true,
  ariaLabelledBy,
  children,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Lock body scroll + focus management
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      // Focus first focusable inside modal sau khi render
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
        );
        firstFocusable?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      previousFocus.current?.focus?.();
      previousFocus.current = null;
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // ESC handler
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  // Focus trap (Tab/Shift+Tab loop)
  useEffect(() => {
    if (!open) return;
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={modalRef}
        className={`relative bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in flex flex-col ${SIZE_CLASSES[size]}`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

type ModalSectionProps = {
  children: React.ReactNode;
  className?: string;
};

type ModalHeaderProps = ModalSectionProps & {
  onClose?: () => void;
};

function ModalHeader({ children, onClose, className = "" }: ModalHeaderProps) {
  return (
    <div className={`sticky top-0 bg-white border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10 ${className}`}>
      <h2 className="text-base font-semibold text-on-surface">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1 hover:bg-surface-low rounded-lg transition-colors"
          aria-label="Đóng"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      )}
    </div>
  );
}

function ModalBody({ children, className = "" }: ModalSectionProps) {
  return <div className={`px-6 py-5 flex-1 ${className}`}>{children}</div>;
}

function ModalFooter({ children, className = "" }: ModalSectionProps) {
  return (
    <div className={`sticky bottom-0 bg-white border-t border-outline-variant px-6 py-4 flex justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
}

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

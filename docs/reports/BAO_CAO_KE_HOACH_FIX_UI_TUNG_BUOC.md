# 🛠️ KẾ HOẠCH FIX UI/UX TỪNG BƯỚC — WMS Vĩnh Giang

> **Ngày lập:** 2026-05-25
> **Phạm vi:** Fix toàn bộ 197 lỗi UI/UX (desktop + mobile) đã liệt kê trong 3 báo cáo audit
> **Nguồn:**
> - [BAO_CAO_LOI_UI_GIAO_DIEN.md](BAO_CAO_LOI_UI_GIAO_DIEN.md) — executive
> - [BAO_CAO_LOI_UI_DESKTOP.md](BAO_CAO_LOI_UI_DESKTOP.md) — 150 lỗi desktop
> - [BAO_CAO_LOI_UI_MOBILE.md](BAO_CAO_LOI_UI_MOBILE.md) — 47 lỗi mobile
>
> **Total effort:** **15-17 ngày người** chia 7 phase. Có thể split team frontend + designer làm song song để rút ngắn còn 8-10 ngày calendar.

---

## 📋 MỤC LỤC

- [Tổng quan 7 phase](#tổng-quan)
- [Phase 0 — Pre-requisite](#phase-0)
- [Phase 1 — Foundation Components (10 component, 2 ngày)](#phase-1)
- [Phase 2 — Token & Utility cleanup (1 ngày)](#phase-2)
- [Phase 3 — Critical fixes (2 ngày)](#phase-3)
- [Phase 4 — Sweep refactor Desktop (6 ngày)](#phase-4)
- [Phase 5 — Sweep refactor Mobile (3 ngày)](#phase-5)
- [Phase 6 — Polish + ESLint guardrails (1.5 ngày)](#phase-6)
- [Phase 7 — QA visual regression (1.5 ngày)](#phase-7)
- [Phụ lục](#phụ-lục)

---

<a id="tổng-quan"></a>

## 📊 TỔNG QUAN 7 PHASE

| Phase | Mục tiêu | Effort | Dependency | Output |
|---|---|---|---|---|
| **0** | Pre-requisite setup | 0.5 ngày | — | Branch + ENV ready |
| **1** | Build 10 component nền tảng | **2 ngày** | Phase 0 | Button, Input, Modal, Toast, ConfirmDialog, Spinner, EmptyState, ErrorState, Pagination, Stepper, Tabs, FormField |
| **2** | Token + animation + status-meta + role-theme | **1 ngày** | Phase 1 | globals.css đủ token, lib/status-meta.ts, lib/role-theme.ts |
| **3** | Fix 6 critical bug | **2 ngày** | Phase 1+2 | Bỏ DOUBLE HEADER, NESTED LAYOUT, hardcoded `/wms/api/`, gradient lạc, broken token |
| **4** | Refactor 50+ page desktop theo module | **6 ngày** | Phase 1+2 | Tất cả desktop pages dùng component nền tảng |
| **5** | Refactor 30+ page mobile theo role | **3 ngày** | Phase 1+2 | Tất cả mobile pages dùng MobileTopbar/StatusChip/EmptyState |
| **6** | ESLint custom rule + polish a11y | **1.5 ngày** | Phase 4+5 | Cấm `text-slate-*`, HEX, emoji decorative, alert/confirm |
| **7** | QA visual regression | **1.5 ngày** | Phase 6 | Screenshot before/after, sign-off |
| **TỔNG** | — | **17 ngày** | — | App "trông như production" |

---

<a id="phase-0"></a>

## 🚀 PHASE 0 — PRE-REQUISITE (0.5 ngày)

### Bước 0.1: Setup branch + protection

```bash
cd D:/wms-vinhgiang_repo
git checkout -b feat/ui-overhaul
git push -u origin feat/ui-overhaul
```

- Tạo PR draft `feat/ui-overhaul` ngay từ đầu để review từng commit
- Tag Tech Lead + Designer trong PR

### Bước 0.2: Cài design tools (optional)

```bash
# Để compare visual trước/sau bằng Playwright snapshot
npm install --save-dev @playwright/test pixelmatch
```

### Bước 0.3: Backup VPS state

```bash
node vps-deploy.js exec "cd /var/www/wms-vinhgiang && tar -czf /tmp/wms-backup-$(date +%Y%m%d).tar.gz src/"
```

### Bước 0.4: Đọc hiểu design tokens hiện có

Đọc `src/app/globals.css` lines 1-62 — đây là source of truth cho tất cả màu/spacing. **TUYỆT ĐỐI** không thêm token mới khi chưa thảo luận.

### Acceptance Phase 0
- [ ] Branch `feat/ui-overhaul` đã push
- [ ] PR draft đã tạo
- [ ] VPS backup ổn
- [ ] Team đồng ý plan này

---

<a id="phase-1"></a>

## 🧱 PHASE 1 — FOUNDATION COMPONENTS (2 ngày)

> **Quy tắc bất di bất dịch:** Mọi component trong phase này ĐỀU phải có TypeScript types + JSDoc + 0 dependencies bên ngoài (chỉ React + lib có sẵn). KHÔNG cài thư viện UI mới (Radix/Headless UI/Mantine) — design hệ thống đã tự đủ.

### 📁 Cấu trúc file mới (sau Phase 1)

```
src/components/ui/
├── Button.tsx              ⭐ NEW
├── Input.tsx               ⭐ NEW
├── Textarea.tsx            ⭐ NEW
├── Select.tsx              ⭐ NEW
├── FormField.tsx           ⭐ NEW
├── Modal.tsx               ⭐ NEW (portal + focus trap + ESC)
├── ConfirmDialog.tsx       ⭐ NEW (+ useConfirm hook)
├── Toast.tsx               ⭐ NEW (+ ToastProvider + useToast hook)
├── Spinner.tsx             ⭐ NEW (+ PageLoader)
├── EmptyState.tsx          ⭐ NEW
├── ErrorState.tsx          ⭐ NEW (+ retry button)
├── Pagination.tsx          ⭐ NEW
├── Stepper.tsx             ⭐ NEW
├── Tabs.tsx                ⭐ NEW
├── Card.tsx                ✓ ĐÃ CÓ — giữ nguyên
├── Badge.tsx               ✓ ĐÃ CÓ — mở rộng variant
└── index.ts                ⭐ NEW — barrel export

src/components/mobile/
├── MobileTopbar.tsx        ⭐ NEW (role-aware color)
├── MobileTabbar.tsx        ⭐ NEW (bottom nav 5 tab)
├── BackLink.tsx            ⭐ NEW (style A unified)
├── StatusChip.tsx          ⭐ NEW (map color theo enum)
├── HeroHeader.tsx          ⭐ NEW (gradient hero role-aware)
├── KPIStrip.tsx            ⭐ NEW (2/3/4 col)
├── QuickAction.tsx         ⭐ NEW (card icon + label + link)
└── index.ts                ⭐ NEW
```

---

### Bước 1.1 — `<Button>` (4 giờ)

**File:** `src/components/ui/Button.tsx` ⭐ NEW

**API:**
```typescript
type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline-primary" | "outline-danger";
  size?: "sm" | "md" | "lg";
  icon?: string;           // material-symbol name (e.g. "add", "save")
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;       // ESCAPE HATCH — dùng hạn chế
};
```

**Skeleton code:**
```tsx
"use client";
import React from "react";

const VARIANT_CLASSES = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-container shadow-sm",
  secondary: "bg-secondary text-white hover:bg-on-secondary-container active:bg-primary",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-low active:bg-surface-mid",
  danger: "bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-sm",
  "outline-primary": "bg-white border border-primary text-primary hover:bg-primary/5",
  "outline-danger": "bg-white border border-error text-error hover:bg-error-container",
};

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2 rounded-lg",
};

const ICON_SIZE = { sm: "16px", md: "18px", lg: "20px" };

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading,
  fullWidth,
  disabled,
  type = "button",
  onClick,
  children,
  className = "",
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/30 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: ICON_SIZE[size] }}>
          progress_activity
        </span>
      ) : icon && iconPosition === "left" ? (
        <span className="material-symbols-outlined" style={{ fontSize: ICON_SIZE[size] }}>{icon}</span>
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" && (
        <span className="material-symbols-outlined" style={{ fontSize: ICON_SIZE[size] }}>{icon}</span>
      )}
    </button>
  );
}
```

**Acceptance:**
- [ ] 6 variant render đúng màu
- [ ] 3 size cố định (h-8/10/12)
- [ ] `loading=true` → icon đổi sang `progress_activity` spin, disabled
- [ ] Icon size match button size (16/18/20px)
- [ ] Focus visible ring
- [ ] TypeScript type pass
- [ ] Hover/active state có transition

---

### Bước 1.2 — `<Input>`, `<Textarea>`, `<Select>`, `<FormField>` (3 giờ)

**Files:** `src/components/ui/Input.tsx`, `Textarea.tsx`, `Select.tsx`, `FormField.tsx`

**API Input:**
```typescript
type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "filled";
  size?: "sm" | "md";
  iconLeft?: string;
  iconRight?: string;
  error?: boolean;
};
```

**Skeleton Input:**
```tsx
"use client";
import React from "react";

const VARIANT_CLASSES = {
  default: "bg-white border border-outline-variant focus:border-primary",
  filled: "bg-surface-low border-0 focus:bg-white focus:ring-2 focus:ring-primary/20",
};

const SIZE_CLASSES = {
  sm: "h-8 px-3 text-xs rounded-md",
  md: "h-10 px-3 text-sm rounded-lg",
};

export function Input({
  variant = "default",
  size = "md",
  iconLeft,
  iconRight,
  error,
  className = "",
  ...rest
}: InputProps) {
  const baseInput = `w-full ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} focus:outline-none focus:ring-2 ${error ? "border-error focus:ring-error/30" : "focus:ring-primary/20"} transition-colors disabled:bg-surface-low disabled:cursor-not-allowed ${iconLeft ? "pl-10" : ""} ${iconRight ? "pr-10" : ""} ${className}`;

  if (!iconLeft && !iconRight) return <input {...rest} className={baseInput} />;

  return (
    <div className="relative">
      {iconLeft && <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px] pointer-events-none">{iconLeft}</span>}
      <input {...rest} className={baseInput} />
      {iconRight && <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">{iconRight}</span>}
    </div>
  );
}
```

**FormField wrapper:**
```tsx
type FormFieldProps = {
  label?: string;
  required?: boolean;
  helper?: string;
  error?: string;
  children: React.ReactNode;
};

export function FormField({ label, required, helper, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="label-caps text-on-surface-variant">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <span className="text-xs text-error mt-0.5">⚠ {error}</span>}
      {!error && helper && <span className="text-xs text-on-surface-variant/70">{helper}</span>}
    </div>
  );
}
```

**Acceptance:**
- [ ] Input 2 variant, 2 size
- [ ] Select dùng `<select>` native style giống Input
- [ ] Textarea dùng `min-h` thay vì height
- [ ] FormField label dùng `label-caps` utility (đã có sẵn)
- [ ] Error state có border đỏ + message dưới
- [ ] Disabled state có background mờ

---

### Bước 1.3 — `<Modal>` với Portal + Focus Trap + ESC (3 giờ)

**File:** `src/components/ui/Modal.tsx` ⭐ NEW

**API:**
```typescript
type ModalProps = {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";  // 420 / 560 / 680 / 800
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  children: React.ReactNode;
};

// Compound API:
<Modal open={open} onClose={close} size="md">
  <Modal.Header>Title</Modal.Header>
  <Modal.Body>Content</Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={close}>Hủy</Button>
    <Button variant="primary" onClick={submit}>Lưu</Button>
  </Modal.Footer>
</Modal>
```

**Skeleton:**
```tsx
"use client";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const SIZE_CLASSES = {
  sm: "w-[420px] max-w-[90vw]",
  md: "w-[560px] max-w-[90vw]",
  lg: "w-[680px] max-w-[95vw]",
  xl: "w-[800px] max-w-[95vw]",
};

export function Modal({ open, onClose, size = "md", closeOnBackdrop = true, closeOnEsc = true, children }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      // Focus first focusable inside modal
      setTimeout(() => {
        const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
        );
        firstFocusable?.focus();
      }, 50);
    } else {
      document.body.style.overflow = "";
      previousFocus.current?.focus?.();
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC handler
  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, closeOnEsc, onClose]);

  // Focus trap
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
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [open]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeOnBackdrop ? onClose : undefined} />
      <div ref={modalRef} className={`relative bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in ${SIZE_CLASSES[size]}`}>
        {children}
      </div>
    </div>,
    document.body
  );
}

Modal.Header = function ModalHeader({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="sticky top-0 bg-white border-b border-outline-variant px-6 py-4 flex items-center justify-between z-10">
      <h2 className="headline-md text-primary">{children}</h2>
      {onClose && (
        <button onClick={onClose} className="p-1 hover:bg-surface-low rounded-lg" aria-label="Đóng">
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
    </div>
  );
};

Modal.Body = function ModalBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 bg-white border-t border-outline-variant px-6 py-4 flex justify-end gap-3">{children}</div>;
};
```

**Acceptance:**
- [ ] Portal vào `document.body`
- [ ] ESC đóng modal
- [ ] Click backdrop đóng (configurable)
- [ ] Body scroll locked khi mở
- [ ] Focus trap: Tab/Shift+Tab loop trong modal
- [ ] First focusable auto focus
- [ ] Return focus về element trigger khi đóng
- [ ] Animation fade-in + scale-in mượt
- [ ] aria-modal="true", role="dialog"
- [ ] 4 size cố định

---

### Bước 1.4 — `<Toast>` + `<ToastProvider>` + `useToast` (2 giờ)

**File:** `src/components/ui/Toast.tsx` ⭐ NEW

**API:**
```typescript
// Wrap app in src/app/layout.tsx
<ToastProvider>
  {children}
</ToastProvider>

// Sử dụng trong component:
const { toast } = useToast();
toast.success("Đã lưu!");
toast.error("Lỗi mạng");
toast.warning("File quá lớn", { duration: 5000 });
toast.info("Đang tải...");
```

**Skeleton:**
```tsx
"use client";
import React, { createContext, useContext, useState, useCallback } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";
type ToastItem = { id: string; variant: ToastVariant; message: string; duration?: number };

const VARIANT_META = {
  success: { bg: "bg-emerald-600", icon: "check_circle" },
  error: { bg: "bg-rose-600", icon: "error" },
  warning: { bg: "bg-amber-500", icon: "warning" },
  info: { bg: "bg-secondary", icon: "info" },
};

const ToastContext = createContext<{
  toast: {
    success: (msg: string, opts?: { duration?: number }) => void;
    error: (msg: string, opts?: { duration?: number }) => void;
    warning: (msg: string, opts?: { duration?: number }) => void;
    info: (msg: string, opts?: { duration?: number }) => void;
  };
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((variant: ToastVariant, message: string, duration = 3500) => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, variant, message, duration }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const toast = {
    success: (msg: string, opts?: { duration?: number }) => push("success", msg, opts?.duration),
    error: (msg: string, opts?: { duration?: number }) => push("error", msg, opts?.duration),
    warning: (msg: string, opts?: { duration?: number }) => push("warning", msg, opts?.duration),
    info: (msg: string, opts?: { duration?: number }) => push("info", msg, opts?.duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast stack */}
      <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => {
          const meta = VARIANT_META[t.variant];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto px-5 py-3 rounded-xl shadow-lg text-sm font-semibold flex items-center gap-2 text-white ${meta.bg} animate-slide-in-right`}
              role="alert"
            >
              <span className="material-symbols-outlined text-[18px]">{meta.icon}</span>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}
```

**Wire vào layout:**
```tsx
// src/app/layout.tsx
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({ children }) {
  return (
    <html lang="vi" className={...}>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
```

**Acceptance:**
- [ ] 4 variant với màu + icon đúng
- [ ] Auto dismiss sau 3.5s (configurable)
- [ ] Stack nhiều toast khi cần
- [ ] Animation slide-in-right
- [ ] Pointer-events-none cho container, auto cho item
- [ ] role="alert" cho screen reader

---

### Bước 1.5 — `<ConfirmDialog>` + `useConfirm` (1.5 giờ)

**File:** `src/components/ui/ConfirmDialog.tsx` ⭐ NEW

**API:**
```typescript
// Wrap app trong src/app/layout.tsx
<ConfirmProvider>
  <ToastProvider>{children}</ToastProvider>
</ConfirmProvider>

// Sử dụng:
const { confirm } = useConfirm();
const ok = await confirm({
  title: "Xóa pallet?",
  description: "PL260525.006 sẽ bị xóa vĩnh viễn.",
  confirmText: "Xóa",
  cancelText: "Hủy",
  variant: "danger",
});
if (ok) { /* proceed */ }
```

**Skeleton:**
```tsx
"use client";
import React, { createContext, useContext, useState, useCallback } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "danger";
};

const ConfirmContext = createContext<{ confirm: (opts: ConfirmOptions) => Promise<boolean> } | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) =>
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
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                state.opts.variant === "danger" ? "bg-error/10 text-error" : "bg-warning/10 text-warning"
              }`}>
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

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be inside <ConfirmProvider>");
  return ctx;
}
```

**Acceptance:**
- [ ] Promise-based API (await)
- [ ] 2 variant: default / danger (đỏ)
- [ ] ESC = cancel
- [ ] Click backdrop = cancel
- [ ] Dùng `<Modal>` + `<Button>` đã build → đồng bộ style

---

### Bước 1.6 — `<Spinner>` + `<PageLoader>` (30 phút)

**File:** `src/components/ui/Spinner.tsx`

```tsx
import React from "react";

type SpinnerProps = { size?: "xs" | "sm" | "md" | "lg"; className?: string };

const SIZE = { xs: "text-[16px]", sm: "text-[20px]", md: "text-[24px]", lg: "text-[32px]" };

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <span className={`material-symbols-outlined animate-spin text-primary ${SIZE[size]} ${className}`}>
      progress_activity
    </span>
  );
}

export function PageLoader({ message = "Đang tải..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-2">
      <Spinner size="lg" />
      <span className="text-sm text-on-surface-variant">{message}</span>
    </div>
  );
}
```

**Acceptance:**
- [ ] Chỉ 1 implementation duy nhất (Material `progress_activity`)
- [ ] 4 size cố định
- [ ] PageLoader có message customizable

---

### Bước 1.7 — `<EmptyState>` + `<ErrorState>` (1 giờ)

**File:** `src/components/ui/EmptyState.tsx`

```tsx
import React from "react";

type EmptyStateProps = {
  icon?: string;       // material symbol, default "inbox"
  title: string;
  description?: string;
  action?: React.ReactNode;  // thường là <Button>
};

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30 mb-2">{icon}</span>
      <h3 className="text-sm font-semibold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-xs text-on-surface-variant max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
```

**`<ErrorState>`:**
```tsx
type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message = "Đã có lỗi xảy ra", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="material-symbols-outlined text-[48px] text-error/40 mb-2">error</span>
      <h3 className="text-sm font-semibold text-error mb-1">{message}</h3>
      {onRetry && (
        <Button variant="ghost" size="sm" icon="refresh" onClick={onRetry} className="mt-3">
          Thử lại
        </Button>
      )}
    </div>
  );
}
```

---

### Bước 1.8 — `<Pagination>` (1 giờ)

**File:** `src/components/ui/Pagination.tsx`

```tsx
type PaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = computePageRange(page, totalPages); // [1, 2, "...", 5, 6, 7, "...", 20]

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30"
        aria-label="Trang đầu"
      >
        <span className="material-symbols-outlined text-[18px]">first_page</span>
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30"
        aria-label="Trang trước"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_left</span>
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={i} className="px-2 text-on-surface-variant">…</span>
        ) : (
          <button
            key={i}
            onClick={() => onPageChange(p as number)}
            className={`min-w-[32px] h-8 rounded text-sm font-medium ${
              p === page ? "bg-primary text-white" : "hover:bg-surface-low"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30"
        aria-label="Trang sau"
      >
        <span className="material-symbols-outlined text-[18px]">chevron_right</span>
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="p-1.5 rounded hover:bg-surface-low disabled:opacity-30"
        aria-label="Trang cuối"
      >
        <span className="material-symbols-outlined text-[18px]">last_page</span>
      </button>
    </div>
  );
}

function computePageRange(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}
```

---

### Bước 1.9 — `<Stepper>` (1 giờ)

**File:** `src/components/ui/Stepper.tsx`

```tsx
type Step = { label: string; icon?: string; sub?: string };

export function Stepper({
  steps,
  current,
  variant = "linear",
}: {
  steps: Step[];
  current: number;
  variant?: "linear" | "dots";
}) {
  // Dùng cho UC-IN-05 stepper 8 dot và UC-IN-06 wizard 3 bước

  if (variant === "dots") {
    return (
      <div className="flex gap-1">
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 w-3 rounded-full ${
              i < current - 1 ? "bg-emerald-500" :
              i === current - 1 ? "bg-amber-500 animate-pulse" :
              "bg-surface-mid"
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {steps.map((s, i) => {
        const done = i < current - 1;
        const active = i === current - 1;
        return (
          <React.Fragment key={i}>
            {i > 0 && (
              <div className={`flex-1 h-0.5 min-w-[20px] ${done ? "bg-primary" : "bg-surface-mid"}`} />
            )}
            <div
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold ${
                done ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                active ? "bg-primary text-white shadow-sm" :
                "bg-surface-low text-on-surface-variant"
              }`}
            >
              {s.icon && (
                <span className="material-symbols-outlined text-[16px]">
                  {done ? "check_circle" : s.icon}
                </span>
              )}
              Bước {i + 1} · {s.label}{s.sub}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

**Replace ở 4 page:** `inbound/page.tsx` (UC-IN-05), `inbound/import/page.tsx` (UC-IN-06 wizard), `inbound-adhoc/[id]/page.tsx` (UC-INTMP-02), `auth/forgot-password/page.tsx`.

---

### Bước 1.10 — `<Tabs>` (1 giờ)

**File:** `src/components/ui/Tabs.tsx`

```tsx
type TabItem = { key: string; label: string; icon?: string; count?: number };

type TabsProps = {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
  variant?: "pill" | "underline";
};

export function Tabs({ tabs, active, onChange, variant = "pill" }: TabsProps) {
  if (variant === "underline") {
    return (
      <div className="flex gap-1 border-b border-outline-variant">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              active === t.key
                ? "border-primary text-primary"
                : "border-transparent text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.icon && <span className="material-symbols-outlined text-[16px] mr-1">{t.icon}</span>}
            {t.label}
            {typeof t.count === "number" && (
              <span className="ml-1 text-[10px] opacity-70">({t.count})</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Pill variant
  return (
    <div className="flex gap-2 overflow-x-auto custom-scroll-hide">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            active === t.key
              ? "bg-primary text-white shadow-sm"
              : "bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-low"
          }`}
        >
          {t.icon && <span className="material-symbols-outlined text-[14px]">{t.icon}</span>}
          {t.label}
          {typeof t.count === "number" && (
            <span className={`text-[10px] font-bold ${active === t.key ? "text-white/80" : "text-on-surface-variant/60"}`}>
              ({t.count})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

---

### Bước 1.11 — Mobile components (3 giờ)

**Files:** `src/components/mobile/MobileTopbar.tsx`, `MobileTabbar.tsx`, `BackLink.tsx`, `StatusChip.tsx`, `HeroHeader.tsx`, `KPIStrip.tsx`, `QuickAction.tsx`

**StatusChip ưu tiên cao nhất** (đang có 8 biến thể):

```tsx
type StatusType = "PALLET" | "INBOUND" | "STOCKCOUNT" | "MOVEMENT" | "OUTBOUND";
type StatusValue = string;  // COUNTING, CONFIRMED, IN_STORAGE, IN_STAGING, etc.

const STATUS_META: Record<StatusType, Record<StatusValue, { label: string; chipBg: string; chipText: string }>> = {
  PALLET: {
    EMPTY: { label: "Trống", chipBg: "bg-surface-low", chipText: "text-on-surface-variant" },
    COUNTING: { label: "Đang đếm", chipBg: "bg-amber-100", chipText: "text-amber-700" },
    CONFIRMED: { label: "Chờ xếp", chipBg: "bg-blue-100", chipText: "text-blue-700" },
    IN_STORAGE: { label: "Trong kho", chipBg: "bg-emerald-100", chipText: "text-emerald-700" },
    IN_STAGING: { label: "Chờ xuất", chipBg: "bg-purple-100", chipText: "text-purple-700" },
    RELEASED: { label: "Đã giải phóng", chipBg: "bg-surface-low", chipText: "text-on-surface-variant" },
    CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error" },
  },
  INBOUND: { /* ... */ },
  STOCKCOUNT: { /* ... */ },
  MOVEMENT: { /* ... */ },
  OUTBOUND: { /* ... */ },
};

export function StatusChip({ type, value, className = "" }: { type: StatusType; value: StatusValue; className?: string }) {
  const meta = STATUS_META[type]?.[value] || { label: value, chipBg: "bg-surface-low", chipText: "text-on-surface-variant" };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.chipBg} ${meta.chipText} ${className}`}>
      {meta.label}
    </span>
  );
}
```

**Acceptance Phase 1:**
- [ ] 14 component nền tảng (10 desktop + 7 mobile, có overlap)
- [ ] TypeScript pass `npx tsc --noEmit`
- [ ] Index barrel export `src/components/ui/index.ts`
- [ ] README ngắn cách dùng từng component
- [ ] Storybook (optional) hoặc 1 page demo `/dev/ui-kit`

---

<a id="phase-2"></a>

## 🎨 PHASE 2 — TOKEN & UTILITY CLEANUP (1 ngày)

### Bước 2.1 — Thêm tokens thiếu (1 giờ)

**File:** `src/app/globals.css` — sửa block `@theme`:

```css
@theme {
  /* ... existing tokens ... */

  /* Bổ sung — Phase 2 */
  --color-warning-container: #fff0d6;
  --color-warning-on-container: #8a5a00;
  --color-success-on-container: #1e6b35;

  /* Role colors (mobile) */
  --color-forklift: #ea580c;
  --color-forklift-container: #fed7aa;
  --color-kiemke: #7c3aed;
  --color-kiemke-container: #ddd6fe;
  --color-thukho: var(--color-primary);
  --color-thukho-container: var(--color-primary-container);

  /* Page padding chuẩn */
  --spacing-page: 24px;        /* p-page */
  --spacing-page-mobile: 16px; /* px-margin-mobile */
  --spacing-section: 20px;     /* space-section */

  /* Typography mobile */
  --text-headline-md-mobile: 18px;
  --text-body-lg: 16px;
}

/* Animation keyframes — gom vào đây thay vì inline trong mỗi page */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes slide-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}

@layer utilities {
  .animate-fade-in { animation: fade-in 0.2s ease-out; }
  .animate-scale-in { animation: scale-in 0.2s ease-out; }
  .animate-slide-in-right { animation: slide-in-right 0.2s ease-out; }
}
```

### Bước 2.2 — Tạo `src/lib/status-meta.ts` central (1 giờ)

```typescript
/**
 * Single source of truth cho status enum + label + color.
 * Replace 5+ STATUS_MAP duplicate trong codebase.
 */

export type PalletStatus = "EMPTY" | "COUNTING" | "CONFIRMED" | "IN_STORAGE" | "IN_STAGING" | "RELEASED" | "CANCELLED";

export const PALLET_STATUS_META: Record<PalletStatus, {
  label: string;
  chipBg: string;
  chipText: string;
  borderLeft: string;
  icon: string;
}> = {
  EMPTY: { label: "Trống", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", borderLeft: "bg-surface-mid", icon: "package_2" },
  COUNTING: { label: "Đang kiểm đếm", chipBg: "bg-amber-100", chipText: "text-amber-700", borderLeft: "bg-amber-500", icon: "hourglass_top" },
  CONFIRMED: { label: "Chờ xe nâng", chipBg: "bg-blue-100", chipText: "text-blue-700", borderLeft: "bg-blue-500", icon: "check_circle" },
  IN_STORAGE: { label: "Trong kho", chipBg: "bg-emerald-100", chipText: "text-emerald-700", borderLeft: "bg-emerald-500", icon: "shelves" },
  IN_STAGING: { label: "Chờ xuất", chipBg: "bg-purple-100", chipText: "text-purple-700", borderLeft: "bg-purple-500", icon: "outbox" },
  RELEASED: { label: "Đã giải phóng", chipBg: "bg-surface-low", chipText: "text-on-surface-variant/50", borderLeft: "bg-surface-mid", icon: "task_alt" },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error", borderLeft: "bg-error/50", icon: "cancel" },
};

export type InboundStatus = "DRAFT" | "PENDING" | "RECEIVING" | "RECONCILING" | "COMPLETED" | "CANCELLED";

export const INBOUND_STATUS_META: Record<InboundStatus, { label: string; chipBg: string; chipText: string; icon: string; step: number }> = {
  DRAFT: { label: "Nháp", chipBg: "bg-surface-low", chipText: "text-on-surface-variant", icon: "edit_note", step: 1 },
  PENDING: { label: "Chờ tiếp nhận", chipBg: "bg-amber-50", chipText: "text-amber-700", icon: "hourglass_top", step: 2 },
  RECEIVING: { label: "Đang nhận hàng", chipBg: "bg-blue-50", chipText: "text-blue-700", icon: "inventory", step: 4 },
  RECONCILING: { label: "Đang đối chiếu", chipBg: "bg-purple-50", chipText: "text-purple-700", icon: "compare_arrows", step: 7 },
  COMPLETED: { label: "Hoàn tất", chipBg: "bg-emerald-50", chipText: "text-emerald-700", icon: "check_circle", step: 8 },
  CANCELLED: { label: "Đã hủy", chipBg: "bg-error-container", chipText: "text-error", icon: "cancel", step: 0 },
};

// Tiếp tục: OUTBOUND_STATUS_META, STOCKCOUNT_STATUS_META, ADJUSTMENT_STATUS_META, MOVEMENT_TYPE_META, USER_ROLE_META
```

### Bước 2.3 — Tạo `src/lib/role-theme.ts` (30 phút)

```typescript
export type AppRole = "ADMIN" | "MANAGER" | "QUAN_LY" | "KE_TOAN" | "STAFF" | "THU_KHO" | "XE_NANG" | "KIEM_KE";

export const ROLE_THEME: Record<AppRole, { color: string; gradient: string; label: string }> = {
  ADMIN: { color: "var(--color-primary)", gradient: "from-primary to-primary-hover", label: "Quản trị" },
  MANAGER: { color: "var(--color-primary)", gradient: "from-primary to-primary-hover", label: "Quản lý" },
  QUAN_LY: { color: "var(--color-primary)", gradient: "from-primary to-primary-hover", label: "Quản lý" },
  KE_TOAN: { color: "var(--color-secondary)", gradient: "from-secondary to-on-secondary-container", label: "Kế toán" },
  STAFF: { color: "var(--color-secondary)", gradient: "from-secondary to-on-secondary-container", label: "Nhân viên" },
  THU_KHO: { color: "var(--color-thukho)", gradient: "from-primary to-primary-hover", label: "Thủ kho" },
  XE_NANG: { color: "var(--color-forklift)", gradient: "from-[#ea580c] to-[#f97316]", label: "Xe nâng" },
  KIEM_KE: { color: "var(--color-kiemke)", gradient: "from-[#7c3aed] to-[#a855f7]", label: "Kiểm kê" },
};
```

### Bước 2.4 — Barrel export `src/components/ui/index.ts` (15 phút)

```typescript
export * from "./Button";
export * from "./Input";
export * from "./Textarea";
export * from "./Select";
export * from "./FormField";
export * from "./Modal";
export * from "./ConfirmDialog";
export * from "./Toast";
export * from "./Spinner";
export * from "./EmptyState";
export * from "./ErrorState";
export * from "./Pagination";
export * from "./Stepper";
export * from "./Tabs";
export * from "./Card";
export * from "./Badge";
```

### Bước 2.5 — Wire `<ToastProvider>` + `<ConfirmProvider>` vào root layout (15 phút)

```tsx
// src/app/layout.tsx
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ConfirmProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </ConfirmProvider>
      </body>
    </html>
  );
}
```

### Acceptance Phase 2
- [ ] globals.css đủ tokens (warning-container, role colors, animation)
- [ ] lib/status-meta.ts có 5 enum (PALLET/INBOUND/OUTBOUND/STOCKCOUNT/MOVEMENT)
- [ ] lib/role-theme.ts có 8 role
- [ ] ToastProvider + ConfirmProvider wrap root layout
- [ ] Smoke test: gọi `useToast` và `useConfirm` từ 1 page mẫu OK

---

<a id="phase-3"></a>

## 🚨 PHASE 3 — 6 CRITICAL FIXES (2 ngày)

### Bước 3.1 — Fix DOUBLE HEADER trang xe nâng (30 phút)

**Vấn đề:** `ForkliftMobileDashboard.tsx:95-104` tự render topbar cam `bg-[#ea580c]` đè lên header trắng đã có từ `forklift/layout.tsx`.

**Fix:**

```tsx
// src/components/forklift/ForkliftMobileDashboard.tsx
// XÓA block sau (line ~95-104):
- <div className="-mx-margin-mobile -mt-md px-margin-mobile py-3 bg-[#ea580c] text-white flex items-center justify-between sticky top-0 z-10 shadow-sm">
-   <span className="text-sm font-bold flex items-center gap-1.5">
-     <span className="material-symbols-outlined text-[20px]">forklift</span>
-     Xe nâng — Việc của tôi
-   </span>
-   <button onClick={() => fetchData(activeTab)} className="text-xs font-semibold flex items-center gap-1 opacity-90 hover:opacity-100">
-     <span className="material-symbols-outlined text-[16px]">refresh</span>
-   </button>
- </div>
```

→ Header trắng từ `forklift/layout.tsx` giữ nguyên. Identity màu cam dùng border-left card và pill tabs.

### Bước 3.2 — Fix NESTED LAYOUT 5 page forklift (4 giờ)

**Vấn đề:** 5 page sau dùng `<AppLayout>` (desktop có sidebar 288px) trong khi đang ở mobile shell:
- `src/app/forklift/put-away/page.tsx`
- `src/app/forklift/relocate/page.tsx`
- `src/app/forklift/stage-out/page.tsx`
- `src/app/forklift/return/page.tsx`
- `src/app/forklift/history/page.tsx`

**Fix mỗi file:**
```tsx
// ❌ HIỆN TẠI:
import { AppLayout } from "@/components/layout/AppLayout";
return (
  <AppLayout title="STAGE OUT">
    <div className="p-6">{/* content */}</div>
  </AppLayout>
);

// ✅ SỬA THÀNH:
// Layout đã có sẵn từ forklift/layout.tsx → KHÔNG cần wrap AppLayout
return (
  <div className="px-margin-mobile py-md flex flex-col gap-md">
    {/* content */}
  </div>
);
```

**Bonus:** Replace tất cả màu lạc (indigo/amber/rose) bằng design token hoặc role color (`var(--color-forklift)`).

### Bước 3.3 — Fix hardcoded `/wms/api/` trong forklift mobile (15 phút)

**File:** `src/app/forklift/history/page.tsx:34`

```tsx
// ❌ HIỆN TẠI:
const res = await fetch(`/wms/api/movements`);

// ✅ SỬA THÀNH:
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const res = await fetch(`${basePath}/api/movements`);
```

**Grep toàn dự án tìm các vị trí khác:**
```bash
grep -rn '"/wms/api/' src/ --include="*.tsx" --include="*.ts"
```

Tất cả phải đổi sang `${basePath}/api/...`.

### Bước 3.4 — Fix broken token `text-headline-md-mobile` (15 phút)

**Vấn đề:** Class `text-headline-md-mobile` được dùng trong 3 layout header nhưng KHÔNG định nghĩa trong globals.css.

**Fix (đã làm ở Phase 2 Step 2.1):**
- Thêm `--text-headline-md-mobile: 18px;` vào `@theme`
- HOẶC grep replace tất cả `text-headline-md-mobile` → `text-lg font-semibold`

### Bước 3.5 — Fix gradient pink-orange lạc tone (15 phút)

**File:** `src/app/inventory/page.tsx:126`

```tsx
// ❌ HIỆN TẠI:
<div className="rounded-xl border border-rose-300 p-4 shadow-sm"
  style={{ background: "linear-gradient(135deg, #fef2f2, #fff7ed)" }}>

// ✅ SỬA THÀNH:
<div className="rounded-xl border border-error/30 p-4 shadow-sm bg-error-container/30">
```

### Bước 3.6 — Replace `alert()` + `confirm()` trên 5 page nặng nhất (4 giờ)

**Mục tiêu:** Phase 3 chỉ replace 5 file dùng nhiều nhất (~30 vị trí), phần còn lại sẽ làm trong Phase 4 sweep.

**Files ưu tiên:**
1. `src/app/inbound/page.tsx` (5 vị trí)
2. `src/app/pallets/[id]/page.tsx` (4 vị trí)
3. `src/app/master-data/page.tsx` (3 vị trí — đã có Modal nội bộ nhưng vẫn dùng confirm trong delete)
4. `src/app/system/users/page.tsx` (4 vị trí)
5. `src/app/locations/page.tsx` (5 vị trí)

**Pattern replace:**

```tsx
// ❌ HIỆN TẠI:
const handleCancel = async (id: string, code: string) => {
  if (!confirm(`Hủy phiếu nhập "${code}"?`)) return;
  // ...
};

// ✅ SỬA THÀNH:
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const { confirm } = useConfirm();
const { toast } = useToast();

const handleCancel = async (id: string, code: string) => {
  const ok = await confirm({
    title: "Hủy phiếu nhập?",
    description: `Phiếu "${code}" sẽ chuyển sang trạng thái Đã hủy.`,
    confirmText: "Hủy phiếu",
    variant: "danger",
  });
  if (!ok) return;
  // ...
  toast.success("Đã hủy phiếu");
};
```

**Replace `alert()`:**

```tsx
// ❌ HIỆN TẠI:
alert(result.error);

// ✅ SỬA THÀNH:
toast.error(result.error || "Có lỗi xảy ra");
```

### Acceptance Phase 3
- [ ] DOUBLE HEADER xe nâng đã fix — không còn 2 sticky top-0
- [ ] 5 page forklift mobile không còn nested `<AppLayout>`
- [ ] Tất cả fetch không còn hardcode `/wms/api/`
- [ ] Token `text-headline-md-mobile` define hoặc replace
- [ ] Gradient pink-orange trong inventory đã đổi sang `bg-error-container/30`
- [ ] 5 page nặng nhất đã hết `alert()` và `confirm()` — đổi sang `useToast` + `useConfirm`
- [ ] Build + deploy verify OK

---

<a id="phase-4"></a>

## 🔄 PHASE 4 — SWEEP REFACTOR DESKTOP (6 ngày)

> **Quy tắc:** Mỗi page refactor xong → screenshot before/after lưu vào `docs/visual-regression/` → commit theo module.

### Module A — Auth (0.5 ngày)

**File:** `src/app/auth/page.tsx`, `src/app/auth/forgot-password/page.tsx`

**Forgot-password là page TỆ NHẤT** (70+ HEX cứng) — viết lại từ đầu.

**Checklist:**
- [ ] Replace 70+ HEX cứng → design token
- [ ] Wrap form bằng `<FormField>` + `<Input>`
- [ ] Replace inline stepper → `<Stepper>`
- [ ] Replace inline button → `<Button>`
- [ ] Replace mock OTP modal → `<Modal>` chuẩn

### Module B — Master Data (1 ngày)

**Files:** 6 page
- `src/app/master-data/page.tsx` (945 dòng)
- `src/app/item-codes/page.tsx` (722 dòng)
- `src/app/product-groups/page.tsx`
- `src/app/units/page.tsx`
- `src/app/locations/page.tsx` (1024 dòng)
- `src/app/suppliers/page.tsx`

**Checklist mỗi page:**
- [ ] Header replace bằng `<PageTitle>` (tạo mới hoặc dùng pattern đồng nhất)
- [ ] Button list (Add/Import Excel/Export Excel) dùng `<Button variant icon>`
- [ ] Form modal dùng `<Modal>` + `<FormField>` + `<Input>`
- [ ] Confirm delete dùng `useConfirm`
- [ ] Empty state dùng `<EmptyState icon="inventory_2" title="..." action={<Button>...</Button>} />`
- [ ] Pagination dùng `<Pagination>` thay vì copy-paste 20 dòng
- [ ] Loading dùng `<PageLoader>` hoặc `<Spinner>`
- [ ] Status badge dùng `<Badge>` (đã có) + lookup `STATUS_META` từ lib

### Module C — Pallet (0.5 ngày)

**Files:** 2 page
- `src/app/pallets/page.tsx`
- `src/app/pallets/[id]/page.tsx`

**Checklist:**
- [ ] Replace STATUS_MAP local → `PALLET_STATUS_META` từ `lib/status-meta.ts`
- [ ] Unlock modal → `<Modal>` + form fields
- [ ] Tab "Hàng hóa / Lịch sử" → `<Tabs variant="underline">`

### Module D — Inbound (1 ngày)

**Files:** 8 page
- `src/app/inbound/page.tsx`, `inbound/new/page.tsx`, `inbound/[id]/page.tsx`, `inbound/import/page.tsx`
- `src/app/inbound-adhoc/page.tsx`, `inbound-adhoc/new/page.tsx`, `inbound-adhoc/[id]/page.tsx`

**Checklist:**
- [ ] InboundStepper 8 dot → `<Stepper variant="dots">` từ component lib
- [ ] Import wizard 3 bước → `<Stepper variant="linear">`
- [ ] Tabs `Nhập tay / Excel / Unilever` → `<Tabs variant="pill">`
- [ ] ProductPicker autocomplete → tạo `<ProductPicker>` reusable trong `src/components/ui/`
- [ ] Filter search → `<Input variant="filled" iconLeft="search">`
- [ ] Button "Lập phiếu mới" / "Import Excel" → `<Button>` (xóa emoji 📝 📥 vì đã có icon)

### Module E — Outbound (1 ngày)

**Files:** 7 page
- `src/app/outbound/page.tsx`, `outbound/report/page.tsx`, `outbound/turnover/page.tsx`, `outbound/reorder/page.tsx`, `outbound/rebalance/page.tsx`
- `src/app/outbound/requests/page.tsx`, `outbound/requests/new/page.tsx`, `outbound/requests/[id]/page.tsx`

**Checklist:**
- [ ] Sweep `<Button>`, `<Input>`, `<Select>`, `<Modal>`, `<Toast>` toàn module
- [ ] Excel button không còn xanh lá tươi — dùng `<Button variant="secondary" icon="download">`
- [ ] OutboundRequest status badge dùng `OUTBOUND_STATUS_META`

### Module F — Inventory (1 ngày)

**Files:** 8 page
- `src/app/inventory/page.tsx`, `by-location`, `by-pallet`, `by-lot`, `alerts`, `adjustments`, `adjustments/new`, `by-sku/[code]/locations`

**Checklist:**
- [ ] Panel cận date đã fix gradient ở Phase 3
- [ ] Alerts page: 4 KPI box → unified KPI card pattern
- [ ] Adjustment new: form fields → `<FormField>` + `<Select>` + `<Textarea>`

### Module G — Stock Count (0.5 ngày)

**Files:** 4 page

**Checklist:** Generic sweep với component nền tảng.

### Module H — Dashboard (0.5 ngày)

**Files:** `dashboard/page.tsx`, `dashboard/manager/page.tsx`

**Checklist:**
- [ ] Bỏ emoji `👋`, `📊`, `🚨`, `📅`, `📋`, `🏆`, `📈` trong H1 + section titles
- [ ] KPI card unified pattern (4 size cố định)
- [ ] Period selector → `<Select>`

### Module I — Forklift Web Dashboard (0.5 ngày)

**File:** `src/components/forklift/ForkliftWebDashboard.tsx`

**Checklist:** Sweep button + table + filter + dùng component nền tảng.

### Module J — System (0.5 ngày)

**Files:** 7 page (config, mail, users, rbac, audit-log, change-password, profile)

**Checklist:**
- [ ] system/users modal → dùng `<Modal>` chuẩn (bỏ rounded-2xl, slate-900/40)
- [ ] Border `border-slate-300` → `border-outline-variant`
- [ ] Status badge `🔒 Khóa` `✅ Hoạt động` → `<Badge variant>` text only
- [ ] RBAC matrix cell checkbox → giữ nguyên nếu đúng UX (xem mockup)
- [ ] Audit log JSON preview → tách `<JsonPreview>` component nhỏ

### Acceptance Phase 4
- [ ] Tất cả 50+ page desktop dùng component nền tảng
- [ ] 0 `alert()` / `confirm()` / `prompt()` còn lại trong src/app/
- [ ] 0 HEX cứng còn lại trong src/app/
- [ ] 0 `text-slate-*` / `bg-slate-*` / `border-slate-*` còn lại
- [ ] 0 emoji decorative trong button/heading (giữ trong toast/empty state OK)
- [ ] Build + deploy verify visual qua Cốc Cốc + Claude in Chrome
- [ ] Screenshot before/after 10 page chính lưu vào `docs/visual-regression/`

---

<a id="phase-5"></a>

## 📱 PHASE 5 — SWEEP REFACTOR MOBILE (3 ngày)

### Module M-A — Thủ kho (1 ngày)

**Files:** 16 page trong `src/app/thukho/`

**Checklist mỗi page:**
- [ ] Replace topbar custom → `<MobileTopbar role="thukho">`
- [ ] Replace back link → `<BackLink>`
- [ ] Replace status badge → `<StatusChip type="PALLET" value={s} />`
- [ ] Replace empty state → `<EmptyState>` với CTA
- [ ] Replace loading → `<Spinner size="md">`
- [ ] Replace error catch silently → `<ErrorState onRetry={refresh}>`
- [ ] Hero card adhoc gradient outlier → `<HeroHeader role="thukho">`
- [ ] KPI strip → `<KPIStrip cols={2|3|4}>`
- [ ] Tap target tối thiểu 44px (nâng `w-6 h-6` → `w-10 h-10` cho icon button)
- [ ] Font tối thiểu 11px (nâng `text-[9px]`, `text-[10px]` → `text-[11px]`)

### Module M-B — Xe nâng (0.5 ngày)

**Files:** 9 page trong `src/app/forklift/` + `ForkliftMobileDashboard.tsx`

Phase 3 đã làm critical fix (DOUBLE HEADER + NESTED LAYOUT). Phase 5 polish thêm:
- [ ] Replace tất cả màu indigo/amber/rose lạc → `var(--color-forklift)` hoặc design token
- [ ] Table 600px width trong `stage-out` → mobile card list
- [ ] Modal `max-w-lg` → `max-w-md sm:max-w-lg`

### Module M-C — Kiểm kê (0.5 ngày)

**Files:** 6 page trong `src/app/kiemke/`

**Checklist:**
- [ ] Header kiểm kê thiếu nút QR → thêm vào layout
- [ ] Header thiếu notification badge → thêm
- [ ] Avatar role → dùng `var(--color-kiemke)` thay vì primary-container
- [ ] Replace `bg-violet-600` button "Mở camera quét QR" → `bg-[var(--color-kiemke)]` hoặc design token

### Module M-D — Component Shared (0.5 ngày)

**Files:** `src/components/shared/BarcodeScanner.tsx`, `BarcodeScannerModal.tsx`, `ImageUpload.tsx`

**Checklist:**
- [ ] BarcodeScannerModal `bg-zinc-900` → `bg-primary` hoặc `bg-black/90`
- [ ] ImageUpload `bg-slate-50/100/300` → `bg-surface-low`, `border-outline-variant`
- [ ] ImageUpload delete button `w-6 h-6` → `w-8 h-8` (tap target 44px ko đạt nhưng cải thiện)

### Module M-E — Profile pages (0.25 ngày)

**Files:** `thukho/profile`, `forklift/profile`, `kiemke/profile`

**Checklist:**
- [ ] Logout button uppercase outlier → bình thường hoá theo `<Button variant="danger">`
- [ ] Mock data hard-code trong `forklift/profile` (license, KPIs) → ẩn block khi chưa có data
- [ ] Toggle switch thêm `role="switch"` + `aria-checked`
- [ ] Unified profile template (3 role chỉ khác hero color)

### Acceptance Phase 5
- [ ] Tất cả 30+ page mobile dùng component mobile chuẩn
- [ ] 0 `text-[9px]` / `text-[10px]` trong text quan trọng (chỉ giữ trong meta/caption)
- [ ] Tap target ≥ 44px cho 90% icon button
- [ ] Empty state có CTA / icon
- [ ] Error state có retry button
- [ ] Build + deploy verify trên VPS 4/4 instance HTTP 200

---

<a id="phase-6"></a>

## 🛡️ PHASE 6 — ESLINT GUARDRAILS + A11Y (1.5 ngày)

### Bước 6.1 — ESLint custom rule (4 giờ)

**File:** `.eslintrc.json` hoặc `eslint.config.js`

Cài `eslint-plugin-no-restricted-syntax` để cấm các pattern xấu:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.name='alert']",
        "message": "Không dùng alert(). Dùng useToast() từ @/components/ui/Toast."
      },
      {
        "selector": "CallExpression[callee.name='confirm']",
        "message": "Không dùng confirm(). Dùng useConfirm() từ @/components/ui/ConfirmDialog."
      },
      {
        "selector": "CallExpression[callee.name='prompt']",
        "message": "Không dùng prompt(). Tạo custom modal với Input."
      }
    ],
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": ["**/AppLayout"],
            "importNames": ["AppLayout"],
            "message": "Không import AppLayout trong page mobile (thukho/xenang/kiemke/forklift)."
          }
        ]
      }
    ]
  }
}
```

**Custom rule cho Tailwind class:**

Cài `eslint-plugin-tailwindcss` rồi config rule custom:

```javascript
// scripts/check-forbidden-classes.js — script chạy CI để chặn class xấu
const FORBIDDEN_CLASSES = [
  /\btext-slate-\d+/,
  /\bbg-slate-\d+/,
  /\bborder-slate-\d+/,
  /\btext-\[#[0-9a-fA-F]{3,8}\]/,
  /\bbg-\[#[0-9a-fA-F]{3,8}\]/,
  /\bborder-\[#[0-9a-fA-F]{3,8}\]/,
  /\brounded-2xl(?![a-z])/, // optional — chỉ dùng rounded-xl
];

// Scan src/app/**/*.tsx và src/components/**/*.tsx
// Báo lỗi nếu match
```

Tích hợp script vào `package.json`:
```json
"scripts": {
  "lint:tokens": "node scripts/check-forbidden-classes.js",
  "lint": "next lint && npm run lint:tokens"
}
```

### Bước 6.2 — A11y sweep (3 giờ)

**Checklist:**
- [ ] Tất cả icon-only button có `aria-label="..."`
- [ ] Tất cả input quan trọng có `<label>` (qua FormField)
- [ ] Tất cả modal có `role="dialog"` + `aria-modal="true"` (đã có trong `<Modal>`)
- [ ] Tất cả link active có `aria-current="page"`
- [ ] Tất cả toggle switch có `role="switch"` + `aria-checked`
- [ ] Test với axe DevTools / Lighthouse — score ≥ 90

**Script tự động kiểm tra:**
```bash
# Cài lighthouse CLI
npm i -g @lhci/cli

# Chạy trên 5 page chính
lhci collect --url=https://188.166.210.73/wms/dashboard --url=https://188.166.210.73/wms/inventory --url=https://188.166.210.73/wms/master-data
```

### Bước 6.3 — Animation cleanup (1 giờ)

- [ ] Tất cả inline `<style>` cho `@keyframes fadeIn`/`scaleIn` xóa khỏi page
- [ ] Animation đã được gom vào `globals.css` (Phase 2)
- [ ] Page chỉ dùng `className="animate-fade-in"` hoặc `animate-scale-in`

### Bước 6.4 — Spinner consolidation (30 phút)

- [ ] Grep `border-2 border-primary/30 border-t-primary rounded-full animate-spin` → replace bằng `<Spinner>`
- [ ] Grep `material-symbols-outlined animate-spin.*progress_activity` → replace bằng `<Spinner>`

### Acceptance Phase 6
- [ ] ESLint `npm run lint` pass — 0 warning về alert/confirm/AppLayout import
- [ ] `npm run lint:tokens` pass — 0 forbidden class
- [ ] Lighthouse a11y score ≥ 90 trên 5 page mẫu
- [ ] Tất cả spinner dùng `<Spinner>` thống nhất

---

<a id="phase-7"></a>

## 🔍 PHASE 7 — QA VISUAL REGRESSION (1.5 ngày)

### Bước 7.1 — Setup Playwright snapshot (3 giờ)

```bash
npm install --save-dev @playwright/test
npx playwright install
```

**File:** `tests/visual.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

const PAGES = [
  { url: "/wms/dashboard", name: "dashboard" },
  { url: "/wms/inventory", name: "inventory" },
  { url: "/wms/master-data", name: "master-data" },
  { url: "/wms/inbound", name: "inbound" },
  { url: "/wms/outbound/requests", name: "outbound-requests" },
  { url: "/wms/stock-count", name: "stock-count" },
  { url: "/wms/system/users", name: "system-users" },
  { url: "/wms/auth", name: "auth" },
  { url: "/thukho/pallet", name: "thukho-pallet" },
  { url: "/xenang/forklift", name: "forklift-mobile" },
  { url: "/kiemke", name: "kiemke" },
];

for (const p of PAGES) {
  test(`visual ${p.name}`, async ({ page }) => {
    await page.goto(`https://188.166.210.73${p.url}`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveScreenshot(`${p.name}.png`, {
      fullPage: true,
      threshold: 0.1,
    });
  });
}
```

### Bước 7.2 — Run baseline trên branch main, compare với branch ui-overhaul (3 giờ)

```bash
# Trên branch main (baseline)
git checkout main
npx playwright test --update-snapshots

# Switch sang branch mới
git checkout feat/ui-overhaul

# Run lại — sẽ fail những page có diff
npx playwright test

# Review diff trong playwright-report/
npx playwright show-report
```

### Bước 7.3 — Manual review checklist (3 giờ)

**Checklist Final Sign-off:**

#### Desktop
- [ ] `/dashboard` (kế toán): 4 KPI card đồng đều, không emoji 👋, font weight đồng nhất
- [ ] `/dashboard/manager`: chart hiển thị OK, không emoji 📊 trong H1
- [ ] `/inventory`: panel cận date không còn gradient pink-orange, KPI 4 box đồng style
- [ ] `/master-data`: modal form sản phẩm dùng `<Modal>` chuẩn, button "Xuất Excel" có ExcelExport component
- [ ] `/item-codes`: modal "Chuẩn hóa mã hàng" dùng `<Modal>` chuẩn
- [ ] `/inbound`: stepper 8 dot, pill "Có chênh lệch", không còn emoji trong button
- [ ] `/inbound/import`: 3-step wizard dùng `<Stepper>` chuẩn
- [ ] `/outbound/report`: bar chart + pie chart hiển thị, button Excel không xanh lá tươi
- [ ] `/system/users`: modal input có border đúng, badge không còn emoji 🔒 ✅
- [ ] `/system/rbac`: 3 button header chuẩn (primary outline)
- [ ] `/auth`: login form đẹp
- [ ] `/auth/forgot-password`: KHÔNG còn HEX cứng — rewrite hoàn toàn

#### Mobile
- [ ] `/thukho/pallet`: 4 pill tab có count, card border-left theo status
- [ ] `/thukho/pallet/new`: form preview mã + dropdown PHN
- [ ] `/thukho/pallet/[id]`: nút 📷 quét cạnh search, modal scanner mở
- [ ] `/xenang/forklift`: KHÔNG còn DOUBLE HEADER, topbar trắng từ layout, card border cam
- [ ] `/xenang/forklift/put-away`: KHÔNG còn `<AppLayout>` desktop nested
- [ ] `/xenang/forklift/history`: fetch dùng basePath đúng, không 404
- [ ] `/kiemke/scan`: nút "Mở camera quét QR" tím, toggle Blind count
- [ ] `/kiemke/tasks/[id]`: 4 KPI tổng SL HT/TT/Chênh/Tiến độ, highlight STAGING-OUT

### Bước 7.4 — Sign-off

- [ ] Tech Lead review 5 page random + cho approval
- [ ] Designer review screenshot before/after
- [ ] Merge PR `feat/ui-overhaul` → main
- [ ] Deploy production VPS
- [ ] Update [CLAUDE.md](CLAUDE.md) với link tới design system docs

### Acceptance Phase 7
- [ ] Playwright snapshot pass 11/11 pages
- [ ] Manual checklist desktop 12/12 ✓
- [ ] Manual checklist mobile 8/8 ✓
- [ ] PR merged
- [ ] VPS production HTTP 200 cả 4 instance
- [ ] Tech Lead sign-off

---

<a id="phụ-lục"></a>

## 📎 PHỤ LỤC

### A. Bảng đối chiếu Before / After (50 ví dụ)

#### Button

| Before | After |
|---|---|
| `<button className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2"><span class="material-symbols-outlined text-[18px]">add</span>Thêm</button>` | `<Button variant="primary" size="md" icon="add">Thêm</Button>` |
| `<button className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs hover:bg-surface-low">Hủy</button>` | `<Button variant="ghost" size="sm">Hủy</Button>` |
| `<button className="px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-semibold hover:bg-rose-700">Xóa</button>` | `<Button variant="danger" size="md">Xóa</Button>` |

#### Input

| Before | After |
|---|---|
| `<input className="w-full pl-10 pr-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20" placeholder="Tìm..." />` | `<Input variant="filled" iconLeft="search" placeholder="Tìm..." />` |
| `<input className="w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />` | `<Input variant="default" />` |

#### Modal

| Before | After |
|---|---|
| 30 dòng `<div className="fixed inset-0 z-50...">...</div>` | `<Modal open={open} onClose={close} size="md"><Modal.Header onClose={close}>Title</Modal.Header><Modal.Body>...</Modal.Body><Modal.Footer><Button>...</Button></Modal.Footer></Modal>` |

#### Alert/Confirm

| Before | After |
|---|---|
| `if (!confirm("Xóa?")) return;` | `const ok = await confirm({ title: "Xóa?", variant: "danger" }); if (!ok) return;` |
| `alert("Lỗi");` | `toast.error("Lỗi");` |

#### Status badge

| Before | After |
|---|---|
| `<span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700">Chờ</span>` | `<Badge variant="warning">Chờ</Badge>` HOẶC `<StatusChip type="INBOUND" value="PENDING" />` |
| `<span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">Hoàn tất</span>` | `<Badge variant="success">Hoàn tất</Badge>` |

#### Spinner

| Before | After |
|---|---|
| `<div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />` | `<Spinner size="sm" />` |
| `<span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>` | `<Spinner size="md" />` |

#### Empty state

| Before | After |
|---|---|
| `<td colSpan={7}><span className="material-symbols-outlined text-[32px] mb-2 block opacity-40">inventory_2</span>Không có dữ liệu</td>` | `<td colSpan={7}><EmptyState icon="inventory_2" title="Chưa có dữ liệu" action={<Button variant="primary" icon="add" onClick={openAdd}>Thêm mới</Button>} /></td>` |

#### Pagination

| Before | After |
|---|---|
| 20 dòng `<button onClick={() => setPage(1)}>...` copy paste | `<Pagination page={page} totalPages={totalPages} onPageChange={setPage} />` |

### B. Codemod script (sample)

**File:** `scripts/codemod-slate-to-token.js`

```javascript
const fs = require("fs");
const glob = require("glob");

const REPLACEMENTS = [
  [/\btext-slate-500\b/g, "text-on-surface-variant"],
  [/\btext-slate-600\b/g, "text-on-surface-variant"],
  [/\btext-slate-700\b/g, "text-on-surface"],
  [/\btext-slate-800\b/g, "text-on-surface"],
  [/\btext-slate-900\b/g, "text-on-surface"],
  [/\btext-slate-400\b/g, "text-on-surface-variant/70"],
  [/\btext-slate-300\b/g, "text-on-surface-variant/50"],
  [/\bbg-slate-50\b/g, "bg-surface-low"],
  [/\bbg-slate-100\b/g, "bg-surface-low"],
  [/\bborder-slate-200\b/g, "border-outline-variant"],
  [/\bborder-slate-300\b/g, "border-outline-variant"],
  [/\bbg-slate-900\/40\b/g, "bg-black/40"],
];

const files = glob.sync("src/**/*.{tsx,ts}");
let totalReplacements = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf8");
  let changes = 0;
  for (const [pattern, replacement] of REPLACEMENTS) {
    const matches = content.match(pattern);
    if (matches) {
      changes += matches.length;
      content = content.replace(pattern, replacement);
    }
  }
  if (changes > 0) {
    fs.writeFileSync(file, content);
    console.log(`✓ ${file}: ${changes} replacements`);
    totalReplacements += changes;
  }
}

console.log(`\n🎉 Total: ${totalReplacements} replacements across ${files.length} files`);
```

Chạy:
```bash
node scripts/codemod-slate-to-token.js
```

### C. Workflow git per phase

```bash
# Phase 1
git checkout -b feat/ui-overhaul-phase1
# ... code components ...
git add src/components/ui/
git commit -m "feat(ui): Phase 1 — 14 foundation components (Button, Input, Modal, Toast, ...)"
git push

# Phase 2
git commit -m "feat(ui): Phase 2 — token cleanup + status-meta + role-theme"

# Phase 3
git commit -m "fix(ui): Phase 3 — critical fixes (DOUBLE HEADER, NESTED LAYOUT, hardcoded API)"

# Phase 4 (chia 10 commit theo module)
git commit -m "refactor(auth): Phase 4-A — replace HEX + Modal + Stepper"
git commit -m "refactor(master-data): Phase 4-B — Button + Modal + Pagination"
# ... 8 commit nữa ...

# Phase 5
git commit -m "refactor(mobile): Phase 5-A — thukho 16 pages sweep"
git commit -m "refactor(mobile): Phase 5-B — forklift polish"
git commit -m "refactor(mobile): Phase 5-C — kiemke header + nav"

# Phase 6
git commit -m "chore(eslint): Phase 6 — ESLint rules + a11y sweep"

# Phase 7
git commit -m "test(visual): Phase 7 — Playwright snapshot baseline"

# Merge
git checkout main
git merge feat/ui-overhaul-phase1 --no-ff -m "feat(ui): UI overhaul — 17 days of refactoring"
git push
```

### D. Communication template

**Khi báo cáo tiến độ hàng ngày:**

```
📅 Ngày 1 / 17 — Phase 1 — Foundation Components

✅ Hoàn thành:
- Button.tsx (6 variant, 3 size, loading, fullWidth) — 100%
- Input.tsx + FormField.tsx — 100%

🚧 Đang làm:
- Modal.tsx (đang implement focus trap)

⏳ Kế hoạch ngày mai:
- Hoàn thành Modal.tsx
- Toast + ConfirmDialog
- Spinner + EmptyState

🚨 Blockers: Không

📊 Tiến độ tổng: 25% Phase 1 / 0% overall
```

### E. Khi nào có thể dừng (Stop Loss)

Nếu sau Phase 1+2 phát hiện scope quá lớn, có thể dừng tại đó với output:
- ✅ 14 component nền tảng sẵn dùng
- ✅ Token đầy đủ
- ✅ ToastProvider + ConfirmProvider wired
- ❌ Chưa refactor 50+ page → patch dần khi sửa feature mới

Đây là "Minimum Viable Cleanup" — vẫn cho nhóm dev mới value lớn.

---

## 🎯 SUMMARY EFFORT

| Phase | Effort | Calendar (1 dev) | Calendar (2 dev song song) |
|---|---|---|---|
| 0 — Pre-requisite | 0.5 ngày | 0.5 ngày | 0.5 ngày |
| 1 — Foundation 14 comp | 2 ngày | 2 ngày | 1 ngày |
| 2 — Token cleanup | 1 ngày | 1 ngày | 0.5 ngày |
| 3 — 6 critical fixes | 2 ngày | 2 ngày | 1.5 ngày |
| 4 — Desktop sweep (10 module) | 6 ngày | 6 ngày | 3 ngày |
| 5 — Mobile sweep (5 module) | 3 ngày | 3 ngày | 2 ngày |
| 6 — ESLint + a11y | 1.5 ngày | 1.5 ngày | 1.5 ngày |
| 7 — QA visual | 1.5 ngày | 1.5 ngày | 1.5 ngày |
| **TỔNG** | **17.5 ngày** | **17.5 ngày** | **~11.5 ngày** |

**Khuyến nghị:**
- **2 dev song song** (1 senior frontend làm components + 1 mid làm refactor) → **~12 calendar days**
- **1 dev solo** → **~17.5 calendar days**

---

## ✅ DEFINITION OF DONE TOÀN BỘ DỰ ÁN

- [ ] 14 component nền tảng đầy đủ trong `src/components/ui/` + `src/components/mobile/`
- [ ] 0 `alert()` / `confirm()` / `prompt()` trong `src/`
- [ ] 0 hardcoded HEX color trong `src/app/` (chỉ allow trong `globals.css`)
- [ ] 0 `text-slate-*` / `bg-slate-*` / `border-slate-*` trong `src/app/`
- [ ] 0 emoji decorative trong heading / button label
- [ ] 0 `<AppLayout>` import trong mobile pages
- [ ] 0 hardcoded `/wms/api/` trong fetch
- [ ] Tất cả modal có focus trap + ESC + lock scroll
- [ ] Tất cả icon-only button có `aria-label`
- [ ] Lighthouse a11y score ≥ 90 trên 5 page mẫu
- [ ] Playwright snapshot pass cho 11 page baseline
- [ ] Tech Lead + Designer sign-off
- [ ] VPS production 4/4 instance HTTP 200
- [ ] Build time < 60s mỗi instance (không tăng so với trước refactor)
- [ ] Bundle size không tăng > 5% (nếu tăng phải có lý do — vd recharts đã được chấp nhận)

---

**Tác giả:** _OCD Designer's revenge plan._
**Ngày:** 2026-05-25
**Liên hệ:** technology.lamphongtech@gmail.com (PM) · #wms-dev (Slack) · Tech Lead (approval)

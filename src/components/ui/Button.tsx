"use client";

/**
 * UI/Button — Component nền tảng cho tất cả button trong app.
 *
 * Replace mọi inline button (~150 biến thể) hiện tại bằng component này.
 *
 * Variants:
 *   - primary    : Bg primary navy đen, chữ trắng (action chính)
 *   - secondary  : Bg secondary xám xanh, chữ trắng
 *   - ghost      : Trong suốt, text on-surface (Cancel/Hủy/secondary action)
 *   - danger     : Bg error đỏ, chữ trắng (Xóa/Hủy phiếu)
 *   - outline-primary : Border primary, text primary, bg trắng
 *   - outline-danger  : Border error, text error, bg trắng
 *
 * Sizes:
 *   - sm  : 32px height, text-xs (filter/action nhỏ)
 *   - md  : 40px height, text-sm (action thông thường)
 *   - lg  : 48px height, text-base (CTA chính của form)
 */

import React from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline-primary" | "outline-danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Material symbol name. Vd: "add", "save", "delete", "edit" */
  icon?: string;
  iconPosition?: "left" | "right";
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-container shadow-sm",
  secondary: "bg-secondary text-white hover:bg-on-secondary-container active:bg-primary",
  ghost: "bg-transparent text-on-surface-variant hover:bg-surface-low active:bg-surface-mid",
  danger: "bg-error text-white hover:bg-error/90 active:bg-error/80 shadow-sm",
  "outline-primary": "bg-white border border-primary text-primary hover:bg-primary/5",
  "outline-danger": "bg-white border border-error text-error hover:bg-error-container",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-5 text-base gap-2 rounded-lg",
};

const ICON_SIZE: Record<ButtonSize, string> = { sm: "16px", md: "18px", lg: "20px" };

export function Button({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading,
  fullWidth,
  disabled,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const baseClass = `inline-flex items-center justify-center font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/30 whitespace-nowrap ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? "w-full" : ""} ${className}`;

  const renderIcon = (name: string) => (
    <span className="material-symbols-outlined" style={{ fontSize: ICON_SIZE[size] }}>
      {name}
    </span>
  );

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={baseClass}
      {...rest}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin" style={{ fontSize: ICON_SIZE[size] }}>
          progress_activity
        </span>
      ) : icon && iconPosition === "left" ? (
        renderIcon(icon)
      ) : null}
      {children}
      {!loading && icon && iconPosition === "right" && renderIcon(icon)}
    </button>
  );
}

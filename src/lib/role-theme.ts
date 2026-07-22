/**
 * Role theme: màu sắc/gradient cho từng vai trò.
 *
 * Sử dụng:
 *   import { ROLE_THEME } from "@/lib/role-theme";
 *   const theme = ROLE_THEME[user.role];
 *   <div className={`bg-gradient-to-br ${theme.gradient}`}>...</div>
 */

export type AppRole =
  | "ADMIN"
  | "MANAGER"
  | "QUAN_LY"
  | "KE_TOAN"
  | "STAFF"
  | "THU_KHO"
  | "XE_NANG"
  | "KIEM_KE";

export const ROLE_THEME: Record<
  AppRole,
  {
    /** CSS color (cho inline style) */
    color: string;
    /** Tailwind gradient classes */
    gradient: string;
    /** Tailwind bg class cho avatar/badge */
    bg: string;
    /** Vietnamese label */
    label: string;
    /** Mobile path prefix (nếu role mobile) */
    mobilePath?: string;
  }
> = {
  ADMIN: {
    color: "var(--color-primary)",
    gradient: "from-primary to-primary-hover",
    bg: "bg-primary",
    label: "Quản trị",
  },
  MANAGER: {
    color: "var(--color-primary)",
    gradient: "from-primary to-primary-hover",
    bg: "bg-primary",
    label: "Quản lý",
  },
  QUAN_LY: {
    color: "var(--color-primary)",
    gradient: "from-primary to-primary-hover",
    bg: "bg-primary",
    label: "Quản lý",
  },
  KE_TOAN: {
    color: "var(--color-secondary)",
    gradient: "from-secondary to-on-secondary-container",
    bg: "bg-secondary",
    label: "Kế toán kho",
  },
  STAFF: {
    color: "var(--color-secondary)",
    gradient: "from-secondary to-on-secondary-container",
    bg: "bg-secondary",
    label: "Nhân viên",
  },
  THU_KHO: {
    color: "var(--color-primary)",
    gradient: "from-primary to-primary-hover",
    bg: "bg-primary",
    label: "Thủ kho",
    mobilePath: "/thukho",
  },
  XE_NANG: {
    color: "#ea580c",
    gradient: "from-[#ea580c] to-[#f97316]",
    bg: "bg-[#ea580c]",
    label: "Xe nâng",
    mobilePath: "/forklift",
  },
  KIEM_KE: {
    color: "#7c3aed",
    gradient: "from-[#7c3aed] to-[#a855f7]",
    bg: "bg-[#7c3aed]",
    label: "Người kiểm kê",
    mobilePath: "/kiemke",
  },
};

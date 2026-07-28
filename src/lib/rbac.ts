/**
 * Client-side RBAC (Role-Based Access Control)
 *
 * Ma trận quyền theo vai trò: Mỗi role có danh sách route prefix được phép truy cập.
 * Route không nằm trong danh sách → bị chặn.
 *
 * WMS-002: KHÔNG còn wildcard super-role. ADMIN/MANAGER/STAFF đã di trú sang QUAN_LY.
 * Nguồn quyền thực sự là SERVER (permissions.ts, deny-by-default); file này chỉ dùng
 * để ẩn/hiện menu phía client (UX), không phải hàng rào bảo mật.
 */

export type Role = "ADMIN" | "MANAGER" | "STAFF" | "QUAN_LY" | "KE_TOAN" | "THU_KHO" | "XE_NANG" | "KIEM_KE";

export interface Feature {
  id: string;
  name: string;
  icon: string;
  routes: string[];
}

export const FEATURE_MAP: Feature[] = [
  { id: "dashboard", name: "Dashboard", icon: "dashboard", routes: ["/", "/dashboard"] },
  { id: "master_data", name: "Dữ liệu gốc", icon: "database", routes: ["/master-data", "/product-groups", "/units", "/item-codes", "/locations", "/suppliers"] },
  { id: "inbound", name: "Phiếu nhập", icon: "input", routes: ["/inbound", "/inbound-adhoc"] },
  { id: "pallet", name: "Pallet", icon: "pallet", routes: ["/pallets"] },
  { id: "forklift", name: "Xe nâng", icon: "forklift", routes: ["/forklift"] },
  { id: "outbound", name: "Xuất kho", icon: "output", routes: ["/outbound"] },
  // UC-FK-06_TC22: lịch sử luân chuyển là báo cáo read-only — mọi vai trò xem được.
  { id: "movements", name: "Lịch sử luân chuyển", icon: "history", routes: ["/movements"] },
  { id: "inventory", name: "Tồn kho", icon: "inventory_2", routes: ["/inventory", "/inventory/adjustments"] },
  { id: "stock_count", name: "Kiểm kê", icon: "fact_check", routes: ["/stock-count"] },
  { id: "system", name: "Hệ thống", icon: "settings", routes: ["/system"] },
  { id: "thukho_mobile", name: "Thủ kho Mobile", icon: "warehouse", routes: ["/thukho"] },
  { id: "kiemke_mobile", name: "Kiểm kê Mobile", icon: "fact_check", routes: ["/kiemke"] },
];

// UC-FK-06_TC22: "movements" (Lịch sử luân chuyển) cấp cho mọi vai trò desktop —
// báo cáo read-only ai cũng xem được. Vai trò mobile (THU_KHO/XE_NANG/KIEM_KE) bị
// AppLayout chuyển hướng về app riêng nên xem lịch sử qua trang mobile của họ
// (/thukho/warehouse/movements, /forklift/history, /kiemke/history).
export const DEFAULT_ROLE_FEATURES: Record<string, string[]> = {
  QUAN_LY: ["dashboard", "master_data", "inbound", "pallet", "forklift", "outbound", "movements", "inventory", "stock_count", "system"],
  KE_TOAN: ["dashboard", "master_data", "inbound", "pallet", "outbound", "movements", "inventory", "stock_count"],
  THU_KHO: ["dashboard", "pallet", "inbound", "inventory", "thukho_mobile"],
  XE_NANG: ["dashboard", "forklift", "pallet"],
  KIEM_KE: ["dashboard", "inventory", "stock_count", "kiemke_mobile"],
};

/**
 * Lấy danh sách route prefix của một role dựa trên cấu hình lưu trong localStorage hoặc mặc định
 */
export function getRoleRoutes(role: Role | string | undefined): string[] {
  if (!role) return [];

  // WMS-002: BỎ wildcard super-role. ADMIN/MANAGER/STAFF được di trú sang QUAN_LY
  // (migration 2026-07-28). Server enforce quyền qua permissions.ts (deny-by-default);
  // client chỉ dùng ma trận dưới để ẩn/hiện menu (UX). Không còn "*" toàn quyền.

  // Thử đọc từ localStorage của Client
  if (typeof window !== "undefined") {
    try {
      const storedRoutes = localStorage.getItem("vinhgiang_wms_role_routes");
      if (storedRoutes) {
        const routesMap = JSON.parse(storedRoutes);
        if (routesMap && routesMap[role]) {
          return routesMap[role];
        }
      }
    } catch (e) {
      console.error("Lỗi khi đọc role routes từ localStorage:", e);
    }
  }

  // Fallback về cấu hình mặc định tĩnh
  const features = DEFAULT_ROLE_FEATURES[role] || [];
  const routes: string[] = [];
  
  // Luôn cho phép truy cập route cơ bản
  routes.push("/");
  
  features.forEach(featId => {
    const feat = FEATURE_MAP.find(f => f.id === featId);
    if (feat) {
      routes.push(...feat.routes);
    }
  });

  return Array.from(new Set(routes));
}

/**
 * Kiểm tra role có quyền truy cập path không
 */
export function canAccess(role: Role | string | undefined, pathname: string): boolean {
  if (!role) return false;

  // Các trang cá nhân (Hồ sơ, Đổi mật khẩu) luôn được phép truy cập đối với mọi tài khoản đã xác thực
  if (pathname === "/system/change-password" || pathname === "/system/profile") return true;

  // Chặn Kế toán truy cập trang Tốc độ luân chuyển theo TC20
  if (role === "KE_TOAN" && (pathname === "/outbound/turnover" || pathname.startsWith("/outbound/turnover/"))) {
    return false;
  }

  const routes = getRoleRoutes(role);
  if (!routes) return false;

  // Wildcard = toàn quyền
  if (routes.includes("*")) return true;

  // Auth page luôn cho phép
  if (pathname === "/auth") return true;

  // Kiểm tra prefix
  return routes.some(route => {
    if (route === "/") return pathname === "/" || pathname === "";
    return pathname === route || pathname.startsWith(route + "/");
  });
}

/**
 * Lấy danh sách sidebar routes phù hợp với role
 */
export function getVisibleRoutes(role: Role | string | undefined): string[] {
  if (!role) return [];
  const routes = getRoleRoutes(role);
  if (!routes || routes.includes("*")) return ["*"];
  return routes;
}


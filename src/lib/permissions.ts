/**
 * WVG-16 / WMS-002 — Ma trận phân quyền (SERVER-AUTHORITATIVE, deny-by-default)
 *
 * Vấn đề cũ:
 *  - RBAC chỉ ở client (src/lib/rbac.ts, cấu hình trong localStorage) → bypass được.
 *  - Super-role ADMIN/MANAGER/STAFF được wildcard "*" → vượt mọi kiểm tra.
 *  - Quyền chỉ ở mức MODULE (bật/tắt), không có action-level.
 *
 * Mô hình mới:
 *  - Quyền = (role, resource) → LEVEL ∈ {none, read, full, special}.
 *  - Mỗi API route khai báo cần (resource, action) với action ∈ {read, write, special}.
 *  - Deny-by-default: role KHÔNG có trong ma trận, hoặc level thấp hơn yêu cầu → CHẶN.
 *  - KHÔNG còn wildcard: ADMIN/MANAGER/STAFF cũng phải có grant tường minh ở đây
 *    (grant tạm mức 'special' toàn bộ — sẽ di trú sang 5 vai trò baseline ở Pha 3).
 *
 * Đây là nguồn sự thật phía server. Pha 4 sẽ cho phép chỉnh sửa & lưu ở DB;
 * hiện tại để tĩnh trong code cho ổn định và dễ test.
 */

// Tài nguyên nghiệp vụ (gộp theo vùng chức năng)
export type Resource =
  | "pallet"
  | "item_code"
  | "supplier"
  | "product_group"
  | "unit"
  | "location"
  | "inbound"
  | "outbound"
  | "inventory"
  | "movement"
  | "stock_count"
  | "user"
  | "system"
  | "audit";

// Nhóm hành động mà một route yêu cầu
export type ActionType = "read" | "write" | "special";
// read    = xem/list (GET)
// write   = tạo/sửa/xoá nghiệp vụ thường (POST/PATCH/PUT/DELETE)
// special = hành động nhạy cảm: duyệt/xác nhận/hủy/điều chỉnh tồn/mở khóa/cấu hình hệ thống

// Mức quyền một role nắm trên một resource
export type Level = "none" | "read" | "full" | "special";
// none    : không truy cập
// read    : chỉ đọc
// full    : đọc + ghi thường
// special : đọc + ghi + hành động nhạy cảm

const LEVEL_RANK: Record<Level, number> = { none: 0, read: 1, full: 2, special: 3 };

// action yêu cầu tối thiểu mức nào
const ACTION_MIN_LEVEL: Record<ActionType, Level> = {
  read: "read",
  write: "full",
  special: "special",
};

// 5 vai trò baseline (mục tiêu WMS-002)
export const BASELINE_ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"] as const;
// Vai trò legacy còn tồn tại trong DB — cấp grant tường minh (không wildcard), di trú ở Pha 3
export const LEGACY_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

/**
 * Ma trận quyền: role → resource → level. Thiếu = "none" (deny-by-default).
 *
 * LƯU Ý: mức dưới đây bám theo cấu hình feature cũ (DEFAULT_ROLE_FEATURES trong rbac.ts)
 * để KHÔNG làm gãy luồng đang chạy; sẽ tinh chỉnh theo UC baseline (WMS_VinhGiang_UseCases_v3.1)
 * ở Pha 0/4. `movement` là báo cáo read-only nên tối đa 'read' cho hầu hết vai trò.
 */
export const PERMISSION_MATRIX: Record<string, Partial<Record<Resource, Level>>> = {
  // Quản lý — vai trò quản trị nghiệp vụ cao nhất trong nhóm baseline
  QUAN_LY: {
    pallet: "special", item_code: "full", supplier: "full", product_group: "full",
    unit: "full", location: "full", inbound: "special", outbound: "special",
    inventory: "special", movement: "read", stock_count: "special",
    user: "special", system: "special", audit: "read",
  },
  // Kế toán — thiên về master data + chứng từ; tồn/kiểm kê chỉ đọc
  KE_TOAN: {
    pallet: "full", item_code: "full", supplier: "full", product_group: "full",
    unit: "full", location: "read", inbound: "full", outbound: "full",
    inventory: "read", movement: "read", stock_count: "read", audit: "read",
  },
  // Thủ kho — pallet + nhập + tồn (thao tác kho)
  THU_KHO: {
    pallet: "full", item_code: "read", inbound: "full", inventory: "read",
    movement: "read", location: "read",
  },
  // Xe nâng — di chuyển pallet + tạo movement
  XE_NANG: {
    pallet: "full", movement: "full", location: "read", inventory: "read",
  },
  // Kiểm kê — tồn kho + kiểm kê
  KIEM_KE: {
    inventory: "full", stock_count: "special", pallet: "read", movement: "read",
    item_code: "read", location: "read",
  },
};

// Legacy roles: grant tường minh mức 'special' toàn bộ resource (KHÔNG wildcard).
// Giữ cho các tài khoản ADMIN/MANAGER/STAFF hiện có không bị khóa trước khi di trú (Pha 3).
const ALL_RESOURCES: Resource[] = [
  "pallet", "item_code", "supplier", "product_group", "unit", "location",
  "inbound", "outbound", "inventory", "movement", "stock_count", "user", "system", "audit",
];
for (const legacy of LEGACY_ROLES) {
  PERMISSION_MATRIX[legacy] = Object.fromEntries(
    ALL_RESOURCES.map((r) => [r, "special" as Level])
  ) as Partial<Record<Resource, Level>>;
}

/** Mức quyền của role trên resource (deny-by-default = "none"). */
export function levelOf(role: string | undefined | null, resource: Resource): Level {
  if (!role) return "none";
  return PERMISSION_MATRIX[role]?.[resource] ?? "none";
}

/**
 * role có được phép thực hiện action trên resource không.
 * Deny-by-default: thiếu grant → false.
 */
export function can(role: string | undefined | null, resource: Resource, action: ActionType): boolean {
  const have = LEVEL_RANK[levelOf(role, resource)];
  const need = LEVEL_RANK[ACTION_MIN_LEVEL[action]];
  return have >= need;
}

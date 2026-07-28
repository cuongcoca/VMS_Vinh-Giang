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
 *  - KHÔNG còn wildcard: ADMIN/MANAGER/STAFF cũng phải có grant tường minh (Pha 3 di trú).
 *
 * Pha 2: phủ guard toàn bộ route business. Ma trận đặt "sàn đọc" cho các resource
 * nghiệp vụ (mọi baseline role đọc được) để KHÔNG làm gãy luồng đang chạy; nâng full ở
 * resource vận hành của từng vai. Tinh chỉnh theo UC baseline (v3.1) sẽ làm ở Pha 4.
 */

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
  | "forklift"
  | "dashboard"
  | "notification"
  | "attachment"
  | "scan"
  | "user"
  | "system"
  | "audit";

// Nhóm hành động mà một route yêu cầu
export type ActionType = "read" | "write" | "special";
// read    = xem/list (GET)
// write   = tạo/sửa/xoá nghiệp vụ (POST/PATCH/PUT/DELETE)
// special = hành động nhạy cảm mức quản trị (dành cho Pha 4: duyệt/điều chỉnh tồn/cấu hình)

export type Level = "none" | "read" | "full" | "special";
const LEVEL_RANK: Record<Level, number> = { none: 0, read: 1, full: 2, special: 3 };
const ACTION_MIN_LEVEL: Record<ActionType, Level> = { read: "read", write: "full", special: "special" };

export const BASELINE_ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"] as const;
export const LEGACY_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;

const ALL_RESOURCES: Resource[] = [
  "pallet", "item_code", "supplier", "product_group", "unit", "location",
  "inbound", "outbound", "inventory", "movement", "stock_count", "forklift",
  "dashboard", "notification", "attachment", "scan", "user", "system", "audit",
];

// "Sàn đọc": resource nghiệp vụ mọi baseline role đọc được (tránh gãy màn hình đọc dữ liệu).
// KHÔNG gồm user/system/audit (nhạy cảm — cấp riêng).
const READ_FLOOR: Resource[] = [
  "pallet", "item_code", "supplier", "product_group", "unit", "location",
  "inbound", "outbound", "inventory", "movement", "stock_count", "forklift",
  "dashboard", "notification", "attachment", "scan",
];

// Tạo grant cho 1 role: bắt đầu từ sàn đọc, rồi nâng theo `up`.
function grants(up: Partial<Record<Resource, Level>>): Partial<Record<Resource, Level>> {
  const m: Partial<Record<Resource, Level>> = {};
  for (const r of READ_FLOOR) m[r] = "read";
  return { ...m, ...up };
}
function allSpecial(): Partial<Record<Resource, Level>> {
  return Object.fromEntries(ALL_RESOURCES.map((r) => [r, "special" as Level]));
}

export const PERMISSION_MATRIX: Record<string, Partial<Record<Resource, Level>>> = {
  // Quản lý — toàn quyền nghiệp vụ + quản trị hệ thống
  QUAN_LY: allSpecial(),

  // Kế toán — master data + chứng từ + báo cáo
  KE_TOAN: grants({
    item_code: "full", supplier: "full", product_group: "full", unit: "full", location: "full",
    inbound: "full", outbound: "full", pallet: "full", inventory: "full", stock_count: "full",
    notification: "full", attachment: "full", scan: "full", audit: "read",
  }),

  // Thủ kho — pallet + nhập + tồn + master data (tạo mã hàng ở mobile)
  THU_KHO: grants({
    pallet: "full", inbound: "full", inventory: "full", item_code: "full",
    location: "full", product_group: "full", unit: "full", stock_count: "full",
    scan: "full", notification: "full", attachment: "full",
  }),

  // Xe nâng — di chuyển pallet + movement
  XE_NANG: grants({
    forklift: "full", pallet: "full", movement: "full",
    scan: "full", notification: "full", attachment: "full",
  }),

  // Kiểm kê — kiểm kê + tồn kho
  KIEM_KE: grants({
    stock_count: "full", inventory: "full",
    scan: "full", notification: "full", attachment: "full",
  }),
};

// Legacy roles: grant TƯỜNG MINH special toàn bộ (KHÔNG wildcard) — di trú ở Pha 3.
for (const legacy of LEGACY_ROLES) {
  PERMISSION_MATRIX[legacy] = allSpecial();
}

/** Mức quyền của role trên resource (deny-by-default = "none"). */
export function levelOf(role: string | undefined | null, resource: Resource): Level {
  if (!role) return "none";
  return PERMISSION_MATRIX[role]?.[resource] ?? "none";
}

/** role có được phép thực hiện action trên resource không. Deny-by-default. */
export function can(role: string | undefined | null, resource: Resource, action: ActionType): boolean {
  return LEVEL_RANK[levelOf(role, resource)] >= LEVEL_RANK[ACTION_MIN_LEVEL[action]];
}

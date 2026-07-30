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

// Ma trận MẶC ĐỊNH (seed/fallback). Pha 4: override lưu ở DB (systemConfig) và
// nạp vào `activeMatrix` qua ensurePermissionMatrixLoaded().
export const DEFAULT_MATRIX: Record<string, Partial<Record<Resource, Level>>> = {
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

// WVG-16 (review 2026-07-29 · gate 4): legacy ADMIN/MANAGER/STAFF sau khi di trú
// KHÔNG còn quyền — cấp grant RỖNG → deny-by-default cho MỌI resource. Trước đây để
// allSpecial() "phòng thủ" trong lúc di trú; nay di trú xong nên vô hiệu hoá hẳn để
// một tài khoản còn sót/role mặc định không thể trở thành super-admin.
for (const legacy of LEGACY_ROLES) {
  DEFAULT_MATRIX[legacy] = {};
}
// Vai trò "PENDING" (default DB mới cho user chưa gán vai) KHÔNG có trong matrix →
// deny-by-default hoàn toàn. Không cần khai báo; để đây làm mốc tài liệu.

// ─────────────────────────────────────────────────────────────────────────────
// Pha 4 — Ma trận ĐANG HIỆU LỰC: mặc định = DEFAULT_MATRIX, override lưu ở DB.
// can()/levelOf() đọc SYNC từ `activeMatrix`; ensurePermissionMatrixLoaded()
// (async, cache TTL) nạp override từ systemConfig. Gọi trong requirePermission.
// ─────────────────────────────────────────────────────────────────────────────
export const PERMISSION_CONFIG_KEY = "rbac_permission_matrix";
const LEVELS: Level[] = ["none", "read", "full", "special"];

function cloneDefault(): Record<string, Partial<Record<Resource, Level>>> {
  return JSON.parse(JSON.stringify(DEFAULT_MATRIX));
}

let activeMatrix = cloneDefault();
let loadedAt = 0;
const TTL_MS = 15_000;

// Áp override (CHỈ baseline roles; legacy giữ default allSpecial). Validate chặt.
function applyOverride(override: unknown): void {
  const m = cloneDefault();
  if (override && typeof override === "object") {
    const o = override as Record<string, Record<string, string>>;
    for (const role of BASELINE_ROLES) {
      const g = o[role];
      if (g && typeof g === "object") {
        const clean: Partial<Record<Resource, Level>> = {};
        for (const res of ALL_RESOURCES) {
          const lvl = g[res];
          if (typeof lvl === "string" && (LEVELS as string[]).includes(lvl)) {
            clean[res] = lvl as Level;
          }
        }
        m[role] = clean;
      }
    }
  }
  activeMatrix = m;
}

/** Nạp override từ DB (cache TTL). Gọi trước can() ở server (requirePermission). */
export async function ensurePermissionMatrixLoaded(): Promise<void> {
  const now = Date.now();
  if (now - loadedAt < TTL_MS) return;
  loadedAt = now; // set trước để tránh nhiều request cùng nạp
  try {
    const { prisma } = await import("./prisma");
    const cfg = await prisma.systemConfig.findUnique({ where: { key: PERMISSION_CONFIG_KEY } });
    if (cfg?.value) applyOverride(JSON.parse(cfg.value));
    else activeMatrix = cloneDefault();
  } catch (e) {
    // Lỗi DB → GIỮ ma trận hiện tại (fallback an toàn, không mở toang quyền).
    console.error("[permissions] load matrix error (giữ ma trận hiện tại):", e);
  }
}

/** Buộc nạp lại ngay (gọi sau khi PUT cập nhật ma trận). */
export async function reloadPermissionMatrix(): Promise<void> {
  loadedAt = 0;
  await ensurePermissionMatrixLoaded();
}

/**
 * WVG-34 / UC-AUTH-05 — Validate input ma trận trước khi lưu (deny một phần).
 * Trả { valid, errors, clean }: chỉ chấp nhận baseline role + resource + level hợp lệ.
 * Nếu có BẤT KỲ role/resource/level sai → valid=false (route trả 400, KHÔNG ghi một phần).
 */
export function validatePermissionMatrix(input: unknown): {
  valid: boolean;
  errors: string[];
  clean: Record<string, Partial<Record<Resource, Level>>>;
} {
  const errors: string[] = [];
  const clean: Record<string, Partial<Record<Resource, Level>>> = {};

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, errors: ["Ma trận phải là object { role: { resource: level } }."], clean };
  }

  const baseline = new Set<string>(BASELINE_ROLES);
  const resourceSet = new Set<string>(ALL_RESOURCES);
  const levelSet = new Set<string>(LEVELS);
  const obj = input as Record<string, unknown>;

  for (const role of Object.keys(obj)) {
    if (!baseline.has(role)) {
      errors.push(`Vai trò không hợp lệ: "${role}" (chỉ nhận ${BASELINE_ROLES.join(", ")}).`);
      continue;
    }
    const grants = obj[role];
    if (!grants || typeof grants !== "object" || Array.isArray(grants)) {
      errors.push(`Cấu hình vai "${role}" phải là object { resource: level }.`);
      continue;
    }
    const cleanRole: Partial<Record<Resource, Level>> = {};
    for (const [res, lvl] of Object.entries(grants as Record<string, unknown>)) {
      if (!resourceSet.has(res)) {
        errors.push(`Tài nguyên không hợp lệ ở vai "${role}": "${res}".`);
        continue;
      }
      if (typeof lvl !== "string" || !levelSet.has(lvl)) {
        errors.push(`Mức quyền không hợp lệ ở "${role}.${res}": "${String(lvl)}" (chỉ nhận ${LEVELS.join(", ")}).`);
        continue;
      }
      cleanRole[res as Resource] = lvl as Level;
    }
    clean[role] = cleanRole;
  }

  // Bảo đảm đủ 5 vai baseline (thiếu → coi như deny toàn bộ cho vai đó).
  for (const role of BASELINE_ROLES) {
    if (!(role in clean)) clean[role] = {};
  }

  return { valid: errors.length === 0, errors, clean };
}

/** Dữ liệu cho UI cấu hình: ma trận hiệu lực (baseline) + metadata. */
export function getPermissionMatrixForAdmin() {
  const matrix: Record<string, Partial<Record<Resource, Level>>> = {};
  for (const role of BASELINE_ROLES) matrix[role] = activeMatrix[role] ?? {};
  return {
    roles: [...BASELINE_ROLES],
    resources: [...ALL_RESOURCES],
    levels: [...LEVELS],
    matrix,
    defaults: Object.fromEntries(BASELINE_ROLES.map((r) => [r, DEFAULT_MATRIX[r] ?? {}])),
  };
}

/** Mức quyền của role trên resource (deny-by-default = "none"). */
export function levelOf(role: string | undefined | null, resource: Resource): Level {
  if (!role) return "none";
  return activeMatrix[role]?.[resource] ?? "none";
}

/** role có được phép thực hiện action trên resource không. Deny-by-default. */
export function can(role: string | undefined | null, resource: Resource, action: ActionType): boolean {
  return LEVEL_RANK[levelOf(role, resource)] >= LEVEL_RANK[ACTION_MIN_LEVEL[action]];
}

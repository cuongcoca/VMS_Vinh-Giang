/**
 * WVG-16 / WMS-002 — Unit test ma trận phân quyền (deny-by-default).
 * Chạy: npx tsx scripts/test-permissions.ts
 *
 * Test thuần logic (không cần server/DB), chứng minh:
 *  - Thiếu grant / role lạ / không role  → CHẶN (deny-by-default).
 *  - Phân tầng read < full(write) < special.
 *  - Legacy role được grant TƯỜNG MINH (không còn wildcard "*").
 */
import assert from "node:assert";
import { can, levelOf } from "../src/lib/permissions";

let passed = 0;
function check(desc: string, actual: unknown, expected: unknown) {
  assert.strictEqual(actual, expected, `${desc} — kỳ vọng ${expected}, nhận ${actual}`);
  passed++;
  console.log(`  ✓ ${desc}`);
}

console.log("WMS-002 permission matrix — unit tests\n");

// Deny-by-default
check("role undefined -> pallet.read = false", can(undefined, "pallet", "read"), false);
check("role lạ -> pallet.read = false (deny-by-default)", can("HACKER", "pallet", "read"), false);
// system/user KHÔNG ở sàn đọc → deny-by-default cho vai không phải quản lý
check("KIEM_KE system.read = false (deny-by-default)", can("KIEM_KE", "system", "read"), false);
check("THU_KHO user.write = false (chỉ QUAN_LY)", can("THU_KHO", "user", "write"), false);
check("QUAN_LY system.special = true", can("QUAN_LY", "system", "special"), true);
// sàn đọc: mọi baseline role đọc được resource nghiệp vụ (tránh gãy màn đọc)
check("KIEM_KE supplier.read = true (sàn đọc)", can("KIEM_KE", "supplier", "read"), true);
check("KIEM_KE supplier.write = false (chỉ đọc)", can("KIEM_KE", "supplier", "write"), false);
// nâng theo vai vận hành
check("XE_NANG forklift.write = true", can("XE_NANG", "forklift", "write"), true);
check("KE_TOAN forklift.write = false (sàn đọc)", can("KE_TOAN", "forklift", "write"), false);

// Tầng read
check("KIEM_KE pallet.read = true", can("KIEM_KE", "pallet", "read"), true);
check("KIEM_KE pallet.write = false (chỉ read)", can("KIEM_KE", "pallet", "write"), false);

// Tầng write (full)
check("THU_KHO pallet.write = true", can("THU_KHO", "pallet", "write"), true);
check("THU_KHO pallet.special = false (full chưa special)", can("THU_KHO", "pallet", "special"), false);

// Tầng special
check("QUAN_LY pallet.special = true", can("QUAN_LY", "pallet", "special"), true);
check("KE_TOAN pallet.special = false (full)", can("KE_TOAN", "pallet", "special"), false);

// Legacy grant tường minh (KHÔNG wildcard)
check("ADMIN pallet.special = true (grant tường minh)", can("ADMIN", "pallet", "special"), true);
check("ADMIN system.special = true", can("ADMIN", "system", "special"), true);

// levelOf
check("levelOf KIEM_KE pallet = read", levelOf("KIEM_KE", "pallet"), "read");
check("levelOf role lạ pallet = none", levelOf("HACKER", "pallet"), "none");

// ── Quét hệ thống theo vai ──────────────────────────────────────────────────
console.log("\n-- Sàn đọc: mọi baseline role đọc được resource nghiệp vụ --");
for (const role of ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"] as const) {
  check(`${role} pallet.read = true`, can(role, "pallet", "read"), true);
  check(`${role} inbound.read = true`, can(role, "inbound", "read"), true);
}
console.log("-- Resource quản trị: CHỈ QUAN_LY (+legacy) --");
for (const role of ["KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"] as const) {
  check(`${role} system.read = false`, can(role, "system", "read"), false);
  check(`${role} user.read = false`, can(role, "user", "read"), false);
}
check("QUAN_LY user.write = true", can("QUAN_LY", "user", "write"), true);
check("QUAN_LY system.special = true", can("QUAN_LY", "system", "special"), true);

console.log("-- Vai vận hành ghi được resource của mình --");
check("THU_KHO inbound.write = true", can("THU_KHO", "inbound", "write"), true);
check("THU_KHO inventory.write = true", can("THU_KHO", "inventory", "write"), true);
check("KE_TOAN item_code.write = true", can("KE_TOAN", "item_code", "write"), true);
check("KIEM_KE stock_count.write = true", can("KIEM_KE", "stock_count", "write"), true);
check("XE_NANG movement.write = true", can("XE_NANG", "movement", "write"), true);

console.log("-- Deny ghi resource không phận sự --");
check("KIEM_KE inbound.write = false", can("KIEM_KE", "inbound", "write"), false);
check("XE_NANG item_code.write = false", can("XE_NANG", "item_code", "write"), false);
check("KE_TOAN forklift.write = false", can("KE_TOAN", "forklift", "write"), false);

console.log("-- Legacy (di trú) vẫn full phòng thủ (không wildcard) --");
for (const legacy of ["ADMIN", "MANAGER", "STAFF"] as const) {
  check(`${legacy} pallet.special = true`, can(legacy, "pallet", "special"), true);
  check(`${legacy} user.write = true`, can(legacy, "user", "write"), true);
}

console.log(`\n✅ ${passed} assertions passed`);

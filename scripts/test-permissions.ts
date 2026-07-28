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
check("KIEM_KE không có grant supplier -> read = false", can("KIEM_KE", "supplier", "read"), false);

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

console.log(`\n✅ ${passed} assertions passed`);

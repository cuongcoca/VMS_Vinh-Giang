/**
 * WVG-63 / WMS-003 — Unit test guard: chặn tài khoản lọt vào Mã hàng.
 * Chạy: npx tsx scripts/test-item-code-guard.ts
 */
import assert from "node:assert";
import {
  looksLikeAccount,
  buildUserIdentitySet,
  matchesUserAccount,
  assertNotAccount,
} from "../src/lib/item-code-guard";

let passed = 0;
function ok(desc: string, cond: boolean) {
  assert.ok(cond, desc);
  passed++;
  console.log("  ✓", desc);
}

console.log("item-code-guard — unit tests\n");

// --- Lớp TĨNH: looksLikeAccount ---
console.log("looksLikeAccount:");
ok("email → bị bắt", looksLikeAccount("bay@gmail.com") !== null);
ok("email hoa/thường → bị bắt", looksLikeAccount("Admin@VinhGiang.VN") !== null);
ok("chuỗi có @ chưa đủ domain → bị bắt", looksLikeAccount("driver@local") !== null);
ok("SĐT di động VN 10 số → bị bắt", looksLikeAccount("0971140828") !== null);
ok("SĐT có +84 → bị bắt", looksLikeAccount("+84971140828") !== null);
ok("SĐT có khoảng trắng → bị bắt", looksLikeAccount("0971 140 828") !== null);

ok("mã hàng 8 số → hợp lệ", looksLikeAccount("68586700") === null);
ok("mã TEMP-* → hợp lệ", looksLikeAccount("TEMP-20260728-AB12") === null);
ok("tên SP có dấu → hợp lệ", looksLikeAccount("824KNORR Tương Ớt Cay Đậm 450g/12") === null);
ok("SĐT cố định 0123456789 KHÔNG dính lớp tĩnh", looksLikeAccount("0123456789") === null);
ok("rỗng → hợp lệ (không xét)", looksLikeAccount("") === null && looksLikeAccount(null) === null);

// --- Lớp ĐỐI CHIẾU DB ---
console.log("\nmatchesUserAccount / buildUserIdentitySet:");
const idSet = buildUserIdentitySet([
  { email: "bay@gmail.com", phone: "0839672843", username: null, full_name: "Vi Văn Bảy" },
  { email: null, phone: "0123456789", username: null, full_name: "Kiểm Kê" },
  { email: "admin1@gmail.com", phone: null, username: "admin1", full_name: "admin1" },
]);
ok("trùng full_name → bắt", matchesUserAccount("Vi Văn Bảy", idSet));
ok("trùng full_name khác hoa/thường → bắt", matchesUserAccount("vi văn bảy", idSet));
ok("trùng SĐT cố định (lớp tĩnh bỏ sót) → bắt qua DB", matchesUserAccount("0123456789", idSet));
ok("trùng username → bắt", matchesUserAccount("admin1", idSet));
ok("mã hàng thật → KHÔNG bắt", !matchesUserAccount("68586700", idSet));
ok("tên SP → KHÔNG bắt", !matchesUserAccount("Omo Matic 4.2kg", idSet));

// --- Hàm tổng assertNotAccount (dùng trong route) ---
console.log("\nassertNotAccount (kèm nhãn):");
ok("email → lỗi có nhãn 'Mã hàng'",
   (assertNotAccount("bay@gmail.com", idSet, "Mã hàng") || "").startsWith("Mã hàng:"));
ok("tên trùng account → lỗi có nhãn 'Tên hàng'",
   (assertNotAccount("Vi Văn Bảy", idSet, "Tên hàng") || "").startsWith("Tên hàng:"));
ok("SĐT cố định trùng account → lỗi (qua DB)",
   assertNotAccount("0123456789", idSet, "Mã hàng") !== null);
ok("mã hàng hợp lệ → null", assertNotAccount("68586700", idSet, "Mã hàng") === null);
ok("tên SP hợp lệ → null", assertNotAccount("824KNORR Tương Ớt 450g/12", idSet, "Tên hàng") === null);

console.log(`\n✅ ${passed}/${passed} assertions passed`);

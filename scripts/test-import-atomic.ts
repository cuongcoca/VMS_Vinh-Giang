// WVG-63 — Unit test pre-validate import (gom hết lỗi, chặn account, dedupe mã tạm).
// Chạy: npx tsx scripts/test-import-atomic.ts
import { prevalidateImportLines } from "../src/lib/import-item-validate";
import { buildUserIdentitySet } from "../src/lib/item-code-guard";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`, extra ?? ""); }
}
const has = (arr: string[], sub: string) => arr.some((e) => e.includes(sub));

// Tập danh tính tài khoản mẫu (để chặn account lọt thành mã hàng).
const users = buildUserIdentitySet([
  { email: "driver@vms.vn", phone: "0987654327", username: "kho1", full_name: "Nguyễn Văn A" },
]);

console.log("WVG-63 prevalidateImportLines");

// 1) Batch SẠCH — 2 mã tạm + 1 dòng mapped → 0 lỗi, plan đúng, dedupe.
{
  const r = prevalidateImportLines([
    { create_temp_code: true, excel_code: "VG-NM-500", excel_name: "NM 500ml", qty_expected: 10 },
    { create_temp_code: true, excel_code: "VG-NM-500", excel_name: "NM 500ml", qty_expected: 5 }, // trùng code
    { item_code_id: "id-abc", qty_expected: 3 },
  ], users);
  ok("batch sạch → 0 lỗi", r.errors.length === 0, r.errors);
  ok("plan có 3 dòng", r.plan.length === 3);
  ok("tempCodes dedupe = 1 (VG-NM-500)", r.tempCodes.length === 1 && r.tempCodes[0] === "VG-NM-500", r.tempCodes);
  ok("dòng mapped giữ item_code_id", r.plan.some((p) => p.kind === "mapped" && p.item_code_id === "id-abc"));
}

// 2) Dòng ACCOUNT (email/SĐT/tên trùng) → bị chặn, KHÔNG vào plan.
{
  const r = prevalidateImportLines([
    { create_temp_code: true, excel_code: "driver@vms.vn", excel_name: "x", qty_expected: 1 }, // email
    { create_temp_code: true, excel_code: "0987654327", excel_name: "y", qty_expected: 1 },     // SĐT trùng account
    { create_temp_code: true, excel_code: "MH-01", excel_name: "Nguyễn Văn A", qty_expected: 1 }, // tên trùng account
  ], users);
  ok("email bị chặn", has(r.errors, "Dòng 1"));
  ok("SĐT trùng account bị chặn", has(r.errors, "Dòng 2"));
  ok("tên trùng account bị chặn", has(r.errors, "Dòng 3"));
  ok("KHÔNG dòng account nào vào plan", r.plan.length === 0, r.plan);
}

// 3) Gom HẾT lỗi trong 1 lần (nhiều dòng lỗi khác loại).
{
  const r = prevalidateImportLines([
    { create_temp_code: true, excel_code: "MH-1", excel_name: "A", qty_expected: 0 },      // qty<=0
    { create_temp_code: true, excel_code: "MH@2", excel_name: "B", qty_expected: 2 },      // ký tự lạ '@'
    { create_temp_code: true, excel_code: "", excel_name: "C", qty_expected: 2 },          // thiếu excel_code
    { qty_expected: 2 },                                                                    // thiếu mã hoàn toàn
  ], users);
  ok("gom >= 4 lỗi", r.errors.length >= 4, r.errors.length);
  ok("có lỗi qty<=0", has(r.errors, "Số lượng"));
  ok("có lỗi ký tự lạ", has(r.errors, "ký tự không hợp lệ"));
  ok("có lỗi thiếu excel_code", has(r.errors, "Cần excel_code"));
  ok("có lỗi thiếu mã", has(r.errors, "Thiếu mã hàng"));
}

// 4) Mã hàng THẬT không bị nhầm là account (tránh false-positive).
{
  const r = prevalidateImportLines([
    { create_temp_code: true, excel_code: "12345678", excel_name: "Sữa 180ml", qty_expected: 1 }, // 8 số
    { create_temp_code: true, excel_code: "TEMP-DA-5L", excel_name: "Dầu ăn 5L có dấu", qty_expected: 1 },
  ], users);
  ok("mã 8 số + TEMP-* KHÔNG bị chặn", r.errors.length === 0, r.errors);
  ok("cả 2 vào plan", r.plan.length === 2);
}

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

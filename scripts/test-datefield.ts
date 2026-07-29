/**
 * WVG-97 — Unit test validate ô nhập ngày gõ tay (DateField).
 * Chạy: npx tsx scripts/test-datefield.ts
 */
import assert from "node:assert";
import { formatTyping, parseDisplay } from "../src/components/mobile/DateField";

let passed = 0;
function ok(desc: string, cond: boolean) {
  assert.ok(cond, desc);
  passed++;
  console.log("  ✓", desc);
}

console.log("DateField validate — unit tests\n");

// --- formatTyping: tự chèn "/" + kẹp ngày/tháng ---
console.log("formatTyping (tự chèn / + kẹp):");
ok('"15082027" → "15/08/2027"', formatTyping("15082027") === "15/08/2027");
ok('"1508" → "15/08"', formatTyping("1508") === "15/08");
ok('chỉ giữ số: "15/08/2027" → "15/08/2027"', formatTyping("15/08/2027") === "15/08/2027");
ok('kẹp ngày > 31: "99" → "31"', formatTyping("99") === "31");
ok('kẹp tháng > 12: "1545" → "15/12"', formatTyping("1545") === "15/12");
ok('không kẹp khi mới 1 số ngày: "3" → "3"', formatTyping("3") === "3");
ok('cắt tối đa 8 số: "150820271234" → "15/08/2027"', formatTyping("150820271234") === "15/08/2027");

// --- parseDisplay: ngày thật, mọi năm ---
console.log("\nparseDisplay (ngày thật, KHÔNG giới hạn năm):");
ok('"15/08/2027" → "2027-08-15"', parseDisplay("15/08/2027") === "2027-08-15");
ok('"31/02/2027" → null (không tồn tại)', parseDisplay("31/02/2027") === null);
ok('"31/04/2027" → null (tháng 4 chỉ 30 ngày)', parseDisplay("31/04/2027") === null);
ok('"29/02/2024" → hợp lệ (năm nhuận)', parseDisplay("29/02/2024") === "2024-02-29");
ok('"29/02/2023" → null (năm thường)', parseDisplay("29/02/2023") === null);
ok('"00/01/2027" → null (ngày 0)', parseDisplay("00/01/2027") === null);
ok('"15/13/2027" → null (tháng 13)', parseDisplay("15/13/2027") === null);
ok('năm bất kỳ: "01/01/1990" → "1990-01-01"', parseDisplay("01/01/1990") === "1990-01-01");
ok('năm bất kỳ: "31/12/2099" → "2099-12-31"', parseDisplay("31/12/2099") === "2099-12-31");
ok('gõ dở "15/08/20" → null', parseDisplay("15/08/20") === null);
ok('sai định dạng "15/8/2027" (1 số tháng) → null', parseDisplay("15/8/2027") === null);

console.log(`\n✅ ${passed}/${passed} assertions passed`);

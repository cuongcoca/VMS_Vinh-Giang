/**
 * WVG-97 / WMS-008 — Unit test nguồn truy vết pallet.
 * Chạy: npx tsx scripts/test-pallet-source.ts
 */
import assert from "node:assert";
import {
  deriveCreateSource,
  isValidSource,
  PALLET_SOURCE_LABEL,
} from "../src/lib/pallet-source";

let passed = 0;
function ok(desc: string, cond: boolean) {
  assert.ok(cond, desc);
  passed++;
  console.log("  ✓", desc);
}

console.log("pallet-source — unit tests\n");

// --- deriveCreateSource ---
console.log("deriveCreateSource (POST /api/pallets):");
const a = deriveCreateSource({ inbound_request_id: "phn-1" });
ok("có PHN → INBOUND + source_id", a.source_type === "INBOUND" && a.source_id === "phn-1");
const b = deriveCreateSource({ inbound_temp_id: "tmp-1" });
ok("có phiếu tạm → INBOUND_TEMP", b.source_type === "INBOUND_TEMP" && b.source_id === "tmp-1");
const c = deriveCreateSource({ inbound_request_id: "phn-1", inbound_temp_id: "tmp-1" });
ok("có cả 2 → ưu tiên INBOUND", c.source_type === "INBOUND" && c.source_id === "phn-1");
const d = deriveCreateSource({});
ok("không link → EXCEPTION + có lý do", d.source_type === "EXCEPTION" && !!d.source_note && d.source_id === null);

// --- isValidSource (khớp CHECK constraint DB) ---
console.log("\nisValidSource (khớp ràng buộc DB):");
ok("INBOUND có source_id → hợp lệ", isValidSource({ source_type: "INBOUND", source_id: "x", source_note: null }));
ok("INBOUND thiếu source_id → KHÔNG hợp lệ", !isValidSource({ source_type: "INBOUND", source_id: null, source_note: null }));
ok("SPLIT có source_id → hợp lệ", isValidSource({ source_type: "SPLIT", source_id: "parent", source_note: null }));
ok("ADJUSTMENT có source_id → hợp lệ", isValidSource({ source_type: "ADJUSTMENT", source_id: "v", source_note: null }));
ok("EXCEPTION có note → hợp lệ", isValidSource({ source_type: "EXCEPTION", source_id: null, source_note: "lý do" }));
ok("EXCEPTION thiếu note → KHÔNG hợp lệ", !isValidSource({ source_type: "EXCEPTION", source_id: null, source_note: null }));
ok("EXCEPTION note rỗng → KHÔNG hợp lệ", !isValidSource({ source_type: "EXCEPTION", source_id: null, source_note: "  " }));

// --- labels ---
console.log("\nnhãn hiển thị:");
ok("đủ 5 nhãn", Object.keys(PALLET_SOURCE_LABEL).length === 5);
ok("INBOUND có nhãn tiếng Việt", PALLET_SOURCE_LABEL.INBOUND.includes("Phiếu nhập"));

console.log(`\n✅ ${passed}/${passed} assertions passed`);

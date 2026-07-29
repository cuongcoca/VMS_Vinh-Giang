/**
 * WVG-131 / WMS-005 — Unit test tiến trình phiếu nhập (6 status → bước liên tiếp).
 * Chạy: npx tsx scripts/test-inbound-steps.ts
 */
import assert from "node:assert";
import {
  inboundStep,
  INBOUND_STATUS_STEP,
  INBOUND_TOTAL_STEPS,
} from "../src/lib/inbound-status";

let passed = 0;
function ok(desc: string, cond: boolean) {
  assert.ok(cond, desc);
  passed++;
  console.log("  ✓", desc);
}

console.log("inbound-status — unit tests\n");

// Tổng bước
ok("INBOUND_TOTAL_STEPS = 5", INBOUND_TOTAL_STEPS === 5);

// Phủ đủ 6 status
const forward = ["DRAFT", "PENDING", "RECEIVING", "RECONCILING", "COMPLETED"] as const;
forward.forEach((s, i) => {
  ok(`${s} → bước ${i + 1}`, inboundStep(s).step === i + 1);
});
ok("CANCELLED → bước 0 (tách khỏi tiến trình)", inboundStep("CANCELLED").step === 0);

// LIÊN TIẾP, không hở: 5 bước tiến = đúng tập {1,2,3,4,5}
const steps = forward.map((s) => inboundStep(s).step).sort((a, b) => a - b);
ok("5 bước tiến liên tiếp 1..5 (không nhảy 1→2→4→7→8)", JSON.stringify(steps) === "[1,2,3,4,5]");

// Không status nào vượt tổng bước
ok("mọi step ≤ tổng bước", Object.values(INBOUND_STATUS_STEP).every((m) => m.step <= INBOUND_TOTAL_STEPS));

// Status lạ → step 0 + giữ nhãn
ok("status lạ → step 0", inboundStep("FOO").step === 0);

// Có nhãn tiếng Việt
ok("COMPLETED có nhãn 'Đã chốt'", inboundStep("COMPLETED").label === "Đã chốt");

console.log(`\n✅ ${passed}/${passed} assertions passed`);

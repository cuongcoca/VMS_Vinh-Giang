// WVG-179 — Unit test cho buildMovementSnapshot (hàm thuần, không cần DB).
// Chạy: npx tsx scripts/test-movement-snapshot.ts
import { buildMovementSnapshot } from "../src/lib/movement-snapshot";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`, extra ?? "");
  }
}

console.log("WVG-179 buildMovementSnapshot");

// 1) Pallet nhiều dòng → 1 movement / dòng, đủ item/lot/qty/HSD.
{
  const exp = new Date("2027-01-31T00:00:00Z");
  const rows = buildMovementSnapshot(
    {
      pallet_id: "P1",
      movement_type: "RELOCATE",
      from_location_id: "L-A",
      to_location_id: "L-B",
      performed_by: "U1",
      reason: "dời kho",
    },
    [
      { item_code_id: "IC1", lot: "LOT1", expiry_date: exp, qty_box: 5, qty_unit: 60 },
      { item_code_id: "IC2", lot: null, expiry_date: null, qty_box: 3 },
    ]
  );
  check("2 dòng → 2 movement", rows.length === 2, rows.length);
  check("dòng 1 giữ item_code_id", rows[0].item_code_id === "IC1");
  check("dòng 1 giữ lot", rows[0].lot === "LOT1");
  check("dòng 1 giữ expiry_date (snapshot)", rows[0].expiry_date === exp);
  check("dòng 1 giữ qty_box", rows[0].qty_box === 5);
  check("dòng 1 giữ qty_unit", rows[0].qty_unit === 60);
  check("dòng 2 item_code_id", rows[1].item_code_id === "IC2");
  check("dòng 2 lot null → null", rows[1].lot === null);
  check("dòng 2 qty_unit thiếu → null", rows[1].qty_unit === null);
  check("mọi dòng cùng from_location", rows.every((r) => r.from_location_id === "L-A"));
  check("mọi dòng cùng to_location", rows.every((r) => r.to_location_id === "L-B"));
  check("mọi dòng cùng movement_type", rows.every((r) => r.movement_type === "RELOCATE"));
  check("mọi dòng cùng performed_by", rows.every((r) => r.performed_by === "U1"));
  check("mọi dòng cùng reason", rows.every((r) => r.reason === "dời kho"));
}

// 2) Pallet rỗng → 1 movement mức-pallet, item/qty = null (không mất sự kiện).
{
  const rows = buildMovementSnapshot(
    { pallet_id: "P2", movement_type: "STAGE_OUT", from_location_id: "L-A", to_location_id: "L-S", performed_by: "U2", mode: "FULL" },
    []
  );
  check("pallet rỗng → 1 movement", rows.length === 1, rows.length);
  check("rỗng: item_code_id null", rows[0].item_code_id === null);
  check("rỗng: qty_box null", rows[0].qty_box === null);
  check("rỗng: qty_unit null", rows[0].qty_unit === null);
  check("rỗng: vẫn giữ mode", rows[0].mode === "FULL");
  check("rỗng: vẫn giữ from/to", rows[0].from_location_id === "L-A" && rows[0].to_location_id === "L-S");
}

// 3) Field ngữ cảnh mặc định null khi không truyền.
{
  const rows = buildMovementSnapshot(
    { pallet_id: "P3", movement_type: "PUT_AWAY" },
    [{ item_code_id: "IC9", qty_box: 1 }]
  );
  check("from mặc định null", rows[0].from_location_id === null);
  check("to mặc định null", rows[0].to_location_id === null);
  check("reason mặc định null", rows[0].reason === null);
  check("reason_code mặc định null", rows[0].reason_code === null);
  check("mode mặc định null", rows[0].mode === null);
  check("audit_log_id mặc định null", rows[0].audit_log_id === null);
  check("performed_by mặc định null", rows[0].performed_by === null);
  check("lot mặc định null", rows[0].lot === null);
  check("expiry_date mặc định null", rows[0].expiry_date === null);
}

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

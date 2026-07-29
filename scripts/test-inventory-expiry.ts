// WVG-239 — Unit test chính sách hết hạn (hàm thuần, không cần DB).
// Chạy: npx tsx scripts/test-inventory-expiry.ts
import {
  expiryCutoff,
  isExpired,
  expiredLineWhere,
  availableLineWhere,
} from "../src/lib/inventory-expiry";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}`, extra ?? ""); }
}

console.log("WVG-239 inventory-expiry policy");

// Mốc tham chiếu: 10:00 sáng 29/07/2026 giờ VN (03:00 UTC).
const asOf = new Date("2026-07-29T03:00:00Z");

// 1) Cutoff = nửa đêm NGÀY VN (UTC-midnight).
{
  const c = expiryCutoff(asOf);
  check("cutoff = 2026-07-29 UTC-midnight", c.toISOString() === "2026-07-29T00:00:00.000Z", c.toISOString());
}

// 2) isExpired quanh mốc hôm nay.
{
  check("HSD hôm qua (28/07) → hết hạn", isExpired(new Date("2026-07-28T00:00:00Z"), asOf));
  check("HSD hôm nay (29/07) → CÒN hạn", !isExpired(new Date("2026-07-29T00:00:00Z"), asOf));
  check("HSD ngày mai (30/07) → CÒN hạn", !isExpired(new Date("2026-07-30T00:00:00Z"), asOf));
  check("HSD xa (2027) → còn hạn", !isExpired(new Date("2027-01-01T00:00:00Z"), asOf));
  check("HSD null → không chặn", !isExpired(null, asOf));
  check("HSD undefined → không chặn", !isExpired(undefined, asOf));
  check("HSD chuỗi ISO hợp lệ hôm qua → hết hạn", isExpired("2026-07-28", asOf));
  check("HSD chuỗi rác → không chặn (an toàn)", !isExpired("not-a-date", asOf));
}

// 3) Biên GMT+7: 17:30 UTC ngày 28 = 00:30 VN ngày 29 → cutoff phải là ngày 29.
{
  const nearMidnight = new Date("2026-07-28T17:30:00Z"); // = 29/07 00:30 giờ VN
  const c = expiryCutoff(nearMidnight);
  check("biên nửa đêm VN: cutoff = 29/07 (không phải 28/07)", c.toISOString() === "2026-07-29T00:00:00.000Z", c.toISOString());
  check("biên: HSD 28/07 → hết hạn theo ngày VN", isExpired(new Date("2026-07-28T00:00:00Z"), nearMidnight));
}

// 4) Mảnh Prisma where.
{
  const cutoff = expiryCutoff(asOf);
  const exp = expiredLineWhere(cutoff) as { expiry_date: { not: null; lt: Date } };
  check("expiredLineWhere: not null", exp.expiry_date.not === null);
  check("expiredLineWhere: lt = cutoff", exp.expiry_date.lt.getTime() === cutoff.getTime());

  const avail = availableLineWhere(cutoff) as { OR: Array<Record<string, unknown>> };
  check("availableLineWhere: OR có 2 nhánh", Array.isArray(avail.OR) && avail.OR.length === 2);
  check("availableLineWhere: nhánh null", JSON.stringify(avail.OR[0]) === JSON.stringify({ expiry_date: null }));
  const gte = avail.OR[1] as { expiry_date: { gte: Date } };
  check("availableLineWhere: nhánh gte = cutoff", gte.expiry_date.gte.getTime() === cutoff.getTime());
}

console.log(`\nKết quả: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

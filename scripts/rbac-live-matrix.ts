/**
 * WVG-16 / WMS-002 — Bằng chứng RBAC LIVE (negative + positive) cho 5 vai trò.
 *
 * Gọi API thật qua HTTP với token của TỪNG vai trò + trường hợp KHÔNG token, đối
 * chiếu status với ma trận `can()` (deny-by-default). Chứng minh backend chặn thật
 * sự (không chỉ ẩn menu). Guard dùng role trong DB → cần user thật mỗi vai.
 *
 * CHẠY TRÊN SERVER (có .env: JWT_SECRET + DATABASE_URL, app chạy localhost):
 *   cd /var/www/wms-vinhgiang && npx tsx scripts/rbac-live-matrix.ts
 *   (mặc định base = http://localhost:4200/wms — đổi bằng: BASE=... npx tsx ...)
 *
 * Quy ước kiểm chứng (test GUARD, không test nghiệp vụ):
 *   - Không token           → kỳ vọng 401.
 *   - Có quyền (can=true)   → PASS nếu status ∉ {401,403} (qua được cửa quyền; 400 do body rỗng vẫn PASS).
 *   - Không quyền (can=false)→ kỳ vọng 403.
 */
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { can, type Resource, type ActionType } from "../src/lib/permissions";
import { prisma } from "../src/lib/prisma"; // client đã cấu hình adapter PrismaPg

// nạp JWT_SECRET/BASE từ .env nếu chưa có trong env (DATABASE_URL nên export ở shell
// TRƯỚC khi chạy để client prisma nhận được lúc import).
try {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch { /* .env optional nếu env đã set */ }

const SECRET = process.env.JWT_SECRET as string;
const BASE = process.env.BASE || "http://localhost:4200/wms";

const ROLES = ["QUAN_LY", "KE_TOAN", "THU_KHO", "XE_NANG", "KIEM_KE"] as const;

type Case = { label: string; path: string; method: string; resource: Resource; action: ActionType };
// LƯU Ý side-effect: chỉ dùng endpoint KHÔNG tạo/sửa dữ liệu.
//  - write pallet: DELETE với UUID GIẢ → qua cửa quyền rồi 404 (không xoá gì thật).
//  - write forklift: POST put-away body rỗng → qua cửa quyền rồi 400 (validation).
// (KHÔNG dùng POST /api/pallets vì body rỗng vẫn TẠO pallet — sinh rác.)
const FAKE_ID = "00000000-0000-0000-0000-000000000000";
const CASES: Case[] = [
  { label: "GET  pallets",           path: "/api/pallets",           method: "GET",    resource: "pallet",    action: "read"  },
  { label: "DEL  pallets/{fake}",    path: `/api/pallets/${FAKE_ID}`,method: "DELETE", resource: "pallet",    action: "write" },
  { label: "GET  inventory/by-item", path: "/api/inventory/by-item", method: "GET",    resource: "inventory", action: "read"  },
  { label: "GET  movements",         path: "/api/movements",         method: "GET",    resource: "movement",  action: "read"  },
  { label: "GET  users (admin)",     path: "/api/users",             method: "GET",    resource: "user",      action: "read"  },
  { label: "POST forklift/put-away", path: "/api/forklift/put-away", method: "POST",   resource: "forklift",  action: "write" },
];

function tok(u: { id: string; role: string }) {
  return jwt.sign({ userId: u.id, role: u.role }, SECRET, { algorithm: "HS256", expiresIn: "1h" });
}
async function hit(path: string, method: string, headers: Record<string, string>) {
  const init: RequestInit = { method, headers };
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    (init.headers as Record<string,string>)["Content-Type"] = "application/json"; init.body = "{}";
  }
  try { const r = await fetch(BASE + path, init); return r.status; } catch { return -1; }
}

(async () => {
  if (!SECRET) { console.error("Thiếu JWT_SECRET"); process.exit(2); }
  console.log(`WVG-16 RBAC live matrix @ ${BASE}\n`);

  // 1 user active mỗi vai
  const users: Record<string, { id: string; role: string } | null> = {};
  for (const r of ROLES) {
    users[r] = await prisma.user.findFirst({ where: { role: r as never, is_locked: false }, select: { id: true, role: true } });
  }
  const missing = ROLES.filter((r) => !users[r]);
  if (missing.length) console.log(`⚠ Thiếu user cho vai: ${missing.join(", ")} — bỏ qua các vai này.\n`);

  let pass = 0, fail = 0;
  const fails: string[] = [];
  const pad = (s: string, n: number) => (s + " ".repeat(n)).slice(0, n);

  // Header
  console.log(pad("Endpoint", 26) + ROLES.map((r) => pad(r, 9)).join("") + pad("no-tok", 8));
  console.log("-".repeat(26 + 9 * ROLES.length + 8));

  for (const c of CASES) {
    let row = pad(c.label, 26);
    for (const r of ROLES) {
      const u = users[r];
      if (!u) { row += pad("—", 9); continue; }
      const status = await hit(c.path, c.method, { Authorization: `Bearer ${tok(u)}` });
      const allowed = can(r, c.resource, c.action);
      const ok = allowed ? (status !== 401 && status !== 403) : (status === 403);
      if (ok) pass++; else { fail++; fails.push(`${c.label} · ${r}: status ${status}, kỳ vọng ${allowed ? "ALLOW(∉401/403)" : "403"}`); }
      row += pad(`${status}${ok ? "✓" : "✗"}${allowed ? "" : "·D"}`, 9);
    }
    // no-token → 401
    const st = await hit(c.path, c.method, {});
    const okNo = st === 401;
    if (okNo) pass++; else { fail++; fails.push(`${c.label} · no-token: status ${st}, kỳ vọng 401`); }
    row += pad(`${st}${okNo ? "✓" : "✗"}`, 8);
    console.log(row);
  }

  // Legacy neutralized (chỉ đúng SAU khi deploy bản fix gate-4)
  const legacy = await prisma.user.findFirst({ where: { role: "ADMIN" as never, is_locked: false }, select: { id: true, role: true } });
  if (legacy) {
    const st = await hit("/api/pallets", "GET", { Authorization: `Bearer ${tok(legacy)}` });
    const ok = st === 403;
    console.log(`\nLegacy ADMIN GET pallets -> ${st} ${ok ? "✓ (đã vô hiệu hoá)" : "✗ (còn quyền — bản fix CHƯA deploy?)"}`);
  }

  console.log(`\nKết quả: ${pass} PASS · ${fail} FAIL`);
  if (fails.length) { console.log("Chi tiết FAIL:"); fails.forEach((f) => console.log("  ✗ " + f)); }
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
})();

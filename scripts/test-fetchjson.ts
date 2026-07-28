/**
 * WVG-64 / WMS-004 — Unit test fetchJson: KHÔNG biến lỗi thành rỗng.
 * Chạy: npx tsx scripts/test-fetchjson.ts
 */
import assert from "node:assert";
import { fetchJson, ApiError } from "../src/lib/api";

let passed = 0;
function ok(desc: string, cond: boolean) { assert.ok(cond, desc); passed++; console.log("  ✓", desc); }
function mock(status: number, ct: string, body: string) {
  (globalThis as unknown as { fetch: unknown }).fetch = async () => new Response(body, { status, headers: { "content-type": ct } });
}

(async () => {
  console.log("fetchJson — unit tests\n");

  mock(200, "application/json", JSON.stringify({ success: true, data: [1, 2] }));
  const a = await fetchJson<{ data: number[] }>("/x");
  ok("JSON 200 → trả body.data", Array.isArray(a.data) && a.data.length === 2);

  mock(200, "text/html", "<!DOCTYPE html><html>404</html>");
  try { await fetchJson("/x"); ok("HTML → phải ném (không rỗng)", false); }
  catch (e) { ok("HTML (Unexpected token '<') → ApiError, KHÔNG parse rỗng", e instanceof ApiError); }

  mock(500, "application/json", JSON.stringify({ success: false, error: "Lỗi máy chủ X" }));
  try { await fetchJson("/x"); ok("500 → phải ném", false); }
  catch (e) { ok("500 JSON → ApiError giữ message máy chủ", e instanceof ApiError && (e as ApiError).message === "Lỗi máy chủ X"); }

  mock(401, "application/json", JSON.stringify({ success: false }));
  try { await fetchJson("/x"); ok("401 → phải ném", false); }
  catch (e) { ok("401 → ApiError.status=401 (phiên hết hạn)", e instanceof ApiError && (e as ApiError).status === 401); }

  mock(200, "application/json", JSON.stringify({ success: false, error: "Thất bại 200" }));
  try { await fetchJson("/x"); ok("200 success:false → phải ném", false); }
  catch (e) { ok("200 nhưng success:false → vẫn ném (không hiểu nhầm)", e instanceof ApiError); }

  (globalThis as unknown as { fetch: unknown }).fetch = async () => { throw new Error("network down"); };
  try { await fetchJson("/x"); ok("network lỗi → phải ném", false); }
  catch (e) { ok("network lỗi → ApiError.status=0", e instanceof ApiError && (e as ApiError).status === 0); }

  console.log(`\n✅ ${passed} assertions passed`);
})();

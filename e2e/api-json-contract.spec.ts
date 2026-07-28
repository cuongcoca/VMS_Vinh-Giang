import { test, expect } from "@playwright/test";

/**
 * WVG-64 / WMS-004 — API luôn trả JSON contract (không trả HTML gây "Unexpected token '<'").
 * Chạy: E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/api-json-contract.spec.ts
 */
test.describe("WMS-004 — /api luôn trả JSON", () => {
  test("Path API SAI → JSON 404 (không phải trang HTML)", async ({ request }) => {
    const res = await request.get("/wms/api/khong-ton-tai-xyz-123");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"] || "").toContain("application/json");
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
  });

  test("Lỗi xác thực trả JSON (không HTML redirect)", async ({ request }) => {
    const res = await request.get("/wms/api/suppliers"); // không token → 401
    expect(res.status()).toBe(401);
    expect(res.headers()["content-type"] || "").toContain("application/json");
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

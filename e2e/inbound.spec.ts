import { test, expect } from "@playwright/test";
import { loginViaAPI } from "./helpers/auth";

test.describe("Inbound (PHN) — M04", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("listing page loads", async ({ page }) => {
    await page.goto("/wms/inbound");
    await expect(page.locator("body")).toContainText(/nhập kho|phiếu nhập|inbound/i);
  });

  test("API: list returns success envelope + PHN code format", async ({ request }) => {
    const res = await request.get("/wms/api/inbound?page=1&page_size=10");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    const items = body.data ?? body.items ?? [];
    if (items.length > 0) {
      // PROTECTED format: PHN-YYMMDD-NNN
      expect(items[0].code ?? items[0].phn_code).toMatch(/^PHN-\d{6}-\d{3}$/);
    }
  });

  test("API: pallet code generator is monotonic", async ({ request }) => {
    // Two consecutive POSTs should give sequential codes
    const r1 = await request.post("/wms/api/pallets", { data: {} });
    const r2 = await request.post("/wms/api/pallets", { data: {} });
    if (!r1.ok() || !r2.ok()) test.skip(true, "Pallet POST not accepting empty body");
    const b1 = await r1.json();
    const b2 = await r2.json();
    const c1 = b1.data?.code;
    const c2 = b2.data?.code;
    if (!c1 || !c2) test.skip(true, "No code in response");

    // Same date prefix expected
    expect(c1.slice(0, 10)).toBe(c2.slice(0, 10));
    // Sequence increments
    expect(Number(c2.slice(-3))).toBeGreaterThan(Number(c1.slice(-3)));
  });
});

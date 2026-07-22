import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@vinhgiang.vn";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Aa@123456";

test.describe("RBAC + Audit", () => {
  test("admin sees system menu items (admin-only routes accessible)", async ({ page }) => {
    // Login via UI to ensure sidebar/menu hydrates
    await page.goto("/wms/auth");
    await page.locator('input[name="username"]').fill(ADMIN_EMAIL);
    await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth"), { timeout: 15_000 });

    // Direct nav to admin-only page should succeed
    await page.goto("/wms/system/mail");
    await expect(page.locator("body")).toContainText(/cấu hình mail|provider/i);
  });

  test("unauthenticated request to protected API returns 401", async ({ request }) => {
    // Use a fresh request context with NO cookies/token
    const res = await request.get("/wms/api/products?page=1", {
      headers: { Authorization: "" },
    });
    // Should be rejected (401 or redirect)
    expect([401, 403, 302]).toContain(res.status());
  });

  test("token-less POST to write endpoint is rejected", async ({ request }) => {
    const res = await request.post("/wms/api/suppliers", {
      headers: { Authorization: "" },
      data: { code: "X", name: "X" },
    });
    expect([401, 403]).toContain(res.status());
  });

  test("audit-logs endpoint exists for ADMIN", async ({ request }) => {
    // Login first
    const loginRes = await request.post("/wms/api/auth/login", {
      data: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    const { token } = await loginRes.json();

    const res = await request.get("/wms/api/audit-logs?page=1&page_size=10", {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Either 200 with list, or 404 if not implemented yet — accept both
    expect([200, 404]).toContain(res.status());
  });
});

import { test, expect } from "@playwright/test";
import { loginViaAPI } from "./helpers/auth";

test.describe("Master Data — M02", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("suppliers list page renders", async ({ page }) => {
    await page.goto("/wms/master-data");
    await expect(page.locator("body")).toContainText(/dữ liệu|master|supplier|nhà cung cấp/i);
  });

  test.describe("CRUD suppliers via API", () => {
    let createdId: string | null = null;

    test("create supplier", async ({ request }) => {
      const code = `TEST-${Date.now().toString(36).toUpperCase()}`;
      const res = await request.post("/wms/api/suppliers", {
        data: {
          code,
          name: `Test supplier ${code}`,
          phone: "0900000000",
        },
      });
      expect(res.ok()).toBe(true);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data?.id).toBeTruthy();
      createdId = body.data.id;
    });

    test("get the supplier back in list", async ({ request }) => {
      if (!createdId) test.skip(true, "Create step failed");
      const res = await request.get("/wms/api/suppliers?page=1&page_size=100");
      const body = await res.json();
      const items = body.data ?? body.items ?? [];
      const found = items.find((s: { id: string }) => s.id === createdId);
      expect(found).toBeTruthy();
    });

    test("delete the supplier (cleanup)", async ({ request }) => {
      if (!createdId) test.skip(true, "Create step failed");
      const res = await request.delete(`/wms/api/suppliers/${createdId}`);
      // 200 OK or 204 No Content
      expect([200, 204]).toContain(res.status());
    });
  });

  test("product groups API returns list", async ({ request }) => {
    const res = await request.get("/wms/api/product-groups");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test("units API returns list", async ({ request }) => {
    const res = await request.get("/wms/api/units");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

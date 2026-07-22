import { test, expect } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD, loginAsAdmin } from "./helpers/auth";

test.describe("Authentication", () => {
  test("login page renders form fields", async ({ page }) => {
    await page.goto("/wms/auth");
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /đăng nhập/i })).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/wms/auth");
    await page.locator('input[name="username"]').fill("nobody@example.com");
    await page.locator('input[name="password"]').fill("wrong-pass-123");
    await page.getByRole("button", { name: /đăng nhập/i }).click();
    // Error message should appear (Vietnamese — "thất bại"/"sai"/"không tìm thấy")
    await expect(
      page.locator("body").filter({ hasText: /thất bại|sai|không tìm thấy|không tồn tại/i }),
    ).toBeVisible({ timeout: 8_000 });
  });

  test("admin can log in and lands on a dashboard page", async ({ page }) => {
    await loginAsAdmin(page);
    expect(page.url()).not.toContain("/wms/auth");
    // token must be stored in localStorage under the known key
    const token = await page.evaluate(() =>
      localStorage.getItem("vinhgiang_wms_token"),
    );
    expect(token).toBeTruthy();
    expect(token!.split(".")).toHaveLength(3); // JWT format
  });

  test("login API returns JWT for valid credentials", async ({ request }) => {
    const res = await request.post("/wms/api/auth/login", {
      data: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
    expect(body.user.role).toBe("ADMIN");
  });
});

import { Page, expect } from "@playwright/test";

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@vinhgiang.vn";
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "Aa@123456";

const TOKEN_KEY = "vinhgiang_wms_token";
const USER_KEY = "vinhgiang_wms_user";

/** Log into WMS as admin via the form. */
export async function loginAsAdmin(page: Page) {
  await page.goto("/wms/auth");
  await page.locator('input[name="username"]').fill(ADMIN_EMAIL);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /đăng nhập/i }).click();
  // Wait for redirect away from auth page
  await page.waitForURL((url) => !url.pathname.includes("/auth"), {
    timeout: 15_000,
  });
}

/**
 * Faster: log in via API + inject token, skipping the form.
 * Call this in beforeEach for non-auth tests.
 */
export async function loginViaAPI(page: Page) {
  const res = await page.request.post("/wms/api/auth/login", {
    data: { identifier: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.success).toBe(true);
  const token = body.token as string;
  const user = body.user;

  await page.addInitScript(
    ({ tk, t, uk, u }) => {
      localStorage.setItem(tk, t);
      localStorage.setItem(uk, JSON.stringify(u));
    },
    { tk: TOKEN_KEY, t: token, uk: USER_KEY, u: user },
  );
  return token;
}

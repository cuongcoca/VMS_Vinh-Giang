import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for WMS Vĩnh Giang.
 *
 * Run against:
 *   - local dev:  E2E_BASE_URL=http://localhost:3000 npm run e2e
 *   - VPS prod:   E2E_BASE_URL=https://wms.vinhgiang.com npm run e2e
 *
 * Default = http://localhost:3000 (with /wms basePath). When testing
 * VPS, set E2E_BASE_URL to https://wms.vinhgiang.com.
 *
 * Login credentials are read from env (E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD)
 * with defaults matching the seed user.
 */

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // single-DB tests; serialize to avoid race conditions
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 5"] },
      // Mobile-specific tests live in e2e/mobile/* (UC-PAL-03 scanner relies on
      // mobile camera permissions; we don't actually grant them — just verify
      // the UI surfaces the manual fallback)
      testMatch: /mobile\/.*\.spec\.ts/,
    },
  ],
});

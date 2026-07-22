import { test, expect } from "@playwright/test";
import { loginViaAPI } from "../helpers/auth";

/**
 * Mobile-flavored test for UC-PAL-03. Runs under the "mobile-chrome" project
 * (Pixel 5 viewport). We don't actually grant camera permission — we verify
 * that the UI handles the rejection gracefully and surfaces the manual /
 * USB fallback tabs, which is the whole point of "đa phương thức quét".
 */
test.describe("UC-PAL-03 scanner on mobile", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaAPI(page);
  });

  test("scanner has 3 mode tabs and falls back when camera denied", async ({ page, context }) => {
    // Explicitly deny camera permission for this test
    await context.clearPermissions();

    await page.goto("/wms/pallets");
    const firstLink = page.locator('a[href*="/wms/pallets/"]').first();
    if (!(await firstLink.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "No pallets to test on");
    }
    await firstLink.click();
    await page.waitForURL(/\/wms\/pallets\/[^/]+$/);

    const scannerBtn = page.locator('button:has(span:text("qr_code_scanner"))').first();
    if (!(await scannerBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip(true, "Pallet not editable");
    }
    await scannerBtn.click();

    // Three tabs present
    await expect(page.getByRole("button", { name: /^camera$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^usb$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /nhập tay/i })).toBeVisible();

    // Switch to manual — input must be visible and typable
    await page.getByRole("button", { name: /nhập tay/i }).click();
    const codeInput = page.locator(
      'input[placeholder*="VG-001"], input[placeholder*="89345"]',
    );
    await expect(codeInput).toBeVisible();
    await codeInput.fill("MOBILE-TEST-001");
    await expect(codeInput).toHaveValue("MOBILE-TEST-001");

    // Switch to USB — instructions visible
    await page.getByRole("button", { name: /^usb$/i }).click();
    await expect(page.locator("body")).toContainText(/usb scanner|sẵn sàng/i);
  });
});

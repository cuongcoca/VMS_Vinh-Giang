import { test, expect } from "@playwright/test";

/**
 * WVG-16 / WMS-002 — Negative API test tổng (deny-by-default toàn bộ resource).
 *
 * Trước fix: 110/121 route trả 200 KHÔNG cần token → rò/đổi dữ liệu ẩn danh.
 * Sau fix: mọi route business yêu cầu xác thực; vai không phận sự bị 403.
 *
 * Chạy: E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/rbac-api.spec.ts
 * Test 403-theo-vai cần tài khoản vai thấp qua env (mặc định skip):
 *   E2E_LOWROLE_LOGIN=<sđt/email vai XE_NANG/KIEM_KE...> E2E_LOWROLE_PASSWORD=<mk>
 */

// Route đại diện các resource — không token phải 401
const NO_TOKEN_ROUTES = [
  "/wms/api/pallets",
  "/wms/api/suppliers",
  "/wms/api/inbound",
  "/wms/api/inbound-temp",
  "/wms/api/outbound/staging",
  "/wms/api/inventory/by-pallet",
  "/wms/api/movements",
  "/wms/api/item-codes",
  "/wms/api/products",
  "/wms/api/locations",
  "/wms/api/units",
  "/wms/api/product-groups",
  "/wms/api/stock-count",
  "/wms/api/forklift/queue",
  "/wms/api/dashboard/kpi",
  "/wms/api/notifications",
  "/wms/api/users",
  "/wms/api/system/config",
  "/wms/api/system/permissions",
  "/wms/api/audit-logs",
  "/wms/api/adjustments",
  "/wms/api/attachments",
];

test.describe("WMS-002 — deny-by-default toàn API", () => {
  for (const path of NO_TOKEN_ROUTES) {
    test(`Không token: GET ${path} → 401`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status(), `${path} phải 401 khi không đăng nhập`).toBe(401);
    });
  }

  test("Token không hợp lệ → 401", async ({ request }) => {
    const res = await request.get("/wms/api/pallets", {
      headers: { Authorization: "Bearer khong.hop.le" },
    });
    expect(res.status()).toBe(401);
  });

  test("Route công khai KHÔNG bị chặn nhầm (login ≠ 401)", async ({ request }) => {
    const res = await request.post("/wms/api/auth/login", { data: {} });
    expect(res.status(), "login phải tới handler (400), không 401").not.toBe(401);
  });

  // 403 theo vai — cần tài khoản vai thấp (không phải Quản lý) qua env.
  const login = process.env.E2E_LOWROLE_LOGIN;
  const pass = process.env.E2E_LOWROLE_PASSWORD;
  test("Vai thấp bị chặn resource quản trị / ghi không phận sự (403)", async ({ request }) => {
    test.skip(!login || !pass, "Đặt E2E_LOWROLE_LOGIN + E2E_LOWROLE_PASSWORD để chạy test 403");
    const body = await (await request.post("/wms/api/auth/login", { data: { identifier: login, password: pass } })).json();
    const token = body?.token ?? body?.data?.token;
    expect(token, "Đăng nhập vai thấp thất bại").toBeTruthy();
    const headers = { Authorization: `Bearer ${token}` };

    // Không được xem người dùng / cấu hình hệ thống / ma trận quyền
    expect((await request.get("/wms/api/users", { headers })).status()).toBe(403);
    expect((await request.get("/wms/api/system/config", { headers })).status()).toBe(403);
    expect((await request.get("/wms/api/system/permissions", { headers })).status()).toBe(403);
    // Không được tạo người dùng
    expect((await request.post("/wms/api/users", { headers, data: {} })).status()).toBe(403);
  });
});

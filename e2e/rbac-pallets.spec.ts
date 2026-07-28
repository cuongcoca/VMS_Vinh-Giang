import { test, expect } from "@playwright/test";

/**
 * WVG-16 / WMS-002 — Negative API test: enforce deny-by-default cho resource "pallet".
 *
 * Trước fix: /wms/api/pallets trả 200 KHÔNG cần token (đã chứng minh bằng curl).
 * Sau fix: mọi route pallet yêu cầu xác thực + đúng quyền.
 *
 * Chạy: E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/rbac-pallets.spec.ts
 * (403 test cần tài khoản KIEM_KE qua env E2E_KIEMKE_LOGIN + E2E_KIEMKE_PASSWORD)
 */

const READ_ENDPOINTS = [
  "/wms/api/pallets",
  "/wms/api/pallets/next-code",
  "/wms/api/pallets/by-code?code=PL000000.001",
  "/wms/api/pallets/by-item?item_code_id=00000000-0000-0000-0000-000000000000",
];

test.describe("WMS-002 RBAC pallet — deny-by-default", () => {
  test("Không đăng nhập → 401 trên mọi route pallet", async ({ request }) => {
    for (const path of READ_ENDPOINTS) {
      const res = await request.get(path);
      expect(res.status(), `GET ${path} phải 401 khi không có token`).toBe(401);
    }
    const post = await request.post("/wms/api/pallets", { data: {} });
    expect(post.status(), "POST /wms/api/pallets không token phải 401").toBe(401);
  });

  test("Token không hợp lệ → 401", async ({ request }) => {
    const res = await request.get("/wms/api/pallets", {
      headers: { Authorization: "Bearer invalid.token.value" },
    });
    expect(res.status()).toBe(401);
  });

  const kkLogin = process.env.E2E_KIEMKE_LOGIN;
  const kkPass = process.env.E2E_KIEMKE_PASSWORD;
  test("KIEM_KE: đọc pallet 200 nhưng tạo pallet 403", async ({ request }) => {
    test.skip(!kkLogin || !kkPass, "Đặt E2E_KIEMKE_LOGIN + E2E_KIEMKE_PASSWORD để chạy test 403");
    const login = await request.post("/wms/api/auth/login", {
      data: { username: kkLogin, password: kkPass },
    });
    expect(login.ok(), "Đăng nhập KIEM_KE thất bại").toBeTruthy();
    const body = await login.json();
    const token = body?.data?.token ?? body?.token;
    expect(token, "Không lấy được token đăng nhập").toBeTruthy();
    const headers = { Authorization: `Bearer ${token}` };

    const read = await request.get("/wms/api/pallets", { headers });
    expect(read.status(), "KIEM_KE đọc pallet phải 200").toBe(200);

    const write = await request.post("/wms/api/pallets", { headers, data: {} });
    expect(write.status(), "KIEM_KE tạo pallet phải bị chặn 403").toBe(403);
  });
});

#!/usr/bin/env node
/**
 * test-fixtures.js — Helpers tạo test data cho auto-fix automation.
 *
 * Khi 1 test case cần data đặc biệt (vd inactive product, pallet IN_STAGING),
 * subagent gọi các helper ở đây thay vì manually tạo qua UI.
 *
 * Auth: dùng token admin từ env AUTO_FIX_AUTH_TOKEN (set 1 lần ở setup).
 * Get token: `curl -X POST /api/auth/login -d '{identifier, password}' | jq -r .token`.
 *
 * Usage trong code:
 *   const fx = require("./scripts/test-fixtures");
 *   const product = await fx.createTestProduct({ is_active: false });
 *   // ... do test ...
 *   await fx.cleanup(); // xoá all test_* records
 */

const VPS_URL = process.env.AUTO_FIX_VPS_URL || "https://188.166.210.73";
const TOKEN = process.env.AUTO_FIX_AUTH_TOKEN || "";
const TEST_PREFIX = "TEST_AUTO_"; // mọi record tạo tự động dùng prefix này để cleanup

if (!TOKEN) {
  console.warn("[test-fixtures] AUTO_FIX_AUTH_TOKEN not set — fixtures will skip writes.");
}

async function api(method, path, body) {
  const url = `${VPS_URL}${path}`;
  // node 20+ có fetch built-in
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${TOKEN}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${method} ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

const createdIds = { products: [], pallets: [], inboundRequests: [], itemCodes: [] };

/**
 * Tạo product test với is_active configurable.
 * Returns { id, sku, ... }.
 */
async function createTestProduct(overrides = {}) {
  const ts = Date.now().toString().slice(-8);
  const payload = {
    sku: `${TEST_PREFIX}SKU_${ts}`,
    name: `${TEST_PREFIX}Product ${ts}`,
    short_name: `Test${ts}`,
    specification: "1x1x1",
    units_per_box: 1,
    weight_per_box: 1.0,
    is_active: true,
    manage_lot: false,
    manage_expiry: false,
    min_stock: 0,
    ...overrides,
  };
  const res = await api("POST", "/wms/api/products", payload);
  const id = res.data?.id || res.id;
  if (id) createdIds.products.push(id);
  return res.data || res;
}

/**
 * Tạo inbound request test ở status cụ thể (DRAFT mặc định).
 */
async function createTestInbound(overrides = {}) {
  const payload = {
    expected_date: new Date().toISOString().slice(0, 10),
    note: `${TEST_PREFIX} inbound for auto-fix test`,
    lines: [],
    ...overrides,
  };
  const res = await api("POST", "/wms/api/inbound", payload);
  const id = res.data?.id || res.id;
  if (id) createdIds.inboundRequests.push(id);
  return res.data || res;
}

/**
 * Cleanup: xoá all records prefix TEST_AUTO_ tạo bởi script này.
 * Gọi cuối mỗi vòng fix nếu có tạo data.
 */
async function cleanup() {
  const results = { products: 0, pallets: 0, inboundRequests: 0 };
  for (const id of createdIds.products) {
    try { await api("DELETE", `/wms/api/products/${id}`); results.products++; } catch {}
  }
  for (const id of createdIds.inboundRequests) {
    try { await api("DELETE", `/wms/api/inbound/${id}`); results.inboundRequests++; } catch {}
  }
  // Reset
  Object.keys(createdIds).forEach((k) => { createdIds[k] = []; });
  return results;
}

/**
 * Lấy product theo SKU (helper khi cần product cụ thể).
 */
async function getProductBySku(sku) {
  const res = await api("GET", `/wms/api/products?q=${encodeURIComponent(sku)}`);
  return (res.data || []).find((p) => p.sku === sku) || null;
}

module.exports = {
  createTestProduct,
  createTestInbound,
  cleanup,
  getProductBySku,
  TEST_PREFIX,
};

// CLI: node scripts/test-fixtures.js <cmd>
if (require.main === module) {
  const cmd = process.argv[2];
  (async () => {
    if (cmd === "test-product") {
      const p = await createTestProduct({ is_active: process.argv[3] === "inactive" ? false : true });
      console.log(JSON.stringify(p, null, 2));
    } else if (cmd === "cleanup") {
      const r = await cleanup();
      console.log("Cleaned:", JSON.stringify(r));
    } else {
      console.log("Usage: test-fixtures.js <test-product [inactive] | cleanup>");
    }
  })().catch((e) => { console.error(e.message); process.exit(1); });
}

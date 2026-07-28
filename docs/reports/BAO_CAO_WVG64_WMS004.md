# WVG-64 / WMS-004 — API nhà cung cấp trả HTML thay JSON: Báo cáo & Evidence

**Bug:** [P1][MD][WMS-004] API nhà cung cấp trả HTML thay JSON → `/wms/suppliers` reload nhiều lần về 0 bản ghi.
**Nhánh:** `cuongdd_web` (local). **Trạng thái:** DONE (P1–P5).

---

## 1. Root cause & phạm vi (2 tầng)

**Tầng 1 — Anti-pattern frontend (nguyên nhân "biến lỗi thành empty state"):**
`suppliers/page.tsx` (và ≥9 chỗ khác) gọi `await res.json()` **mù** — không kiểm `res.ok` / `Content-Type`, chỉ xét `result.success`:
- Response **HTML** → `res.json()` ném `Unexpected token '<'` → rơi `catch` → danh sách **giữ rỗng** → hiện *"Chưa có nhà cung cấp"* (nhầm lỗi thành trống).
- Response **JSON lỗi** (401/403/500) → `success=false` → **im lặng, rỗng**, không báo lỗi/không thử lại.

**Tầng 2 — Nguồn HTML "Unexpected token '<'":**
Route `/api/suppliers` đã có try/catch → **luôn trả JSON**. HTML đến từ **ngoài route**:
- **Path API sai** (thiếu basePath) → Next trả **trang HTML 404**.
- Tầng **nginx 502/504** khi instance chậm/quá tải lúc "reload nhiều lần" (Prisma pool cạn) → **trang lỗi HTML**.

→ Chốt: dù nguồn HTML là gì, làm client **cưỡng chế JSON contract** + hiện lỗi/Thử lại là cách bền vững (đúng cả 2 vế Expected Result).

---

## 2. Giải pháp (P1–P5)

- **P1 — Helper `fetchJson<T>()`** (`src/lib/api.ts`): đính token; lỗi mạng → `ApiError(0)`; `!res.ok` → đọc message JSON/theo status; **Content-Type không phải JSON → `ApiError`** (chặn `Unexpected token '<'`); body `{success:false}` → `ApiError`.
- **P2 — Trang Suppliers**: dùng `fetchJson`; thêm **state `error`** tách khỏi empty; render **loading / error (+ nút "Thử lại") / empty / data** — không còn nuốt lỗi.
- **P3 — Nhân ra 9 chỗ** cùng tải suppliers (dropdown): `inbound/page`, `inbound/new`, `inbound/import`, `pallets/page`, `thukho/pallet`, `thukho/pallet/new`, `thukho/adhoc/new`, `inbound-adhoc/page`, `inbound-adhoc/new` → dùng `fetchJson` + `.catch` (thêm catch cho 2 chỗ trước đó **chưa bắt lỗi** → hết unhandled rejection).
- **P4 — Catch-all JSON 404**: `src/app/api/[...notfound]/route.ts` — mọi path `/api/*` sai → **JSON 404** thay trang HTML.
- **P5 — Test + báo cáo**.

---

## 3. Evidence (Acceptance)

| Kiểm chứng | Kết quả |
|---|---|
| Unit `fetchJson` (`scripts/test-fetchjson.ts`) | ✅ **6/6** — HTML → ApiError (KHÔNG rỗng), 500 giữ message, 401 status, success:false ném, network → ApiError(0) |
| Playwright `e2e/api-json-contract.spec.ts` | ✅ **2/2** — path API sai → **JSON 404**; lỗi auth → **JSON 401** (không HTML) |
| `npx tsc --noEmit` | ✅ sạch |
| Live: `/wms/api/<sai>` | ✅ 404 · `application/json` · `{"success":false,...}` |
| Regression: `/api/suppliers` (token) | ✅ 200 · application/json |
| UI Suppliers khi lỗi | ✅ hiện **thông báo lỗi + "Thử lại"** (không hiện "Chưa có NCC") |

**Không đụng:** dữ liệu, tồn kho, quyền, schema, backend logic (thuần frontend + helper + 1 catch-all route).

---

## 4. Ghi chú infra (điều tra, KHÔNG sửa mù) — nguồn 502/504

Frontend giờ chịu lỗi tốt, nhưng để giảm gốc HTML lúc "reload nhiều lần" trên production, nên rà (không bắt buộc để đóng bug):
- **nginx**: `proxy_read_timeout` / `proxy_connect_timeout` cho các location `/wms`, `/thukho`… — nếu instance phản hồi chậm sẽ trả trang 504 HTML.
- **Prisma connection pool**: kiểm `connection_limit` trong `DATABASE_URL` và số instance PM2 dùng chung PG16 — reload dồn có thể cạn pool → query chậm/timeout → 502/504.
- Theo dõi `pm2 logs` + `nginx error_log` khi tái hiện để chốt chính xác.

→ Đề nghị chuyển **To Do/In Progress → In Review**; phần infra tách thành task hardening riêng nếu cần.

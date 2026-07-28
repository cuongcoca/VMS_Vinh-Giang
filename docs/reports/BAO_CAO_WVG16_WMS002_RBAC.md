# WVG-16 / WMS-002 — RBAC deny-by-default: Báo cáo tổng & Evidence

**Bug:** [P1][AUTH][WMS-002] Role legacy có toàn quyền và RBAC sai granularity
**Nhánh:** `cuongdd_web` (local) · **Ngày:** 2026-07-28 · **Trạng thái:** Pha 0–5 DONE

---

## 1. Root cause & phạm vi ảnh hưởng (Acceptance #1)

Audit production 23/07 báo "role legacy toàn quyền, RBAC theo module". Rà code cho thấy **nghiêm trọng hơn**:

| Phát hiện | Bằng chứng |
|---|---|
| **RBAC chỉ ở client** (khớp prefix route), cấu hình trong **localStorage** → bypass được | `src/lib/rbac.ts` |
| **110/121 route API KHÔNG enforce quyền** — gọi thẳng ra data, không cần cả token | `curl /wms/api/pallets` **200** không token |
| **Super-role ADMIN/MANAGER/STAFF wildcard** `["*"]` vượt mọi kiểm tra (cả client & server) | `rbac.ts`, `auth-server.ts` |
| Chỉ mức **module**, không action-level (full/read/special/none) | `DEFAULT_ROLE_FEATURES` |
| Role gate backend **chỉ áp khi truyền allowedRoles** → mặc định allow, không deny-by-default | `auth-server.ts` |

**Kết luận:** thiếu tầng phân quyền backend gần như toàn bộ + wildcard super-role + không granularity.

---

## 2. Giải pháp (5 pha)

| Pha | Nội dung | Kết quả |
|---|---|---|
| **0** | Thiết kế ma trận `resource × role → level {none,read,full,special}`, server-authoritative | `src/lib/permissions.ts` |
| **1** | Lõi `requirePermission`/`guardPermission` (deny-by-default, KHÔNG super bypass) + làm mẫu resource **pallet** (11 route) + negative test | pallet enforce 401/403 |
| **2** | Nhân guard ra **~90 route** (codemod, GET→read, mutation→write) + mở rộng ma trận **19 resource** (sàn đọc + nâng theo vai) | 112/121 route enforce |
| **3** | Hợp nhất 11 route cũ `requireAuth(allowedRoles)` → `requirePermission` (**bịt 3 lỗ hổng GET ẩn danh**); **di trú legacy → QUAN_LY**; **bỏ wildcard** (rbac.ts) + **bỏ super bypass** (auth-server.ts) | không còn `["*"]` / super-role |
| **4** | Ma trận vào **DB** (`systemConfig.rbac_permission_matrix`, cache TTL 15s, fallback default) + **API** GET/PUT + **UI grid** `/wms/system/permissions` | cấu hình quyền lúc chạy, không cần deploy |
| **5** | Bộ test tự động mở rộng + báo cáo evidence + khuyến nghị tinh chỉnh theo UC | tài liệu này |

**Nguyên tắc không hồi quy:** ma trận đặt "sàn đọc" (mọi baseline role đọc được resource nghiệp vụ) + nâng full ở resource vận hành; `system`/`user`/`audit` chỉ Quản lý. `FetchAuthInstaller` tự đính JWT vào mọi fetch `/api/` nên UI người-đã-đăng-nhập không gãy.

---

## 3. Kết quả (before → after)

| Chỉ số | Trước | Sau |
|---|---|---|
| Route API enforce quyền | **11/121** (9%) | **112/121** (còn 9 = `auth/*` self-service + `uploads` phục vụ ảnh — cố ý mở) |
| `GET /api/pallets` (và 21 route khác) không token | **200 + rò data** | **401** JSON contract |
| Super-role wildcard | ADMIN/MANAGER/STAFF full mọi thứ | **Đã bỏ**; tài khoản di trú → QUAN_LY |
| Granularity | module on/off | **action-level** none/read/full/special, **cấu hình DB được** |

---

## 4. Automated test / regression (Acceptance #2)

| Bộ test | Kết quả |
|---|---|
| Unit ma trận `scripts/test-permissions.ts` | ✅ **53 assertions** (sàn đọc, giới hạn ghi, resource quản trị, vai vận hành, legacy) |
| Negative API `e2e/rbac-api.spec.ts` (Playwright) | ✅ **24 pass** — 22 resource không token → 401, token rác → 401, public không chặn nhầm |
| Negative API pallet `e2e/rbac-pallets.spec.ts` | ✅ pallet 401/403 |
| `npx tsc --noEmit` | ✅ sạch |
| **Live: sửa ma trận qua UI/API đổi enforcement ngay** | ✅ đặt XE_NANG.pallet=none → đọc pallet **200→403**, khôi phục → 200 |
| **No-regression**: admin + XE_NANG mở màn hình, gọi API | ✅ 200, 0 console error |

> 403-theo-vai trong Playwright cần tài khoản vai thấp qua env `E2E_LOWROLE_LOGIN/PASSWORD` (mặc định skip). Đã kiểm chứng thủ công: XE_NANG → users/system/config/permissions **403**.

---

## 5. Hướng dẫn cấu hình & vận hành

- **Chỉnh quyền:** đăng nhập Quản lý → `/wms/system/permissions` → chọn mức mỗi ô (resource × vai) → **Lưu**. Áp toàn hệ thống trong ~15s (cache TTL). Ghi audit `UPDATE_PERMISSION_MATRIX`.
- **Deploy production:** chạy migration `prisma/migrations/2026-07-28_migrate_legacy_roles.sql` (di trú 3 ADMIN → QUAN_LY) — **backup DB trước**.
- **Sau deploy:** người đang đăng nhập vai legacy cần **đăng nhập lại** để nhận token QUAN_LY (server đã enforce đúng theo DB ngay).

---

## 6. Khuyến nghị tinh chỉnh theo UC baseline v3.1 (làm qua UI, không cần code)

Ma trận mặc định hiện **rộng rãi có chủ đích** ("sàn đọc") để không gãy luồng. Sau khi QA xác nhận từng luồng, siết dần qua UI:

| Vai | Nên siết (gợi ý) |
|---|---|
| KE_TOAN | `pallet`/`stock_count`: full → **read** nếu kế toán chỉ xem |
| XE_NANG | `supplier`/`item_code`/`outbound`/`inbound`: read → **none** nếu màn xe nâng không dùng |
| KIEM_KE | `inbound`/`outbound`/`supplier`: read → **none** nếu không dùng |
| THU_KHO | `outbound`: read → **none** |

> Mỗi lần siết → test lại luồng của vai đó (đăng nhập vai, chạy nghiệp vụ chính) rồi mới lưu.

---

## 7. Còn lại (nhỏ, không chặn Done)

- `@default(STAFF)` khi tạo user không truyền role → nên đổi default sang baseline (cần schema migration).
- Vài check `includes("*")` inert (dead) trong `rbac.ts` — dọn khi tiện.
- Legacy roles giữ grant `allSpecial` phòng thủ (không wildcard); có thể chuyển sang deny sau khi chắc mọi env đã di trú.

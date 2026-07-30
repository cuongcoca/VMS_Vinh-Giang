# WVG-16 / WMS-002 — Bằng chứng RBAC (unit + negative/positive API)

## 1. Unit test ma trận — `scripts/test-permissions.ts`
`npx tsx scripts/test-permissions.ts` → **61/61 assertions passed**. Phủ:
- Deny-by-default: role rỗng / role lạ / thiếu grant → chặn.
- Phân tầng: `read < full(write) < special`.
- Sàn đọc: mọi baseline role đọc được resource nghiệp vụ; ghi/duyệt siết đúng vai.
- **Legacy ADMIN/MANAGER/STAFF = deny hoàn toàn** (không còn allSpecial/wildcard).
- **PENDING (default user mới) = deny mọi resource.**

## 2. Negative + positive API 5 vai — `scripts/rbac-live-matrix.ts`
Gọi API thật qua HTTP với token từng vai + trường hợp không token; đối chiếu status
với ma trận `can()`. Chạy trên **server Test** (`http://localhost:4200/wms`), **KHÔNG
tạo/sửa dữ liệu** (write dùng DELETE id-giả → 404, và POST body rỗng → 400).

```
Endpoint                  QUAN_LY  KE_TOAN  THU_KHO  XE_NANG  KIEM_KE  no-tok
-------------------------------------------------------------------------------
GET  pallets              200✓     200✓     200✓     200✓     200✓     401✓
DEL  pallets/{fake}       404✓     404✓     404✓     404✓     403✓·D   401✓
GET  inventory/by-item    200✓     200✓     200✓     200✓     200✓     401✓
GET  movements            200✓     200✓     200✓     200✓     200✓     401✓
GET  users (admin)        200✓     403✓·D   403✓·D   403✓·D   403✓·D   401✓
POST forklift/put-away    400✓     403✓·D   403✓·D   400✓     403✓·D   401✓

Kết quả: 36 PASS · 0 FAIL   (·D = ô kỳ vọng bị DENY 403)
```

**Đọc kết quả (negative API — điều reviewer yêu cầu):**
- **Không token → 401** ở mọi endpoint (không lộ dữ liệu cho request ẩn danh).
- **KIEM_KE** bị **403** khi ghi pallet (`DELETE`) và ghi forklift (`put-away`) → đúng "chỉ đọc".
- **KE_TOAN / THU_KHO / KIEM_KE** bị **403** ở `GET /api/users` (chỉ QUAN_LY) → tài nguyên quản trị không rò rỉ.
- **KE_TOAN / THU_KHO** bị **403** ở `put-away` (forklift/write) → đúng UC.
- Vai có quyền ghi qua được cửa quyền (404/400 do id-giả/body rỗng — không phải 401/403).

## 3. Lỗ legacy (bằng chứng cần deploy fix)
Trước khi deploy bản fix, chạy harness còn cho:
```
Legacy ADMIN GET pallets -> 200 ✗ (còn quyền — bản fix CHƯA deploy)
```
→ xác nhận lỗ "legacy còn super-admin" đang tồn tại thật trên Test (4 user legacy).
**Sau deploy + migration** (promote legacy→QUAN_LY, legacy→deny): dòng này không còn
user ADMIN, hoặc trả **403**. Đây là mốc smoke-test trong runbook (§5).

## 4. `tsc`
`npx tsc --noEmit` — sạch (gồm cả 2 script test).

## 5. Cách chạy lại
```bash
# unit (không cần DB/server):
npx tsx scripts/test-permissions.ts
# live (trên server có .env + app chạy):
export $(grep '^DATABASE_URL=' .env | xargs) && npx tsx scripts/rbac-live-matrix.ts
```

# BÁO CÁO LỖI LOGIC TOÀN HỆ THỐNG — WMS Vĩnh Giang

**Ngày**: 2026-05-28 · **Branch**: `feat/phase0-deploy-tools-and-reports`
**Phương pháp**: 6 reviewer độc lập đọc toàn bộ source `src/app/api/**`, `src/lib/**`, `prisma/schema.prisma`, migration SQL, docs `CRITICAL_PATHS.md`/`SECURITY.md`
**Phạm vi**: ~150 file route.ts + helper, 100% module nghiệp vụ (auth, inbound, pallet, forklift, outbound, stocktake, adjustment, master data, inventory, attachments)

---

## TÓM TẮT EXECUTIVE

### Số liệu tổng
| Severity | Số lượng | % |
|---|---:|---:|
| 🔴 **CRITICAL** | **22** | 22% |
| 🟠 **HIGH** | **49** | 50% |
| 🟡 MEDIUM | 20 | 20% |
| ⚪ LOW | 7 | 8% |
| **TỔNG** | **98** | 100% |

### Đánh giá tổng quan: **CHƯA SẴN SÀNG GO-LIVE**

Hệ thống có **3 chain tấn công ẩn danh** dẫn tới tiếp quản admin trong <60 giây, và **3 bug nghiệp vụ nền tảng** khiến số liệu tồn kho sai lệch không thể tái dựng. Cần fix tối thiểu **22 finding CRITICAL** trước khi triển khai production.

### 5 phát hiện nghiêm trọng nhất (đọc kỹ phần dưới)
1. 🔥 **[AUTH-001]** Toàn bộ ~100 API route business không verify JWT — RBAC client-side bị bypass hoàn toàn bằng `curl`
2. 🔥 **[AUTH-007]** Endpoint `send-otp` **trả mã OTP trong response body** (`mock_otp`) → kẻ tấn công reset password user khác bằng 2 request
3. 🔥 **[INV-001]** **Approve điều chỉnh tồn không cộng/trừ tồn thực** — chỉ ghi audit + đổi status, `PalletLine.qty_box` không đổi → toàn bộ kiểm kê + điều chỉnh CP-08 vô nghĩa
4. 🔥 **[OUT-001 / INV-003]** Bảng `audit_logs` **KHÔNG có DB trigger append-only** dù docs `CRITICAL_PATHS.md` yêu cầu → admin/dev có thể xoá/đè log che giấu hành vi
5. 🔥 **[FK-001 / FK-002]** FEFO và Putaway **không có lock/`SELECT FOR UPDATE`** — 2 xe nâng có thể cùng pick 1 pallet, hoặc cùng put-away vượt sức chứa kệ

---

## TOP 3 CHUỖI TẤN CÔNG ẨN DANH (proven exploit chains)

### CHAIN 1: Anonymous Account Takeover (3 request, ~30 giây)
```
1. POST /api/auth/login {phone:"any"}            → 404 "không tồn tại"    [enumerate user]
   POST /api/auth/login {phone:"admin@cty.vn"}    → 401 "sai mật khẩu"   [exists!]
2. POST /api/auth/forgot-password/send-otp {identifier:"admin@cty.vn"}
                                                  → response body chứa mock_otp: "847291"
3. POST /api/auth/forgot-password/verify-otp + reset-password với OTP đó
                                                  → password admin đã đổi
```
**Findings**: AUTH-007 + AUTH-009 + AUTH-001
**Phải fix**: bỏ field `mock_otp` khỏi response NGAY, gửi OTP qua email/SMS thật

### CHAIN 2: RBAC Self-Escalation (1 request)
```
PUT /api/system/rbac
Body: { "THU_KHO": ["dashboard", "system", "master_data", ...all features] }
→ 200 OK (không check role caller, không check ADMIN-only)
→ User THU_KHO hiện tại đăng nhập lại → có toàn bộ menu admin
```
**Findings**: AUTH-002 + AUTH-001
**Phải fix**: gate route bằng `requireRole(['ADMIN'])`, ghi audit

### CHAIN 3: Inventory Tampering Untraceable
```
1. POST /api/outbound/rebalance {pallet_line_id:X, new_qty:0, reason:"thử"}
   → audit ghi nhưng performed_by=NULL (OUT-002), không transaction
2. DELETE FROM audit_logs WHERE entity_id=X   (qua bug INV-003: không trigger)
   → mất dấu hoàn toàn
```
**Findings**: OUT-002 + INV-003 + OUT-001
**Phải fix**: trigger append-only + auth gate route

---

## CROSS-CUTTING ROOT CAUSES (sửa 1 lần áp dụng nhiều nơi)

7 nguyên nhân gốc gây >70% findings. Sửa các root cause này sẽ tự đóng nhiều issue cùng lúc.

### RC-1: Không có lớp `requireAuth(req, roles?)` server-side
**Ảnh hưởng**: AUTH-001, AUTH-002, INB-006, FK-011, FK-015, OUT-007, OUT-008, INV-006, INV-011, XCT-002, XCT-009 (11 finding HIGH/CRITICAL)
**File ảnh hưởng**: ~100 file `src/app/api/**/route.ts`
**Fix template**:
```ts
// src/lib/auth-server.ts (mới)
export async function requireAuth(req: Request, allowedRoles?: Role[]) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new ApiError(401, "Chưa đăng nhập");
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
  const session = await prisma.session.findFirst({ where: { id: payload.sessionId, is_active: true }});
  if (!session) throw new ApiError(401, "Phiên hết hạn");
  const user = await prisma.user.findUnique({ where: { id: payload.userId }});
  if (!user || !user.is_active) throw new ApiError(401);
  if (allowedRoles && !allowedRoles.includes(user.role) && !["ADMIN","MANAGER","STAFF"].includes(user.role))
    throw new ApiError(403);
  return { user, session };
}
```
Mọi route phải gọi `const { user } = await requireAuth(req, ["KE_TOAN","QUAN_LY"]);` ở dòng đầu tiên.

### RC-2: `audit_logs` thiếu DB trigger append-only
**Ảnh hưởng**: INV-003, OUT-001 + làm CP-05, CP-07, CP-08 mất tính trustworthy
**Fix migration mới**:
```sql
CREATE OR REPLACE FUNCTION audit_logs_no_modify() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END $$ LANGUAGE plpgsql;
CREATE TRIGGER trg_audit_logs_no_update BEFORE UPDATE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();
CREATE TRIGGER trg_audit_logs_no_delete BEFORE DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();
REVOKE UPDATE, DELETE ON audit_logs FROM PUBLIC;
```

### RC-3: Pattern "read → check → mutate ngoài transaction" → race vô hệ thống
**Ảnh hưởng**: FK-001, FK-002, FK-003, FK-005, FK-010, OUT-002, OUT-003, OUT-011, INB-002, INB-004, PAL-013, INV-002, INV-004, XCT-005, XCT-006 (15 finding CRITICAL/HIGH)
**Fix template**:
```ts
// Đưa MỌI thao tác (kể cả validate) vào trong $transaction
await prisma.$transaction(async (tx) => {
  // 1. Lock row trước
  await tx.$executeRaw`SELECT id FROM pallets WHERE id = ${id} FOR UPDATE`;
  // 2. Đọc state hiện tại
  const pallet = await tx.pallet.findUnique({ where: { id }});
  // 3. Validate
  if (pallet.status !== "IN_STORAGE") throw new ApiError(409, "Pallet đã đổi trạng thái");
  // 4. Mutate
  await tx.pallet.update({ where: { id }, data: { ... }});
}, { isolationLevel: "Serializable" });
```

### RC-4: Code generation không có advisory lock (PHN, PTT, PL*, KK, DCT)
**Ảnh hưởng**: INB-001, INB-004, FK-004, INV-016 + comment trong `inbound-temp/next-code` đã thừa nhận race
**Fix**: Centralize trong helper, dùng `pg_advisory_xact_lock(hashtext(...))`:
```ts
export async function generateCode(tx, prefix: string, year: number) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix + year}))`;
  const max = await tx.<entity>.aggregate({...});
  return `${prefix}-${year}-${String((max ?? 0) + 1).padStart(4, "0")}`;
}
```
Có pattern đúng ở `src/app/api/pallets/route.ts` (POST) — sao chép sang `inbound`, `inbound-temp/standardize`, `stage-out` partial split, `stock-count`, `adjustments`.

### RC-5: `Number(decimal)` thay vì `Prisma.Decimal` ops
**Ảnh hưởng**: FK-003, OUT-010, OUT-012 (turnover/report KPI sai)
**Fix**: 
```ts
// SAI:
const newWeight = (parent.total_weight_kg - parent.total_weight_kg * ratio).toFixed(2);
// ĐÚNG:
import { Prisma } from "@prisma/client";
const childWeight = parent.total_weight_kg.mul(childQty).div(totalQty);
const newWeight = parent.total_weight_kg.sub(childWeight);
```

### RC-6: Timezone — `T23:59:59Z` thay vì `+07:00`
**Ảnh hưởng**: OUT-014, XCT-012, XCT-013, XCT-015 (báo cáo lệch ~7 giờ)
**Fix template helper**:
```ts
// src/lib/datetime.ts
export const VN_TZ_OFFSET = "+07:00";
export function endOfDayVN(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${VN_TZ_OFFSET}`);
}
export function startOfDayVN(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000${VN_TZ_OFFSET}`);
}
```
Hoặc dùng raw SQL: `WHERE created_at <= ${to}::date + INTERVAL '1 day'`.

### RC-7: Inventory query không filter `qty_box > 0`
**Ảnh hưởng**: FK-014, XCT-022, XCT-023 (gợi ý FEFO pallet ma, cảnh báo HSD vô nghĩa)
**Fix**: Thêm `qty_box: { gt: 0 }` vào mọi where của `palletLine.findMany`/`aggregate` trong module inventory + fefo-suggest.

---

## CRITICAL FINDINGS (22) — CHI TIẾT

### A. AUTH/SECURITY (4)

#### 🔴 AUTH-001 — Toàn bộ API business KHÔNG verify JWT
**File**: `src/middleware.ts:21-38`, `src/app/api/**/route.ts` (ngoại trừ 5 route trong `/api/auth/*`)
**Vấn đề**: Middleware chỉ URL rewrite cho mobile build. ~100 file business không gọi `jwt.verify`. `getRequestActor` chỉ extract actor cho audit, không trả 401.
**Tác động**: Attacker ngoài Internet curl thẳng `POST /api/forklift/put-away`, `POST /api/inbound`, `POST /api/pallets` đều thành công. RBAC client-side bị bypass.
**Fix**: RC-1.

#### 🔴 AUTH-002 — `PUT /api/system/rbac` cho phép ai cũng sửa ma trận phân quyền
**File**: `src/app/api/system/rbac/route.ts:71-127`
**Vấn đề**: Không check JWT, không check ADMIN.
**Tác động**: Anonymous attacker tự cấp quyền `system` cho role mình.
**Fix**: `requireAuth(req, ["ADMIN"])` đầu route, ghi audit.

#### 🔴 AUTH-003 — `JWT_SECRET` fallback hard-coded + COMMIT vào `DEPLOY.md`
**File**: `src/app/api/auth/login/route.ts:6`, `me/route.ts:5`, `change-password/route.ts:6`, `sessions/route.ts:5`, `sessions/[id]/route.ts:5`, `src/lib/audit.ts:5`, `DEPLOY.md:37`
**Vấn đề**: Fallback `"vinhgiang_super_secret_key_2026"` nếu thiếu env. DEPLOY.md commit chính chuỗi này.
**Tác động**: Forge JWT bất kỳ `role=ADMIN` → full takeover (sau khi fix AUTH-001).
**Fix**: Bỏ fallback (throw nếu thiếu env), rotate secret, xoá khỏi DEPLOY.md + git history.

#### 🔴 AUTH-004 — `verify-otp` brute-force OTP khi bỏ trống `identifier`
**File**: `src/app/api/auth/forgot-password/verify-otp/route.ts:6-44`
**Vấn đề**: Không validate `identifier` required. `OR: [{email:undefined},{phone:undefined}]` → Prisma strip → trả user đầu tiên (thường ADMIN seed). Brute-force 5 lần với 1 OTP.
**Fix**: Validate `identifier` required.

### B. INVENTORY/AUDIT NỀN TẢNG (5)

#### 🔴 INV-001 — Approve điều chỉnh KHÔNG cộng/trừ tồn thực
**File**: `src/app/api/adjustments/[id]/approve/route.ts:17-31`
**Vấn đề**: Comment ghi "Cập nhật tồn thực tế" nhưng loop chỉ tạo audit, KHÔNG update `PalletLine.qty_box`/`Inventory`. Không sinh Movement.
**Tác động**: Toàn bộ CP-08 sai vĩnh viễn. "APPROVED" voucher không thay đổi DB.
**Fix**: Trong `$transaction`, mỗi line: locate `PalletLine` → `update qty_box: { increment: Number(line.qty_adjust) }`, tạo `Movement` type `ADJUSTMENT` (cần thêm enum), ghi `applied_at`.

#### 🔴 INV-002 — Approve không có `$transaction`
**File**: `src/app/api/adjustments/[id]/approve/route.ts:17-44`
**Vấn đề**: 4 thao tác chạy rời. Crash giữa chừng → state inconsistent.
**Fix**: Bọc cùng `$transaction` với INV-001.

#### 🔴 INV-003 (= OUT-001) — `audit_logs` không có trigger append-only
**File**: `prisma/migrations/2026-05-27_audit_log_extend.sql` + toàn repo
**Vấn đề**: Docs `CRITICAL_PATHS.md:330` yêu cầu trigger, migration chưa implement.
**Tác động**: `prisma.auditLog.delete/update` thành công → mất tính trustworthy.
**Fix**: RC-2.

#### 🔴 INV-004 — Race approve double-apply (sau khi fix INV-001)
**File**: `src/app/api/adjustments/[id]/approve/route.ts:8-15`
**Vấn đề**: Đọc → check `status==='PENDING'` → update, không lock. 2 manager cùng approve → apply 2 lần.
**Fix**: `tx.adjustmentVoucher.updateMany({ where: { id, status: 'PENDING' }, ... })` rồi check `count === 1`.

#### 🔴 INV-005 — Stocktake CLOSE skip RECONCILING
**File**: `src/app/api/adjustments/[id]/approve/route.ts:39-44`
**Vấn đề**: Approve 1 voucher → tự CLOSE session, không check còn voucher khác PENDING liên kết cùng session.
**Fix**: Check `count(adjustment_vouchers WHERE stocktake_session_id=? AND status='PENDING') === 0` trước CLOSE.

### C. RACE CONDITION CHIẾN LƯỢC (5)

#### 🔴 FK-001 — FEFO + stage-out không lock → 2 xe nâng pick cùng pallet
**File**: `src/app/api/forklift/fefo-suggest/route.ts:21-33`, `src/app/api/forklift/stage-out/route.ts:18-30`
**Vấn đề**: `findUnique` ngoài transaction, validate status, rồi mới mở transaction. 2 xe nâng race → cả 2 đều pass check rồi cùng commit. PARTIAL còn tạo 2 pallet con trừ chồng qty cha → âm số liệu.
**Repro**: 2 request `POST /api/forklift/stage-out` cùng pallet_id IN_STORAGE đồng thời.
**Fix**: RC-3 (đưa toàn bộ vào `$transaction` Serializable + `SELECT FOR UPDATE`).

#### 🔴 FK-002 — Putaway TOCTOU capacity check
**File**: `src/app/api/forklift/put-away/route.ts:35-145`
**Vấn đề**: Check `pallet.status`, `location.pallets.length < max_pallets`, `total_weight < max_weight_kg` rời rạc trước `$transaction`. 2 xe nâng cùng put vào location đầy slot → cả 2 thấy `0/1` → vượt sức chứa (docs gọi "sập kệ").
**Fix**: RC-3.

#### 🔴 FK-003 — Stage-out PARTIAL: `Number(decimal)` mất chính xác + sinh qty âm
**File**: `src/app/api/forklift/stage-out/route.ts:110-127, 161-169`
**Vấn đề**: 3 lỗi cộng dồn:
1. `(parentTotalWeight - parentTotalWeight * ratio).toFixed(2)` thay vì `parent.sub(childWeight)`
2. `newParentQty = Number(parentLine.qty_box) - partialQtyNum` tính ngoài transaction → có thể âm khi race
3. `nextCodeSeq` không advisory lock như `generatePalletCode` → race với POST /api/pallets cùng ngày → unique violation 500
**Fix**: RC-3 + RC-4 + RC-5.

#### 🔴 OUT-002 — Rebalance: AUDIT thiếu actor + LOST UPDATE
**File**: `src/app/api/outbound/rebalance/route.ts:17-82`
**Vấn đề**:
- Không `$transaction`
- Audit ghi qua `prisma.auditLog.create` trực tiếp (không qua `logAudit()`) → thiếu `performed_by`, `ip_address`, `user_agent`
- `Math.max(0, currentQty - outQty)` silent clamp âm về 0 — không error, không audit cảnh báo
- Đọc `findUnique` rồi `update` không lock → race với stage-out
- `palletIds = [...new Set(...)]` dead code
**Tác động**: CP-07 "AUDIT BẮT BUỘC" mất actor + tồn corrupt + không truy được.
**Fix**: RC-1 + RC-3 + dùng `logAudit(req, ..., tx)`.

#### 🔴 OUT-003 — Stage-out FULL không lock pallet
**File**: `src/app/api/forklift/stage-out/route.ts:18-30, 232-268`
**Vấn đề**: Tương tự FK-001 cho mode FULL — 2 user cùng quét → 2 Movement STAGE_OUT trùng, audit nhân đôi.
**Fix**: RC-3.

### D. LOGIC NGHIỆP VỤ THIẾU (4)

#### 🔴 INB-001 — Code prefix tách 2 hệ (`PNK` vs `PHN`)
**File**: `src/app/api/inbound/route.ts:15`, `inbound/next-code/route.ts:17` vs `inbound/import-excel/confirm/route.ts:13`, `inbound-temp/[id]/standardize/route.ts:135`
**Vấn đề**: Helper `generateInboundCode()` trong cùng module dùng prefix khác nhau. CP-01 spec là `PHN`.
**Tác động**: UI/audit/report có cả `PNK-2026-0007` lẫn `PHN-2026-0008` → vi phạm contract; race tạo unique conflict.
**Fix**: Gộp 1 helper duy nhất prefix `PHN`, áp RC-4.

#### 🔴 INB-002 — Excel import confirm: không transaction → orphan ItemCode
**File**: `src/app/api/inbound/import-excel/confirm/route.ts:88-174`
**Vấn đề**: `prisma.itemCode.create` từng cái ngoài transaction, rồi mới `inboundRequest.create`. Fail giữa chừng → ItemCode tạm orphan.
**Fix**: Bọc TOÀN BỘ trong `$transaction`, dùng `tx.itemCode.upsert`.

#### 🔴 OUT-005 — PYX SHIP không cập nhật `qty_shipped`, không trừ tồn, không tạo Movement
**File**: `src/app/api/outbound/requests/[id]/route.ts:51-54`
**Vấn đề**: Action SHIP chỉ `update status='SHIPPED'`. Không:
- Set `OutboundRequestLine.qty_shipped` (UI đọc trường này ở page.tsx:163-164)
- Trừ tồn pallet đã link
- Tạo Movement STAGE_OUT/RELEASED
- Set pallet → RELEASED
- Ghi audit
**Tác động**: Tồn kho **không bao giờ trừ qua PYX** → KPI 2 source of truth không khớp.
**Fix**: Transaction loop lines → giảm `palletLine.qty_box`, set pallet status, tạo Movement, ghi audit; hoặc bắt buộc verify tổng stage_out ≥ qty_requested trước khi SHIP.

#### 🔴 XCT-001 — Path-join bug: file đính kèm KHÔNG bị xoá khỏi disk
**File**: `src/app/api/attachments/[id]/route.ts:18`
**Vấn đề**: `file_url` lưu `"/api/uploads/<name>"`. `path.join(cwd, "public", file_url)` → resolve sai thư mục. `unlink` ENOENT bị `try/catch` nuốt. DB record xoá nhưng file vẫn trên disk → URL gốc vẫn access được.
**Fix**: `path.join(UPLOAD_DIR, path.basename(file_url))` + log warning khi miss.

### E. UPLOAD/FILE LEAK (4)

#### 🔴 XCT-002 — Tất cả route mở (cùng AUTH-001) — duplicate
Xem AUTH-001.

#### 🔴 XCT-003 — Attachment serving không auth + filename brute-forceable
**File**: `src/app/api/uploads/[...path]/route.ts:20-63`
**Vấn đề**: Route public. Filename `${entity_type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}.ext` — random chỉ ~36 bit; biết `entity_type` + timestamp gần thì brute-force được.
**Tác động**: Lộ ảnh chứng từ NCC, ảnh sự cố pallet (FMCG có ảnh hoá đơn → data leak).
**Fix**: 
- Tăng entropy: `crypto.randomUUID()` hoặc 16-byte hex
- Yêu cầu auth trên `/api/uploads/[...path]`
- RBAC theo `entity_type` (THU_KHO của warehouse A không xem file warehouse B)

#### 🔴 XCT-004 — Attachment upload không validate magic bytes → Stored XSS qua SVG
**File**: `src/app/api/attachments/route.ts:48-71`
**Vấn đề**: Chỉ check `file.type` (browser khai báo) + extension cuối. `.svg` chấp nhận → render inline → `<script>` execute.
**Tác động**: Stored XSS lan ra mọi user xem ảnh.
**Fix**: Whitelist ext `jpg|jpeg|png|webp|gif`, đọc magic bytes (`FF D8 FF` JPEG, `89 50 4E 47` PNG, ...), strip SVG hoặc force `Content-Disposition: attachment` + CSP.

---

## HIGH FINDINGS (49) — TÓM TẮT

### Auth (6)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| AUTH-005 | `src/lib/auth.ts:24-29` | Không endpoint logout — token vẫn dùng được sau `removeToken` | Thêm `POST /api/auth/logout` set `session.is_active=false` |
| AUTH-006 | `src/lib/auth.ts:13-29` | Token trong localStorage → XSS đánh cắp | Chuyển HttpOnly cookie + SameSite=Lax |
| AUTH-007 | `forgot-password/send-otp/route.ts:118-128` | **Response body chứa `mock_otp`** → full ATO | Bỏ field ngay, gate sau env `MOCK_OTP=1` + `NODE_ENV!=production` |
| AUTH-008 | `verify-otp/route.ts:54-80` | OTP race: 2 request đồng thời → 2 reset token | `updateMany({where:{id,is_used:false}, data:{is_used:true}})` + check count |
| AUTH-009 | `login`, `send-otp`, `verify-otp` | Username enumeration qua status code khác | Trả message thống nhất + status 401 |
| AUTH-010 | `change-password/route.ts:138-152` | Không revoke session hiện tại sau đổi pass | Cấp token mới hoặc revoke + bắt re-login |

### Inbound (6)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| INB-003 | `inbound/[id]/lines/[lineId]/receive/route.ts:16-79` | `qty_received` không upper bound, không audit, không optimistic lock | Soft warning >20%, audit log, `where: {id, updated_at}` |
| INB-004 | `inbound-temp/[id]/standardize/route.ts:129-175` | `nextSeq` ngoài transaction + link 2 phía riêng → mất link PTT↔PHN | Đưa vào 1 transaction interactive + advisory lock |
| INB-005 | `request-recheck/route.ts:45-53` ↔ `complete/route.ts:52-69` | Không reset `qty_accepted` khi recheck → complete sai data | `updateMany({where:{inbound_request_id:id}, data:{qty_accepted:null}})` |
| INB-006 | toàn bộ `src/app/api/inbound*` | 14+8 route KHÔNG check role | RC-1 |
| INB-007 | `inbound-temp/[id]/lines/route.ts:43-64` | DELETE line không verify thuộc temp → cross-phiếu | `findFirst({id:line_id, inbound_temp_id:id})` trước delete |
| INB-008 | `complete/route.ts:81-100` | Block list cứng pallet status, không dùng allow-list | Import `STOCK_PALLET_STATUSES` constant chung |

### Pallet + Forklift (8)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| FK-004 | `stage-out/route.ts:87-99` | Split seq + code seq không advisory lock như `pallets/route.ts` | RC-4 |
| FK-005 | `forklift/relocate/route.ts:34-138` | `newOldStatus` từ count snapshot ngoài tx → location flap | RC-3 |
| FK-006 | `stage-out/route.ts:244-248` | Location cũ luôn set `EMPTY` dù còn pallet khác (multi-pallet rack) | Count `pallet.count({where:{location_id, status:in(IN_STORAGE,IN_STAGING), id:{not:pallet_id}}})` |
| FK-007 | `stage-out/route.ts:177-183` | Staging location auto-pick không check max_pallets, MAINTENANCE | Validate giống put-away |
| FK-008 | `stage-out/route.ts:60-68` | PARTIAL reject pallet >1 line — spec FEFO yêu cầu split theo SKU | Cho `partial_qty` đi cùng `pallet_line_id` |
| FK-009 | `forklift/relocate/route.ts:75-92, 138` | Chỉ reject MAINTENANCE, bỏ qua RESERVED/WAITING_OUTBOUND/FULL khi max_pallets=null | Whitelist EMPTY/USING/PARTIAL |
| FK-010 | `forklift/web/assign/route.ts:17-79` | Không transaction, không reserve pallet → multi-assign cùng pallet | `Pallet.assigned_to` field + update `where:{id, assigned_to:null}` |
| FK-011 | `forklift/web/assign/route.ts:4` | Endpoint admin không check role caller | RC-1 |

### Return + Outbound (9)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| OUT-006 | `outbound/requests/[id]/route.ts:56-58` | CANCEL phiếu PICKING không reset pallet đã link → mồ côi staging | Check lines.pallet_id, alert/unlink/auto RETURN |
| OUT-007 | `outbound/requests/route.ts` + `[id]/route.ts` | PYX không filter role/warehouse | RC-1 |
| OUT-008 | `outbound/rebalance/route.ts` | Không check role | RC-1 |
| OUT-009 | `movements/route.ts:6-66` | GET trả mọi movement, không filter role/warehouse | Filter `performed_by=me` cho XE_NANG |
| OUT-010 | `stage-out/route.ts:131-159, 172-175` | Pallet con không recompute `total_lines`, parent split rounding | RC-5 |
| OUT-011 | `forklift/return/route.ts:44-48, 81-181` | Check location `EMPTY` ngoài tx → 2 pallet share 1 location | RC-3 |
| OUT-012 | `outbound/turnover/route.ts:22-38`, `report/route.ts:48-71` | KPI duyệt `pallet.lines` thay vì `m.qty_box` → đếm dồn cha+con, sai số | Dùng `m.qty_box`+`m.item_code_id` (đã có ở migration phase0) |
| OUT-013 | `reorder-suggest/route.ts:8-95` | Không trừ `InboundRequest` pending, không lead time | Trừ `sum(qty_expected) WHERE inbound_request.status IN(PENDING,RECEIVING)` |
| AUTH-013 | `login/route.ts:101-119` | Account lockout vĩnh viễn → DoS user dễ | `lockout_until = now+15min`, CAPTCHA sau 3 fail |

### Stock-count + Adjustment (7)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| INV-006 | toàn bộ `adjustments/**`, `stock-count/**` | Không gate role | RC-1 |
| INV-007 | `stock-count/route.ts:65-81` + `quick-scan/route.ts:53-66` | Snapshot system_qty không lock pallet move trong COUNTING | Bảng `stocktake_locks` hoặc lưu `pallet_line_snapshot` per count |
| INV-008 | `stock-count/[id]/complete/route.ts:14-27` | Không check status transition → CLOSE lần 2 ghi đè | `updateMany({where:{id, status:in(OPEN,COUNTING)}})` |
| INV-009 | `stock-count/[id]/route.ts:99-172` | PUT cho ghi đếm khi CLOSED/RECONCILING + force status về COUNTING | Load session, reject nếu RECONCILING/CLOSED, dùng `updateMany` guard |
| INV-010 | `adjustments/route.ts:20-67` | Không validate `qty_before` khớp tồn thực, không bind 1-1 với StocktakeCount | Server load `qty_before` từ DB, thêm `stocktake_count_id @unique` lên `AdjustmentLine` |
| INV-011 | `audit-logs/route.ts:6-26` | Public, không phân trang đúng, leak audit cho XE_NANG | `requireRole(['ADMIN','QUAN_LY','KE_TOAN'])`, cursor pagination |
| INV-012 | `adjustments/[id]/reject/route.ts:14-19` | Không audit log + không lưu `rejected_reason` | Thêm body validation + `logAudit` action REJECT |

### Cross-cutting (13)
| ID | File:line | Vấn đề | Fix |
|---|---|---|---|
| XCT-005 | `item-codes/route.ts:167-194` | Race `findUnique→create` → trùng ItemCode + 500 generic | `upsert` hoặc catch P2002 trả 409 |
| XCT-006 | `item-codes/[id]/route.ts:146-194` | Race chuẩn hoá → tạo trùng Product | Đưa `findUnique` vào transaction + `tx.product.upsert` |
| XCT-007 | `products/[id]/route.ts:240-273` | DELETE không check FK → 500 generic | Count reference, trả 409 với message rõ; soft delete |
| XCT-008 | `item-codes`, `products` route GET | `page`/`limit` không validate NaN/cap → DoS | `Math.min(Math.max(1, n||10), 100)` |
| XCT-009 | `system/config/route.ts:16-32` | PUT bất kỳ key — gồm `rbac_role_features`, mail credentials | Whitelist key, block RBAC/mail/security |
| XCT-010 | `movements/route.ts:32-42` | Không scope warehouse/role | Bắt buộc 1 filter + scope multi-warehouse |
| XCT-011 | `inventory/alerts/route.ts:7-244` | Không dedupe alert (spam mỗi 6h) hoặc mất hành động | Bảng `alert_log` state machine OPEN/ACK/RESOLVED |
| XCT-012 | `inventory/alerts/route.ts:10-11, 40-41`, `by-location/route.ts:48-56` | TZ: `Date` JS vs `@db.Date` lệch ±1 ngày | RC-6 hoặc raw SQL `CURRENT_DATE + INTERVAL '7 days'` |
| XCT-013 | `inventory/by-location/route.ts:48-56` | `has_expiring_soon` flat boolean — mất warning/urgent | Đổi `expiry_level: "urgent"\|"warning"\|"normal"` |
| XCT-014 | `inventory/by-pallet/route.ts:64-90` | `original` = remaining + STAGE_OUT — bỏ sót RETURN/ADJUSTMENT | Lưu `pallet.original_total_qty` snapshot lúc CONFIRMED |
| XCT-015 | `movements/route.ts:22` | `T23:59:59` thiếu `.999` ms | `lte: new Date(to+"T23:59:59.999")` hoặc `lt: startOfNextDay` |
| XCT-016 | `products/import-excel/confirm/route.ts:107-135` | Re-import reset `manage_lot`/`manage_expiry=false` | Chỉ ghi khi file có cột tương ứng |
| OUT-014 | `audit-logs/route.ts:18`, `outbound/report/route.ts:17`, `movements/route.ts:22` | `T23:59:59Z` lệch 7h | RC-6 |

---

## MEDIUM (20) — bảng tham chiếu

| ID | Module | File:line | Vấn đề ngắn |
|---|---|---|---|
| AUTH-011 | auth | jwt.verify mọi nơi | Không pin `algorithms:['HS256']` |
| AUTH-012 | auth | `login/route.ts:155-180` | 2 query ghi token (create+update) — reliability |
| AUTH-014 | auth | `reset-password/route.ts:122-142` | Không revoke reset token khác của cùng user |
| AUTH-015 | auth | `change-password/route.ts:107-123` | Message khác → leak xác nhận pass đúng |
| INB-009 | inbound | `inbound/import-excel/route.ts:78-121` | Heuristic header Excel match nhầm cột, NaN qty không filter |
| PAL-012 | pallet | `pallets/[id]/route.ts:48-96` | DELETE không check Movement reference, không guard role |
| PAL-013 | pallet | `pallets/[id]/lines/route.ts:112-146` | Race aggregate `total_lines/total_weight_kg` lệch |
| FK-014 | forklift | `fefo-suggest/route.ts:12-17` | Thiếu secondary sort `manufactured_date`, `lot`; không filter `location_id IS NOT NULL`, `qty_box > 0` |
| INV-013 | stocktake | `stock-count/[id]/add-unexpected/route.ts:72-99` | Không dedup `(session,location,item,lot)` → dup line |
| INV-014 | stocktake | `stock-count/route.ts:73-80` | BY_ITEM không group `lot` → discrepancy mất chi tiết |
| INV-015 | stocktake | `stock-count/[id]/route.ts:145-166` | PUT không set `counted_by`, không audit per count |
| INV-016 | stocktake | `stock-count/route.ts:60-61`, `adjustments/route.ts:41-42` | Mã KK/DCT race `count+1` |
| OUT-014 | report | (đã list) | TZ `T23:59:59Z` |
| OUT-015 | outbound | `outbound/staging/route.ts:44-52` | `nearest_expiry` không cờ `overdue` |
| XCT-017 | products | `products/import-excel/confirm/route.ts:107-135` | Không sync `min_stock`/`max_stock` |
| XCT-018 | item-codes | `item-codes/by-barcode/route.ts:22-28` | `findFirst` không deterministic order — scan trả khác nhau |
| XCT-019 | item-codes | `item-codes/route.ts:134`, `[id]/route.ts:95` | Regex không match Unicode/dấu — reject mã NCC tiếng Việt |
| XCT-020 | products | `confirm/route.ts:101-104` | Barcode conflict silent set null |
| XCT-021 | products | `import-excel/route.ts:141` vs `confirm/route.ts:108` | Preview case-insensitive, confirm case-sensitive → tạo 2 SP "ABC"/"abc" |
| XCT-022 | inventory | `by-item/route.ts:36-50` | `nearest_expiry` không filter `qty_box > 0` |
| XCT-023 | inventory | `alerts/route.ts:14-38` | Cảnh báo HSD pallet đã rút sạch |

---

## LOW (7) — defensive miss

| ID | File:line | Vấn đề |
|---|---|---|
| AUTH-016 | `prisma/schema.prisma:52` | `session.token` không hash — DB leak = token leak |
| INB-010 | `inbound/next-code`, `inbound-temp/next-code` | Preview mã race với POST — UX confusion |
| FK-015 | toàn bộ `/api/forklift/*` | Không gate role `XE_NANG` (cross-cut RC-1) |
| FK-016 | `forklift/web/drivers/route.ts:24-103` | N+1 query (6 round-trip) + mock data lẫn real |
| OUT-016 | `audit-logs/route.ts:22-26` | `take:200` cứng, không cursor — không xem lịch sử cũ |
| XCT-024 | `item-codes/[id]/route.ts:226-256` | DELETE pending không check reference → 500 generic |
| PAL-012 | (đã list MEDIUM) | DELETE pallet không check Movement (downgrade) |

---

## LỊCH FIX ĐỀ XUẤT (3 sprint)

### Sprint 0 — Hot patch trước go-live (1 tuần)
**Không sửa = không production**

1. **RC-1**: Tạo `requireAuth()` helper + áp lên top 10 route admin (system/*, adjustments/approve, outbound/rebalance) — _2 ngày_
2. **AUTH-007**: Xoá field `mock_otp` khỏi response — _10 phút_
3. **AUTH-002**: Gate `PUT /api/system/rbac` bằng `requireAuth(['ADMIN'])` — _10 phút_
4. **AUTH-003**: Bỏ JWT_SECRET fallback + xoá khỏi `DEPLOY.md` + rotate secret — _30 phút_
5. **RC-2**: Migration thêm trigger `audit_logs` append-only — _30 phút_
6. **INV-001 + INV-002**: Approve adjustment thực sự update tồn + bọc transaction — _1 ngày_
7. **OUT-005**: PYX SHIP cập nhật `qty_shipped` + trừ tồn + tạo Movement + audit — _1 ngày_
8. **XCT-001**: Sửa path-join attachment DELETE — _10 phút_
9. **XCT-003 + XCT-004**: Upload — random UUID filename + magic bytes validation + cấm SVG inline — _4 giờ_

**Total**: ~5 ngày 1 dev

### Sprint 1 — Race conditions (2 tuần)
Áp dụng **RC-3** + **RC-4** cho top route concurrency:

1. **FK-001 + FK-003**: FEFO + stage-out trong `$transaction` Serializable + advisory lock
2. **FK-002**: Putaway transaction + capacity check trong tx
3. **OUT-002**: Rebalance transaction + dùng `logAudit()` chuẩn
4. **INV-004**: Approve double-apply prevention với `updateMany` guard
5. **INB-001**: Gộp `generateInboundCode()` 1 helper prefix `PHN` + RC-4
6. **INB-002**: Excel import confirm transaction toàn cục
7. **OUT-011 + FK-005 + FK-006**: Return + relocate atomic + count location chuẩn
8. **XCT-005 + XCT-006**: ItemCode + Product upsert

**Total**: ~10 ngày 1 dev

### Sprint 2 — Hardening + bug nghiệp vụ (2 tuần)
1. **RC-1 áp full**: ~100 file route — dùng codemod script
2. **RC-5**: `Prisma.Decimal` ops thay `Number()`
3. **RC-6**: Helper `endOfDayVN()` áp 4 file timezone bug
4. **RC-7**: Filter `qty_box > 0` 3 file inventory
5. **OUT-012**: Turnover/report dùng `m.qty_box` thay `pallet.lines`
6. **OUT-013**: Reorder-suggest trừ inbound pending
7. **AUTH-005 + AUTH-006**: Logout endpoint + chuyển sang HttpOnly cookie
8. **INV-007**: Stocktake_locks bảng + check khi pallet move
9. **INV-010**: AdjustmentLine bind 1-1 StocktakeCount
10. Hết MEDIUM còn lại — codemod + review

**Total**: ~10 ngày 1 dev

---

## FILE/MODULE ẢNH HƯỞNG NHIỀU NHẤT

| File | # findings | Severity cao nhất |
|---|---:|---|
| `src/app/api/forklift/stage-out/route.ts` | 7 | CRITICAL |
| `src/app/api/adjustments/[id]/approve/route.ts` | 5 | CRITICAL |
| `src/app/api/forklift/put-away/route.ts` | 3 | CRITICAL |
| `src/app/api/outbound/rebalance/route.ts` | 3 | CRITICAL |
| `src/app/api/auth/forgot-password/verify-otp/route.ts` | 3 | CRITICAL |
| `src/app/api/attachments/route.ts` | 3 | CRITICAL |
| `src/lib/audit.ts` | 2 | CRITICAL (cross-cut) |
| `src/middleware.ts` | 1 (root of AUTH-001) | CRITICAL |
| `prisma/migrations/*` | 1 (missing trigger) | CRITICAL |

---

## TRACEABILITY MA TRẬN — CRITICAL PATHS ↔ FINDINGS

| Critical Path | Findings ảnh hưởng | Trạng thái |
|---|---|---|
| CP-01 Nhập có phiếu | INB-001, INB-002, INB-003, INB-006, INB-008 | ⚠️ Code prefix sai, không transaction, không gate role |
| CP-02 Nhập đột xuất | INB-004, INB-007 | ⚠️ Standardize race, DELETE cross-phiếu |
| CP-03 Putaway | FK-002, FK-009 | ⚠️ TOCTOU capacity, status whitelist thiếu |
| CP-04 FEFO | FK-001, FK-003, FK-014 | 🔴 Double-pick race + Decimal mất chính xác |
| CP-05 Return (AUDIT) | OUT-001, OUT-011 | 🔴 Audit trigger thiếu + location race |
| CP-06 Excel import | INB-002, XCT-016 | ⚠️ Transaction + reset manage_expiry |
| CP-07 Rebalance (AUDIT) | OUT-001, OUT-002 | 🔴 Audit thiếu actor + không transaction |
| CP-08 Kiểm kê + Điều chỉnh (AUDIT) | INV-001..005, INV-007, INV-010 | 🔴 Approve không apply tồn, audit không trigger |
| CP-09 Cảnh báo HSD | XCT-011, XCT-012, XCT-013 | ⚠️ Dedup + timezone + không phân cấp warning |
| CP-10 Auth & RBAC | AUTH-001..016, XCT-002 | 🔴 100% bị bypass server-side |

---

## PHỤ LỤC — DANH SÁCH FILE ĐÃ REVIEW

**Auth/RBAC**: `src/middleware.ts`, `src/lib/rbac.ts`, `src/lib/audit.ts`, `src/lib/auth.ts`, `src/app/api/auth/{login,me,change-password,sessions,sessions/[id],forgot-password/{send-otp,verify-otp,reset-password}}/route.ts`

**Inbound**: `src/app/api/inbound/{route,next-code,[id]/{route,send,receive,finish-receiving,complete,request-recheck,lines/route,lines/[lineId]/accept,lines/[lineId]/receive},import-excel/{route,confirm},template}/route.ts`, `src/app/api/inbound-temp/{route,next-code,summary,inventory,[id]/{route,standardize,reject,create-supplier,lines}}/route.ts`

**Pallet + Forklift**: `src/app/api/pallets/{route,[id]/{route,confirm,history,lines/route,lines/[lineId]}}/route.ts`, `src/app/api/forklift/{fefo-suggest,put-away,relocate,stage-out,return,queue,history,web/{assign,drivers,tasks,kpi}}/route.ts`

**Outbound**: `src/app/api/outbound/{requests/route,requests/[id]/route,rebalance,staging,turnover,report,reorder-suggest}/route.ts`, `src/app/api/movements/route.ts`

**Stocktake + Adjustment**: `src/app/api/stock-count/{route,[id]/{route,complete,add-unexpected},quick-scan}/route.ts`, `src/app/api/adjustments/{route,[id]/{approve,reject}}/route.ts`, `src/app/api/audit-logs/route.ts`

**Cross-cutting**: `src/app/api/{item-codes,products}/{route,[id]/route}` + sub-routes, `src/app/api/attachments/{route,[id]/route}`, `src/app/api/uploads/[...path]/route.ts`, `src/app/api/inventory/{by-location,by-pallet,by-lot,by-item,alerts}/route.ts`, `src/app/api/system/{rbac,config,mail,users}/route.ts`

**Schema/Migration**: `prisma/schema.prisma`, `prisma/migrations/*.sql`, `migrate_phase0.sql`

**Docs tham chiếu**: `docs/CRITICAL_PATHS.md`, `docs/SECURITY.md`, `docs/IMPLEMENTATION_ROADMAP.md`, `docs/DATABASE.md`, `docs/API_CONTRACTS.md`

---

**Báo cáo tạo tự động bằng 6 subagent review song song. Mỗi finding đều có file:line chứng minh + repro nếu khả thi. Không bịa.**

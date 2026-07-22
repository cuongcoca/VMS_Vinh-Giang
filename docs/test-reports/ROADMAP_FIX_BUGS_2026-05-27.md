# Lộ trình fix bug theo báo cáo BUG_REPORT_QLY_2026-05-27

> **Nguồn báo cáo:** [BUG_REPORT_QLY_2026-05-27.md](./BUG_REPORT_QLY_2026-05-27.md)
> **Tổng số FAIL:** 103 TC trong 7 module + 28 Not Run + 4 module trống (MD08-11)
> **Lộ trình dự kiến:** 8 tuần (1 dev backend + 1 dev frontend + 1 QA), có thể nén còn 5-6 tuần nếu chạy parallel.
> **Ngày viết:** 2026-05-27

---

## 0. Bản đồ tham chiếu nhanh (root cause cố định cho nhiều TC)

| # | Vấn đề lõi | Số TC ảnh hưởng | File chính |
|---|---|---:|---|
| RC-1 | Chốt phiếu nhập không sinh Pallet IN_STORAGE → không lên tồn kho | 3 (TC_CLOSE_IN_006/_010/_015) | [src/app/api/inbound/[id]/complete/route.ts](../../src/app/api/inbound/[id]/complete/route.ts) |
| RC-2 | Schema `AuditLog` thiếu trường `role / ip_address / user_agent`; nhiều route ghi log thiếu/sai action | 5+ (TC_EDIT_PAL_008/_013/_014/_018/_020) + tất cả route mutating | [prisma/schema.prisma](../../prisma/schema.prisma) (model AuditLog) |
| RC-3 | Enum `LocationStatus` (EMPTY/USING/FULL/PARTIAL/MAINTENANCE/RESERVED/WAITING_OUTBOUND/NEEDS_CHECK) không khớp label mockup ("Trống/Đang dùng/Đầy/Còn 1 phần/Chờ kiểm kê/Khóa SD/Cần kiểm tra lại") | 8 (TC_LOC_003 + _014→_019 + row 207) | [prisma/schema.prisma](../../prisma/schema.prisma) (LocationStatus) + UI badge component |
| RC-4 | Mobile `/thukho/adhoc/new` không upload được ảnh runtime, validate yếu, không trim, mất NCC/ghi chú | 9 (TC_TMP_IN_010 → _025) | [src/app/thukho/adhoc/new/page.tsx](../../src/app/thukho/adhoc/new/page.tsx) + [src/app/api/inbound-temp/route.ts](../../src/app/api/inbound-temp/route.ts) |
| RC-5 | Forklift chưa có QR scan + audit log đầy đủ + FEFO logic | 6 Fail + 10 Not Run | [src/app/api/forklift/*](../../src/app/api/forklift/) + [src/app/forklift/*](../../src/app/forklift/) |
| RC-6 | Thiếu cơ chế notification Kế toán → Thủ kho khi lưu phiếu YC nhập | 2 (TC_IN_REQ_027/_028) | [src/app/api/inbound/route.ts](../../src/app/api/inbound/route.ts) — NOT FOUND notification service |
| RC-7 | Form Khai báo SP & Mã hàng: validate sai (i18n EN), trạng thái default sai, thiếu field "Ảnh hàng/vỏ thùng" | 7 (cụm UC-MD-01 + UC-MD-02) | [src/app/items/new/page.tsx](../../src/app/items/new/page.tsx) (hoặc tương đương) + [src/app/api/products/route.ts](../../src/app/api/products/route.ts) + [src/app/thukho/item-code/new/page.tsx](../../src/app/thukho/item-code/new/page.tsx) |
| RC-8 | OTP forgot-password khóa 1 tiếng thay vì 30 phút | 1 (TC_T04_18 Not Run nhưng có actual) | [src/app/api/auth/forgot-password/verify-otp/route.ts](../../src/app/api/auth/forgot-password/verify-otp/route.ts) |

---

## 1. Phase 0 — Setup & Retest (½ tuần · ~2 ngày)

### Mục tiêu
- Đóng các TC đã `Dev: Fixed` mà chưa retest, gỡ noise khỏi báo cáo.
- Tạo nhánh `fix/wave-bug-report-2026-05-27` từ `main` để tổng hợp toàn bộ fix.

### Việc cần làm
1. **Retest 7 TC `Fixed`** (QA chủ trì):
   - MD01: TC_T03_12 (trim password)
   - MD02: TC_STANDARD_001, row 97 (Tạo mã hàng mới), TC_SUP_001, TC_SUP_002 (NCC mapping field)
   - MD03: TC_CREATE_PAL_011 (text mismatch — nghi cùng giá trị "Chưa kích hoạt" nhưng đánh Fail)
2. **Cập nhật sheet Google** với kết quả retest. Đóng TC nếu Pass.
3. **Tạo Jira/issue board** import từ báo cáo (tự động hoá: `gh issue create` qua script đọc Markdown).
4. **Setup screenshot folder**: `docs/test-reports/screenshots/2026-05-27/` để dev attach evidence khi tự test lại.

### Acceptance
- 7 TC Fixed có status mới (Pass/Reopen) trên sheet.
- Board issue tracking ≥ 96 issues (103 Fail – 7 retest – các issue gộp cùng root cause).

---

## 2. Phase 1 — Critical Path: Inbound → Inventory (Tuần 1, 4-5 ngày)

> ⛔ **Blocker cho cả hệ thống.** Phiếu nhập đang chốt mà tồn kho không lên → toàn bộ Dashboard / Inventory / Outbound / Stocktake đều sai số.

### 2.1 Sửa luồng chốt phiếu sinh Pallet `IN_STORAGE`

**TC cover:** TC_CLOSE_IN_006, TC_CLOSE_IN_010, TC_CLOSE_IN_015 (MD04 UC-IN-04).

**Root cause (đã verify code):**
- File [src/app/api/inbound/[id]/complete/route.ts](../../src/app/api/inbound/[id]/complete/route.ts) chỉ `UPDATE inbound_request SET status='COMPLETED'`. Không có code nào tạo `Pallet` hay set `pallet.status = IN_STORAGE`.
- Bảng tồn kho không có model riêng — `GET /api/inventory/by-item` đang `groupBy PalletLine WHERE pallet.status IN (IN_STORAGE, IN_STAGING)`. Nên phải có pallet đúng status mới có tồn.

**Việc cần làm:**
1. Trong transaction của `complete/route.ts`:
   - Verify tất cả PalletLine của các Pallet `CONFIRMED` thuộc phiếu này.
   - Set `pallet.status = IN_STORAGE` cho các pallet đã `CONFIRMED` + có `location_id`.
   - Pallet chưa có location: vẫn cho phép chốt nhưng giữ `CONFIRMED` (trừ khi business rule yêu cầu khác — confirm với BA).
   - Cập nhật `inbound_request.completed_at`, `reconciled_by` (lấy từ session).
2. Ghi audit log cụm: action `COMPLETE_INBOUND` + per-pallet `MOVE_TO_STORAGE` (entity_type=`pallet`).
3. Trigger event `inbound:completed` (sự kiện in-process — chuẩn bị cho Phase 7 notification).

**File ảnh hưởng:**
- [src/app/api/inbound/[id]/complete/route.ts](../../src/app/api/inbound/[id]/complete/route.ts)
- [prisma/schema.prisma](../../prisma/schema.prisma) (có thể cần thêm `reconciled_by`, `completed_by` nếu chưa có)

**Acceptance:**
- Sau khi POST `/complete` → `GET /api/inventory/by-item` cho thấy SL tăng đúng tổng `qty_accepted` của phiếu.
- Test case TC_CLOSE_IN_006/_010/_015 retest PASS với evidence là JSON response.

**Effort:** 1.5 ngày backend + 0.5 ngày QA.

### 2.2 Đối chiếu phiếu nhập trên PC — hiển thị thiếu/sai field

**TC cover:** UC-IN-03 row 79.

**Việc cần làm:**
- Sửa trang [src/app/inbound/[id]/page.tsx](../../src/app/inbound/[id]/page.tsx) (hoặc tương đương Kế toán) để hiển thị thêm:
  - Tổng yêu cầu (sum qty_expected)
  - Tổng thực nhập (sum qty_received)
  - Pallet đã tạo (count pallets where inbound_request_id)
  - Cột "Mã tạm" (mã chứng từ NCC) + "Trạng thái dòng" + "Pallet chứa"
- Đảm bảo cùng layout với mockup. **Đính kèm screenshot mockup vào ticket.**

**Effort:** 1 ngày frontend.

### 2.3 Tiếp nhận phiếu nhập trên mobile

**TC cover:** TC_RECEIVE_IN_002 (mở phiếu báo lỗi reload), TC_RECEIVE_IN_008/_009/_014/_028 (ghi chú chênh lệch), TC_RECEIVE_IN_031 (kéo thả file Excel).

**Việc cần làm:**
1. Debug lỗi reload khi mở phiếu trên mobile: kiểm tra [src/app/thukho/inbound/[id]/page.tsx](../../src/app/thukho/inbound/[id]/page.tsx) + xem console / network log thực tế. Có thể do `useSearchParams` chạy ở runtime với Next.js 16 — xem [feedback_nextjs_version.md](../../../../C:/Users/LOQ/.claude/projects/D--wms-vinhgiang-repo/memory/feedback_nextjs_version.md).
2. Mở khả năng nhập ghi chú khi line có chênh lệch:
   - Schema có thể đã có field `note` trên `InboundLine` — verify, nếu chưa thì thêm migration.
   - UI input cho cả "ghi chú thiếu" và "ghi chú thừa".
3. Hoãn TC_RECEIVE_IN_031 (kéo thả file Excel) sang Phase 9 (feature nhỏ, không blocker).

**Effort:** 1.5 ngày fullstack.

---

## 3. Phase 2 — Audit Log đầy đủ (Tuần 1-2, 3 ngày)

### 3.1 Mở rộng schema `AuditLog`

**TC cover:** TC_EDIT_PAL_008, _013, _014, _018, _020 (MD03 UC-PAL-05).

**Việc cần làm:**
1. Migration thêm cột vào `audit_logs`:
   ```prisma
   model AuditLog {
     // ... existing fields
     performed_by_role  String?  @db.VarChar(40)   // SYS_ADMIN / MANAGER / KE_TOAN / ...
     ip_address         String?  @db.VarChar(45)   // IPv4/IPv6
     user_agent         String?  @db.VarChar(255)
   }
   ```
2. Tạo helper `lib/audit.ts`:
   ```ts
   export async function logAudit(req, params) {
     return prisma.auditLog.create({
       data: {
         entity_type, entity_id, action,
         old_value, new_value, reason,
         performed_by: session.user.id,
         performed_by_role: session.user.role,
         ip_address: req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip'),
         user_agent: req.headers.get('user-agent')?.slice(0, 255),
       },
     });
   }
   ```
3. Refactor tất cả `prisma.auditLog.create(...)` hiện có sang helper. Grep `auditLog.create` để liệt kê.

**File ảnh hưởng:**
- [prisma/schema.prisma](../../prisma/schema.prisma)
- Tạo mới `src/lib/audit.ts`
- Tất cả route `src/app/api/**/*.ts` có `auditLog.create`

### 3.2 Trang xem audit log (Hệ thống)

**TC cover:** chuẩn bị cho MD10 UC-SYS Audit Log.

**Việc cần làm:**
- Sửa [src/app/system/audit-log/page.tsx](../../src/app/system/audit-log/page.tsx) hiển thị bảng đầy đủ: thời gian, user + role, IP, entity, action, diff (old → new), reason.
- API `GET /api/audit-logs` (filter theo entity_type/entity_id/range date/user).
- Pagination + filter.

**Effort:** Schema + helper: 0.5 ngày. Refactor toàn bộ route: 1 ngày. UI audit log: 1.5 ngày.

---

## 4. Phase 3 — Pallet (Tuần 2-3, 5 ngày)

### 4.1 Tạo pallet (UC-PAL-01)

**TC cover:**
- Row 15 (thiếu "Liên kết phiếu nhập" trên desktop, validate năm sai 5 ký tự).
- TC_CREATE_PAL_008 (Ngày nhập không validate quá khứ, nhập nhiều số trường năm vẫn được).
- TC_CREATE_PAL_011 (text mismatch trạng thái — verify lại).
- Row 45 (chọn phiếu nhập liên kết nhưng tạo xong chưa liên kết).
- Row 46 (vẫn hiển thị phiếu đã gán).
- Row 47 (chưa hiển thị danh sách hàng theo phiếu).

**Việc cần làm:**
1. Form tạo pallet [src/app/thukho/pallet/new/page.tsx](../../src/app/thukho/pallet/new/page.tsx): thêm field "Liên kết phiếu nhập" (combobox) cho desktop. Disable + hide phiếu đã có pallet (filter ở API).
2. API danh sách phiếu nhập gợi ý: `GET /api/inbound?has_pallet=false`. Thêm WHERE NOT EXISTS subquery pallets.
3. Validate Ngày nhập (year đúng 4 ký tự, không nhập ngày tương lai/quá xa). Dùng `react-hook-form + zod`.
4. Sau khi chọn phiếu: gọi `GET /api/inbound/[id]/lines` → render danh sách hàng (read-only) trong form pallet.
5. Verify text trạng thái sau tạo pallet: hiện đang là `EMPTY` enum, UI hiển thị "Chưa kích hoạt"? Hoặc đổi enum.

**Effort:** 1.5 ngày frontend + 0.5 ngày backend.

### 4.2 Cập nhật pallet — thêm hàng (UC-PAL-02)

**TC cover:** TC_UPDATE_PAL_001, row 50, TC_UPDATE_PAL_005, _006, _011, _035, _037, row 79.

**Việc cần làm:**
1. **Đơn vị lẻ (cụm bug chính):**
   - Trong [src/app/api/pallets/[id]/route.ts](../../src/app/api/pallets/[id]/route.ts) (PATCH) thêm field `qty_unit_label` (lấy từ ItemCode.unit_alt hoặc tính quy đổi). Trả về để FE hiển thị.
   - Hoặc tốt hơn: sửa luôn UI để khi user chọn ItemCode → auto hiển thị unit lẻ tương ứng (xem ItemCode model).
2. **Validate bắt buộc** (TC_UPDATE_PAL_005): disable nút "Thêm vào pallet" khi thiếu Lô/HSD/SL/Mã hàng.
3. **Auto trim** (TC_UPDATE_PAL_006): trong API trim các trường text khi PATCH (Mã hàng, lô, ghi chú).
4. **Hiển thị ghi chú** (TC_UPDATE_PAL_011): trong UI danh sách dòng hàng, render `palletLine.note`.
5. **Thông tin tab pallet** (row 50): sửa header pallet detail page để hiển thị **Trạng thái + Mã phiếu nhập + Tên người tạo + Thời gian** thay vì NCC + SL dòng + KL + Ngày tạo.
6. **Bỏ "Ảnh đính kèm" trên Desktop** (TC_UPDATE_PAL_035): xoá block UI thừa.
7. **Phân quyền Thủ kho thêm/xoá dòng** (TC_UPDATE_PAL_037): kiểm tra RBAC client-side (DEFAULT_ROLE_FEATURES) — cho phép Thủ kho thao tác dòng hàng kể cả khi pallet đã liên kết phiếu YC nhập.

**File:** [src/app/thukho/pallet/[id]/page.tsx](../../src/app/thukho/pallet/[id]/page.tsx) + [src/app/api/pallets/[id]/route.ts](../../src/app/api/pallets/[id]/route.ts) + RBAC config.

**Effort:** 2 ngày fullstack.

### 4.3 Xác nhận pallet (UC-PAL-04) — TC_CONFIRM_PAL_026

- Cùng root cause với 4.2 (đơn vị lẻ). Fix Phase 3.2 sẽ cover.

### 4.4 Sửa pallet sau xác nhận (UC-PAL-05)

**TC cover:** row 143 (mobile thiếu field), row 148 (counter ký tự mobile), 5 TC audit log.

**Việc cần làm:**
1. Trang sửa sau xác nhận (mobile responsive trong cùng `[id]/page.tsx`): hiển thị đủ 4 field "Mã Pallet / Lý do sửa / Mô tả chi tiết / Người duyệt".
2. Input counter ký tự + validate `min 5` cho "Lý do sửa", disable Confirm khi <5.
3. Audit log đầy đủ: dựa trên Phase 2 helper, ghi rõ action `EDIT_AFTER_CONFIRM`, lưu `old_value` + `new_value` + `reason` (lý do sửa).

**Effort:** 1 ngày frontend.

### 4.5 Xem lịch sử pallet (UC-PAL-06) — 10 TC fail

**TC cover:** Row 166, TC_HISTORY_PAL_002/_003/_004/_006/_008/_013/_014/_015/_017/_018/_020.

**Việc cần làm:**
1. API [src/app/api/pallets/[id]/history/route.ts](../../src/app/api/pallets/[id]/history/route.ts): join `Movement` + `AuditLog` cho pallet đó. Trả về cả thay đổi trạng thái + thay đổi vị trí + ai/khi nào.
2. UI history view: hiển thị timeline đủ "vị trí cũ → vị trí mới" + "trạng thái cũ → trạng thái mới" + user + thời gian.
3. Bộ lọc danh sách pallet [src/app/pallets/page.tsx](../../src/app/pallets/page.tsx): thêm filter theo **ngày** và **NCC** (TC_HISTORY_PAL_002/_003).
4. Phân quyền: cho phép Quản lý / Kế toán / Thủ kho xem (TC_HISTORY_PAL_017 — hiện chỉ Admin xem được).

**Effort:** 2 ngày fullstack.

---

## 5. Phase 4 — Phiếu tạm / Nhập đột xuất (Tuần 3-4, 5 ngày)

### 5.1 UC-INTMP-01: Tạo phiếu tồn tạm trên Mobile (9 TC)

**TC cover:** Row 17, row 18, TC_TMP_IN_010 → _025.

**Việc cần làm:**
1. **Validate tạo phiếu mobile** (row 17): bắt buộc các trường Lý do, Tên người giao… trước khi submit.
2. **Mã phiếu sau lưu** (row 18): debug FE — đảm bảo mã phiếu sau lưu khớp với mã hiển thị (có thể FE đang generate giả → BE generate khác). **Sửa: BE generate trước khi return, FE chỉ hiển thị mã từ response.**
3. **Upload ảnh runtime** (TC_TMP_IN_010, _025): áp dụng theo [feedback_nextjs_runtime_uploads.md](../../../../C:/Users/LOQ/.claude/projects/D--wms-vinhgiang-repo/memory/feedback_nextjs_runtime_uploads.md):
   - Lưu file qua `/api/uploads` → trả về URL `/api/uploads/[path]` (route handler stream từ FS).
   - Không lưu trực tiếp vào `public/` (Next.js 16 build-time snapshot).
4. **Ngày giờ nhập** (TC_TMP_IN_010, _023, _025): đảm bảo BE save UTC, FE hiển thị timezone Việt Nam (Asia/Ho_Chi_Minh) thông qua `Intl.DateTimeFormat`.
5. **NCC** (TC_TMP_IN_011, _023): điều tra schema `InboundTemp` → check `supplier_id` field, đảm bảo lưu khi tạo + hiển thị trong chi tiết.
6. **Ghi chú dòng hàng** (TC_TMP_IN_012, _024): thêm field `note` cho `InboundTempLine` (nếu chưa có) + UI input + hiển thị khi mở lại phiếu.
7. **Tạo nhanh mã hàng mới** (TC_TMP_IN_019): bug trong [src/app/thukho/item-code/new/page.tsx](../../src/app/thukho/item-code/new/page.tsx) hoặc luồng quick-create — verify lỗi cụ thể (có thể chung gốc với UC-MD-02 fail).

**File:**
- [src/app/thukho/adhoc/new/page.tsx](../../src/app/thukho/adhoc/new/page.tsx)
- [src/app/thukho/adhoc/[id]/page.tsx](../../src/app/thukho/adhoc/[id]/page.tsx)
- [src/app/api/inbound-temp/route.ts](../../src/app/api/inbound-temp/route.ts) (POST/GET)
- Migration schema `InboundTempLine.note` nếu thiếu.

**Effort:** 3 ngày fullstack mobile-focused.

### 5.2 UC-INTMP-02: Chuẩn hóa phiếu tạm Desktop (9 TC)

**TC cover:** TC_STD_TMP_001/_002/_003/_006/_007, row 55, TC_STD_TMP_023/_029/_031.

**Việc cần làm:**
1. Trang chuẩn hóa: thêm bước "Liên kết / Tạo phiếu chính thức" (TC_STD_TMP_003). Có 2 lựa chọn: chọn phiếu YC sẵn có, hoặc tạo phiếu hồi tố.
2. Nút "Tạo NCC mới từ thông tin này" khi NCC chưa tồn tại (TC_STD_TMP_001, _006). Bind vào API `POST /api/suppliers` rồi auto-fill vào phiếu.
3. Bảng chuẩn hóa mã hàng (TC_STD_TMP_002): thêm cột "Hành động" + sửa format Mã chuẩn theo mockup.
4. Hiển thị NCC trong chi tiết (TC_STD_TMP_007): bug FE — verify JSON từ API có trả NCC không.
5. Click "Mã hàng chuẩn" (row 55): bỏ navigation, giữ ở màn hiện tại.
6. Lưu lý do từ chối (TC_STD_TMP_023): thêm field reason vào model + API + UI.
7. Mở lại phiếu sau phê duyệt (TC_STD_TMP_029): FE đang hiển thị nhầm mã — kiểm tra route `[id]/page.tsx`.

**File:** Tương tự 5.1, thiên về desktop.

**Effort:** 2 ngày fullstack desktop.

### 5.3 UC-INTMP-03: Xem tồn tạm (3 TC)

**TC cover:** UC-INTMP-03-TC002/_017/_018.

**Việc cần làm:**
1. Bug counter "Tổng phiếu tạm" sai (TC002): sửa query API `GET /api/inbound-temp?stats=true` — đếm đúng DB.
2. Icon `>` không điều hướng (TC017/_018): bug FE button — thêm `onClick` route `push /thukho/adhoc/[id]`.

**Effort:** 0.5 ngày.

---

## 6. Phase 5 — Vị trí kho & Danh mục cơ bản (Tuần 4-5, 4 ngày)

### 6.1 Trạng thái vị trí kho — đồng bộ enum & UI (8 TC)

**TC cover:** Row 187, TC_LOC_003, _014, _015, _016, _017, _018, _019, row 207.

**Việc cần làm (quan trọng nhất):**
1. **Quyết định nguồn sự thật:**
   - Hiện schema có: `EMPTY / USING / FULL / PARTIAL / MAINTENANCE / RESERVED / WAITING_OUTBOUND / NEEDS_CHECK`.
   - Mockup yêu cầu: `Trống / Đang dùng / Đầy / Còn một phần / Chờ kiểm kê / Khóa SD / Cần kiểm tra lại`.
   - **Đề xuất mapping (làm BA confirm trước):**

   | Enum hiện tại | Label mockup |
   |---|---|
   | EMPTY | Trống |
   | USING | Đang dùng |
   | FULL | Đầy |
   | PARTIAL | Còn một phần |
   | NEEDS_CHECK | Chờ kiểm kê |
   | MAINTENANCE | Khóa SD |
   | RESERVED | (?) — không match — có thể bỏ hoặc gộp |
   | WAITING_OUTBOUND | (không trong mockup — giữ riêng cho luồng outbound) |
   | (mới) | Cần kiểm tra lại |

2. Migration: thêm enum `CHECK_AGAIN` (Cần kiểm tra lại). Verify `RESERVED` còn dùng hay không, gộp nếu không.
3. Tạo file constant `src/lib/location-status.ts` map enum → label tiếng Việt + màu (Tailwind class):
   ```ts
   export const LOCATION_STATUS_META = {
     EMPTY:           { label: 'Trống',           color: 'bg-gray-200 text-gray-700' },
     USING:           { label: 'Đang dùng',       color: 'bg-blue-200 text-blue-800' },
     FULL:            { label: 'Đầy',             color: 'bg-red-200 text-red-800' },
     PARTIAL:         { label: 'Còn một phần',    color: 'bg-orange-200 text-orange-800' },
     NEEDS_CHECK:     { label: 'Chờ kiểm kê',     color: 'bg-yellow-200 text-yellow-800' },
     MAINTENANCE:     { label: 'Khóa SD',         color: 'bg-gray-400 text-white' },
     CHECK_AGAIN:     { label: 'Cần kiểm tra lại',color: 'bg-purple-200 text-purple-800' },
   };
   ```
4. Refactor toàn bộ chỗ render badge dùng constant này (grep `LocationStatus` trong `src`).
5. Thêm nút **IMPORT** và **Xem dạng sơ đồ** trên [src/app/locations/page.tsx](../../src/app/locations/page.tsx) (row 187).

**File:**
- [prisma/schema.prisma](../../prisma/schema.prisma)
- Tạo mới `src/lib/location-status.ts`
- [src/app/locations/page.tsx](../../src/app/locations/page.tsx)
- Component badge nơi render `location.status`.

**Effort:** 1.5 ngày fullstack + 0.5 ngày BA sign-off.

### 6.2 Khai báo Sản phẩm (UC-MD-01) — 7 TC

**TC cover:** TC_ADD_003, row 35, row 36, TC_ADD_009, row 50, TC_MD_001, TC_MD_005.

**Việc cần làm:**
1. **Validate tất cả trường bắt buộc cùng lúc** (TC_ADD_003): tổng hợp hết error rồi hiển thị, không chỉ "Mã SKU". Dùng `zod` + `react-hook-form`.
2. **i18n thông báo validate** (row 35, TC_ADD_009): thay "Please enter a number." / "Value must be greater than or equal to 0." bằng tiếng Việt. Tốt nhất tự viết refine zod thay vì dùng default message.
3. **TC_ADD_009 cũng cần đổi logic:** `>= 0` → `> 0` (yêu cầu trọng lượng > 0, không cho phép = 0).
4. **Trạng thái sửa SP** (row 36, TC_MD_001, TC_MD_005): sửa form Edit để gửi đúng `is_active` về BE và BE update đúng. Hiện đang luôn về "Đang hoạt động".
5. **Form sửa SP thừa field "Tồn min/max"** (row 50): xoá 2 field này khỏi form Edit (chỉ giữ ở form Add nếu logic là min/max chỉ set lần đầu).

**File:**
- Trang Add/Edit Product: tìm trong `src/app/items` hoặc `src/app/products`.
- [src/app/api/products/route.ts](../../src/app/api/products/route.ts)
- [src/app/api/item-codes/route.ts](../../src/app/api/item-codes/route.ts)

**Effort:** 1.5 ngày fullstack.

### 6.3 Quản lý Mã hàng / Tạo mã hàng Mobile (UC-MD-02) — 8 TC

**TC cover:** TC_001_001/_002/_006/_010, row 95, TC_STANDARD_001/_006, row 97.

**Việc cần làm:**
1. **Field "Ảnh hàng / vỏ thùng"** (TC_001_001): bổ sung vào form mobile [src/app/thukho/item-code/new/page.tsx](../../src/app/thukho/item-code/new/page.tsx). Upload theo Phase 4.1 (route handler).
2. **Bug "Mã hàng theo chứng từ là bắt buộc"** chặn lưu (TC_001_002, _010, TC_STANDARD_006): tìm validation rule này, có thể đang bắt buộc nhầm cho luồng tạo nhanh (Thủ kho) — đáng lẽ chỉ bắt buộc khi chuẩn hóa (Kế toán). Sửa schema validate theo role.
3. **Cảnh báo mã hàng trùng** (TC_001_006): API `POST /api/item-codes` đang `409 Conflict` nhưng FE không bắt — handle response và toast.
4. **TC_STANDARD_001** đã `Fixed` — retest. Nếu vẫn fail thì verify event `STANDARDIZE` chuyển trạng thái `PENDING → STANDARDIZED` + sản phẩm move sang `Danh mục sản phẩm`.

**Effort:** 1 ngày fullstack.

### 6.4 Quản lý Nhóm hàng (UC-MD-03) + Nhà cung cấp (UC-MD-06)

**TC cover:** TC_GROUP_001 (thiếu import), TC_SUP_001/_002 (đã Fixed — retest).

**Việc cần làm:**
- TC_GROUP_001: bổ sung nút Import + parse Excel (tham khảo cùng pattern với import inbound nếu có; nếu không, hoãn sang Phase 9).
- TC_SUP_001/_002: chỉ retest sau Phase 0.

**Effort:** 0.5 ngày (chỉ phần import nhóm hàng — có thể dời).

---

## 7. Phase 6 — Forklift QR scan + FEFO + Audit (Tuần 5-6, 7 ngày · FEATURE LỚN)

> 🆕 **Chú ý:** Đây gần như là **xây mới feature**, không phải fix bug. 10 case Not Run của MD06 thực chất là 1 feature chưa làm.

### 7.1 QR scan module

**TC cover:** UC-FK-02_TC01 + UC-FK-02_TC05/06/15/18 (Not Run) + UC-FK-03_TC01/_08/_09/_10/_12/_18 (Not Run) + UC-FK-04_TC03.

**Việc cần làm:**
1. Chọn thư viện QR scan: `html5-qrcode` hoặc `@zxing/browser`. Test với camera mobile.
2. Tạo component `src/components/qr-scanner.tsx`. Hook ra `onResult(code)`.
3. Tích hợp vào:
   - [src/app/forklift/put-away/page.tsx](../../src/app/forklift/put-away/page.tsx): quét pallet + quét vị trí đích.
   - [src/app/forklift/relocate/page.tsx](../../src/app/forklift/relocate/page.tsx)
   - [src/app/forklift/stage-out/page.tsx](../../src/app/forklift/stage-out/page.tsx)
   - `src/app/kiemke/scan/page.tsx` (cho MD11 sau).
4. Validate format mã (A-03-02), báo lỗi "Mã vị trí không hợp lệ" khi sai.
5. Trường hợp camera lỗi / không có camera / quyền bị từ chối → fallback nhập thủ công.

**Effort:** 3 ngày frontend mobile.

### 7.2 FEFO logic khi chuyển sang khu chờ xuất

**TC cover:** UC-FK-04_TC03, row 70 (xuất 1 phần).

**Việc cần làm:**
1. API `GET /api/forklift/stage-out/suggest?item_code=X`: query `PalletLine` WHERE `pallet.status=IN_STORAGE AND item_code_id=X` ORDER BY `expiry_date ASC` (FEFO).
2. Khi xuất 1 phần (qty_box < tổng pallet): tạo pallet con (xem schema `parent_pallet_id / split_seq` đã có sẵn).
3. UI hiển thị pallet gợi ý theo HSD gần nhất.

**Effort:** 2 ngày fullstack.

### 7.3 Lịch sử luân chuyển Forklift (UC-FK-06)

**TC cover:** UC-FK-06_TC01, UC-FK-03_TC20.

**Việc cần làm:**
1. Trang `/forklift/history` (mới) hoặc tận dụng `[src/app/system/audit-log/page.tsx]` filter entity_type=`pallet` + action `MOVE`.
2. Đảm bảo mỗi `Movement` ghi đủ pallet/vị trí cũ/vị trí mới/user/thời gian (kiểm tra schema Movement).
3. Audit log per movement: thông qua helper Phase 2.

**Effort:** 1 ngày.

### 7.4 Trang chủ lịch sử hôm nay

**TC cover:** Row 46.

**Việc cần làm:** Sửa query trang chủ forklift để filter `performed_at >= startOfDay(today)` + sort desc.

**Effort:** 0.5 ngày.

---

## 8. Phase 7 — Outbound + Notification (Tuần 6, 3 ngày)

### 8.1 Dashboard khu chờ xuất

**TC cover:** UC-OUT-01_TC01, _TC04.

**Việc cần làm:**
1. UI dashboard [src/app/outbound/page.tsx](../../src/app/outbound/page.tsx) hoặc tương đương:
   - Thêm: **Tổng pallet, Tổng mã, Tổng SL, Quá 24H** (tính `now() - moved_to_staging_at > 24h`).
   - Bỏ: Tổng KG, HSD gần nhất.
   - Mỗi dòng: Pallet, Mã hàng, Lô/Date, SL, Thời gian đến khu chờ xuất.
2. API tương ứng `GET /api/outbound/staging`.

**Effort:** 1.5 ngày.

### 8.2 Notification Kế toán → Thủ kho

**TC cover:** TC_IN_REQ_027, TC_IN_REQ_028.

**Lựa chọn kỹ thuật:**
- **Option A (đơn giản, đề xuất):** Tạo model `Notification` + poll mỗi 30s ở FE thủ kho (mobile). Đơn giản, không cần infra mới.
- **Option B (real-time):** SSE qua route `/api/notifications/stream` (Next.js 16 hỗ trợ Web Streams).
- **Option C:** WebSocket (cần lib socket.io) — quá nặng cho mức bug này.

**Đề xuất:** Bắt đầu Option A, upgrade Option B sau.

**Việc cần làm:**
1. Schema `Notification` { id, user_id, type, payload (JSON), read_at, created_at }.
2. Khi `POST /api/inbound` thành công → insert notification cho tất cả user role `THU_KHO` (hoặc filter theo store nếu có).
3. FE thủ kho: poll `GET /api/notifications?unread=true` mỗi 30s, hiển thị badge + dropdown.
4. Mark-as-read khi user click.

**Effort:** 1.5 ngày fullstack.

---

## 9. Phase 8 — Đăng nhập + polish (Tuần 7, 2 ngày)

### 9.1 OTP lockout 30 phút (TC_T04_18)

**Việc cần làm:**
- Trong [src/app/api/auth/forgot-password/verify-otp/route.ts](../../src/app/api/auth/forgot-password/verify-otp/route.ts): khi sai OTP > N lần, set lockout 30 phút (hiện đang 1 tiếng). Verify config trong env hoặc constant.

**Effort:** 0.5 ngày.

### 9.2 Trim password khi login (TC_T03_12 — đã Fixed, retest)

### 9.3 Submit Enter ở form quên mật khẩu khi đã hiện password (TC_T03_24, TC_T04_39)

**Việc cần làm:**
- Trang `auth/forgot-password/page.tsx`: handler `onKeyDown` của input password trigger submit form. Toggle `show password` không được làm mất focus form.

**Effort:** 0.5 ngày.

### 9.4 Unicode/emojis trong fields (TC_T04_42 Not Run)

**Việc cần làm:**
- Verify form không crash với emojis. Thường framework đã handle, chỉ test.

**Effort:** 0.25 ngày.

### 9.5 Còn lại MD01 Not Run

- TC_T01_012 (tài khoản bị khóa): cần BA seed tài khoản test trạng thái `LOCKED`. → Coordinate với QA.

---

## 10. Phase 9 — Test 4 module trống (Tuần 7-8, 5 ngày)

> QA chủ trì, dev backup khi gặp bug.

| Module | Số TC test | Phụ thuộc |
|---|---:|---|
| MD08 Tồn kho & Kiểm kê (UC-INV) | ~30-50 TC | Phase 1 (Inbound→Inventory) phải xong |
| MD09 Dashboard (UC-DASH) | ~20-30 TC | Phase 1, 7 (Outbound) xong |
| MD10 Hệ thống/Cấu hình (UC-SYS) | ~30 TC | Phase 2 (Audit log) xong |
| MD11 Tích hợp QR (UC-INT, đã thấy 15 TC trong sheet) | ~20-30 TC | Phase 6 (QR scan) xong |

**Trình tự test:**
1. MD11 (sau Phase 6) — verify QR scan ngon.
2. MD08 (sau Phase 1) — verify tồn kho đã lên đúng.
3. MD10 (sau Phase 2) — verify audit log.
4. MD09 cuối cùng — vì dashboard tổng hợp tất cả.

---

## 11. Tổng kết Gantt rough (8 tuần)

```
Tuần │ 1     2     3     4     5     6     7     8
─────┼────────────────────────────────────────────────
Phase 0   ▓   
Phase 1   ▓▓▓▓▓     
Phase 2         ▓▓▓
Phase 3         ▓▓▓▓▓▓▓▓
Phase 4               ▓▓▓▓▓▓▓▓▓
Phase 5                   ▓▓▓▓▓▓
Phase 6                         ▓▓▓▓▓▓▓
Phase 7                               ▓▓▓
Phase 8                                     ▓▓
Phase 9                                     ▓▓▓▓▓▓ (test, không cần dev nhiều)
```

**Nén còn 5-6 tuần** nếu Phase 3 + 4 + 5 chạy parallel với 2 cặp dev (FE-BE).

---

## 12. Quy tắc làm việc cho cả lộ trình

1. **Mỗi TC fail = 1 commit hoặc 1 PR riêng**, message format: `fix(modX-UC-XX): TC_XXX_NNN — short desc`.
2. **Mỗi PR phải đính kèm:**
   - Screenshot trước/sau (mobile + desktop nếu liên quan).
   - Link Google Sheet TC (gid + row).
   - Test plan ngắn cho QA.
3. **Retest:** QA chạy lại TC và update status trên sheet trong cùng ngày PR merge.
4. **Critical path (Phase 1, 2) bắt buộc code review 2 người** vì ảnh hưởng dữ liệu sản xuất.
5. **DB migration:** test trên VPS staging trước (additive only, không drop column — xem [project_vps_company.md](../../../../C:/Users/LOQ/.claude/projects/D--wms-vinhgiang-repo/memory/project_vps_company.md)).
6. **Sau mỗi Phase:** deploy lên VPS 188.166.210.73 qua `vps-deploy.js` để demo cho khách hàng.

---

## 13. Việc cần làm NGAY (D-Day)

- [ ] Tạo branch `fix/wave-bug-report-2026-05-27`.
- [ ] Tạo Jira/issue board từ báo cáo.
- [ ] BA confirm mapping `LocationStatus` (mục 6.1).
- [ ] BA confirm cơ chế notification (Option A vs B mục 8.2).
- [ ] Bắt đầu Phase 1.1 (chốt phiếu nhập → tồn kho) — ưu tiên tuyệt đối.

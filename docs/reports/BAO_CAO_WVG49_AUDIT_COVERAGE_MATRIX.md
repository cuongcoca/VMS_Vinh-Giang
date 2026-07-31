# WVG-49 / UC-SYS-03 — Audit Event Coverage Matrix + cơ chế ghi audit

**Mục đích:** input cho BA (WVG-48) chốt phạm vi Audit Log + bằng chứng cho QA. Liệt kê
event audit ĐANG ghi, cơ chế ghi/đọc, và các open point cần BA quyết.

---

## 1. Cơ chế ghi audit (`src/lib/audit.ts`)
- `logAudit(req, input, client?)` / `logAuditMany(...)`: ghi 1/nhiều dòng `audit_logs`.
- Trích actor từ JWT (`getRequestActor`): `performed_by`, `performed_by_role`, `ip_address`, `user_agent`.
- Field mỗi bản ghi: `entity_type`, `entity_id (uuid)`, `action`, `old_value (json)`, `new_value (json)`, `reason`, `performed_at (default now, GMT)`.
- **`keyToUuid()`** (WVG-34): map config-key chuỗi → UUID v5 tất định (vá lỗi audit config **hỏng thầm lặng** do cột `entity_id @db.Uuid`).
- **Best-effort**: `logAudit` bọc try/catch, **KHÔNG chặn nghiệp vụ** nếu ghi audit lỗi (trả null). Có tham số `client` → có thể gọi TRONG `prisma.$transaction` để atomic khi cần.

## 2. Cơ chế đọc (`GET /api/audit-logs`) — sau WVG-49
- **Authz**: `guardPermission("audit","read")` — **chỉ QUẢN LÝ** (đã bỏ `audit:read` của Kế toán để đồng bộ menu; deny-by-default cho vai khác).
- **Lọc (server)**: `from`,`to` (biên ngày **GMT+7**), `entity_type`, `action`, `actor` (tên người thực hiện).
- **Phân trang (server)**: `page`,`limit` (≤200) → trả `{ data, total, page, limit }`.
- **Mask (read)**: che `old/new_value` các khoá nhạy cảm (`pass|token|secret|otp|hash|salt|api_key`) → không rò secret; dữ liệu gốc trong DB giữ nguyên.
- **Enrich**: `entity_code` (mã thân thiện thay UUID) + `performed_by_name` + `role`.

## 3. Coverage Matrix — event audit ĐANG ghi (theo module)

| Module (entity_type) | Action đang audit |
|---|---|
| **Auth / User** | `LOGIN`, `LOGIN_FAILED`, `ACCOUNT_LOCKED` (WVG-19), `UPDATE_PROFILE` |
| **System (config/RBAC)** | `UPDATE_PERMISSION_MATRIX`, `UPDATE_RBAC_MATRIX`, `RESET_RBAC_MATRIX` (WVG-34) |
| **Master data (item_code/supplier/group)** | `CREATE`, `CREATE_BY_IMPORT`, `UPDATE_BY_IMPORT`, `IMPORT_EXCEL`, `STANDARDIZE_CREATE_INBOUND`, `STANDARDIZE_LINK_INBOUND`, `CREATE_SUPPLIER_FROM_TEMP` |
| **Pallet** | `CREATE_PALLET`, `CONFIRM_PALLET`, `CANCEL_PALLET`, `UNLOCK_PALLET`, `ADD_PALLET_LINE`, `EDIT_PALLET_LINE`, `EDIT_PALLET_LINE_VIA_RETURN`, `DELETE_PALLET_LINE` |
| **Inbound (nhập)** | `CREATE_INBOUND`, `START_RECEIVING`, `COMPLETE_RECEIVING`, `COMPLETE_INBOUND`, `REJECT_INBOUND_TEMP` |
| **Forklift / movement** | `PUT_AWAY`, `RELOCATE`, `RETURN`, `STAGE_OUT_FULL`, `STAGE_OUT_PARTIAL`, `REBALANCE`, `ASSIGN_DRIVER` |
| **Outbound (xuất)** | `START_PICKING`, `RELEASE`, `SHIP`, `APPROVE`, `REJECT` |
| **Adjustment (kiểm kê/điều chỉnh)** | `APPROVE`, `REJECT`, `CREATE` (phiếu điều chỉnh) |

→ **~40 action** trên **~30 route** (POST/PUT/PATCH/DELETE) đã ghi audit — phủ các nghiệp vụ trọng yếu: nhập/xuất/luân chuyển/kiểm kê/điều chỉnh/master-data/RBAC/auth.

## 4. Phân tích khoảng trống (gap) — cần BA chốt phạm vi
- Tổng route API: **124**; route **ghi audit: ~30**. Phần lớn 94 route còn lại là **GET (đọc)** → không cần audit.
- **Cần BA chốt (blocker P0 của WVG-48):** phạm vi audit là **MỌI data-mutation** hay chỉ **source-action đang liệt kê**? Nếu "mọi mutation", DEV sẽ rà toàn bộ route POST/PUT/PATCH/DELETE chưa có `logAudit` và bổ sung (đợt sau, theo scope BA duyệt).
- **Mapping UC-FK-05 / UC-INV-09** (bắt buộc theo Story): các action forklift/kiểm kê ở trên đã phủ; cần BA xác nhận mapping đúng event.

## 5. Open point — chờ BA (WVG-48) quyết (KHÔNG tự chốt)
1. **Phạm vi coverage**: mọi mutation vs source-action.
2. **Data-scope theo kho/chi nhánh** cho Quản lý (hiện đọc TẤT CẢ, chưa lọc theo kho).
3. **Transaction integrity policy**: audit-write hiện **best-effort** (không rollback nghiệp vụ nếu audit lỗi) — BA chốt có cần **blocking/transactional** + retry + idempotency/duplicate không.
4. **Masking policy**: hiện che ở READ theo regex khoá nhạy cảm — BA chốt danh mục field cần mask.
5. **Timezone/semantics old-new**: đã dùng GMT+7 cho lọc + `performed_at`; BA chốt chuẩn hiển thị + ngữ nghĩa old/new (đầy đủ vs diff).
6. **Retention**: chưa có chính sách xoá/lưu trữ — BA/DevOps chốt.

## 6. Đã làm đợt này (WVG-49 BE + WVG-50 FE) — phần AN TOÀN, không đổi contract BA phải chốt
- **BE:** bỏ `audit:read` của Kế toán (chỉ QUẢN LÝ) · server pagination · timezone GMT+7 · lọc action/actor server · mask nhạy cảm ở read.
- **FE:** dùng server pagination (xem hết lịch sử, không giới hạn 200) · filter đẩy lên server (debounce) · **state 403 "Không có quyền" tường minh** · giữ nguyên loading/empty/error/success + validate ngày + Excel export.

# CRITICAL PATHS — WMS Vĩnh Giang

> Tài liệu mô tả các **luồng nghiệp vụ trọng yếu** — nếu một trong các luồng này hỏng thì toàn hệ thống mất giá trị. File `PROTECTED` được liệt kê chi tiết: chỉ sửa khi có Tech Lead approve + 2 reviewer.
>
> Phiên bản: 1.0 · Ngày: 2026-05-20

---

## 0. Ký hiệu

- 🔒 **PROTECTED** — File không được sửa trực tiếp. Mọi thay đổi cần:
  1. PR phải tag `@tech-lead` + 2 reviewer khác.
  2. Mô tả "Why" rõ ràng + impact analysis.
  3. Test coverage ≥ 90% cho file (unit + integration).
  4. Manual smoke test luồng nghiệp vụ kèm video/screenshot.
- ⚠️ **AUDIT** — Endpoint/service bắt buộc ghi `audit_logs`.
- 🟥 **BLOCKER** — Bug ở đây = ngừng vận hành kho.
- 🟧 **HIGH** — Bug ở đây = giảm hiệu suất nghiêm trọng, có workaround thủ công.
- 🟨 **MEDIUM** — Có ảnh hưởng nhưng vận hành tiếp được.

---

## 1. Bản đồ luồng nghiệp vụ tổng thể

```
┌───────────────────────────────────────────────────────────────────────────┐
│                            WMS BUSINESS FLOWS                              │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CP-01: NHẬP HÀNG CÓ PHIẾU (Inbound with PO)                  🟥 BLOCKER   │
│    Kế toán lập PHN → Thủ kho nhận → Tạo pallet → Xác nhận →                │
│    Engine đối chiếu → Chốt phiếu                                            │
│                                                                             │
│  CP-02: NHẬP HÀNG ĐỘT XUẤT (Inbound temporary)                 🟧 HIGH    │
│    Thủ kho tạo PNT → Kế toán chuẩn hoá → Tạo PHN chính thức                │
│                                                                             │
│  CP-03: XẾP PALLET VÀO VỊ TRÍ (Putaway)                       🟥 BLOCKER   │
│    Xe nâng chọn pallet chờ → Quét vị trí → Xác nhận                        │
│                                                                             │
│  CP-04: RÚT FEFO RA KHU CHỜ XUẤT                              🟥 BLOCKER   │
│    Xe nâng chọn mã → Engine FEFO gợi ý → Rút nguyên/một phần               │
│                                                                             │
│  CP-05: TRẢ KHU CHỜ XUẤT VỀ VỊ TRÍ (có sửa nội dung)          🟧 HIGH ⚠️   │
│    Người được phân quyền chọn pallet → Sửa nội dung → Audit log            │
│                                                                             │
│  CP-06: IMPORT EXCEL HÀNG VỀ (UC-IN-06)                       🟧 HIGH    │
│    Upload file NCC lớn → Parse → Đối chiếu mã → Tạo PHN                    │
│                                                                             │
│  CP-07: CÂN LẠI TỒN KHU CHỜ XUẤT (UC-OUT-05)                  🟧 HIGH ⚠️   │
│    Kế toán upload file SL xuất → Preview → Apply                            │
│                                                                             │
│  CP-08: KIỂM KÊ → ĐIỀU CHỈNH TỒN                              🟧 HIGH ⚠️   │
│    Người KK đếm → Quản lý duyệt chênh → Phiếu ADJ → Quản lý duyệt          │
│                                                                             │
│  CP-09: CẢNH BÁO HSD & TỒN (cron)                              🟨 MEDIUM  │
│    Cron 6:00 hằng ngày → Quét DB → Gửi email + push notification           │
│                                                                             │
│  CP-10: AUTH & RBAC                                            🟥 BLOCKER   │
│    Login → JWT → RBAC guard → Mọi request                                  │
│                                                                             │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CP-01: Nhập hàng có phiếu (🟥 BLOCKER)

**Use cases:** UC-IN-01 → UC-IN-02 → UC-PAL-01 → UC-PAL-02 → UC-PAL-04 → UC-IN-03 → UC-FK-02 → UC-IN-04.

### 2.1 Flow chi tiết

```
[KẾ TOÁN — WEB]                                              [Cơ sở dữ liệu]
  1. Lập PHN với danh sách hàng yêu cầu                          inbound_requests
     POST /inbound/requests                                       inbound_request_lines
     → status=NEW
                                                                  
[THỦ KHO — MOBILE]
  2. Mở phiếu, tiếp nhận                                          inbound_requests.status=PENDING_KEEPER → PREPARING
     POST /inbound/requests/:id/accept
  
  3. Tạo pallet (sinh code tự động PLYYMMDD.STT)                  pallets (advisory_lock theo code_date)
     POST /pallets {inboundRequestId}
     → status=EMPTY, code="PL260506.011"
  
  4. Thêm dòng hàng (theo thùng, auto-convert sang lẻ)            pallet_lines
     POST /pallets/:id/lines {productId, qtyBox, lot, expiry…}
     → pallet.status=COUNTING (auto sau line đầu tiên)
  
  5. Xác nhận pallet (khoá thông tin)                             pallets.status=CONFIRMED
     POST /pallets/:id/confirm                                    domain event: PalletConfirmed
                                                                  
[ENGINE — BACKGROUND]
  6. Reconcile engine chạy auto khi event PalletConfirmed         (tính toán + cache)
     - Gom pallet_lines theo product_id, lot
     - So sánh với inbound_request_lines
     - Phân loại: MATCHED / SHORTAGE / EXCESS / EXTRA_PENDING
     → kết quả lưu cache Redis, expose qua /reconcile

[XE NÂNG — MOBILE]
  7. Xem DS pallet chờ đưa vị trí                                 GET /forklift/pallets-pending
     GET → pallets where status=CONFIRMED & location_id IS NULL
  
  8. Đưa vào vị trí (PUTAWAY)                                     pallets.location_id=A-03-02
     POST /forklift/putaway                                       pallets.status=IN_STORAGE
     → BEGIN TX → SELECT pallet FOR UPDATE                        movements (type=PUTAWAY)
       → check location.type=STORAGE                              
       → check weight/maxPallets                                  
       → UPDATE pallet + INSERT movement                          
     → COMMIT
  
  → inbound_requests.status auto cập nhật PUTAWAY khi tất cả pallet putaway xong
                                                                  
[KẾ TOÁN — WEB]
  9. Kiểm tra đối chiếu, xử lý chênh lệch / chuẩn hoá mã tạm     
     GET /inbound/requests/:id/reconcile
  
  10. Chốt phiếu                                                  inbound_requests.status=CLOSED
      POST /inbound/requests/:id/finalize                         (validate precondition)
      → check: tất cả pallet IN_STORAGE                           
        + mã tạm đã MAPPED                                        
        + total_received = total_allocated                        
      → nếu OK: status=CLOSED, ghi close_at, close_by             
      → nếu fail: 409 với detail rõ thiếu cái gì
```

### 2.2 Files PROTECTED

| File | Lý do | Quy tắc |
|---|---|---|
| 🔒 `apps/api/src/modules/pallets/services/pallet-code-generator.service.ts` | Sinh code `PLYYMMDD.STT` với advisory_lock — race condition fix | Không sửa thuật toán sinh code mà không có ADR + test concurrent đầy đủ |
| 🔒 `apps/api/src/modules/pallets/services/pallet-confirm.service.ts` | Khoá pallet, emit domain event — tâm điểm luồng | Test phải cover: race confirm 2 lần, confirm khi pallet rỗng |
| 🔒 `apps/api/src/modules/inbound/services/reconcile-engine.service.ts` | Engine đối chiếu — sai 1 dòng = chốt nhầm phiếu | Test fixture phải cover 5 trạng thái: MATCHED / SHORTAGE / EXCESS / EXTRA_PENDING / SKU_TEMP |
| 🔒 `apps/api/src/modules/inbound/services/finalize.service.ts` | Validate precondition + chốt phiếu | Mọi điều kiện check phải có unit test riêng |
| 🔒 `apps/api/src/modules/forklift/services/putaway.service.ts` | Transaction lock pallet + update location | TX phải atomic, test rollback khi exception |
| 🔒 `prisma/schema.prisma` (các model: Pallet, PalletLine, InboundRequest, Movement) | Schema cốt lõi | Mọi thay đổi field phải tuân R1-R8 trong DATABASE.md §4 |

### 2.3 Failure modes & xử lý

| Failure | Triệu chứng | Tác động | Mitigation |
|---|---|---|---|
| Race condition khi 2 thủ kho cùng tạo pallet → trùng code | 500 unique violation | Thủ kho không tạo được pallet | Advisory lock theo `code_date`, retry 3 lần |
| Engine đối chiếu sai do unit conversion | Số "Đã khớp" sai vs thực tế | Chốt phiếu sai → tồn sai | Lưu cả `qty_box` & `qty_unit`, dùng DECIMAL không float |
| Putaway 2 lần cho 1 pallet | Movement duplicate | Báo cáo luân chuyển sai | TX với `SELECT FOR UPDATE`, check `pallet.status != IN_STORAGE` trước |
| Finalize với pallet còn chờ | Phiếu chốt nhưng còn pallet floating | Tồn lệch | Validate precondition + 409 chi tiết |

---

## 3. CP-02: Nhập hàng đột xuất (🟧 HIGH)

**Use cases:** UC-INTMP-01 → UC-INTMP-02 → (→ UC-IN-04).

### 3.1 Flow

```
[THỦ KHO — MOBILE]
  1. Hàng về không có phiếu → bấm "Nhập đột xuất"                inbound_temps
     POST /inbound-temps {sourceType, reason*, photoUrls,        inbound_temp_lines
                          lines:[{skuId, qtyBox, lot, expiry}]}
     → code=PNT-260506-003, status=PENDING

[KẾ TOÁN — WEB]
  2. Mở phiếu tạm, xử lý 3 bước:                                 
     a) Kiểm tra nguồn hàng                                       
     b) Chuẩn hoá mã hàng (map sku → product hoặc tạo product mới) skus.mapped_product_id
     c) Tạo PHN chính thức từ phiếu tạm                          inbound_requests (source=TEMP_STANDARDIZED)
     POST /inbound-temps/:id/standardize                          inbound_temps.standardized_to
                                                                   → status=STANDARDIZED
  
  3. Tiếp tục flow CP-01 từ bước 7 (đưa vào vị trí)
```

### 3.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/modules/inbound-tmp/services/standardize.service.ts` | Chuyển phiếu tạm sang PHN chính — không được mất line nào |
| 🔒 `apps/api/src/modules/master-data/skus/services/sku-map.service.ts` | Map sku tạm → product chuẩn — sai = lệch tồn ngay |

---

## 4. CP-03: Putaway (🟥 BLOCKER)

**Use case:** UC-FK-02.

### 4.1 Flow

```
[XE NÂNG — MOBILE]
  1. Quét QR pallet (hoặc chọn từ DS)
  2. App tự lấy GPS / vị trí gần nhất, hiển thị vị trí trống gần nhất gợi ý
  3. Xe nâng đến vị trí, quét QR vị trí
  4. App show pallet + vị trí → bấm "Xác nhận"
     POST /forklift/putaway {palletId, toLocationCode}
     
[BACKEND]
  TX: SELECT pallet FOR UPDATE
      check pallet.status=CONFIRMED & location_id IS NULL
      check location.type=STORAGE, is_active=true
      check sum(weights) ≤ location.max_weight_kg
      check (current_pallets at location) < location.max_pallets
      UPDATE pallet SET location_id=:loc, status=IN_STORAGE
      INSERT movement (type=PUTAWAY, from=NULL, to=:loc, performed_by=:user)
  COMMIT
```

### 4.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/modules/forklift/services/putaway.service.ts` | TX core, validate capacity |
| 🔒 `apps/api/src/modules/forklift/validators/location-capacity.validator.ts` | Check tải trọng/pallet count — bypass = sập kệ |

### 4.3 Edge cases

- Putaway lên `INBOUND_STAGING` → reject (chỉ cho `STORAGE`).
- Putaway lên location đã đầy → reject với detail "Vị trí đã đầy (3/3 pallet)".
- Putaway pallet `EMPTY` (chưa có dòng) → reject "Pallet rỗng không được xếp".

---

## 5. CP-04: Rút FEFO ra khu chờ xuất (🟥 BLOCKER)

**Use case:** UC-FK-04.

### 5.1 Flow

```
[XE NÂNG — MOBILE]
  1. Nhập/quét mã hàng cần rút                                    
     GET /forklift/fefo-suggestions?productId=12
     
[BACKEND — FEFO engine]
  SELECT pallets p
    JOIN pallet_lines pl ON pl.pallet_id = p.id
    JOIN locations l ON l.id = p.location_id
  WHERE pl.product_id = 12
    AND p.status = 'IN_STORAGE'
    AND l.type = 'STORAGE'
    AND pl.expiry_date IS NOT NULL
  ORDER BY pl.expiry_date ASC, pl.lot ASC, p.created_at ASC
  
  → gắn nhãn priority 1..N
  → warningLevel: CRITICAL (≤7d), WARN (≤30d), NONE
  → response

[XE NÂNG — MOBILE]
  2. Chọn vị trí ưu tiên 1
  3. Chọn TH-A (rút nguyên) hoặc TH-B (rút một phần) + qty
  
  4. Xác nhận
     POST /forklift/pick-fefo {palletId, fromLocationId, toLocationId (STAGING), qtyUnit, mode}

[BACKEND]
  TX: SELECT pallet FOR UPDATE
      check qty_unit_available ≥ qtyUnit
      if mode=FULL:
        UPDATE pallet SET location_id=:staging, status=IN_STAGING
      else (PARTIAL):
        SPLIT: new_pallet với qty_unit=picked, status=IN_STAGING, location=:staging
               old_pallet giữ nguyên, qty trừ đi
      INSERT movement (type=PICK_FEFO, mode, from, to, performed_by)
  COMMIT
```

### 5.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/modules/forklift/services/fefo-engine.service.ts` | Engine FEFO — sai gợi ý = rút sai date, lệch nghiệp vụ |
| 🔒 `apps/api/src/modules/forklift/services/pick-fefo.service.ts` | TX split pallet PARTIAL — corner case nhiều |
| 🔒 `apps/api/src/modules/pallets/services/pallet-split.service.ts` | Tách pallet — atomic operation |

### 5.3 Edge cases

- Rút quá tồn → 409 "Còn lại tại vị trí: X, yêu cầu Y".
- 2 xe nâng cùng pick 1 pallet → SELECT FOR UPDATE, người sau 409.
- Product không có HSD → priority dựa trên `manufactured_date`, sau đó FIFO.
- Pallet có nhiều dòng (nhiều product) → FEFO chỉ áp dụng lines của product được yêu cầu.

---

## 6. CP-05: Trả Khu chờ xuất → Vị trí (🟧 HIGH ⚠️ AUDIT BẮT BUỘC)

**Use case:** UC-FK-05.

### 6.1 Flow

```
[NGƯỜI ĐƯỢC PHÂN QUYỀN — MOBILE]
  1. Chọn pallet tại khu chờ xuất
  2. Sửa nội dung (Mã hàng, SL, Lô, HSD) nếu cần — LUỒNG DUY NHẤT cho phép
  3. Chọn vị trí trả về (STORAGE)
  4. Chọn lý do (enum 4) + mô tả chi tiết
  5. Xác nhận
     POST /forklift/return {palletId, toLocationCode, updates, reasonCode, reasonDetail*}

[BACKEND]
  TX: SELECT pallet, pallet_lines FOR UPDATE
      validate location.type=STORAGE
      validate capacity (như putaway)
      
      diff = compute_diff(before, updates)
      
      INSERT audit_logs (
        actor_id, actor_role,
        action='forklift.return',
        resource_type='pallet', resource_id=:palletId, resource_code=PL...,
        before, after, reason=:reasonDetail,
        ip, user_agent
      ) → audit_log_id
      
      UPDATE pallet_lines (set product_id, qty_unit, lot, expiry_date)
      UPDATE pallet SET location_id=:loc, status=IN_STORAGE
      
      INSERT movement (type=RETURN_FROM_STAGING, audit_log_id=:audit_log_id, …)
  COMMIT
```

### 6.2 Files PROTECTED (mức cao nhất)

| File | Lý do |
|---|---|
| 🔒🔒 `apps/api/src/modules/forklift/services/return-from-staging.service.ts` | **Luồng DUY NHẤT** cho phép sửa nội dung pallet sau confirm. Sai = mở backdoor sửa data |
| 🔒🔒 `apps/api/src/common/interceptors/audit-log.interceptor.ts` | Interceptor ghi audit chung — gỡ = mất audit toàn hệ thống |
| 🔒🔒 `apps/api/src/modules/system/services/audit-log.service.ts` | Service ghi log — append-only, không cho UPDATE/DELETE |

### 6.3 Database constraints liên quan

- `audit_logs` table có trigger `BEFORE UPDATE/DELETE` raise exception.
- `movements` khi `type=RETURN_FROM_STAGING` thì `audit_log_id` NOT NULL (DB constraint).

---

## 7. CP-06: Import Excel Hàng về (🟧 HIGH)

**Use case:** UC-IN-06.

### 7.1 Flow

```
[KẾ TOÁN — WEB]
  1. Upload file Excel NCC (HangUVe_05062026.xlsx)
     POST /inbound/excel-imports (multipart)
     → status=UPLOADING → PARSED (sau khi job xong)

[BACKEND — BullMQ worker]
  2. Parse file:
     - Đọc sheet, detect header dòng đầu
     - Map columns: Mã hàng (file) | Tên hàng | SL thùng | Trọng lượng | BU
     - Loop từng row:
       a) Tìm products WHERE sku = supplier_code OR barcode = supplier_code
       b) Nếu không match: tìm skus WHERE supplier_code = ?
       c) Nếu vẫn không: đánh dấu PENDING (cần tạo mã)
       d) Nếu có 2+ match: đánh dấu DUPLICATED
     - Lưu kết quả vào excel_imports.parsed_payload (JSONB)
     - Cập nhật matched_rows, pending_rows, duplicated_rows, total_weight

[KẾ TOÁN — WEB]
  3. Xem preview, chọn strategy:
     - AUTO_CREATE: tạo nhanh tất cả SKU pending (UC-MD-02)
     - MANUAL: map từng dòng duplicated/pending
     - SKIP: bỏ qua các dòng pending
  
  4. Commit
     POST /inbound/excel-imports/:id/commit {skuStrategy, manualMapping}

[BACKEND]
  TX: tạo PHN-2026-0044 từ parsed_payload
      INSERT inbound_request + inbound_request_lines
      INSERT skus (nếu AUTO_CREATE) cho dòng pending
      excel_imports.status=COMMITTED
      excel_imports.inbound_request_id=:phn
  COMMIT
```

### 7.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/modules/inbound/excel-import/services/excel-parser.service.ts` | Parser file NCC — sai mapping cột = lệch toàn bộ |
| 🔒 `apps/api/src/modules/inbound/excel-import/services/excel-commit.service.ts` | Commit tạo PHN — TX phải atomic |
| 🔒 `apps/api/src/jobs/excel-import.processor.ts` | BullMQ worker — retry/dead-letter |

### 7.3 Edge cases

- File > 10MB → reject upload trước khi parse.
- File sai format (không có header chuẩn) → status=FAILED, error_message rõ.
- Row có `qty=0` hoặc weight không phải số → skip + log warning.

---

## 8. CP-07: Cân lại tồn (🟧 HIGH ⚠️ AUDIT BẮT BUỘC)

**Use case:** UC-OUT-05.

### 8.1 Flow

```
[KẾ TOÁN — WEB]
  1. Upload file SL đã xuất trong ngày (hoặc phiếu yêu cầu xuất)
     POST /outbound/rebalances (multipart)
     → status=PARSED → PREVIEWED

[BACKEND]
  2. Parse + match với staging:
     - Mỗi row: product + qty đã xuất
     - Tìm pallet/line ở OUTBOUND_STAGING tương ứng
     - Tính diff: qty_unit_before, qty_unit_exported, qty_unit_after

[KẾ TOÁN — WEB]
  3. Xem preview, kiểm chênh lệch
  4. Apply
     POST /outbound/rebalances/:id/apply {confirm, note}

[BACKEND]
  TX: validate user.permission = outbound.rebalance.apply
      INSERT audit_logs (action='outbound.rebalance.apply', before, after, reason=:note)
      LOOP qua rebalance_lines:
        UPDATE pallet_lines SET qty_unit = qty_unit_after
        INSERT movement (type=REBALANCE) — hoặc tracking riêng
        Nếu qty_unit_after=0 → pallet.status=RELEASED
      excel_imports.applied_at=now()
  COMMIT
```

### 8.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/modules/outbound/rebalance/services/rebalance-parser.service.ts` | Parse file SL xuất |
| 🔒 `apps/api/src/modules/outbound/rebalance/services/rebalance-apply.service.ts` | Apply — trừ tồn hàng loạt, sai = lệch nghiêm trọng |

---

## 9. CP-08: Kiểm kê → Điều chỉnh tồn (🟧 HIGH ⚠️ AUDIT BẮT BUỘC)

**Use cases:** UC-INV-06 → UC-INV-07 → UC-INV-08 → UC-INV-09.

### 9.1 Flow

```
[QUẢN LÝ — WEB]
  1. Tạo phiên kiểm kê                                            stocktake_sessions
     POST /stocktake/sessions
     {type=BY_LOCATION, blindCount=true, targetScope}

[NGƯỜI KK — MOBILE]
  2. Quét QR vị trí
     POST /stocktake/sessions/:id/scan-location {locationCode}
     → trả pallet + lines (ẨN system_qty_unit nếu blindCount)
  
  3. Đếm thực tế, nhập vào app
     POST /stocktake/sessions/:id/lines {actualQtyUnit, lot, expiryDate, note, photo}
     → backend so sánh với system_qty_unit (lúc tạo session) → tính diff
     → status=MATCHED nếu diff=0, DISCREPANCY nếu khác

[QUẢN LÝ — WEB]
  4. Xem báo cáo theo SKU
     GET /stocktake/sessions/:id/by-sku-summary
  
  5. Xử lý từng dòng chênh lệch
     POST /stocktake/sessions/:id/lines/:lineId/resolve {resolution}
     → ACCEPT: tạo dòng adjustment line
     → RECOUNT: đẩy lại bước 3 cho người KK khác
     → IGNORE: chỉ ghi nhận
  
  6. Đóng session
     POST /stocktake/sessions/:id/close
     → tự tạo inventory_adjustments DRAFT với các line ACCEPT

[KẾ TOÁN — WEB]
  7. Mở phiếu ADJ, bổ sung lý do, gửi duyệt
     POST /inventory/adjustments/:id/submit
     → status=PENDING_APPROVAL

[QUẢN LÝ — WEB]
  8. Duyệt
     POST /inventory/adjustments/:id/approve {note}
     
[BACKEND]
  TX: validate user.role=MANAGER
      INSERT audit_logs (action='adjustment.approve', before, after, reason=:note)
      → audit_log_id
      
      LOOP adjustment_lines:
        UPDATE pallet_lines SET qty_unit = qty_unit_after
      
      UPDATE inventory_adjustments
        SET status=APPROVED, approved_at, approved_by, audit_log_id
      
      Nếu type=DECREASE và pallet còn=0 → pallet.status=RELEASED
  COMMIT
```

### 9.2 Files PROTECTED (mức cao nhất)

| File | Lý do |
|---|---|
| 🔒🔒 `apps/api/src/modules/inventory/adjustments/services/approve.service.ts` | Duyệt điều chỉnh = thay đổi tồn chính thức. Sai = sai sổ |
| 🔒🔒 `apps/api/src/modules/inventory/adjustments/services/apply.service.ts` | Trừ/cộng tồn thực |
| 🔒🔒 `apps/api/src/modules/inventory/stocktake/services/session-close.service.ts` | Đóng phiên + sinh ADJ — không được mất diff |

### 9.3 Database invariants

- `inventory_adjustments` khi `status=APPROVED` thì `audit_log_id NOT NULL` (DB constraint).
- `inventory_adjustment_lines.diff_qty_unit` là GENERATED COLUMN — không cho client gửi.
- `stocktake_lines.system_qty_unit` chốt tại thời điểm tạo session, **không cập nhật theo realtime tồn**.

---

## 10. CP-09: Cảnh báo HSD & Tồn thấp (🟨 MEDIUM)

**Use case:** UC-INV-05.

### 10.1 Flow

```
[BULLMQ CRON — Hằng ngày 6:00]
  1. Query pallets có lines với:
     - expiry_date ≤ today + 7  → CRITICAL
     - expiry_date ≤ today + 30 → WARN
  
  2. Query products có:
     - sum(qty) < min_stock → STOCK_LOW
     - sum(qty) > max_stock → STOCK_OVER
  
  3. Query oldest_stock (cận date xa nhất theo vị trí)
  
  4. Loop alerts:
     INSERT notifications cho từng user theo cấu hình
     Push notification cho mobile (FCM)
     INSERT mail_logs + gửi email (BullMQ child job)
```

### 10.2 Files

| File | Lý do |
|---|---|
| 🔒 `apps/api/src/jobs/hsd-alert.processor.ts` | Job cron — sai = mất cảnh báo |
| `apps/api/src/jobs/email.processor.ts` | Gửi email — không PROTECTED nhưng quan trọng |

---

## 11. CP-10: Auth & RBAC (🟥 BLOCKER)

**Use cases:** UC-AUTH-01, 03, 04, 05.

### 11.1 Flow

```
[USER — Web/Mobile]
  1. Login với email/phone + password                             users
     POST /auth/login
     → bcrypt.compare(password, password_hash)
     → if fail: failed_login_count++, lock sau 5 lần
     → if ok: tạo access_token (15p) + refresh_token (7d)
              INSERT user_sessions (refresh_hash, device, ip)
              UPDATE users.last_login_at

  2. Mọi request → JwtAuthGuard verify access_token
     → CurrentUser decorator inject user
     → RolesGuard / PermissionsGuard check permission
     → 401/403 nếu không đủ

  3. Access token hết → refresh
     POST /auth/refresh (cookie refresh_token)
     → verify refresh_hash trong user_sessions
     → check expires_at, revoked_at
     → cấp access_token mới

  4. Logout
     POST /auth/logout
     → user_sessions.revoked_at = now()
```

### 11.2 Files PROTECTED

| File | Lý do |
|---|---|
| 🔒🔒 `apps/api/src/modules/auth/services/auth.service.ts` | Core login/refresh/logout |
| 🔒🔒 `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | Verify JWT |
| 🔒🔒 `apps/api/src/common/guards/jwt-auth.guard.ts` | Guard mọi request |
| 🔒🔒 `apps/api/src/common/guards/permissions.guard.ts` | RBAC check |
| 🔒🔒 `apps/api/src/modules/auth/services/password.service.ts` | bcrypt hash, lock policy |
| 🔒🔒 `apps/api/src/common/decorators/permissions.decorator.ts` | Decorator gắn permission lên endpoint |

### 11.3 Invariants

- bcrypt cost ≥ 12 (cấu hình từ env, không hard-code).
- Refresh token lưu hash, KHÔNG bao giờ lưu plaintext.
- Sau khi đổi mật khẩu (UC-AUTH-03/04): revoke toàn bộ `user_sessions` của user.
- 5 lần sai → lock 15 phút (không cho user lock chính mình bằng spam).

---

## 12. Bảng tổng hợp files PROTECTED

### 12.1 PROTECTED MAX (🔒🔒) — Cần Tech Lead + CTO approve

```
apps/api/src/modules/auth/services/auth.service.ts
apps/api/src/modules/auth/services/password.service.ts
apps/api/src/modules/auth/strategies/jwt.strategy.ts
apps/api/src/common/guards/jwt-auth.guard.ts
apps/api/src/common/guards/permissions.guard.ts
apps/api/src/common/decorators/permissions.decorator.ts
apps/api/src/modules/forklift/services/return-from-staging.service.ts
apps/api/src/modules/inventory/adjustments/services/approve.service.ts
apps/api/src/modules/inventory/adjustments/services/apply.service.ts
apps/api/src/modules/inventory/stocktake/services/session-close.service.ts
apps/api/src/modules/system/services/audit-log.service.ts
apps/api/src/common/interceptors/audit-log.interceptor.ts
```

### 12.2 PROTECTED (🔒) — Cần Tech Lead approve

```
apps/api/src/modules/pallets/services/pallet-code-generator.service.ts
apps/api/src/modules/pallets/services/pallet-confirm.service.ts
apps/api/src/modules/pallets/services/pallet-split.service.ts
apps/api/src/modules/inbound/services/reconcile-engine.service.ts
apps/api/src/modules/inbound/services/finalize.service.ts
apps/api/src/modules/inbound/excel-import/services/excel-parser.service.ts
apps/api/src/modules/inbound/excel-import/services/excel-commit.service.ts
apps/api/src/modules/inbound-tmp/services/standardize.service.ts
apps/api/src/modules/master-data/skus/services/sku-map.service.ts
apps/api/src/modules/forklift/services/putaway.service.ts
apps/api/src/modules/forklift/services/fefo-engine.service.ts
apps/api/src/modules/forklift/services/pick-fefo.service.ts
apps/api/src/modules/forklift/validators/location-capacity.validator.ts
apps/api/src/modules/outbound/rebalance/services/rebalance-parser.service.ts
apps/api/src/modules/outbound/rebalance/services/rebalance-apply.service.ts
apps/api/src/jobs/hsd-alert.processor.ts
apps/api/src/jobs/excel-import.processor.ts
prisma/schema.prisma                  # các model: Pallet, PalletLine, InboundRequest, Movement, AuditLog, InventoryAdjustment
prisma/migrations/                    # toàn bộ — chỉ tạo migration mới, không sửa file cũ
```

### 12.3 Quy ước review cho file PROTECTED

```markdown
## PR Title: [PROTECTED] <verb> <noun>
## Files touched: <list>

### Why (mục đích thay đổi)
<...>

### Impact analysis
- [ ] Tests cover ≥ 90% file đã sửa
- [ ] Backwards-compatible với API hiện tại
- [ ] Migration script (nếu có) đã test rollback
- [ ] Audit log không bị ảnh hưởng

### Manual test plan
- [ ] Smoke test luồng <CP-XX>
- [ ] Video/screenshot attached

### Reviewers
- [ ] @tech-lead (BẮT BUỘC)
- [ ] @reviewer1
- [ ] @reviewer2
```

CI workflow `.github/workflows/protected-files.yml` cần:
- Detect file PROTECTED trong diff
- Yêu cầu nhãn `protected-review` + ≥ 2 approvals từ CODEOWNERS
- Block merge nếu coverage < 90% cho file đó

---

## 13. CODEOWNERS đề xuất (`.github/CODEOWNERS`)

```
# Auth & Security
/apps/api/src/modules/auth/                 @tech-lead @security-lead
/apps/api/src/common/guards/                @tech-lead @security-lead
/apps/api/src/common/interceptors/audit-log.interceptor.ts  @tech-lead @security-lead

# Domain cốt lõi
/apps/api/src/modules/pallets/              @tech-lead @backend-lead
/apps/api/src/modules/inbound/              @tech-lead @backend-lead
/apps/api/src/modules/forklift/             @tech-lead @backend-lead
/apps/api/src/modules/inventory/            @tech-lead @backend-lead
/apps/api/src/modules/system/services/audit-log.service.ts  @tech-lead @security-lead

# Schema
/prisma/                                    @tech-lead @backend-lead @db-lead

# Infra
/infra/                                     @devops-lead @tech-lead
/.github/workflows/                         @devops-lead @tech-lead
```

---

## 14. Tham chiếu

- [ARCHITECTURE.md](ARCHITECTURE.md) — bố cục module
- [DATABASE.md](DATABASE.md) — schema cốt lõi
- [API_CONTRACTS.md](API_CONTRACTS.md) — endpoints
- [SECURITY.md](SECURITY.md) — mô hình bảo mật & audit
- [../RULES.md](../RULES.md) — quy ước phát triển

# 🛠️ LỘ TRÌNH CODE CHI TIẾT — 56 USE CASE WMS VĨNH GIANG
## Từng bước một, từ đầu đến cuối

---

## THỨ TỰ THỰC HIỆN TỔNG QUAN

```
BƯỚC 1  → UC-PAL-04  Xác nhận pallet
BƯỚC 2  → UC-PAL-03  Quét mã hàng vào pallet
BƯỚC 3  → UC-PAL-05  Sửa pallet sau xác nhận
BƯỚC 4  → UC-PAL-06  Xem lịch sử pallet
BƯỚC 5  → UC-IN-01   Lập phiếu yêu cầu nhập
BƯỚC 6  → UC-IN-06   Nhập phiếu từ Excel
BƯỚC 7  → UC-IN-02   Tiếp nhận phiếu nhập
BƯỚC 8  → UC-IN-03   Đối chiếu phiếu nhập
BƯỚC 9  → UC-IN-04   Chốt phiếu nhập
BƯỚC 10 → UC-IN-05   Theo dõi phiếu nhập
BƯỚC 11 → UC-INTMP-01 Tạo phiếu tồn tạm
BƯỚC 12 → UC-INTMP-02 Chuẩn hóa phiếu tạm
BƯỚC 13 → UC-INTMP-03 Xem tồn tạm
BƯỚC 14 → UC-FK-01   DS pallet chờ xếp
BƯỚC 15 → UC-FK-02   Đưa pallet vào vị trí
BƯỚC 16 → UC-FK-03   Chuyển vị trí pallet
BƯỚC 17 → UC-FK-04   Chuyển khu chờ xuất FEFO
BƯỚC 18 → UC-FK-05   Hoàn trả pallet (Audit)
BƯỚC 19 → UC-FK-06   Lịch sử luân chuyển
BƯỚC 20 → UC-OUT-01  Xem khu chờ xuất
BƯỚC 21 → UC-OUT-05  Cân lại tồn khu chờ xuất
BƯỚC 22 → UC-OUT-02  Báo cáo xuất tương đối
BƯỚC 23 → UC-OUT-03  Tốc độ luân chuyển
BƯỚC 24 → UC-OUT-04  Gợi ý nhập hàng
BƯỚC 25 → UC-INV-01  Tồn kho theo mã hàng
BƯỚC 26 → UC-INV-02  Tồn kho theo vị trí
BƯỚC 27 → UC-INV-03  Tồn kho theo pallet
BƯỚC 28 → UC-INV-04  Tồn kho theo lô/HSD
BƯỚC 29 → UC-INV-05  Cảnh báo HSD & tồn thấp
BƯỚC 30 → UC-INV-06  Kiểm kê theo vị trí
BƯỚC 31 → UC-INV-07  Kiểm kê theo mã hàng
BƯỚC 32 → UC-INV-08  Xử lý chênh lệch
BƯỚC 33 → UC-INV-09  Phiếu điều chỉnh tồn
BƯỚC 34 → UC-DASH-01 Dashboard theo vai trò
BƯỚC 35 → UC-DASH-02 KPI tổng quan
BƯỚC 36 → UC-AUTH-05 Phân quyền RBAC
BƯỚC 37 → UC-SYS-04  Quản lý người dùng
BƯỚC 38 → UC-SYS-01  Cấu hình chung
BƯỚC 39 → UC-SYS-02  Cấu hình mail
BƯỚC 40 → UC-SYS-03  Audit Log (xem)
BƯỚC 41 → UC-INT-01  Quét barcode/QR
BƯỚC 42 → UC-INT-02  Chụp ảnh đính kèm
BƯỚC 43 → UC-INT-03  Xuất Excel báo cáo
BƯỚC 44 → UC-SYS-05  Profile cá nhân (đã có)
```

---

# ═══════════════════════════════════════════
# PHASE 1: PALLET HOÀN THIỆN (4 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 1: UC-PAL-04 — Xác nhận pallet ⭐ Must

### Mục đích
Thủ kho nhấn "Xác nhận" → pallet chuyển COUNTING → CONFIRMED → sẵn sàng cho xe nâng.

### 1.1 Schema (prisma/schema.prisma)
```diff
# Cập nhật enum PalletStatus — thêm CONFIRMED
enum PalletStatus {
  EMPTY
  COUNTING
+ CONFIRMED      // Thủ kho đã xác nhận, chờ xe nâng
+ IN_STORAGE     // Xe nâng đã xếp vào vị trí
+ IN_STAGING     // Đang ở khu chờ xuất
+ RELEASED       // Đã xuất kho
  CANCELLED
}

# Thêm fields vào model Pallet
model Pallet {
  ...
+ confirmed_by    String?   @db.Uuid
+ location_id     String?   @db.Uuid  // Vị trí hiện tại (dùng cho FK)
+ location        Location? @relation(fields: [location_id], references: [id])
}
```

### 1.2 API
```
POST /api/pallets/[id]/confirm
```
**File:** `src/app/api/pallets/[id]/confirm/route.ts`

**Logic:**
1. Kiểm tra pallet tồn tại
2. Kiểm tra status = COUNTING (chỉ COUNTING mới confirm được)
3. Kiểm tra pallet có ≥ 1 dòng hàng (lines.length > 0)
4. Tính `total_weight_kg` = SUM(lines.weight_kg)
5. Cập nhật: `status = CONFIRMED`, `confirmed_at = now()`, `confirmed_by = userId`
6. Trả về pallet đã cập nhật

**Validation:**
- Pallet EMPTY → lỗi "Pallet chưa có hàng, không thể xác nhận"
- Pallet CONFIRMED rồi → lỗi "Pallet đã xác nhận"
- Lines = 0 → lỗi "Phải có ít nhất 1 dòng hàng"

### 1.3 Frontend
**File:** `src/app/pallets/[id]/page.tsx` (SỬA)

**Thay đổi:**
- Thêm nút **"✅ Xác nhận pallet"** (chỉ hiện khi status = COUNTING)
- Khi click → confirm dialog "Xác nhận pallet {code}? Sau khi xác nhận, pallet sẽ chuyển cho xe nâng."
- Gọi `POST /api/pallets/[id]/confirm`
- Sau confirm → disable form thêm hàng, nút chuyển xám

### 1.4 Test
```
✓ Confirm pallet COUNTING → CONFIRMED
✓ Confirm pallet EMPTY → lỗi (chưa có hàng)
✓ Confirm pallet đã CONFIRMED → lỗi
✓ Confirm pallet 0 dòng → lỗi
✓ confirmed_at + confirmed_by được ghi
```

---

## BƯỚC 2: UC-PAL-03 — Quét mã hàng vào pallet ⭐ Must

### Mục đích
Camera điện thoại quét barcode/QR → tự động nhận diện mã hàng → điền vào form thêm dòng hàng.

### 2.1 Schema
Không cần thêm — dùng lại `PalletLine` + `ItemCode` đã có.

### 2.2 Component mới
**File:** `src/components/BarcodeScanner.tsx` (MỚI)

**Dùng thư viện:** `html5-qrcode` (CDN hoặc npm)

**Logic:**
1. Component nhận prop `onScan(code: string)`
2. Khi mount → mở camera rear
3. Quét liên tục → khi nhận mã → gọi callback `onScan(code)`
4. Nút "Đóng camera" để tắt
5. Fallback: input text nếu camera lỗi

### 2.3 Frontend
**File:** `src/app/pallets/[id]/page.tsx` (SỬA)

**Thay đổi:**
- Thêm nút **"📷 Quét mã"** bên cạnh ô tìm kiếm
- Click → mở BarcodeScanner component (overlay/modal)
- Khi quét được → gọi `/api/item-codes?q={scanned_code}`
- Nếu tìm thấy → tự động chọn mã hàng vào form
- Nếu không → hiện dialog "Mã chưa có — Tạo mã mới?"

### 2.4 Cài đặt
```bash
npm install html5-qrcode
```

### 2.5 Test
```
✓ Mở camera quét barcode thành công
✓ Quét mã → tự điền vào form
✓ Quét mã không tồn tại → thông báo "không tìm thấy"
✓ Camera lỗi → fallback nhập tay
✓ Nút đóng camera hoạt động
```

---

## BƯỚC 3: UC-PAL-05 — Sửa pallet sau xác nhận · Should

### Mục đích
Unlock pallet đã CONFIRMED để sửa lại, bắt buộc nhập lý do, ghi audit log.

### 3.1 Schema
```diff
# Thêm model AuditLog (dùng chung cả hệ thống)
model AuditLog {
  id          String   @id @default(uuid()) @db.Uuid
  entity_type String   @db.VarChar(50)    // "pallet", "inbound", "adjustment"...
  entity_id   String   @db.Uuid
  action      String   @db.VarChar(50)    // "UNLOCK", "CONFIRM", "DELETE"...
  old_value   Json?                        // Giá trị cũ (JSON)
  new_value   Json?                        // Giá trị mới (JSON)
  reason      String?  @db.Text           // Lý do thay đổi
  performed_by String? @db.Uuid
  performed_at DateTime @default(now())

  @@index([entity_type, entity_id])
  @@index([performed_at])
  @@map("audit_logs")
}
```

### 3.2 API
```
POST /api/pallets/[id]/unlock
```
**File:** `src/app/api/pallets/[id]/unlock/route.ts` (MỚI)

**Logic:**
1. Kiểm tra pallet tồn tại + status = CONFIRMED
2. Kiểm tra body có `reason` (bắt buộc, min 5 ký tự)
3. Cập nhật: `status = COUNTING`, `confirmed_at = null`
4. Tạo AuditLog: entity_type="pallet", action="UNLOCK", reason=...
5. Trả về pallet + thông báo

**Validation:**
- Không có lý do → lỗi 400
- Status khác CONFIRMED → lỗi "Chỉ pallet đã xác nhận mới có thể mở lại"

### 3.3 Frontend
**File:** `src/app/pallets/[id]/page.tsx` (SỬA)

**Thay đổi:**
- Khi status = CONFIRMED → hiện nút **"🔓 Yêu cầu sửa"**
- Click → modal nhập lý do (textarea, bắt buộc)
- Gọi `POST /api/pallets/[id]/unlock`
- Sau unlock → form thêm hàng mở lại

### 3.4 Test
```
✓ Unlock pallet CONFIRMED → COUNTING
✓ Unlock không có lý do → lỗi
✓ Unlock pallet COUNTING/EMPTY → lỗi
✓ AuditLog được tạo với reason
✓ Sau unlock → có thể thêm/xóa hàng lại
```

---

## BƯỚC 4: UC-PAL-06 — Xem lịch sử pallet ⭐ Must

### Mục đích
Tab "Lịch sử" trong trang chi tiết pallet: timeline trạng thái + thay đổi.

### 4.1 API
```
GET /api/pallets/[id]/history
```
**File:** `src/app/api/pallets/[id]/history/route.ts` (MỚI)

**Logic:**
1. Query AuditLog WHERE entity_type="pallet" AND entity_id = id
2. ORDER BY performed_at DESC
3. Include performer info (user name)
4. Trả về mảng events

### 4.2 Frontend
**File:** `src/app/pallets/[id]/page.tsx` (SỬA)

**Thay đổi:**
- Thêm **2 tabs**: "📦 Hàng hóa" (hiện tại) | "📜 Lịch sử"
- Tab Lịch sử: timeline vertical
  - Mỗi event: icon trạng thái + mô tả + người thực hiện + thời gian
  - VD: "🟢 Tạo pallet · admin · 21/05/2026 09:00"
  - VD: "📦 Thêm 5 thùng UNI-2023-B002 · admin · 09:05"
  - VD: "✅ Xác nhận pallet · admin · 09:10"

### 4.3 Test
```
✓ Hiển thị timeline đúng thứ tự thời gian
✓ Hiện tên người thực hiện
✓ Hiện đầy đủ events: tạo, thêm hàng, xác nhận, unlock
```

---

# ═══════════════════════════════════════════
# PHASE 2: INBOUND — NHẬP KHO (6 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 5: UC-IN-01 — Lập phiếu yêu cầu nhập ⭐ Must

### Mục đích
Kế toán tạo phiếu nhập: chọn NCC, ngày dự kiến, thêm dòng hàng dự kiến.

### 5.1 Schema
```prisma
enum InboundStatus {
  DRAFT           // Mới tạo, chưa gửi
  PENDING         // Đã gửi, chờ Thủ kho tiếp nhận
  RECEIVING       // Thủ kho đang nhập SL thực nhận
  RECONCILING     // Kế toán đang đối chiếu
  COMPLETED       // Đã chốt
  CANCELLED       // Đã hủy
}

model InboundRequest {
  id              String         @id @default(uuid()) @db.Uuid
  code            String         @unique @db.VarChar(20) // PNK-2026-0001
  code_year       Int            @db.SmallInt
  code_seq        Int            @db.SmallInt
  supplier_id     String?        @db.Uuid
  expected_date   DateTime?      @db.Date
  status          InboundStatus  @default(DRAFT)
  note            String?        @db.Text
  created_by      String?        @db.Uuid
  received_by     String?        @db.Uuid      // Thủ kho tiếp nhận
  reconciled_by   String?        @db.Uuid      // Kế toán đối chiếu
  received_at     DateTime?
  reconciled_at   DateTime?
  completed_at    DateTime?
  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt

  supplier        Supplier?      @relation(fields: [supplier_id], references: [id])
  lines           InboundLine[]

  @@unique([code_year, code_seq])
  @@index([status])
  @@index([supplier_id])
  @@map("inbound_requests")
}

model InboundLine {
  id                 String          @id @default(uuid()) @db.Uuid
  inbound_request_id String          @db.Uuid
  item_code_id       String          @db.Uuid
  qty_expected       Decimal         @db.Decimal(10, 2)  // SL dự kiến (thùng)
  qty_received       Decimal?        @db.Decimal(10, 2)  // SL thực nhận
  qty_accepted       Decimal?        @db.Decimal(10, 2)  // SL chấp nhận sau đối chiếu
  lot                String?         @db.VarChar(40)
  expiry_date        DateTime?       @db.Date
  note               String?         @db.Text
  discrepancy_note   String?         @db.Text             // Ghi chú chênh lệch
  created_at         DateTime        @default(now())
  updated_at         DateTime        @updatedAt

  inbound_request    InboundRequest  @relation(fields: [inbound_request_id], references: [id], onDelete: Cascade)
  item_code          ItemCode        @relation(fields: [item_code_id], references: [id])

  @@index([inbound_request_id])
  @@map("inbound_lines")
}
```

### 5.2 API
```
GET  /api/inbound             → Danh sách phiếu nhập
POST /api/inbound             → Tạo phiếu mới
GET  /api/inbound/[id]        → Chi tiết phiếu
PUT  /api/inbound/[id]        → Cập nhật phiếu (DRAFT only)
DELETE /api/inbound/[id]      → Hủy phiếu
POST /api/inbound/[id]/send   → Gửi cho Thủ kho (DRAFT → PENDING)
```

**Files:**
- `src/app/api/inbound/route.ts` — GET list + POST create
- `src/app/api/inbound/[id]/route.ts` — GET detail + PUT update + DELETE
- `src/app/api/inbound/[id]/send/route.ts` — POST gửi

**Logic tạo phiếu:**
1. Sinh mã: `PNK-{YYYY}-{SSSS}` (4 số, tăng dần theo năm)
2. Body: `{ supplier_id, expected_date, note, lines: [{ item_code_id, qty_expected, lot, expiry_date }] }`
3. Status = DRAFT
4. Validate: mỗi line phải có item_code_id + qty_expected > 0

**Logic gửi phiếu:**
1. Status DRAFT → PENDING
2. (Tương lai: gửi notification cho Thủ kho)

### 5.3 Frontend
**File:** `src/app/inbound/page.tsx` (MỚI)

**Giao diện:**
- Bảng danh sách phiếu: Mã | NCC | Ngày dự kiến | Status | Dòng hàng | Ngày tạo | Thao tác
- KPI cards: Tổng | Nháp | Chờ tiếp nhận | Đang đối chiếu | Hoàn tất
- Nút "📝 Lập phiếu mới" → modal/trang mới
- Click mã phiếu → trang chi tiết

**File:** `src/app/inbound/new/page.tsx` (MỚI)

**Giao diện form:**
- Header: Mã tự sinh (readonly), NCC dropdown, Ngày dự kiến
- Bảng dòng hàng: Mã hàng (search) | Tên | SL thùng | Lô | HSD | Xóa
- Nút "Thêm dòng" + "Lưu nháp" + "Gửi cho Thủ kho"

### 5.4 Sidebar
```diff
# src/components/layout/Sidebar.tsx — Thêm menu
+ NHẬP KHO
+   ├── Phiếu nhập         → /inbound
+   └── Nhập đột xuất      → /inbound-adhoc
```

### 5.5 Test
```
✓ Tạo phiếu nhập mã PNK-2026-SSSS
✓ Thêm dòng hàng (mã hàng + SL + Lô + HSD)
✓ Gửi phiếu DRAFT → PENDING
✓ Hủy phiếu DRAFT → CANCELLED
✓ Không thêm/sửa phiếu khi status ≠ DRAFT
```

---

## BƯỚC 6: UC-IN-06 — Nhập phiếu từ Excel ★ Must · Mới

### Mục đích
Upload file Excel hàng về NCC → parse → match mã hàng → tạo phiếu tự động.

### 6.1 API
```
POST /api/inbound/import-excel
```
**File:** `src/app/api/inbound/import-excel/route.ts` (MỚI)

**Logic:**
1. Nhận file upload (multipart/form-data)
2. Parse Excel bằng thư viện `xlsx`
3. Đọc từng dòng: mã hàng, tên, SL, đơn giá...
4. Match mã hàng với `item_codes` table:
   - Khớp 100% → ✅ xanh
   - Khớp tương đối (similarity) → 🟡 vàng, gợi ý
   - Không khớp → 🔴 đỏ, cần tạo mã tạm
5. Trả về kết quả match (chưa tạo phiếu)

```
POST /api/inbound/import-excel/confirm
```
6. Người dùng xác nhận mapping → tạo phiếu + tự tạo mã tạm cho dòng không khớp

### 6.2 Cài đặt
```bash
npm install xlsx
```

### 6.3 Frontend
**File:** `src/app/inbound/import/page.tsx` (MỚI)

**Giao diện 3 bước:**
1. **Upload:** Kéo thả file Excel / chọn file + chọn NCC
2. **Đối chiếu:** Bảng match — mã hàng Excel | mã hệ thống | trạng thái (✅🟡🔴) | hành động
3. **Xác nhận:** Review → "Tạo phiếu" → chuyển sang trang phiếu mới tạo

### 6.4 Test
```
✓ Upload file Excel thành công
✓ Parse đúng các dòng hàng
✓ Match mã hàng chính xác (xanh)
✓ Mã không khớp → hiện cảnh báo (vàng/đỏ)
✓ Tự tạo mã tạm cho hàng mới
✓ Tạo phiếu nhập từ kết quả import
```

---

## BƯỚC 7: UC-IN-02 — Tiếp nhận phiếu nhập ⭐ Must

### Mục đích
Thủ kho nhận hàng thực tế, nhập SL thực nhận cho từng dòng.

### 7.1 API
```
POST /api/inbound/[id]/receive
PUT  /api/inbound/[id]/lines/[lineId]/receive
```

**File:** `src/app/api/inbound/[id]/receive/route.ts` (MỚI)

**Logic POST (bắt đầu tiếp nhận):**
1. Status PENDING → RECEIVING
2. Ghi `received_by`, `received_at`

**File:** `src/app/api/inbound/[id]/lines/[lineId]/receive/route.ts` (MỚI)

**Logic PUT (nhập SL từng dòng):**
1. Body: `{ qty_received, note }`
2. Validate: qty_received ≥ 0
3. Cập nhật `inbound_line.qty_received`
4. Ghi `discrepancy_note` nếu chênh lệch

### 7.2 Frontend
**File:** `src/app/inbound/[id]/page.tsx` (MỚI)

**Giao diện (cho Thủ kho - mobile):**
- Header: Mã phiếu, NCC, Ngày dự kiến, Status badge
- Bảng: Mã hàng | Tên | SL Dự kiến | **SL Thực nhận (input)** | Chênh lệch | Ghi chú
- Chênh lệch tự tính: `qty_received - qty_expected` (đỏ nếu âm, xanh nếu dương)
- Nút **"✅ Hoàn tất tiếp nhận"** → gửi tất cả SL → chuyển RECEIVING → RECONCILING

### 7.3 Test
```
✓ Bắt đầu tiếp nhận PENDING → RECEIVING
✓ Nhập SL thực nhận từng dòng
✓ Hiển thị chênh lệch tự động
✓ Hoàn tất tiếp nhận → RECONCILING
```

---

## BƯỚC 8: UC-IN-03 — Đối chiếu phiếu nhập ⭐ Must

### Mục đích
Kế toán xem bảng so sánh dự kiến vs thực nhận, xử lý chênh lệch.

### 8.1 API
```
POST /api/inbound/[id]/reconcile
PUT  /api/inbound/[id]/lines/[lineId]/accept
```

**Logic PUT (chấp nhận từng dòng):**
- Body: `{ qty_accepted, discrepancy_note }`
- Kế toán quyết định SL chấp nhận cuối cùng
- Ghi lý do chênh lệch

**Logic POST (hoàn tất đối chiếu):**
- Kiểm tra tất cả lines đều có qty_accepted
- RECONCILING → COMPLETED hoặc chờ chốt

### 8.2 Frontend
**File:** `src/app/inbound/[id]/page.tsx` (SỬA — thêm view cho Kế toán)

**Giao diện (cho Kế toán - PC):**
- Bảng 5 cột: Mã hàng | SL Dự kiến | SL Thực nhận | **SL Chấp nhận (input)** | Ghi chú chênh lệch
- Hàng có chênh lệch → highlight vàng/đỏ
- Nút **"Phê duyệt đối chiếu"**

### 8.3 Test
```
✓ Hiển thị bảng 3 cột SL (dự kiến, thực nhận, chấp nhận)
✓ Nhập SL chấp nhận + ghi chú chênh lệch
✓ Hoàn tất đối chiếu → sẵn sàng chốt
```

---

## BƯỚC 9: UC-IN-04 — Chốt phiếu nhập ⭐ Must

### Mục đích
Chốt phiếu → tồn kho chính thức cập nhật.

### 9.1 API
```
POST /api/inbound/[id]/complete
```
**File:** `src/app/api/inbound/[id]/complete/route.ts` (MỚI)

**Logic:**
1. Kiểm tra status = RECONCILING
2. Kiểm tra tất cả lines có qty_accepted
3. Cập nhật status → COMPLETED, completed_at = now()
4. **(Tương lai khi có Inventory):** Cập nhật tồn kho chính thức
5. Ghi AuditLog

### 9.2 Frontend
- Nút **"🔒 Chốt phiếu"** trên trang chi tiết (khi status = RECONCILING)
- Confirm dialog: "Chốt phiếu {code}? Tồn kho sẽ được cập nhật."

### 9.3 Test
```
✓ Chốt phiếu RECONCILING → COMPLETED
✓ Không chốt nếu còn line chưa có qty_accepted
✓ completed_at được ghi
✓ AuditLog được tạo
```

---

## BƯỚC 10: UC-IN-05 — Theo dõi phiếu nhập ⭐ Must

### Mục đích
Trang danh sách phiếu + bộ lọc mạnh.

### 10.1 API
Đã có từ Bước 5: `GET /api/inbound?q=...&status=...&supplier_id=...&from=...&to=...`

**Thêm filter:**
- `supplier_id` — lọc NCC
- `status` — lọc trạng thái
- `from` / `to` — lọc theo ngày tạo
- `q` — tìm mã phiếu

### 10.2 Frontend
Đã tạo từ Bước 5: `src/app/inbound/page.tsx`

**Bổ sung:**
- Dropdown NCC filter
- Date range picker (từ ngày - đến ngày)
- Status filter chips
- Export nút (tương lai: UC-INT-03)

### 10.3 Test
```
✓ Lọc theo NCC
✓ Lọc theo trạng thái
✓ Lọc theo khoảng thời gian
✓ Tìm kiếm mã phiếu
✓ Kết hợp nhiều bộ lọc
```

---

# ═══════════════════════════════════════════
# PHASE 3: INBOUND TEMP — NHẬP ĐỘT XUẤT (3 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 11: UC-INTMP-01 — Tạo phiếu tồn tạm (Mobile) ⭐ Must

### 11.1 Schema
```prisma
enum InboundTempStatus { PENDING  STANDARDIZED  REJECTED }

model InboundTemp {
  id              String              @id @default(uuid()) @db.Uuid
  code            String              @unique @db.VarChar(20) // PTT-2026-0001
  supplier_id     String?             @db.Uuid
  status          InboundTempStatus   @default(PENDING)
  note            String?             @db.Text
  created_by      String?             @db.Uuid
  standardized_by String?             @db.Uuid
  standardized_at DateTime?
  created_at      DateTime            @default(now())
  updated_at      DateTime            @updatedAt

  supplier        Supplier?           @relation(fields: [supplier_id], references: [id])
  lines           InboundTempLine[]

  @@index([status])
  @@map("inbound_temps")
}

model InboundTempLine {
  id               String       @id @default(uuid()) @db.Uuid
  inbound_temp_id  String       @db.Uuid
  item_code_id     String       @db.Uuid
  qty_box          Decimal      @db.Decimal(10, 2)
  lot              String?      @db.VarChar(40)
  expiry_date      DateTime?    @db.Date
  note             String?      @db.Text
  created_at       DateTime     @default(now())

  inbound_temp     InboundTemp  @relation(fields: [inbound_temp_id], references: [id], onDelete: Cascade)
  item_code        ItemCode     @relation(fields: [item_code_id], references: [id])

  @@map("inbound_temp_lines")
}
```

### 11.2 API
```
GET  /api/inbound-temp            → Danh sách phiếu tạm
POST /api/inbound-temp            → Tạo phiếu tạm
GET  /api/inbound-temp/[id]       → Chi tiết
POST /api/inbound-temp/[id]/lines → Thêm dòng hàng
```

### 11.3 Frontend
**File:** `src/app/inbound-adhoc/page.tsx` (MỚI)
- Giống trang pallet: form tạo phiếu tạm + danh sách

### 11.4 Test
```
✓ Tạo phiếu tạm mã PTT-YYYY-SSSS
✓ Thêm dòng hàng (quét/nhập)
✓ Hiển thị danh sách phiếu tạm
```

---

## BƯỚC 12: UC-INTMP-02 — Chuẩn hóa phiếu tạm (Desktop) ⭐ Must

### 12.1 API
```
POST /api/inbound-temp/[id]/standardize   → Chuyển thành phiếu nhập chính thức
POST /api/inbound-temp/[id]/reject        → Từ chối phiếu tạm
```

**Logic standardize:**
1. Tạo InboundRequest từ InboundTemp (copy lines)
2. Cập nhật InboundTemp status → STANDARDIZED
3. Trả về mã phiếu nhập mới

### 12.2 Frontend
**File:** `src/app/inbound-adhoc/[id]/page.tsx` (MỚI)
- Xem chi tiết phiếu tạm
- Nút "Chuẩn hóa → Phiếu nhập" hoặc "Từ chối"

---

## BƯỚC 13: UC-INTMP-03 — Xem tồn tạm ⭐ Must

### 13.1 API
```
GET /api/inbound-temp/summary → Tổng hợp tồn tạm
```

### 13.2 Frontend
- Tab hoặc card trên trang `/inbound-adhoc`: tổng phiếu chờ, tổng giá trị tồn tạm

---

# ═══════════════════════════════════════════
# PHASE 4: FORKLIFT — XE NÂNG (6 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 14: UC-FK-01 — Danh sách pallet chờ xếp ⭐ Must

### 14.1 API
```
GET /api/forklift/queue → Pallet WHERE status = CONFIRMED ORDER BY confirmed_at ASC
```

### 14.2 Frontend
**File:** `src/app/forklift/page.tsx` (MỚI)
- Danh sách pallet chờ: Mã | NCC | Tổng dòng | Tổng KG | Thời gian chờ | "Xếp vị trí"

### 14.3 Sidebar
```diff
+ VẬN HÀNH KHO
    Pallet          → /pallets
+   Xe nâng         → /forklift
```

---

## BƯỚC 15: UC-FK-02 — Đưa pallet vào vị trí ⭐ Must

### 15.1 Schema
```prisma
enum MovementType { PUT_AWAY  RELOCATE  STAGE_OUT  RETURN }

model Movement {
  id               String       @id @default(uuid()) @db.Uuid
  pallet_id        String       @db.Uuid
  movement_type    MovementType
  from_location_id String?      @db.Uuid
  to_location_id   String?      @db.Uuid
  reason           String?      @db.Text
  performed_by     String?      @db.Uuid
  performed_at     DateTime     @default(now())

  pallet           Pallet       @relation(fields: [pallet_id], references: [id])
  from_location    Location?    @relation("movement_from", fields: [from_location_id], references: [id])
  to_location      Location?    @relation("movement_to", fields: [to_location_id], references: [id])

  @@index([pallet_id])
  @@index([performed_at])
  @@map("movements")
}
```

### 15.2 API
```
POST /api/forklift/put-away
```
**Body:** `{ pallet_id, location_id }`

**Logic:**
1. Kiểm tra pallet status = CONFIRMED
2. Kiểm tra location status = AVAILABLE (trống)
3. Cập nhật pallet: `status = IN_STORAGE`, `location_id = location_id`
4. Cập nhật location: `status = OCCUPIED`
5. Tạo Movement: type=PUT_AWAY, to_location_id
6. Trả về thành công

### 15.3 Frontend
**File:** `src/app/forklift/put-away/page.tsx` (MỚI)
- Bước 1: Quét/chọn pallet (từ danh sách chờ)
- Bước 2: Quét QR vị trí đích
- Bước 3: Xác nhận "Đã xếp xong"

---

## BƯỚC 16: UC-FK-03 — Chuyển vị trí pallet ⭐ Must

### 16.1 API
```
POST /api/forklift/relocate
```
**Body:** `{ pallet_id, new_location_id }`

**Logic:**
1. Lấy pallet + location hiện tại
2. Kiểm tra new_location AVAILABLE
3. Location cũ → AVAILABLE, Location mới → OCCUPIED
4. Pallet.location_id = new_location_id
5. Tạo Movement: type=RELOCATE, from=cũ, to=mới

### 16.2 Frontend
**File:** `src/app/forklift/relocate/page.tsx` (MỚI)
- Quét pallet → hiện vị trí hiện tại → Quét vị trí mới → Xác nhận

---

## BƯỚC 17: UC-FK-04 — Chuyển khu chờ xuất (FEFO) ⭐ Must

### 17.1 API
```
GET  /api/forklift/fefo-suggest?item_code_id=xxx  → Gợi ý pallet theo FEFO
POST /api/forklift/stage-out                       → Chuyển pallet sang khu chờ
```

**Logic GET fefo-suggest:**
1. Query PalletLine WHERE item_code_id = xxx + pallet.status = IN_STORAGE
2. JOIN expiry_date, ORDER BY expiry_date ASC (hết hạn sớm nhất trước)
3. Cảnh báo: ≤7 ngày → 🔴, ≤30 ngày → 🟡
4. Trả về danh sách gợi ý

**Logic POST stage-out:**
1. Pallet.status → IN_STAGING, location cũ → AVAILABLE
2. Pallet.location_id = staging_area_id (vị trí khu chờ)
3. Tạo Movement: type=STAGE_OUT

### 17.2 Frontend
**File:** `src/app/forklift/stage-out/page.tsx` (MỚI)
- Tìm mã hàng cần xuất → hệ thống gợi ý pallet FEFO → chọn → xác nhận

---

## BƯỚC 18: UC-FK-05 — Hoàn trả pallet (Audit) ⭐ Must

### 18.1 API
```
POST /api/forklift/return
```
**Body:** `{ pallet_id, location_id, reason (bắt buộc) }`

**Logic:**
1. Pallet.status IN_STAGING → IN_STORAGE
2. Location mới → OCCUPIED
3. Tạo Movement: type=RETURN
4. Tạo AuditLog: entity_type="return", reason=...

### 18.2 Frontend
- Nút "Hoàn trả" trên trang khu chờ xuất → modal nhập lý do → quét vị trí trả về

---

## BƯỚC 19: UC-FK-06 — Lịch sử luân chuyển · Should

### 19.1 API
```
GET /api/movements?pallet_id=...&item_code_id=...&location_id=...&from=...&to=...
```

### 19.2 Frontend
**File:** `src/app/forklift/history/page.tsx` (MỚI)
- Bộ lọc: pallet, mã hàng, vị trí, thời gian
- Timeline: icon loại di chuyển + từ/đến + người thực hiện + thời gian

---

# ═══════════════════════════════════════════
# PHASE 5: OUTBOUND — XUẤT KHO (5 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 20: UC-OUT-01 — Xem khu chờ xuất ⭐ Must

### API: `GET /api/outbound/staging`
Query pallet WHERE status = IN_STAGING, include lines + HSD info.

### Frontend: `src/app/outbound/page.tsx` (MỚI)
- Bảng pallet ở khu chờ: Mã | Hàng | SL | HSD | Thời gian vào khu | Thao tác

---

## BƯỚC 21: UC-OUT-05 — Cân lại tồn khu chờ xuất ★ Must · Mới

### API:
```
POST /api/outbound/rebalance/upload    → Upload Excel SL đã xuất
POST /api/outbound/rebalance/confirm   → Xác nhận trừ tồn
```

### Frontend: `src/app/outbound/rebalance/page.tsx` (MỚI)
- Upload file → so sánh tồn hiện tại vs SL xuất → bảng chênh lệch → xác nhận → trừ tồn

---

## BƯỚC 22: UC-OUT-02 — Báo cáo xuất tương đối ⭐ Must

### API: `GET /api/outbound/report?from=...&to=...&group_by=item|supplier`
Tổng hợp SL xuất theo kỳ, mã hàng, NCC.

### Frontend: `src/app/outbound/report/page.tsx` (MỚI)
- Bảng báo cáo + biểu đồ cột (Chart.js) + xuất Excel

---

## BƯỚC 23: UC-OUT-03 — Tốc độ luân chuyển · Should

### API: `GET /api/outbound/turnover?period=30d`
Tính turnover rate = SL xuất / Tồn TB × 100%.

### Frontend: `src/app/outbound/turnover/page.tsx` (MỚI)
- Bảng: Mã hàng | Tồn TB | SL Nhập | SL Xuất | Turnover Rate | Xếp hạng

---

## BƯỚC 24: UC-OUT-04 — Gợi ý nhập hàng · Should

### API: `GET /api/outbound/reorder-suggest`
WHERE current_stock < min_stock → gợi ý SL cần nhập.

### Frontend: `src/app/outbound/reorder/page.tsx` (MỚI)
- Bảng gợi ý: Mã hàng | Tồn hiện tại | Mức min | SL cần nhập | "Tạo phiếu"

---

# ═══════════════════════════════════════════
# PHASE 6: INVENTORY — TỒN KHO & KIỂM KÊ (9 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 25: UC-INV-01 — Tồn kho theo mã hàng ⭐ Must

### API: `GET /api/inventory/by-item`
```sql
SELECT item_code_id, SUM(qty_box) as total_qty,
  SUM(CASE WHEN pallet.status='IN_STORAGE' THEN qty_box END) as available_qty,
  SUM(CASE WHEN pallet.status='IN_STAGING' THEN qty_box END) as staging_qty,
  MIN(expiry_date) as nearest_expiry
FROM pallet_lines
JOIN pallets ON ...
WHERE pallet.status IN ('IN_STORAGE', 'IN_STAGING')
GROUP BY item_code_id
```

### Frontend: `src/app/inventory/page.tsx` (MỚI)
- Bảng: Mã hàng | Tên | SL Khả dụng | SL Chờ xuất | Tổng | HSD gần nhất | Cảnh báo

---

## BƯỚC 26: UC-INV-02 — Tồn kho theo vị trí ⭐ Must

### API: `GET /api/inventory/by-location`
Locations + pallets ở đó + lines bên trong.

### Frontend: `src/app/inventory/by-location/page.tsx` (MỚI)
- Sơ đồ lưới kho (grid) — mỗi ô = 1 vị trí, màu theo trạng thái
- Click ô → popup chi tiết: pallet nào, hàng gì, SL bao nhiêu

---

## BƯỚC 27: UC-INV-03 — Tồn kho theo pallet ⭐ Must

### API: Tái sử dụng `GET /api/pallets?status=IN_STORAGE,IN_STAGING`

### Frontend: `src/app/inventory/by-pallet/page.tsx` (MỚI)
- Danh sách pallet trong kho + vị trí + nội dung

---

## BƯỚC 28: UC-INV-04 — Tồn kho theo lô/HSD (FEFO) ⭐ Must

### API: `GET /api/inventory/by-lot`
GROUP BY item_code_id, lot, expiry_date → phân bổ tồn theo lô.

### Frontend: `src/app/inventory/by-lot/page.tsx` (MỚI)
- Bảng: Mã hàng | Lô | HSD | SL | Vị trí | Cảnh báo FEFO
- Sort mặc định: HSD tăng dần (sắp hết hạn trước)

---

## BƯỚC 29: UC-INV-05 — Cảnh báo HSD & tồn thấp ⭐ Must

### API: `GET /api/inventory/alerts`
- HSD ≤ 7 ngày → 🔴 Urgent
- HSD ≤ 30 ngày → 🟡 Warning
- Tồn < min → ⚠️ Low stock

### Frontend: `src/app/inventory/alerts/page.tsx` (MỚI)
- Cards cảnh báo: SL hàng sắp hết HSD + SL hàng tồn thấp
- Bảng chi tiết + link đến vị trí/pallet

---

## BƯỚC 30: UC-INV-06 — Kiểm kê theo vị trí ★ Must · Mới

### 30.1 Schema
```prisma
enum StocktakeType   { BY_LOCATION  BY_ITEM }
enum StocktakeStatus { OPEN  COUNTING  RECONCILING  CLOSED }

model StocktakeSession {
  id          String           @id @default(uuid()) @db.Uuid
  code        String           @unique @db.VarChar(20) // KK-2026-001
  type        StocktakeType
  status      StocktakeStatus  @default(OPEN)
  note        String?          @db.Text
  created_by  String?          @db.Uuid
  started_at  DateTime?
  completed_at DateTime?
  created_at  DateTime         @default(now())

  counts      StocktakeCount[]
  @@map("stocktake_sessions")
}

model StocktakeCount {
  id               String           @id @default(uuid()) @db.Uuid
  session_id       String           @db.Uuid
  location_id      String?          @db.Uuid
  item_code_id     String?          @db.Uuid
  system_qty       Decimal          @db.Decimal(10, 2)
  actual_qty       Decimal?         @db.Decimal(10, 2)
  discrepancy      Decimal?         @db.Decimal(10, 2)
  note             String?          @db.Text
  counted_by       String?          @db.Uuid
  counted_at       DateTime?
  created_at       DateTime         @default(now())

  session          StocktakeSession @relation(fields: [session_id], references: [id], onDelete: Cascade)
  @@map("stocktake_counts")
}
```

### 30.2 API
```
POST /api/stock-count                  → Tạo phiên kiểm kê
GET  /api/stock-count/[id]             → Chi tiết phiên
PUT  /api/stock-count/[id]/counts/[cid] → Nhập SL thực đếm
POST /api/stock-count/[id]/complete    → Hoàn tất kiểm kê
```

### 30.3 Frontend
**File:** `src/app/stock-count/page.tsx` → Danh sách phiên kiểm kê
**File:** `src/app/stock-count/new/page.tsx` → Tạo phiên mới (chọn vị trí)
**File:** `src/app/stock-count/[id]/page.tsx` → Thực hiện kiểm kê (nhập SL thực đếm)

---

## BƯỚC 31: UC-INV-07 — Kiểm kê theo mã hàng ★ Must · Mới
Tương tự Bước 30 nhưng type = BY_ITEM. Chọn mã hàng → liệt kê tất cả vị trí có mã đó → đếm.

---

## BƯỚC 32: UC-INV-08 — Xử lý chênh lệch ★ Must · Mới

### API: `GET /api/stock-count/[id]/discrepancies`
Bảng: system_qty vs actual_qty → discrepancy (dương/âm).

### Frontend: Tab "Chênh lệch" trên trang phiên kiểm kê
- Highlight: dương = xanh (thừa), âm = đỏ (thiếu)
- Hành động: "Phê duyệt điều chỉnh" hoặc "Yêu cầu kiểm lại"

---

## BƯỚC 33: UC-INV-09 — Phiếu điều chỉnh tồn ★ Must · Mới

### 33.1 Schema
```prisma
enum AdjustmentStatus { PENDING  APPROVED  REJECTED }

model AdjustmentVoucher {
  id                    String           @id @default(uuid()) @db.Uuid
  code                  String           @unique @db.VarChar(20) // DCT-2026-001
  stocktake_session_id  String?          @db.Uuid
  reason                String           @db.Text
  status                AdjustmentStatus @default(PENDING)
  created_by            String?          @db.Uuid
  approved_by           String?          @db.Uuid
  approved_at           DateTime?
  created_at            DateTime         @default(now())

  lines                 AdjustmentLine[]
  @@map("adjustment_vouchers")
}

model AdjustmentLine {
  id                    String             @id @default(uuid()) @db.Uuid
  voucher_id            String             @db.Uuid
  item_code_id          String             @db.Uuid
  location_id           String?            @db.Uuid
  qty_before            Decimal            @db.Decimal(10, 2)
  qty_adjust            Decimal            @db.Decimal(10, 2) // + thêm / - bớt
  qty_after             Decimal            @db.Decimal(10, 2)

  voucher               AdjustmentVoucher  @relation(fields: [voucher_id], references: [id], onDelete: Cascade)
  @@map("adjustment_lines")
}
```

### 33.2 API
```
POST /api/adjustments            → Tạo phiếu điều chỉnh
POST /api/adjustments/[id]/approve → Quản lý phê duyệt
POST /api/adjustments/[id]/reject  → Quản lý từ chối
```

### 33.3 Frontend
**File:** `src/app/inventory/adjustments/page.tsx` → Danh sách phiếu
**File:** `src/app/inventory/adjustments/[id]/page.tsx` → Chi tiết + phê duyệt

---

# ═══════════════════════════════════════════
# PHASE 7: DASHBOARD + SYSTEM + INTEGRATION (10 UC)
# ═══════════════════════════════════════════

---

## BƯỚC 34: UC-DASH-01 — Dashboard theo vai trò ⭐ Must

### API: `GET /api/dashboard`
Trả về data tùy vai trò user (từ JWT token).

### Frontend: `src/app/page.tsx` hoặc `src/app/dashboard/page.tsx` (SỬA)

**5 giao diện theo role:**
| Vai trò | Widget chính |
|---------|-------------|
| Quản lý | KPI tổng quan, biểu đồ nhập/xuất, cảnh báo |
| Kế toán | Phiếu nhập chờ xử lý, phiếu tạm chờ, tồn kho |
| Thủ kho | Pallet chờ thêm hàng, phiếu nhập chờ tiếp nhận |
| Xe nâng | Pallet chờ xếp, việc cần làm hôm nay |
| NKK | Phiên kiểm kê đang mở, vị trí cần kiểm |

---

## BƯỚC 35: UC-DASH-02 — KPI tổng quan ⭐ Must

### API: `GET /api/dashboard/kpi?period=7d|30d|90d`
```json
{
  "total_stock_items": 1234,
  "total_stock_weight_kg": 56789,
  "inbound_this_period": 45,
  "outbound_this_period": 32,
  "location_usage_percent": 72.5,
  "expiring_items_7d": 8,
  "expiring_items_30d": 23,
  "forklift_tasks_today": 12
}
```

### Frontend: Cards KPI + biểu đồ Chart.js (line chart nhập/xuất theo ngày)
**Cài đặt:** `npm install chart.js react-chartjs-2`

---

## BƯỚC 36: UC-AUTH-05 — Phân quyền RBAC ⭐ Must

### 36.1 Schema
```diff
# Cập nhật enum Role
enum Role {
- ADMIN
- MANAGER
- STAFF
+ QUAN_LY        // Quản lý — full quyền
+ KE_TOAN        // Kế toán kho
+ THU_KHO        // Thủ kho
+ XE_NANG        // Xe nâng
+ KIEM_KE        // Người kiểm kê
}
```

### 36.2 Middleware RBAC
**File:** `src/middleware.ts` (SỬA)

**Logic:**
- Mỗi route → kiểm tra role user (từ JWT)
- Ma trận: role × chức năng → Có / Không
- VD: XE_NANG chỉ truy cập `/forklift/*`, `/pallets/*` (xem)

### 36.3 Frontend
**File:** `src/app/system/rbac/page.tsx` (MỚI)
- Bảng ma trận: hàng = chức năng, cột = vai trò, ô = checkbox

---

## BƯỚC 37: UC-SYS-04 — Quản lý người dùng ⭐ Must

### API:
```
GET    /api/users          → Danh sách users
POST   /api/users          → Tạo user mới
PUT    /api/users/[id]     → Sửa user (tên, role, khóa/mở)
DELETE /api/users/[id]     → Xóa user
```

### Frontend: `src/app/system/users/page.tsx` (MỚI)
- Bảng: Tên | Email | SĐT | Vai trò | Trạng thái | Lần đăng nhập cuối | Thao tác

---

## BƯỚC 38: UC-SYS-01 — Cấu hình chung ⭐ Must

### Schema:
```prisma
model SystemConfig {
  id    String @id @default(uuid()) @db.Uuid
  key   String @unique @db.VarChar(100)
  value String @db.Text
  @@map("system_configs")
}
```

### Keys:
- `company_name`, `hsd_warning_7d`, `hsd_warning_30d`, `default_min_stock`, `timezone`

### Frontend: `src/app/system/config/page.tsx` (MỚI)
- Form key-value + Lưu

---

## BƯỚC 39: UC-SYS-02 — Cấu hình mail · Should

### API: `PUT /api/system/mail`, `POST /api/system/mail/test`

### Frontend: `src/app/system/mail/page.tsx` (MỚI)
- Form: SMTP host, port, user, password + nút "Test kết nối"

---

## BƯỚC 40: UC-SYS-03 — Audit Log ⭐ Must

### API: `GET /api/audit-logs?entity_type=...&user_id=...&from=...&to=...`
Dùng model AuditLog đã tạo ở Bước 3.

### Frontend: `src/app/system/audit-log/page.tsx` (MỚI)
- Bảng: Thời gian | Người dùng | Hành động | Đối tượng | Chi tiết | Lý do

---

## BƯỚC 41: UC-INT-01 — Quét barcode/QR ⭐ Must

**Tái sử dụng** `BarcodeScanner.tsx` từ Bước 2. Không cần code thêm.

---

## BƯỚC 42: UC-INT-02 — Chụp ảnh đính kèm · Should

### Schema:
```prisma
model Attachment {
  id          String @id @default(uuid()) @db.Uuid
  entity_type String @db.VarChar(50)
  entity_id   String @db.Uuid
  file_url    String @db.Text
  file_name   String @db.VarChar(255)
  file_size   Int
  mime_type   String @db.VarChar(50)
  note        String? @db.Text
  uploaded_by String? @db.Uuid
  created_at  DateTime @default(now())
  @@map("attachments")
}
```

### API:
```
POST   /api/attachments/upload  → Upload ảnh (multipart)
GET    /api/attachments?entity_type=inbound&entity_id=xxx
DELETE /api/attachments/[id]
```

### Component: `src/components/AttachmentUpload.tsx`
- Chụp ảnh camera / chọn file → upload → hiển thị thumbnail
- Max 10 ảnh/phiếu, 5MB/ảnh

---

## BƯỚC 43: UC-INT-03 — Xuất Excel báo cáo · Should

### Component: `src/components/ExcelExport.tsx`
- Props: `data[]`, `columns[]`, `filename`
- Dùng thư viện `xlsx` (đã cài ở Bước 6)
- Options: chọn cột, phạm vi (toàn bộ/đã lọc), định dạng (.xlsx/.csv)

### Tích hợp vào:
- Trang tồn kho (UC-INV-01~04)
- Trang báo cáo xuất (UC-OUT-02)
- Trang audit log (UC-SYS-03)
- Trang kiểm kê (UC-INV-06~07)

---

## BƯỚC 44: UC-SYS-05 — Profile cá nhân ✅ ĐÃ CÓ

Trang đổi mật khẩu đã hoàn thành. Bổ sung nếu cần: sửa tên, SĐT, ảnh đại diện.

---

# ═══════════════════════════════════════════
# TỔNG HỢP FILES CẦN TẠO/SỬA
# ═══════════════════════════════════════════

## Schema (prisma/schema.prisma)
```
Phase 1:  + Sửa PalletStatus enum, + AuditLog model
Phase 2:  + InboundRequest, InboundLine
Phase 3:  + InboundTemp, InboundTempLine
Phase 4:  + Movement model
Phase 5:  (không thêm model mới)
Phase 6:  + StocktakeSession, StocktakeCount, AdjustmentVoucher, AdjustmentLine
Phase 7:  + SystemConfig, Attachment, sửa Role enum
```

## API Routes (src/app/api/)
```
Phase 1:  pallets/[id]/confirm, pallets/[id]/unlock, pallets/[id]/history
Phase 2:  inbound/*, inbound/[id]/*, inbound/import-excel/*
Phase 3:  inbound-temp/*, inbound-temp/[id]/*
Phase 4:  forklift/queue, forklift/put-away, forklift/relocate, forklift/stage-out, forklift/return, movements
Phase 5:  outbound/staging, outbound/rebalance/*, outbound/report, outbound/turnover, outbound/reorder-suggest
Phase 6:  inventory/by-item, inventory/by-location, inventory/by-lot, inventory/alerts, stock-count/*, adjustments/*
Phase 7:  dashboard, dashboard/kpi, users/*, system/config, system/mail, audit-logs, attachments/*
```

## Frontend Pages (src/app/)
```
Phase 1:  pallets/[id]/page.tsx (SỬA)
Phase 2:  inbound/page.tsx, inbound/new/page.tsx, inbound/import/page.tsx, inbound/[id]/page.tsx
Phase 3:  inbound-adhoc/page.tsx, inbound-adhoc/[id]/page.tsx
Phase 4:  forklift/page.tsx, forklift/put-away/page.tsx, forklift/relocate/page.tsx, forklift/stage-out/page.tsx, forklift/history/page.tsx
Phase 5:  outbound/page.tsx, outbound/rebalance/page.tsx, outbound/report/page.tsx, outbound/turnover/page.tsx, outbound/reorder/page.tsx
Phase 6:  inventory/page.tsx, inventory/by-location/page.tsx, inventory/by-pallet/page.tsx, inventory/by-lot/page.tsx, inventory/alerts/page.tsx, stock-count/page.tsx, stock-count/new/page.tsx, stock-count/[id]/page.tsx, inventory/adjustments/page.tsx, inventory/adjustments/[id]/page.tsx
Phase 7:  dashboard/page.tsx (SỬA), system/rbac/page.tsx, system/users/page.tsx, system/config/page.tsx, system/mail/page.tsx, system/audit-log/page.tsx
```

## Components (src/components/)
```
Phase 1:  BarcodeScanner.tsx
Phase 5:  (Chart.js wrapper)
Phase 7:  ExcelExport.tsx, AttachmentUpload.tsx
```

## Sidebar Menu (src/components/layout/Sidebar.tsx)
```
DỮ LIỆU GỐC          ← Đã có
├── Sản phẩm           /master-data
├── Mã hàng            /item-codes
├── Nhóm hàng          /product-groups
├── Đơn vị tính        /units
├── Vị trí kho         /locations
└── Nhà cung cấp       /suppliers

VẬN HÀNH KHO          ← Phase 1
├── Pallet             /pallets
├── Xe nâng            /forklift          ← Phase 4
└── Nhập đột xuất      /inbound-adhoc     ← Phase 3

NHẬP KHO              ← Phase 2
├── Phiếu nhập         /inbound
└── Import Excel       /inbound/import

XUẤT KHO              ← Phase 5
├── Khu chờ xuất       /outbound
├── Báo cáo xuất       /outbound/report
└── Gợi ý nhập         /outbound/reorder

TỒN KHO               ← Phase 6
├── Theo mã hàng       /inventory
├── Theo vị trí        /inventory/by-location
├── Theo pallet        /inventory/by-pallet
├── Theo lô/HSD        /inventory/by-lot
├── Cảnh báo           /inventory/alerts
├── Kiểm kê            /stock-count
└── Phiếu điều chỉnh   /inventory/adjustments

HỆ THỐNG              ← Phase 7
├── Dashboard          /dashboard
├── Người dùng         /system/users
├── Phân quyền         /system/rbac
├── Cấu hình           /system/config
├── Audit Log          /system/audit-log
└── Đổi mật khẩu       /system/change-password
```

---

## CHECKLIST HOÀN THÀNH TOÀN DỰ ÁN

```
Phase 0  ✅✅✅✅✅✅✅✅✅✅✅✅  12/12
Phase 1  ✅✅✅✅                     4/4   (PAL-04 ✅, PAL-03 ✅, PAL-05 ✅, PAL-06 ✅) ← DONE!
Phase 2  ✅✅✅✅✅✅                 6/6   (IN-01 ✅, IN-06 ✅, IN-02 ✅, IN-03 ✅, IN-04 ✅, IN-05 ✅) ← DONE!
Phase 3  ✅✅✅                       3/3   (INTMP-01 ✅, INTMP-02 ✅, INTMP-03 ✅) ← DONE!
Phase 4  ✅✅✅✅✅✅                 6/6   (FK-01 ✅, FK-02 ✅, FK-03 ✅, FK-04 ✅, FK-05 ✅, FK-06 ✅) ← DONE!
Phase 5  ✅✅✅✅✅                   5/5   (OUT-01 ✅, OUT-05 ✅, OUT-02 ✅, OUT-03 ✅, OUT-04 ✅) ← DONE!
Phase 6  ✅✅✅✅✅✅✅✅✅           9/9   (INV-01 ✅ ~ INV-09 ✅) ← DONE!
Phase 7  ✅✅✅✅✅✅✅✅✅✅         10/10  (DASH ✅, AUTH ✅, SYS ✅, INT ✅) ← DONE!
─────────────────────────────────────
TỔNG     56/56 → 🎉🎉🎉 HOÀN THÀNH! 🎉🎉🎉
```

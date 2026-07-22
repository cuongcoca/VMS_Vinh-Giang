# 🗺️ LỘ TRÌNH CHI TIẾT FIX GAP — WMS Vĩnh Giang

> **Ngày lập:** 2026-05-25
> **Nguồn:** `BAO_CAO_GAP_MOCKUP_VS_WEB.md` (53 UC đã đối chiếu)
> **Branch làm việc:** `vinhgiang1`
> **Mục tiêu:** Đưa giao diện web về khớp 100% mockup `wms_mockups_4.html`

---

## 📐 NGUYÊN TẮC TỔ CHỨC

### Ký hiệu effort
- **XS** — ≤ 2 giờ (1 PR nhỏ, fix 1 field)
- **S** — ½ – 1 ngày (1 PR, fix 1 page)
- **M** — 1 – 3 ngày (cần migration hoặc workflow nhỏ)
- **L** — > 3 ngày (workflow lớn, nhiều file, API mới)

### Quy ước task ID
- `P{phase}.{group}.{seq}` — VD `P1.PAL.03` = Phase 1, nhóm Pallet, task 3

### Quy tắc PR
- Mỗi task ≈ 1 PR. Task L có thể chia 2-3 PR.
- File **🔒 PROTECTED** (xem [docs/CRITICAL_PATHS.md](docs/CRITICAL_PATHS.md) §12) cần Tech Lead review.
- Mọi DB migration tạo file `migrate_*.sql` ở root + commit cùng PR.

### Cấu trúc team gợi ý
- 1 Backend (Prisma + API routes)
- 1 Frontend (Next.js pages + components)
- 1 QA part-time

### Tổng quan 6 phase

| Phase | Tên | Thời lượng | Mục tiêu chính |
|---|---|---|---|
| **P0** | Foundation — DB & Schema | 3-5 ngày | Bổ sung field DB còn thiếu, master data đầy đủ |
| **P1** | Quick Wins — Hiển thị field đã có | 5-7 ngày | Hiển thị data đã có trong DB lên UI (ít rủi ro) |
| **P2** | Bổ sung field BẮT BUỘC | 8-10 ngày | Thêm các field mockup yêu cầu vào form |
| **P3** | Workflow lớn | 12-15 ngày | UC-FK-04/05, UC-OUT-05, UC-INTMP-02, UC-INV-09 |
| **P4** | Báo cáo & Dashboard | 7-10 ngày | Chart, KPI, drill-down, cảnh báo |
| **P5** | System & Polish | 5-7 ngày | Logo, mail config, RBAC nâng cao, audit log |

**Tổng:** ~8-10 tuần với team 2-3 người.

---

# 📦 PHASE 0 — FOUNDATION (3-5 ngày)

> **Mục đích:** Bổ sung các field DB còn thiếu mà nhiều UC khác sẽ dùng. Không sửa logic — chỉ migration + cập nhật Prisma client.

## P0.DB.01 — Thêm các field còn thiếu vào Prisma schema
**Loại:** DB | **Effort:** M | **Depends on:** —

**Files sửa:**
- `prisma/schema.prisma`

**Field bổ sung:**

```prisma
// Pallet — thêm liên kết PHN
model Pallet {
  // ... existing
  inbound_request_id String?         @db.Uuid
  inbound_request    InboundRequest? @relation(fields: [inbound_request_id], references: [id])
  created_by         String?         @db.Uuid
  creator            User?           @relation("pallet_creator", fields: [created_by], references: [id])
  @@index([inbound_request_id])
}

// ProductGroup — thêm mã hiển thị (NH-01)
model ProductGroup {
  // ... existing
  code String? @unique @db.VarChar(20)
}

// UnitOfMeasure — thêm mã hiển thị
model UnitOfMeasure {
  // ... existing
  code String? @unique @db.VarChar(20)
}

// User — thêm username + force change password
model User {
  // ... existing
  username             String?  @unique @db.VarChar(50)
  must_change_password Boolean  @default(false)
  avatar_url           String?  @db.Text
}

// InboundRequest — đã có import_type/warehouse; bổ sung thêm
model InboundRequest {
  // ... existing
  source_file_url    String?   @db.Text   // UC-IN-06: link file Excel gốc
  source_file_name   String?   @db.VarChar(255)
  order_date         DateTime? @db.Date   // UC-IN-06: ngày đặt theo file
}

// InboundTemp — thêm metadata theo UC-INTMP-01
model InboundTemp {
  // ... existing
  source_type        String?   @db.VarChar(20) // SUPPLIER | RETURN | OTHER
  delivered_by       String?   @db.VarChar(120)
  received_at        DateTime?
  reason             String?   @db.VarChar(40) // EARLY | NOT_READY | UNNOTIFIED_RETURN | NEW_SUPPLIER | OTHER
  reason_detail      String?   @db.Text
}

// AdjustmentVoucher — bổ sung phân loại + link
model AdjustmentVoucher {
  // ... existing
  type       String?  @db.VarChar(20)  // DECREASE | INCREASE | STOCKTAKE_RESOLVE
  reason_code String? @db.VarChar(40)  // BROKEN | LOST | STOCKTAKE | OTHER
}

// AdjustmentLine — thêm pallet/location/lot
model AdjustmentLine {
  // ... existing (đã có location_id)
  pallet_id String? @db.Uuid
  lot       String? @db.VarChar(40)
  note      String? @db.Text
  pallet    Pallet? @relation(fields: [pallet_id], references: [id])
}

// Movement — bổ sung detail cho UC-FK-04/05
model Movement {
  // ... existing
  product_id  String?  @db.Uuid
  qty_box     Decimal? @db.Decimal(10, 2)
  qty_unit    Decimal? @db.Decimal(14, 3)
  lot         String?  @db.VarChar(40)
  expiry_date DateTime? @db.Date
  mode        String?  @db.VarChar(10) // FULL | PARTIAL
  reason_code String?  @db.VarChar(40)
  audit_log_id String? @db.Uuid       // bắt buộc khi UC-FK-05
}

// Mới: OutboundRequest (PYX) cho UC-OUT-05 cách 2
model OutboundRequest {
  id              String   @id @default(uuid()) @db.Uuid
  code            String   @unique @db.VarChar(20)  // PYX-2026-0034
  code_year       Int      @db.SmallInt
  code_seq        Int      @db.SmallInt
  customer        String?  @db.VarChar(255)
  ship_date       DateTime? @db.Date
  status          String   @default("PENDING") @db.VarChar(20) // PENDING | PICKING | SHIPPED | CANCELLED
  created_by      String?  @db.Uuid
  shipped_by      String?  @db.Uuid
  shipped_at      DateTime?
  note            String?  @db.Text
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  lines           OutboundRequestLine[]
  @@unique([code_year, code_seq])
  @@map("outbound_requests")
}

model OutboundRequestLine {
  id                   String  @id @default(uuid()) @db.Uuid
  outbound_request_id  String  @db.Uuid
  item_code_id         String  @db.Uuid
  qty_requested        Decimal @db.Decimal(14, 3)
  qty_shipped          Decimal? @db.Decimal(14, 3)
  pallet_id            String? @db.Uuid
  outbound_request     OutboundRequest @relation(fields: [outbound_request_id], references: [id], onDelete: Cascade)
  item_code            ItemCode @relation(fields: [item_code_id], references: [id])
  @@map("outbound_request_lines")
}

// Mới: MailSettings + MailLog cho UC-SYS-02 đầy đủ
model MailSettings {
  id              String   @id @default(uuid()) @db.Uuid
  provider        String   @db.VarChar(20) // SMTP | MAILGUN | SENDGRID
  host            String?  @db.VarChar(120)
  port            Int?
  security        String   @default("TLS") @db.VarChar(10) // TLS | SSL | NONE
  username        String?  @db.VarChar(255)
  password_enc    String?  @db.Text
  api_key_enc     String?  @db.Text
  from_email      String   @db.VarChar(255)
  from_name       String   @db.VarChar(120)
  reply_to_email  String?  @db.VarChar(255)
  rate_limit_per_hour Int? @default(100)
  is_active       Boolean  @default(false)
  last_tested_at  DateTime?
  last_test_result String? @db.Text
  updated_at      DateTime @updatedAt
  @@map("mail_settings")
}

// Mới: AlertSetting cho UC-INV-05
model AlertSetting {
  id            String   @id @default(uuid()) @db.Uuid
  alert_type    String   @db.VarChar(40) // HSD_7D | HSD_30D | STOCK_LOW | STOCK_OVER | OLD_STOCK
  frequency     String   @db.VarChar(20) // DAILY_6AM | WEEKLY | MONTHLY
  recipients    String[] // mảng email
  is_active     Boolean  @default(true)
  updated_at    DateTime @updatedAt
  @@map("alert_settings")
}
```

**Acceptance criteria:**
- [ ] `npx prisma db push` chạy sạch không lỗi
- [ ] `npx prisma generate` cập nhật client
- [ ] Seed mới chạy không lỗi
- [ ] Backup DB trước khi push prod

---

## P0.DB.02 — Bổ sung enum LocationStatus theo mockup
**Loại:** DB | **Effort:** XS | **Depends on:** P0.DB.01

**Files sửa:**
- `prisma/schema.prisma`

```prisma
enum LocationStatus {
  EMPTY
  USING
  FULL
  PARTIAL          // ← mới: Còn một phần
  MAINTENANCE
  RESERVED
  WAITING_OUTBOUND
  NEEDS_CHECK      // ← mới: Cần kiểm tra lại
}
```

**Acceptance criteria:**
- [ ] Migration không break dữ liệu cũ (chỉ thêm enum value)

---

## P0.DB.03 — Bổ sung enum cho Pallet status detail
**Loại:** DB | **Effort:** XS | **Depends on:** P0.DB.01

Code hiện tại đủ enum `PalletStatus` — chỉ cần verify mapping với mockup:
- `EMPTY` ↔ "Chưa kích hoạt"
- `COUNTING` ↔ "Đang kiểm đếm"
- `CONFIRMED` ↔ "Đã xác nhận"
- `IN_STORAGE` ↔ "Đã vào vị trí"
- `IN_STAGING` ↔ "Đang ở khu chờ xuất"
- `RELEASED` ↔ "Đã rời kho"

**Acceptance criteria:**
- [ ] Tạo file `src/lib/status-labels.ts` map enum → label tiếng Việt cho mọi enum

---

## P0.SEED.01 — Seed mã (code) cho ProductGroup và Unit hiện có
**Loại:** Data | **Effort:** XS | **Depends on:** P0.DB.01

**Script mới:** `prisma/seed-codes.ts`

```typescript
// Loop tất cả groups → assign code = `NH-${index+1:02d}`
// Loop tất cả units → assign code = uppercase short name
```

**Acceptance criteria:**
- [ ] Tất cả group có `code` (vd NH-01, NH-02...)
- [ ] Tất cả unit có `code` (vd THUNG, CHAI, GOI, LON)

---

## P0.LIB.01 — Tạo helper conversion thùng ↔ đơn vị lẻ
**Loại:** UI Library | **Effort:** S | **Depends on:** —

**File mới:** `src/lib/qty-converter.ts`

```typescript
export function boxToUnit(qtyBox: number, qtyPerBox: number): number {
  return qtyBox * qtyPerBox;
}

export function weightOfBox(qtyBox: number, weightPerBox: number): number {
  return qtyBox * weightPerBox;
}

export function formatConversion(qtyBox: number, item: ItemCode): string {
  // "5 thùng × 24 chai = 120 chai · Tải trọng: 66 kg"
  // dùng cho UC-PAL-02, UC-FK-04, UC-INV-*
}
```

**Acceptance criteria:**
- [ ] Unit test cover 5 case: integer, float, zero qty_per_box, missing weight, lots of boxes
- [ ] Export type + function rõ ràng

---

# 🎯 PHASE 1 — QUICK WINS (5-7 ngày)

> **Mục đích:** Hiển thị data đã có trong DB lên UI. Rủi ro thấp — chỉ thêm cột bảng hoặc field hiển thị, không sửa logic backend.

## Nhóm PAL — Pallet

### P1.PAL.01 — Hiển thị vị trí hiện tại trên Pallet detail (UC-PAL-06)
**Loại:** UI | **Effort:** S | **Depends on:** —
**Priority:** 🔥 CRITICAL — gap lớn nhất trong báo cáo

**Files sửa:**
- `src/app/pallets/[id]/page.tsx` (desktop)
- `src/app/thukho/pallet/[id]/page.tsx` (mobile)
- `src/app/pallets/page.tsx` (list) — thêm cột Vị trí
- `src/app/thukho/pallet/page.tsx` (mobile list) — badge `📍 A-03-02`

**API:** Đảm bảo `GET /api/pallets/[id]` đã include `location` (đã có trong `pallets/route.ts`); kiểm tra `[id]/route.ts` có `include: { location: true }` chưa.

**UI changes:**
- Desktop: thêm field "Vị trí hiện tại" trong header card cạnh status badge
- Mobile: badge `📍 {location.code}` ngay dưới mã pallet
- List card mobile: thêm `📍 A-03-02` vào meta line khi `status=IN_STORAGE`

**Acceptance criteria:**
- [ ] Pallet `IN_STORAGE` hiển thị mã vị trí ở 4 chỗ (2 detail + 2 list)
- [ ] Pallet không có vị trí → hiển thị "—"
- [ ] Test thủ công với pallet `PL260523.001` (đang IN_STORAGE @ A-01-01)

---

### P1.PAL.02 — Hiển thị liên kết PHN trên Pallet (UC-PAL-01, 06)
**Loại:** UI | **Effort:** S | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/pallets/[id]/page.tsx`
- `src/app/thukho/pallet/[id]/page.tsx`
- `src/app/thukho/pallet/page.tsx`

**API:** Update `src/app/api/pallets/[id]/route.ts` để include `inbound_request: { select: { code: true } }`.

**UI:**
- Header detail: badge `📥 PHN-2026-0042` (link sang `/inbound/{id}`)
- Card list: meta line `📥 PHN-...` khi có

**Acceptance criteria:**
- [ ] Pallet không gắn PHN → ẩn badge
- [ ] Click badge → navigate sang phiếu nhập

---

### P1.PAL.03 — Hiển thị count theo tab (UC-PAL-01)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/thukho/pallet/page.tsx`

**API:** Đảm bảo `GET /api/pallets` trả về `kpis` (đã có) hoặc thêm count theo từng status.

**UI:**
- Tab pill hiển thị `Đang xử lý (4)`, `Đã xác nhận (12)`, `Đã vào vị trí (n)` thay vì plain label

**Acceptance criteria:**
- [ ] Mỗi tab có số đếm chính xác
- [ ] Reload sau khi confirm pallet → count cập nhật

---

### P1.PAL.04 — Hiển thị số mã hàng (distinct) trên card pallet (UC-PAL-01)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/pallets/route.ts` (thêm aggregate)
- `src/app/thukho/pallet/page.tsx`

**API:**
```typescript
// Thêm vào response mỗi pallet:
distinct_items: number // SELECT COUNT(DISTINCT item_code_id) FROM pallet_lines WHERE pallet_id = ?
```

Cách rẻ: dùng `_count.lines` đã có (= total_lines) + thêm subquery cho distinct.

**UI:**
- Card: `{distinct_items} mã hàng · {total_lines} dòng`

**Acceptance criteria:**
- [ ] Pallet có 3 lines của 2 mã hàng khác nhau → hiển thị "2 mã hàng · 3 dòng"

---

### P1.PAL.05 — Hiển thị SL đơn vị lẻ trên card dòng hàng (UC-PAL-06)
**Loại:** UI | **Effort:** S | **Depends on:** P0.LIB.01

**Files sửa:**
- `src/app/pallets/[id]/page.tsx`
- `src/app/thukho/pallet/[id]/page.tsx`

**UI:**
- Mỗi dòng pallet show: `qty_box thùng × qty_per_box = qty_unit {đơn vị lẻ}`
- VD: `5 thùng × 24 chai = 120 chai`
- Dùng `formatConversion()` từ P0.LIB.01

**Acceptance criteria:**
- [ ] Item code có `qty_per_box=24`, dòng có `qty_box=5` → show "120 chai"
- [ ] Item code không có `qty_per_box` → fallback hiển thị `qty_box`

---

### P1.PAL.06 — Thêm event PUTAWAY/RELOCATE vào timeline lịch sử (UC-PAL-06)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/pallets/[id]/page.tsx` (ACTION_MAP)
- `src/app/thukho/pallet/[id]/page.tsx`
- `src/app/api/pallets/[id]/history/route.ts` — include movements nếu chưa

**API:** Merge `audit_logs` + `movements` vào 1 timeline thống nhất, sắp xếp DESC theo time.

**ACTION_MAP cập nhật:**
```typescript
const ACTION_MAP = {
  CREATE: { icon: "✨", label: "Tạo pallet" },
  ADD_LINE: { icon: "➕", label: "Thêm dòng hàng" },
  DELETE_LINE: { icon: "🗑️", label: "Xóa dòng hàng" },
  CONFIRM: { icon: "✓", label: "Xác nhận pallet" },
  UNLOCK: { icon: "🔓", label: "Mở khóa pallet" },
  PUT_AWAY: { icon: "📍", label: "Đưa vào vị trí" },      // mới
  RELOCATE: { icon: "🔄", label: "Chuyển vị trí" },        // mới
  STAGE_OUT: { icon: "🚚", label: "Sang khu chờ xuất" },   // mới
  RETURN: { icon: "↩️", label: "Hoàn trả vị trí" },        // mới
}
```

**Acceptance criteria:**
- [ ] Pallet đã putaway → timeline hiện event "Đưa vào vị trí A-03-02"
- [ ] Mỗi event hiển thị tên user (role) + vị trí from/to

---

## Nhóm IN — Inbound

### P1.IN.01 — Hiển thị tổng SL trên card list phiếu nhập (UC-IN-05)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/inbound/route.ts` (thêm sum qty)
- `src/app/inbound/page.tsx` — thêm cột "SL nhập / yêu cầu"

**API:**
```typescript
// Trong include lines, thêm:
_aggregate: {
  sum_expected: SUM(qty_expected),
  sum_received: SUM(qty_received),
}
```

**UI:**
- Bảng list thêm cột `SL nhập / yêu cầu` (vd `876 / 920`)
- Mobile card: `3 mã · 920 đv`

**Acceptance criteria:**
- [ ] Phiếu có 3 dòng tổng 920 yêu cầu, đã nhập 876 → show "876 / 920"
- [ ] Phiếu DRAFT chưa có thực nhận → show "— / 920"

---

### P1.IN.02 — Thêm filter "Có chênh lệch" (UC-IN-05)
**Loại:** UI + API | **Effort:** S | **Depends on:** P1.IN.01

**Files sửa:**
- `src/app/api/inbound/route.ts` (filter query param)
- `src/app/inbound/page.tsx` (thêm chip filter)

**API:** Thêm query param `?has_discrepancy=true` → filter phiếu có `sum_received != sum_expected`.

**Acceptance criteria:**
- [ ] Click chip "Có chênh lệch" → chỉ hiện phiếu có gap

---

### P1.IN.03 — Hiển thị người tạo trên card list inbound mobile (UC-IN-02)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/api/inbound/route.ts` — include `creator: { select: { full_name: true } }`
- `src/app/thukho/inbound/page.tsx`

**UI:**
- Card: `👤 {creator.full_name}`

**Acceptance criteria:**
- [ ] Card hiển thị tên KT đã tạo phiếu

---

## Nhóm FK — Forklift

### P1.FK.01 — Thêm cột Mã hàng/Lô/SL/Người vào lịch sử luân chuyển (UC-FK-06)
**Loại:** UI | **Effort:** M | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/api/movements/route.ts` (verify include đầy đủ)
- `src/app/forklift/history/page.tsx`

**API include:**
```typescript
{
  pallet: { include: { lines: { include: { item_code: true } } } },
  performed_by_user: true,
}
```

**UI:**
- Đổi từ timeline sang **bảng** với cột: `Thời gian | Loại | Pallet | Mã hàng | Lô/Date | SL | Từ | Đến | Người`
- Nếu pallet có nhiều dòng → show `(N mã)` collapse
- Badge color theo 4 loại

**Acceptance criteria:**
- [ ] Bảng hiển thị đủ 9 cột mockup
- [ ] Có row → có người thao tác (không "—")

---

### P1.FK.02 — Thêm search + export Excel cho lịch sử (UC-FK-06)
**Loại:** UI + API | **Effort:** S | **Depends on:** P1.FK.01

**Files sửa:**
- `src/app/api/movements/route.ts` (search query)
- `src/app/forklift/history/page.tsx`

**API:** Thêm `?q=` search theo `pallet.code` hoặc `item_code.code`.

**UI:**
- Search box ở filter row
- Button "📤 Xuất Excel" dùng `ExcelExport` component

**Acceptance criteria:**
- [ ] Tìm `PL260506` → ra movements của pallet đó
- [ ] Export xlsx có đủ 9 cột

---

### P1.FK.03 — Hiển thị tổng đv, số dòng, HSD gần nhất trên card pallet chờ xếp (UC-FK-01)
**Loại:** UI | **Effort:** S | **Depends on:** P0.LIB.01

**Files sửa:**
- `src/app/api/forklift/queue/route.ts` (verify include)
- `src/components/forklift/ForkliftMobileDashboard.tsx`

**API include lines + tính min(expiry_date).**

**UI card:**
```
PL260506.011    [Chờ đưa vào]
3 dòng · 240 chai
📥 PHN-2026-0042
🗓 HSD gần nhất: 30/04/2027
⏱ XN 9:30
```

**Acceptance criteria:**
- [ ] Card đầy đủ 4 line meta
- [ ] HSD đỏ nếu ≤30 ngày, vàng nếu ≤90

---

## Nhóm OUT — Outbound

### P1.OUT.01 — Thêm cột Mã hàng/Lô/Tên riêng trong outbound staging (UC-OUT-01)
**Loại:** UI + API | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/api/outbound/route.ts` (đổi từ pallet-level → line-level)
- `src/app/outbound/page.tsx` (bảng mới)

**API:** Đổi response từ aggregate per pallet → list pallet_lines của pallets IN_STAGING.

**UI bảng mới:**
| Pallet | Mã hàng | Tên | Lô | HSD | SL | Đến lúc | Chờ |

**Acceptance criteria:**
- [ ] 1 pallet 3 dòng → 3 row trong bảng
- [ ] Cột "Chờ" highlight đỏ nếu >24h

---

### P1.OUT.02 — KPI cảnh báo "Quá 24h" + tổng SKU distinct (UC-OUT-01)
**Loại:** UI + API | **Effort:** S | **Depends on:** P1.OUT.01

**Files sửa:**
- `src/app/api/outbound/route.ts`
- `src/app/outbound/page.tsx`

**API:** Thêm aggregate `count_over_24h`, `count_distinct_sku`.

**UI:** KPI grid 4 ô: `Tổng pallet | Tổng mã | Tổng SL | ⚠ Quá 24h (red)`.

**Acceptance criteria:**
- [ ] Pallet có `updated_at` (chuyển sang staging) > 24h → đếm vào "Quá 24h"

---

## Nhóm INV — Inventory

### P1.INV.01 — Thêm cột Nhóm/ĐVT/Min-Max vào tồn kho (UC-INV-01)
**Loại:** UI + API | **Effort:** S | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/api/inventory/route.ts`
- `src/app/inventory/page.tsx`

**API include:** `group`, `unit` từ ItemCode/Product.

**UI:** Thêm cột Nhóm, ĐVT, Min/Max + badge `Dưới min` (đỏ) / `Vượt max` (vàng).

**Acceptance criteria:**
- [ ] Item có `current < min_stock` → badge "Dưới min"
- [ ] Có cột Nhóm hiển thị tên nhóm hàng

---

### P1.INV.02 — Filter Nhóm + Trạng thái (UC-INV-01)
**Loại:** UI | **Effort:** S | **Depends on:** P1.INV.01

**Files sửa:**
- `src/app/inventory/page.tsx`

**UI:**
- 2 select dropdown: Nhóm hàng (fetch từ `/api/product-groups`) + Trạng thái (Còn hàng / Hết hàng)

**Acceptance criteria:**
- [ ] Chọn nhóm "Đồ uống" → chỉ hiện item của nhóm đó

---

### P1.INV.03 — Thêm cột Ngày tạo/Số dòng/SL gốc/SL còn vào tồn theo Pallet (UC-INV-03)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/inventory/by-pallet/route.ts`
- `src/app/inventory/by-pallet/page.tsx`

**Acceptance criteria:**
- [ ] Bảng có 4 cột mới hiển thị đúng

---

### P1.INV.04 — Thêm cột NSX + Vị trí vào báo cáo FEFO (UC-INV-04)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/inventory/by-lot/page.tsx`

**API:** Đã có data, chỉ thêm cột hiển thị.

---

## Nhóm SYS — System

### P1.SYS.01 — Hiển thị `last_login_at` trong user list (UC-SYS-04)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/system/users/page.tsx`

**UI:** Thêm cột "Đăng nhập cuối" — format `dd/MM HH:mm` hoặc "Chưa đăng nhập".

---

### P1.SYS.02 — Filter user (search + role + status) (UC-SYS-04)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/users/route.ts` (support `?q=&role=&active=`)
- `src/app/system/users/page.tsx`

---

### P1.SYS.03 — Thêm cột Người dùng/Vai trò/IP vào audit log (UC-SYS-03)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/audit-logs/route.ts` (include user)
- `src/app/system/audit-log/page.tsx`

**Note:** Cần verify schema `AuditLog` có lưu IP không (hiện schema chưa có cột `ip`). Nếu chưa → migration thêm `ip String?` + `user_agent String?`.

---

### P1.SYS.04 — Filter audit log (user + action + entity) (UC-SYS-03)
**Loại:** UI | **Effort:** S | **Depends on:** P1.SYS.03

**Files sửa:**
- `src/app/system/audit-log/page.tsx`

**UI:** 3 select dropdown.

---

# 🔧 PHASE 2 — BỔ SUNG FIELD BẮT BUỘC (8-10 ngày)

> **Mục đích:** Thêm các field mà mockup yêu cầu nhưng UI hiện chưa có (cần đổi form).

## Nhóm IN — Inbound

### P2.IN.01 — Sửa label/option của `import_type` khớp mockup (UC-IN-01)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/inbound/new/page.tsx`

**Đổi:**
- Bỏ option "Nhập chuyển kho" (không có trong mockup)
- Đổi "Nhập hoàn trả" → "Hàng trả lại"
- Giữ 2 option chính: "Nhập từ NCC" và "Hàng trả lại"

**Acceptance criteria:**
- [ ] Confirm với PO trước khi xóa option "Nhập chuyển kho"

---

### P2.IN.02 — Thêm nút "Tải template" Excel (UC-IN-01)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Files mới:**
- `src/app/api/inbound/template/route.ts` — sinh file template xlsx
- `src/app/inbound/new/page.tsx` — thêm nút "⬇ Template"

**Template gồm cột:** Mã hàng | Tên | SL | ĐVT | Ghi chú (1 sheet, header bold).

**Acceptance criteria:**
- [ ] Click nút → download `template_phieu_nhap.xlsx`
- [ ] Mở file đúng format

---

### P2.IN.03 — Tab thứ 3 của UC-IN-01 là link sang UC-IN-06 (UC-IN-01)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/inbound/new/page.tsx`

**Đổi:** Pill "Up file NCC lớn" hiện đang là tab nội bộ → đổi thành `<Link href="/inbound/import">` redirect.

---

### P2.IN.04 — Thêm checkbox "Khu vực dỡ hàng đã chuẩn bị" (UC-IN-02)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Migration:**
```prisma
model InboundRequest {
  prep_zone_ready Boolean @default(false)
}
```

**Files sửa:**
- `prisma/schema.prisma`
- `src/app/api/inbound/[id]/receive/route.ts` (thêm body `prep_zone_ready`)
- `src/app/thukho/inbound/[id]/page.tsx`
- `src/app/inbound/[id]/page.tsx`

**UI:**
- Checkbox không bắt buộc trước nút "Tiếp nhận"
- Banner cam nhỏ: "Chưa check vẫn được bấm Tiếp nhận"

**Acceptance criteria:**
- [ ] Check hoặc không check đều submit được
- [ ] Giá trị lưu vào DB

---

### P2.IN.05 — UI checklist điều kiện chốt phiếu (UC-IN-04)
**Loại:** UI + API | **Effort:** M | **Depends on:** P1.IN.01

**Files sửa:**
- `src/app/api/inbound/[id]/route.ts` (thêm field tính `finalize_conditions`)
- `src/app/inbound/[id]/page.tsx` (mở modal/section riêng cho finalize)

**API trả về:**
```json
{
  "finalize_conditions": {
    "all_pallets_confirmed": { "ok": true, "count": "5/5" },
    "all_pallets_in_storage": { "ok": true, "count": "5/5" },
    "temp_codes_standardized": { "ok": false, "count": "0/1" },
    "discrepancies_resolved": { "ok": true, "count": "3" },
    "total_received_matches": { "ok": true, "expected": 876, "received": 876 }
  }
}
```

**UI:**
- Section "ĐIỀU KIỆN CHỐT" với 5 dòng checklist icon ✓/⚠
- Nút "Chốt phiếu" disabled nếu có dòng `ok=false`

---

### P2.IN.06 — Dropdown "Quyết định với chênh lệch" khi chốt (UC-IN-04)
**Loại:** UI + API | **Effort:** M | **Depends on:** P2.IN.05

**Migration:**
```prisma
model InboundRequest {
  discrepancy_decision String? @db.VarChar(40)  // ACCEPT | REVIEW_AGAIN | CREATE_ADJUSTMENT
  close_note           String? @db.Text
}
```

**Files sửa:**
- `src/app/api/inbound/[id]/complete/route.ts` (accept body)
- `src/app/inbound/[id]/page.tsx`

**UI:**
- Modal chốt phiếu có:
  - Textarea "Ghi chú khi chốt"
  - Select "Quyết định với chênh lệch" (3 options)
  - Nút "Chốt phiếu" / "Đánh dấu Chưa khớp số" / "Hủy"

**Logic:**
- `CREATE_ADJUSTMENT` → sau khi chốt redirect `/inventory/adjustments/new?from_inbound={id}`
- `REVIEW_AGAIN` → status quay về RECEIVING
- `ACCEPT` → chốt như cũ

---

### P2.IN.07 — Cải tiến stepper 8 bước cho UC-IN-05
**Loại:** UI | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/inbound/page.tsx`

**Cần định nghĩa lại enum status hoặc thêm field `step` (1-8):**

Cách an toàn: tính `step` từ status hiện có + thông tin pallet/reconcile:
- 1: DRAFT
- 2: PENDING (chưa thủ kho nhận)
- 3: RECEIVING + prep_zone_ready=false
- 4: RECEIVING + có pallet COUNTING
- 5: RECEIVING + tất cả pallet CONFIRMED, chưa putaway
- 6: RECONCILING + còn pallet IN_STORAGE
- 7: RECONCILING + đã reconcile xong
- 8: COMPLETED

**UI:** Render stepper 8 ô vuông + label `Chờ chốt số (7/8)`.

---

## Nhóm INTMP — Inbound Temp (CRITICAL)

### P2.INTMP.01 — Form tạo phiếu tạm đầy đủ (UC-INTMP-01)
**Loại:** UI + API | **Effort:** L | **Depends on:** P0.DB.01
**Priority:** 🔥 CRITICAL — thiếu nhiều field BẮT BUỘC

**Files sửa:**
- `src/app/api/inbound-temp/route.ts` (accept new body)
- `src/app/thukho/adhoc/new/page.tsx` (mobile)
- `src/app/inbound-adhoc/new/page.tsx` (desktop)

**Body POST mới:**
```typescript
{
  source_type: "SUPPLIER" | "RETURN" | "OTHER",  // required
  supplier_id: string | null,  // required nếu source_type=SUPPLIER
  delivered_by: string,         // required
  received_at: string,          // ISO datetime, required
  reason: "EARLY" | "NOT_READY" | "UNNOTIFIED_RETURN" | "NEW_SUPPLIER" | "OTHER",  // required
  reason_detail: string,        // required nếu reason=OTHER
  photo_urls: string[],         // attachments
  note: string,
}
```

**UI mobile (thứ tự theo mockup):**
1. Banner cam cảnh báo "⚡ Nhập đột xuất..."
2. Select Nguồn hàng *
3. Input Người giao
4. Datetime-local Ngày giờ nhận *
5. Select Lý do *
6. AttachmentUpload (component đã có) — cho phép nhiều ảnh
7. Textarea Ghi chú
8. Nút "Tạo phiếu nhập tạm" full màu cam

**Code generation:**
- Mã format mới `PNT-yyMMdd-NNN` (đổi từ `PTT-YYYY-SSSS`)
- Function `generateTempCode()` reset NNN theo ngày

**Acceptance criteria:**
- [ ] 5 field required validate trên FE
- [ ] Submit thiếu lý do → 400 với message tiếng Việt
- [ ] Ảnh upload qua `/api/attachments` + lưu URL vào `photo_urls` array

---

### P2.INTMP.02 — Mã format mới + đồng bộ tên field giữa mobile/desktop (UC-INTMP-01)
**Loại:** Refactor | **Effort:** S | **Depends on:** P2.INTMP.01

**Files sửa:**
- `src/app/thukho/adhoc/[id]/page.tsx` — đổi `qty_cartons` → `qty_box`, `lot_number` → `lot`
- `src/app/inbound-adhoc/[id]/page.tsx` — đồng bộ

**Lý do:** Backend DB dùng `qty_box`/`lot`, FE mobile dùng tên khác → lệch.

---

### P2.INTMP.03 — Thêm cột "Mã tạm" + "Số ngày tồn" vào theo dõi (UC-INTMP-03)
**Loại:** UI + API | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/api/inbound-temp/route.ts` (thêm aggregate items)
- `src/app/inbound-adhoc/page.tsx`

**Cần định nghĩa:** "Mã tạm" là gì? Nếu là item_code trong inbound_temp_lines có `status=pending` (ItemCode chưa standardize) → có thể derive.

**Hai cách hiển thị mockup yêu cầu:**
A) Theo phiếu (hiện có): thêm cột "Số ngày tồn"
B) Theo mã tạm (mockup chính): mỗi row = 1 mã tạm trong 1 phiếu

**Đề xuất:** Làm cả 2, có toggle view "Theo phiếu / Theo mã hàng".

**KPI bổ sung:**
- `Tổng phiếu tạm`
- `Mã tạm chờ XL` (count itemCodes pending)
- `Tổng SL tồn tạm (đv)` — quy đổi từ qty_box
- `⚠ Quá hạn (>3 ngày)` — count phiếu có `created_at < today - 3d`

**Acceptance criteria:**
- [ ] KPI quá hạn highlight đỏ
- [ ] Toggle 2 view hoạt động

---

## Nhóm PAL — Pallet

### P2.PAL.01 — Liên kết PHN khi tạo Pallet (UC-PAL-01)
**Loại:** UI + API | **Effort:** S | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/api/pallets/route.ts` (accept `inbound_request_id`)
- `src/app/thukho/pallet/new/page.tsx`

**UI:**
- Thêm select "Liên kết với phiếu nhập (tùy chọn)" — fetch các phiếu status `PENDING|RECEIVING|RECONCILING`
- Hiện preview mã pallet `PL{yymmdd}.{nextSeq}`

**Acceptance criteria:**
- [ ] Tạo pallet có PHN → DB có FK
- [ ] Pallet tạo "trắng" (không PHN) vẫn cho phép

---

### P2.PAL.02 — Hiển thị quy đổi thùng→lẻ + quy cách realtime (UC-PAL-02)
**Loại:** UI | **Effort:** S | **Depends on:** P0.LIB.01

**Files sửa:**
- `src/app/thukho/pallet/[id]/page.tsx` (form thêm dòng)

**UI:**
- Sau khi chọn mã hàng + nhập qty_box → hiển thị:
  ```
  Đã chọn: VG-NM-001 — Nước mắm 500ml
  Quy cách: 24 chai/thùng · Trọng lượng: 13.2 kg/thùng
  5 thùng × 24 chai = 120 chai · Tải trọng: 66 kg
  ```
- Field "Đơn vị lẻ (auto)" disabled hiển thị `chai`/`gói`/`lon`

---

### P2.PAL.03 — Bắt buộc Lô và HSD trong form thêm dòng (UC-PAL-02)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/thukho/pallet/[id]/page.tsx`

**Logic:**
- Nếu `item_code.product.has_lot=true` → Lô bắt buộc
- Nếu `item_code.product.has_expiry=true` → HSD bắt buộc

Hiện code đang để optional cả 2. Cần check theo flag từ product.

---

### P2.PAL.04 — Nút stepper +/− cho input SL (UC-PAL-02)
**Loại:** UI | **Effort:** XS | **Depends on:** —

**Files sửa:**
- `src/app/thukho/pallet/[id]/page.tsx`
- Có thể tạo component `<NumberStepper>` reusable

---

### P2.PAL.05 — Modal tổng kết khi xác nhận pallet (UC-PAL-04)
**Loại:** UI | **Effort:** M | **Depends on:** P0.LIB.01

**Files sửa:**
- `src/app/thukho/pallet/[id]/page.tsx`
- `src/app/pallets/[id]/page.tsx`

**UI modal:**
```
TỔNG KẾT
- Tổng dòng hàng: 3
- Tổng mã hàng: 2
- Tổng SL: 276 đv
- Date gần nhất: 30/04/2027

⚠ Sau khi xác nhận: Mã/SL/Lô/Date bị KHÓA với Xe nâng

☐ Tôi xác nhận đã kiểm đếm chính xác

[ ✓ Xác nhận pallet ]  [ Hủy ]
```

**Acceptance criteria:**
- [ ] Checkbox phải tick mới enable nút xác nhận
- [ ] Sau confirm → success screen với CTA "Tạo pallet mới" / "Về danh sách"
- [ ] Desktop bỏ `window.confirm()` thô, dùng modal đẹp

---

### P2.PAL.06 — Enum lý do unlock + select dropdown (UC-PAL-05)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/pallets/[id]/unlock/route.ts` (body có `reason_code`)
- `src/app/pallets/[id]/page.tsx`
- `src/app/thukho/pallet/[id]/page.tsx`

**Migration:** Thêm vào AuditLog hoặc tạo `pallet_unlock_logs` table riêng (đề xuất dùng AuditLog với metadata field).

**UI form:**
- Select Lý do *: 4 enum (Sai SL / Sai lô-HSD / Sai mã / Khác)
- Textarea Mô tả chi tiết *
- (Optional) Select Người duyệt — chưa làm approval workflow ở đây, ghi nhận audit

---

### P2.PAL.07 — Tích hợp BarcodeScanner vào mobile pallet detail (UC-PAL-03)
**Loại:** UI | **Effort:** S | **Depends on:** —
**Priority:** 🔥 NGHIỆP VỤ

**Files sửa:**
- `src/app/thukho/pallet/[id]/page.tsx`

**UI:**
- Thêm nút "📷 Quét" cạnh input "Mã hàng" trong form thêm dòng
- Mở `<BarcodeScanner onScan={...}>` modal
- Trên scan → call `/api/item-codes?q={code}` auto-select

**Note:** Pattern này đã có ở `/pallets/[id]` desktop — copy logic sang mobile.

---

## Nhóm FK — Forklift

### P2.FK.01 — Thêm trường Lý do vào relocate (UC-FK-03)
**Loại:** UI + API | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/forklift/relocate/route.ts` (accept `reason`)
- `src/app/forklift/relocate/page.tsx`

**UI:**
- Select Lý do (tùy chọn) với 4 options: Sắp xếp lại kho / Gom hàng cùng lô / Giải phóng vị trí / Khác
- Note 🔒 "Khóa nội dung: Mã hàng, SL, Lô, Date sẽ KHÔNG thay đổi"

**Acceptance criteria:**
- [ ] Lý do lưu vào `movements.reason`

---

### P2.FK.02 — Wizard 2 bước cho putaway (UC-FK-02)
**Loại:** UI | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/forklift/put-away/page.tsx`

**UI:**
- Step 1: Chọn pallet + gợi ý vị trí trống (sort theo zone gần nhất)
  - Section "VỊ TRÍ TRỐNG GỢI Ý" với badge "Gần nhất"
- Step 2: Card so sánh `Pallet → Vị trí đích` với nút "Xác nhận hoàn tất" / "Quay lại"
- Mô tả tác động sau xác nhận

---

### P2.FK.03 — Hiển thị mã hàng + SL pallet nguồn trong relocate (UC-FK-03)
**Loại:** UI | **Effort:** S | **Depends on:** P2.FK.01

**Files sửa:**
- `src/app/api/forklift/relocate/route.ts` (return pallet với lines)
- `src/app/forklift/relocate/page.tsx`

**UI card pallet nguồn:**
```
📍 A-03-02 [Đang chứa]
PL260506.005 — VG-NM-001 · 240 chai
```

---

# 🏗️ PHASE 3 — WORKFLOW LỚN (12-15 ngày)

> **Mục đích:** Build các nghiệp vụ mới hoặc thay đổi workflow lớn. Cần Tech Lead review.

## P3.FK.01 — UC-FK-05: Cho phép sửa nội dung khi hoàn trả (3-4 ngày)
**Loại:** Workflow + API + UI | **Effort:** L | **Depends on:** P0.DB.01
**Priority:** 🔥🔥 CRITICAL — đang sai bản chất UC

**Files sửa (🔒 PROTECTED):**
- `src/app/api/forklift/return/route.ts`
- `src/app/forklift/return/page.tsx`
- `src/lib/audit-log.ts` (tạo mới helper)

**API mới body:**
```typescript
POST /api/forklift/return
{
  pallet_id: string,
  to_location_id: string,
  // Lines updates (mỗi pallet_line có thể bị sửa)
  line_updates: [{
    line_id: string,
    item_code_id?: string,     // có thể đổi mã
    qty_box?: number,           // SL còn lại
    lot?: string,
    expiry_date?: string,
  }],
  reason_code: "PARTIAL_PICKED_RETURN" | "PALLET_SPLIT" | "WRONG_DETECT" | "OTHER",
  reason_detail: string,        // required
}
```

**Logic:**
1. BEGIN TRANSACTION
2. SELECT pallet + lines FOR UPDATE
3. Validate location.type = STORAGE, đủ capacity
4. Compute diff `before` vs `line_updates`
5. INSERT AuditLog với `action='forklift.return'`, `before/after/reason`
6. UPDATE pallet_lines theo updates
7. UPDATE pallet.location_id, status=IN_STORAGE
8. INSERT Movement với `audit_log_id` link
9. COMMIT

**UI:**
- Note đầu trang: "⚠ Quyền đặc biệt: Đây là luồng DUY NHẤT cho phép sửa Mã/SL/Lô/Date..."
- Section "CẬP NHẬT NỘI DUNG" với form editable từng dòng:
  - Mã hàng (search dropdown)
  - SL còn lại (number) + warning "⚠ Khác SL ban đầu ({orig}). Đã xuất {delta}."
  - Lô (text)
  - HSD (date)
- Section "VỊ TRÍ TRẢ VỀ" + scan
- Select "Lý do thay đổi nội dung *" (4 options)
- Textarea "Mô tả chi tiết *"
- Button đỏ "✓ Xác nhận trả về (ghi audit log)"

**Permission check:**
- Chỉ role có permission `forklift.return` mới được dùng (default: XE_NANG có quyền cấp)
- Verify trên server-side route

**Acceptance criteria:**
- [ ] Sửa qty từ 240 → 180 → audit_log có `before:240, after:180`
- [ ] Sửa lô → audit log có cả 2 giá trị
- [ ] Movement có `audit_log_id` NOT NULL
- [ ] Test rollback khi exception
- [ ] Manual smoke test với 3 scenario: sửa SL / sửa lô / sửa cả 4 field

---

## P3.FK.02 — UC-FK-04: Thêm TH-B rút một phần (2-3 ngày)
**Loại:** Workflow + API + UI | **Effort:** L | **Depends on:** P0.LIB.01
**Priority:** 🔥 NGHIỆP VỤ

**Files sửa (🔒 PROTECTED):**
- `src/app/api/forklift/stage-out/route.ts`
- `src/app/forklift/stage-out/page.tsx`
- **Mới:** `src/app/api/pallets/[id]/split/route.ts`

**API stage-out body mới:**
```typescript
{
  pallet_id: string,
  qty_unit: number,           // SL rút (nếu PARTIAL)
  mode: "FULL" | "PARTIAL",
  to_location_id?: string,    // default = OUTBOUND_STAGING
}
```

**Logic mode FULL:** (đã có)
- Update pallet.location_id = staging, status=IN_STAGING

**Logic mode PARTIAL (mới):**
1. BEGIN TX, SELECT pallet FOR UPDATE
2. Validate qty_unit ≤ qty còn của pallet line tương ứng
3. Tạo pallet mới (split):
   - code mới `PL{yymmdd}.{seq}`
   - status = IN_STAGING, location = staging
   - copy line với qty_unit = picked
4. UPDATE pallet cũ: trừ qty_unit
5. INSERT Movement với mode=PARTIAL
6. COMMIT

**UI 2 màn:**

Màn 1 (đã có sau khi search): hiển thị bảng FEFO với badge `Ưu tiên 1/2/3`.

Màn 2 (mới — modal hoặc page riêng):
- Card xác nhận:
  ```
  Pallet PL260506.005 @ A-03-02
  → Khu chờ xuất
  
  VG-NM-001 · Lô L26-04 · HSD 30/04/2027
  Hiện có: 240 chai
  ```
- Radio:
  - ⚪ TH-A: Rút nguyên pallet (240 chai)
  - ⚪ TH-B: Rút một phần (≤ 240)
- Nếu TH-B: input number + stepper +/− + hiển thị "Còn lại sau rút: X chai"
- Note "Xuất kho tương đối"
- Button "✓ Xác nhận"

**Acceptance criteria:**
- [ ] Rút PARTIAL 60/240 → pallet cũ còn 180, pallet mới 60 IN_STAGING
- [ ] Không cho rút quá tồn (409)
- [ ] Concurrent: 2 user cùng pick 1 pallet → người sau 409

---

## P3.OUT.01 — UC-OUT-05 cách 1: Upload file SL đã xuất (3-4 ngày)
**Loại:** Workflow + API + UI | **Effort:** L | **Depends on:** P0.DB.01
**Priority:** 🔥🔥 CRITICAL

**Files sửa/mới:**
- `prisma/schema.prisma` — thêm `OutboundRebalance` + lines (xem P0.DB.01)
- **Mới:** `src/app/api/outbound/rebalance/route.ts` (POST upload + GET list)
- **Mới:** `src/app/api/outbound/rebalance/[id]/route.ts` (GET preview)
- **Mới:** `src/app/api/outbound/rebalance/[id]/apply/route.ts` (POST apply)
- **Mới:** `src/app/api/outbound/rebalance/template/route.ts` (download template)
- Sửa: `src/app/outbound/rebalance/page.tsx`

**Migration mới:**
```prisma
model OutboundRebalance {
  id              String   @id @default(uuid()) @db.Uuid
  code            String   @unique @db.VarChar(20) // RBL-2026-0021
  method          String   @db.VarChar(20)        // EXPORTED_QTY_FILE | OUTBOUND_REQUEST_FILE
  file_url        String   @db.Text
  file_name       String   @db.VarChar(255)
  ship_date       DateTime? @db.Date
  status          String   @default("PARSED") @db.VarChar(20)
  total_lines     Int      @default(0)
  matched_lines   Int      @default(0)
  warning_lines   Int      @default(0)
  applied_at      DateTime?
  applied_by      String?  @db.Uuid
  audit_log_id    String?  @db.Uuid
  note            String?  @db.Text
  created_by      String?  @db.Uuid
  created_at      DateTime @default(now())
  lines           OutboundRebalanceLine[]
  @@map("outbound_rebalances")
}

model OutboundRebalanceLine {
  id                  String  @id @default(uuid()) @db.Uuid
  rebalance_id        String  @db.Uuid
  item_code_id        String  @db.Uuid
  pallet_id           String? @db.Uuid
  qty_unit_before     Decimal @db.Decimal(14,3)
  qty_unit_exported   Decimal @db.Decimal(14,3)
  qty_unit_after      Decimal @db.Decimal(14,3)
  status              String  @default("MATCHED") @db.VarChar(20) // MATCHED | OVER_STOCK | EXHAUSTED
  rebalance           OutboundRebalance @relation(fields: [rebalance_id], references: [id], onDelete: Cascade)
  @@map("outbound_rebalance_lines")
}
```

**Flow:**
1. **Upload file Excel** (cột: Mã hàng | Pallet (opt) | SL đã xuất | Ngày | Người nhận | Ghi chú)
2. Parse → tạo `OutboundRebalance` record + parse lines
3. Auto match pallet ở OUTBOUND_STAGING:
   - Tính `qty_unit_before` (hiện có), `qty_unit_after = before - exported`
   - Status: MATCHED (after≥0) / OVER_STOCK (after<0) / EXHAUSTED (after=0)
4. UI bước Preview:
   - Bảng: Mã hàng | Tên | Pallet | Tồn chờ xuất | SL đã xuất | Tồn sau trừ | Trạng thái
   - Note 4 tác động khi apply
5. Nút Apply → BEGIN TX:
   - INSERT AuditLog với reason
   - LOOP lines: UPDATE pallet_lines.qty_unit -= exported
   - Nếu after=0 → pallet.status=RELEASED
   - INSERT Movement type=REBALANCE
   - UPDATE rebalance.status=APPLIED, applied_at, audit_log_id
6. COMMIT
- Button "Tạm hoãn (giữ file)" → status vẫn là PREVIEWED, chưa apply

**UI 2 tab:**
- Tab `📥 Up file SL đã xuất` (active)
- Tab `📋 Up phiếu yêu cầu xuất` (link sang `/outbound/requests` — sẽ làm P3.OUT.02)

**Template Excel:** `template_can_lai_ton.xlsx`

**Acceptance criteria:**
- [ ] Upload file 10 dòng → preview hiển thị status đúng
- [ ] Apply → tồn trừ chính xác
- [ ] Pallet hết tồn → status RELEASED
- [ ] Audit log có before/after JSON
- [ ] Rollback nếu exception

---

## P3.OUT.02 — UC-OUT-05 cách 2: Entity Phiếu yêu cầu xuất (PYX) (3-4 ngày)
**Loại:** New Entity + CRUD | **Effort:** L | **Depends on:** P0.DB.01, P3.OUT.01

**Files mới:**
- `src/app/outbound/requests/page.tsx` (list)
- `src/app/outbound/requests/new/page.tsx` (form)
- `src/app/outbound/requests/[id]/page.tsx` (detail + ship)
- `src/app/outbound/requests/import/page.tsx` (bulk import)
- `src/app/api/outbound-requests/route.ts`
- `src/app/api/outbound-requests/[id]/route.ts`
- `src/app/api/outbound-requests/[id]/ship/route.ts`

**Migration:** `OutboundRequest` + `OutboundRequestLine` (đã có trong P0.DB.01).

**Workflow:**
- Tạo phiếu PYX → status=PENDING (Chờ xuất)
- Picker bắt đầu lấy hàng → status=PICKING
- Xác nhận đã xuất → status=SHIPPED, trừ tồn từ pallet_lines + Movement type=SHIP_OUT

**UI list:**
- 3 pill filter: Chờ xuất (3) / Đã xuất (28) / Hủy (1)
- Bảng: Mã phiếu | Khách | Ngày xuất | Số mã | Tổng SL | Trạng thái | Hành động

**UI detail:**
- Header: Mã PYX + tên khách + badge + ngày + người
- Bảng dòng: Mã hàng | Tên | Pallet ở khu chờ | SL yêu cầu | Tồn khu chờ | SL trừ | Trạng thái (Khớp / Thiếu)
- Button "✓ Xác nhận đã xuất hàng"

**Acceptance criteria:**
- [ ] CRUD PYX hoạt động
- [ ] Ship → trừ tồn pallet + lưu Movement + audit log
- [ ] PYX bulk upload Excel hoạt động (tương tự P3.OUT.01)

---

## P3.INTMP.01 — UC-INTMP-02: Workflow 3 bước chuẩn hóa (3 ngày)
**Loại:** Workflow + UI | **Effort:** L | **Depends on:** P2.INTMP.01

**Files sửa (🔒 PROTECTED):**
- `src/app/api/inbound-temp/[id]/standardize/route.ts`
- **Mới:** `src/app/api/inbound-temp/[id]/standardize/preview/route.ts`
- `src/app/inbound-adhoc/[id]/page.tsx` (redesign 3 bước)

**Workflow:**

**Bước 1 — KIỂM TRA NGUỒN HÀNG:**
- Hiển thị read-only: Nguồn, Người giao + SĐT, Ngày giờ, Ảnh chứng từ
- Nếu source=SUPPLIER và supplier=null → button "+ Tạo NCC mới từ thông tin này" (mở modal tạo supplier nhanh)

**Bước 2 — CHUẨN HÓA MÃ HÀNG:**
- Bảng dòng hàng từ temp:
  ```
  Mã (chứng từ) | Tên rút gọn | SL thùng | Mã chuẩn | Hành động
  TMP-260506-007| Mì gói lạ    | 30       | [select] | "Chuẩn hóa →"
  ```
- Select "Mã chuẩn": dropdown ItemCodes hiện có (search) + option "+ Tạo mới" (mở modal tạo Product mới)
- Click "Chuẩn hóa →" → cập nhật line.item_code_id

**Bước 3 — LIÊN KẾT/TẠO PHIẾU CHÍNH THỨC:**
- Radio 2 option:
  - ⚪ Liên kết với phiếu YC có sẵn (dropdown chọn PHN có cùng supplier, status=PENDING|RECEIVING)
  - ⚪ Tạo phiếu YC mới (hồi tố) — input mã `PHN-2026-NNNN` auto
- Button "✓ Hoàn tất chuẩn hóa" → call API:
  - Nếu link với phiếu có → merge lines vào phiếu đó
  - Nếu tạo mới → POST `/api/inbound` với lines từ temp

**Side panel tiến độ 4 dòng:**
- ☑ Kiểm nguồn (auto check khi mở)
- ☑ Chuẩn hóa mã (0/3 → 3/3)
- ☐ Tạo phiếu chính thức
- ☐ Chốt phiếu

**Acceptance criteria:**
- [ ] Phiếu tạm 3 dòng pending → chuẩn hóa từng dòng → tiến độ cập nhật
- [ ] Tạo NCC mới inline → supplier_id update vào temp
- [ ] Link với phiếu có → status=STANDARDIZED, link `inbound_request_id`

---

## P3.IN.01 — UC-IN-03: Tích hợp Pallet + Mã tạm vào đối chiếu (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** P2.PAL.01

**Files sửa (🔒 PROTECTED):**
- `src/app/api/inbound/[id]/route.ts` — thêm aggregate pallet info
- `src/app/inbound/[id]/page.tsx` — tab reconcile

**API include:**
```typescript
// Trong response reconcile:
pallets_summary: {
  total: 5,
  confirmed: 3,
  counting: 2,
  pallet_codes_by_line: {  // map line_id → ["PL260506.005", ...]
    "uuid-line-1": ["PL260506.005", "PL260506.008"]
  }
},
temp_codes_summary: {
  total: 1,
  pending: 1,
  codes: ["TMP-260506-007"]
}
```

**UI:**
- 4 KPI mới: Tổng yêu cầu | Tổng thực nhập (+%delta) | Pallet đã tạo (5, 3 XN + 2 đang đếm) | Mã tạm (1)
- Cột "Pallet" trong bảng đối chiếu (list mã pallet đóng góp)
- Trạng thái dòng phân loại: ✓ Đã khớp / Thiếu / Thừa / **Hàng phát sinh** / Chờ chuẩn hóa

**Logic phát sinh:**
- "Hàng phát sinh" = pallet_line có item_code mà inbound_request_lines KHÔNG có
- Hiển thị thành row riêng trong bảng đối chiếu với badge "Hàng phát sinh · Chờ chuẩn hóa"

**Nút thêm:**
- "Yêu cầu kiểm lại" → set status RECEIVING
- "📤 Xuất Excel" (đối chiếu)

---

## P3.INV.01 — UC-INV-09: Trang tạo phiếu điều chỉnh mới (2-3 ngày)
**Loại:** New Page + Workflow | **Effort:** L | **Depends on:** P0.DB.01

**Files mới:**
- `src/app/inventory/adjustments/new/page.tsx`
- Update `src/app/api/adjustments/route.ts` (POST body mới)

**Migration:** đã có thêm `pallet_id`, `lot`, `note` vào AdjustmentLine ở P0.DB.01.

**UI form tạo:**
```
HEADER:
- Số phiếu: ADJ-2026-0015 (auto)
- Ngày lập: (auto today)
- Người lập: (auto current user)
- Loại điều chỉnh *: select (Giảm tồn hỏng/mất | Tăng tồn thừa | Điều chỉnh sau kiểm kê)
- Lý do *: select (Hỏng/Vỡ | Mất | Kiểm kê chấp nhận chênh lệch | Khác)
- Tham chiếu phiếu kiểm: input STK-... (autocomplete)

BẢNG CHI TIẾT:
| Mã hàng | Pallet | Vị trí | Lô | SL trước | SL thực tế | Chênh | Ghi chú | [Lưu] |
+ Thêm dòng

ACTION:
[Lưu nháp] [Gửi duyệt →]
```

**Workflow:**
- POST tạo → status=DRAFT
- POST `/api/adjustments/[id]/submit` → status=PENDING_APPROVAL
- POST `/api/adjustments/[id]/approve` (Quản lý) → status=APPROVED + apply tồn + AuditLog

**Acceptance criteria:**
- [ ] Prefill từ `?from_inbound={id}` (từ P2.IN.06) hoặc `?from_stocktake={id}`
- [ ] Mỗi line lưu pallet/location/lot
- [ ] Approve → tồn pallet_lines trừ chính xác

---

## P3.INV.02 — UC-INV-08: Workflow xử lý từng dòng chênh lệch (1-2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** P3.INV.01

**Files sửa:**
- `src/app/api/stock-count/[id]/route.ts` — thêm per-line resolve
- **Mới:** `src/app/api/stock-count/[id]/lines/[lineId]/resolve/route.ts`
- `src/app/stock-count/[id]/page.tsx`

**API:** `POST /api/stock-count/{id}/lines/{lineId}/resolve` body `{ resolution: "ACCEPT" | "RECOUNT" | "IGNORE" }`.

**UI:**
- Header info: Đợt (STK-...) | Loại | Thời gian | Số người KK | X/Y vị trí
- KPI 4 cards: Khớp / Có chênh / Đã xử lý / Còn chờ
- Bảng: # | Mã hàng | Vị trí | Pallet | SL HT | SL TT | Chênh | Ghi chú KK | **[✓ Chấp nhận] [↻ Kiểm lại]**
- Highlight row: nền vàng "Cần xử lý", xanh "Đã chấp nhận"

**Acceptance criteria:**
- [ ] Click "Chấp nhận" → row highlight xanh, KPI cập nhật
- [ ] Khi tất cả ACCEPT → tự sinh `AdjustmentVoucher` DRAFT

---

## P3.INV.03 — UC-INV-06: Camera QR + Blind count + Chụp ảnh (2 ngày)
**Loại:** UI | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/kiemke/scan/page.tsx`
- `src/app/kiemke/tasks/[id]/page.tsx`
- `src/app/api/stock-count/route.ts` (thêm `blind_count` flag)
- `prisma/schema.prisma` — thêm `blind_count Boolean @default(true)` vào `StocktakeSession`

**UI:**
- Bước 1: thêm `BarcodeScanner` component (đã có) — quét QR vị trí
- Bước 2: liệt kê pallet tại vị trí, **ẩn `system_qty`** nếu `blind_count=true`
- Bước 3 (mới — tách màn riêng): form ghi nhận đếm
  - SL hệ thống (disabled, ẩn nếu blind_count)
  - SL thực tế đếm * (input)
  - Lô (xác nhận) (text)
  - HSD (xác nhận) (date)
  - Auto hiển thị Chênh lệch
  - Textarea Ghi chú chênh lệch
  - `AttachmentUpload` cho ảnh hiện trường
  - Button "Lưu kết quả"
- Nút "+ Thêm pallet ngoài hệ thống" (mở form tạo pallet ad-hoc)

---

# 📊 PHASE 4 — BÁO CÁO & DASHBOARD (7-10 ngày)

## P4.DASH.01 — Cá nhân hóa dashboard theo role (UC-DASH-01) (2 ngày)
**Loại:** UI | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/page.tsx` (Kế toán)
- `src/app/thukho/page.tsx`
- `src/app/forklift/page.tsx`
- `src/app/kiemke/page.tsx`

**Common:**
- Greeting card cá nhân: "Chào {fullName} — Hôm nay {date}" với gradient color theo role

**Per role widget mới:**

**Kế toán:**
- KPI thay: Phiếu nhập đang xử lý / Tồn tạm chờ chuẩn hóa / Phiếu lệch SL / Phiếu điều chỉnh chờ duyệt
- Card "Cảnh báo HSD/Tồn thấp" gộp 3 dòng

**Thủ kho:**
- KPI: Phiếu chờ nhận / Pallet chờ xếp / Hoàn tất hôm nay / Lệch SL
- Section "Tác vụ ưu tiên" cards PNK

**Xe nâng:**
- KPI: Pallet chờ xếp / Yêu cầu di chuyển / Yêu cầu xuất tương đối / Hoàn trả vị trí

**Kiểm kê:**
- Card session với progress bar X/Y vị trí (%)
- Section "Vị trí được giao" liệt kê Khu/Kệ

**APIs cần mới hoặc cập nhật:**
- `/api/dashboard/kpi?role=KE_TOAN` trả về tập KPI khác cho mỗi role

---

## P4.DASH.02 — UC-DASH-02: Card Top SKU + Nhóm hàng + Phiếu chờ xử lý (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/dashboard/page.tsx`
- **Mới:** `src/app/api/dashboard/groups-distribution/route.ts`
- **Mới:** `src/app/api/dashboard/top-skus/route.ts`
- **Mới:** `src/app/api/dashboard/pending-tasks/route.ts`

**UI cards mới:**

**📊 Tồn theo nhóm hàng** (progress bars):
- Loop nhóm hàng, tính sum(qty_unit) per group, render progress bar % so với tổng

**🏆 Top mã xuất tương đối (tháng)**:
- Query movements type=STAGE_OUT trong tháng, group by item_code, sum qty
- Top 5 với số SL

**📋 Phiếu chờ xử lý**:
- 5 dòng tổng hợp:
  - Phiếu nhập (RECEIVING + RECONCILING) — số đếm
  - Tồn tạm (PENDING) — số đếm
  - Pallet chờ xếp (CONFIRMED, location_id=null)
  - Pallet đang di chuyển (status=COUNTING|CONFIRMED transitioning)
  - Phiếu điều chỉnh (PENDING_APPROVAL)

**Filter kỳ:** Đổi từ "7/30/90 ngày" → "Hôm nay / Tuần / Tháng".

---

## P4.INV.01 — UC-INV-05: Cảnh báo HSD nâng cao + cấu hình mail (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/inventory/alerts/page.tsx`
- **Mới:** `src/app/api/alerts/settings/route.ts` (CRUD AlertSetting)

**UI bổ sung:**
- **KPI mới**: "Tồn vượt max" (đếm SKU current_stock > max_stock) + nút "Tạo gợi ý nhập"
- **Card "Hàng tồn lâu"**: cận date xa nhất theo vị trí + nút "Xem báo cáo"
- **Bảng cấu hình gửi mail**: hiển thị `AlertSetting`s + toggle bật/tắt

**Cron** (nếu chưa có): tạo file `src/lib/cron/hsd-alert.ts` chạy 6:00 hàng ngày — không bắt buộc trong UI gap fix, có thể là P5.

---

## P4.INV.02 — UC-INV-01: Trang drill-down /by-sku/[code]/locations (1 ngày)
**Loại:** New Page | **Effort:** S | **Depends on:** —

**Files mới:**
- `src/app/inventory/by-sku/[code]/locations/page.tsx`
- `src/app/api/inventory/by-sku/[code]/locations/route.ts`

**UI:**
- Header: "{name} ({code}) — tổng tồn / đang ở N vị trí"
- Bảng: Vị trí | Pallet | Lô | NSX | HSD | SL còn (chai) | Trạng thái
- Sort default HSD xa nhất xuống dưới

---

## P4.INV.03 — UC-INV-02: Nút "Sửa số tồn" → ADJ prefill (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** P3.INV.01

**Files sửa:**
- `src/app/inventory/by-location/page.tsx`

**UI:** Mỗi dòng pallet thêm nút "✏ Sửa số tồn" → navigate `/inventory/adjustments/new?pallet_id={}&location_id={}&item_code_id={}`.

---

## P4.OUT.01 — UC-OUT-02: Chart Top 5 + Nhóm hàng (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Library:** Recharts (cài mới: `npm install recharts`).

**Files sửa:**
- `src/app/outbound/report/page.tsx`

**Charts:**
- BarChart vertical top 5
- BarChart horizontal theo nhóm + %

**Bonus:** Filter kỳ Tháng X/YYYY, filter nhóm hàng.

---

## P4.OUT.02 — UC-OUT-03/04: Bổ sung metric forecast (1 ngày)
**Loại:** API + UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/api/outbound/turnover/route.ts` — thêm `avg_per_day`, `days_left`
- `src/app/outbound/turnover/page.tsx` — thêm cột
- `src/app/api/outbound/reorder/route.ts` — chuyển logic sang forecast-based
- `src/app/outbound/reorder/page.tsx` — thêm input "Số ngày dự trữ" + checkbox bulk + button "Tạo phiếu từ gợi ý"

**Logic reorder mới:**
```
avg_per_day = sum(stage_out_qty trong N ngày) / N
demand = avg_per_day × days_buffer
suggested = max(0, demand - current_stock)
```

---

## P4.FK.01 — UC-FK-01: Dashboard "Việc của tôi" mobile xe nâng (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** P1.FK.03

**Files sửa:**
- `src/components/forklift/ForkliftMobileDashboard.tsx`

**UI:**
- Pill filter: Vào vị trí (n) / Luân chuyển (n) / Sang chờ xuất (n)
- Tabbar bottom: Việc / Bản đồ / Lịch sử / Tôi

---

## P4.PAL.01 — Màn chi tiết pallet đọc-only cho xe nâng (UC-FK-01) (1 ngày)
**Loại:** New Page | **Effort:** S | **Depends on:** P1.PAL.01

**Files mới:**
- `src/app/forklift/pallet/[id]/page.tsx`

**UI read-only:**
- Header pallet
- Liệt kê dòng hàng đầy đủ (mã, SL, lô, HSD)
- Note "🔒 Xe nâng không sửa được nội dung, chỉ thay đổi vị trí"
- Button "🚜 Bắt đầu đưa vào vị trí →" → navigate `/forklift/put-away?pallet_id=...`

---

# ⚙️ PHASE 5 — SYSTEM & POLISH (5-7 ngày)

## P5.SYS.01 — UC-SYS-01: Thêm logo/favicon upload + các field thiếu (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/app/api/system/config/route.ts` (verify accept all keys)
- `src/app/system/config/page.tsx` (form lại)
- **Mới:** `src/app/api/system/upload-logo/route.ts` (POST multipart)

**Config keys bổ sung:**
- `app_name`, `app_short_name`, `hotline`, `support_email`, `date_format`, `logo_url`, `favicon_url`, `footer_text`

**UI:**
- Field upload logo (preview + drag-drop, max 2MB)
- Field upload favicon
- Tất cả input layout grid, button "Lưu cấu hình" tổng

---

## P5.SYS.02 — UC-SYS-02: Mail config đầy đủ + history (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** P0.DB.01 (MailSettings)

**Files sửa:**
- `src/app/api/system/mail/route.ts` (CRUD MailSettings)
- `src/app/api/system/mail/test/route.ts` (POST test)
- `src/app/system/mail/page.tsx`

**UI form:**
- Provider (SMTP/Mailgun/SendGrid)
- Host, Port, **Security (TLS/SSL/None)**
- Username, Password (encrypted)
- **From Name**, From Email
- **Reply-to Email**
- **Rate limit/giờ**
- Toggle Active
- Nút "Test send" — input email + subject + body → call `/api/system/mail/test`
- Hiển thị "Lần kiểm tra cuối: ... Thành công/Thất bại"

---

## P5.SYS.03 — UC-SYS-04: Trường username + reset password + bulk action (1 ngày)
**Loại:** UI + API | **Effort:** S | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/api/users/route.ts` (accept username field, must_change_password)
- `src/app/api/users/[id]/reset-password/route.ts` (mới)
- `src/app/system/users/page.tsx`

**Form:**
- Thêm input Username *
- Checkbox "Bắt buộc đổi mật khẩu lần đầu đăng nhập"
- Button random generate password

**Bảng:**
- Thêm icon 🔑 (reset password) per row → mở modal sinh password mới + gửi email

---

## P5.SYS.04 — UC-AUTH-05: RBAC 4 mức quyền + tạo role mới (2 ngày)
**Loại:** UI + API | **Effort:** M | **Depends on:** —

**Files sửa:**
- Cần thêm bảng `roles` + `role_permissions` (nếu chưa có) thay vì hardcode 8 enum
- Hoặc giữ enum và bổ sung bảng `role_feature_permissions` với 4 mức:

```prisma
model RoleFeaturePermission {
  id          String @id @default(uuid())
  role        String @db.VarChar(20)
  feature_id  String @db.VarChar(40)
  permission  String @db.VarChar(20)  // FULL | LIMITED | SUGGEST | NONE | SPECIAL
  @@unique([role, feature_id])
}
```

**UI:**
- Ma trận grid: 9 chức năng × 5 role × 5 mức quyền
- Click cell → dropdown đổi mức
- Nút "+ Tạo vai trò" (custom role)
- Nút "📤 Xuất Excel ma trận"
- Nút "🔄 Khôi phục mặc định"

---

## P5.INT.01 — UC-INT-02: Cho phép nhập mô tả khi upload + counter (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/components/AttachmentUpload.tsx`

**UI:**
- Textarea "Mô tả ảnh" trước/sau upload
- Counter "X ảnh đã đính kèm · Tối đa 10 ảnh, 5MB/ảnh"
- Validation: reject file > 5MB hoặc khi đã có 10 ảnh

---

## P5.INT.02 — UC-INT-03: Modal cấu hình Export Excel (2 ngày)
**Loại:** UI | **Effort:** M | **Depends on:** —

**Files sửa:**
- `src/components/ExcelExport.tsx` (đổi từ 1-click → modal)

**Modal options:**
- Phạm vi: radio (Toàn bộ / Đã lọc / Đã chọn)
- Cột xuất: checkbox list (mặc định tick all)
- Định dạng: .xlsx / .csv
- Tùy chọn: Bao gồm tiêu đề công ty / Đóng băng dòng tiêu đề / Tô màu cảnh báo (HSD)
- Button "Xuất ngay"

**Backend:** Helper xlsx (đã có) + thêm CSV export option.

---

## P5.MD.01 — UC-MD-03: Bổ sung trang Đơn vị tính chung với Nhóm hàng (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** P0.DB.01

**Files sửa:**
- `src/app/product-groups/page.tsx` — chia 2 cột (Nhóm hàng | Đơn vị tính)
- Hoặc tạo tab/section riêng

**UI:**
- 2 bảng cạnh nhau: Nhóm hàng (đã có) + Đơn vị tính (CRUD mới)
- Khu Upload Excel hàng loạt với dropdown loại data + nút Template + thống kê

---

## P5.MD.02 — UC-MD-02: Upload ảnh khi tạo mã hàng (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/item-codes/page.tsx` (form tạo)

**UI:**
- Field upload ảnh sử dụng `AttachmentUpload` hoặc `<input type="file" accept="image/*">`
- Lưu URL vào `photo_url`

---

## P5.MD.03 — UC-MD-05: Cây thư mục Dãy/Kệ (1 ngày)
**Loại:** UI | **Effort:** S | **Depends on:** —

**Files sửa:**
- `src/app/locations/page.tsx`

**UI:**
- Sidebar trái: tree group locations theo zone → rack
- Click node → filter bảng phía phải

---

# 📋 BẢNG TỔNG KẾT TIMELINE

| Phase | Sprint | Tuần | Task chính | Người |
|---|---|---|---|---|
| **P0** | Sprint 0 | T1 | Migration + lib helpers (P0.DB.01-03, P0.SEED.01, P0.LIB.01) | BE |
| **P1** | Sprint 1 | T2 | Quick wins PAL + IN + FK + INV (10 task XS-S) | FE + BE |
| **P1** | Sprint 1 | T3 | Quick wins SYS + OUT + finish (8 task XS-S) | FE |
| **P2** | Sprint 2 | T4 | Inbound + Inbound Temp form bắt buộc (P2.IN.01-07, P2.INTMP.01-03) | FE + BE |
| **P2** | Sprint 2 | T5 | Pallet form + Forklift quick (P2.PAL.01-07, P2.FK.01-03) | FE |
| **P3** | Sprint 3 | T6 | UC-FK-05 + UC-FK-04 (P3.FK.01-02) | BE 🔒 |
| **P3** | Sprint 3 | T7 | UC-OUT-05 cách 1 + cách 2 (P3.OUT.01-02) | FE + BE |
| **P3** | Sprint 4 | T8 | UC-INTMP-02 + UC-IN-03 + UC-INV-09/08/06 (P3.INTMP.01, P3.IN.01, P3.INV.01-03) | FE + BE |
| **P4** | Sprint 5 | T9 | Dashboard cá nhân + Top SKU + Inv alerts (P4.DASH.01-02, P4.INV.01-03) | FE |
| **P4** | Sprint 5 | T10 | Charts + Forecast metric + Forklift dashboard (P4.OUT.01-02, P4.FK.01, P4.PAL.01) | FE |
| **P5** | Sprint 6 | T11 | System logo + Mail + Users + RBAC (P5.SYS.01-04) | FE + BE |
| **P5** | Sprint 6 | T12 | Integration + Master data polish (P5.INT.01-02, P5.MD.01-03) | FE |

**Total:** ~12 tuần (3 tháng) với 2 FE + 1 BE.

---

# ⚠️ CẢNH BÁO QUAN TRỌNG

## File 🔒 PROTECTED cần review nâng cao
- `src/app/api/forklift/return/route.ts` (P3.FK.01)
- `src/app/api/forklift/stage-out/route.ts` + `pallets/[id]/split/route.ts` (P3.FK.02)
- `src/app/api/outbound/rebalance/[id]/apply/route.ts` (P3.OUT.01)
- `src/app/api/adjustments/[id]/approve/route.ts` (P3.INV.01)
- `src/app/api/inbound-temp/[id]/standardize/route.ts` (P3.INTMP.01)

## Confirm với PO trước khi làm
1. **UC-AUTH-04**: Email-link reset (mockup) vs OTP (code hiện tại) — chọn cái nào là chuẩn?
2. **UC-IN-01 import_type**: Có giữ option "Nhập chuyển kho" hay xóa theo mockup?
3. **UC-PAL-01 trạng thái khởi tạo**: `EMPTY` (code) hay `COUNTING` (mockup) lúc mới tạo?
4. **UC-INTMP-01 code format**: `PNT-yyMMdd-NNN` (mockup) hay `PTT-YYYY-SSSS` (code)? — Đổi sẽ break audit trail cũ.
5. **UC-SYS-04**: Bỏ 3 role kỹ thuật (ADMIN/MANAGER/STAFF) hay giữ?

## Migration risk
- Mọi migration trên prod cần backup pg_dump trước.
- Field thêm phải có `DEFAULT` để không break records cũ.
- Test rollback script cho mỗi PR có migration.

## Test fixture mới
Cần seed thêm fixture cho:
- Outbound Rebalance (P3.OUT.01)
- Outbound Request (P3.OUT.02)
- Mail Settings (P5.SYS.02)
- Alert Settings (P4.INV.01)

---

# 🎯 ĐỊNH NGHĨA "DONE"

Mỗi task hoàn thành khi:
- [ ] Code merge vào `vinhgiang1` (PR có approve)
- [ ] Manual test theo Acceptance Criteria pass
- [ ] Migration (nếu có) chạy được trên staging
- [ ] Update file `BAO_CAO_GAP_MOCKUP_VS_WEB.md` đánh dấu UC chuyển từ ⚠️/❌ → ✅
- [ ] Update [docs/CHANGELOG.md](docs/CHANGELOG.md) entry mới

Mỗi phase hoàn thành khi:
- [ ] Tất cả task trong phase complete
- [ ] Smoke test luồng end-to-end (CP-01 .. CP-10 theo `docs/CRITICAL_PATHS.md`)
- [ ] Deploy lên VPS staging
- [ ] Demo cho PO + stakeholder

---

**Hết lộ trình.** Bắt đầu với **P0.DB.01** trong PR đầu tiên.

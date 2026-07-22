# BÁO CÁO LỖI — Quy cách & Đơn vị tính lẻ

> **Ngày:** 2026-05-28
> **Người báo:** Người dùng (Quản lý) — qua 2 screenshot
> **Người phân tích:** Claude (đối chiếu code + schema)
> **Phạm vi:** Sản phẩm/Mã hàng (master-data) ↔ Pallet dòng hàng ↔ Tồn kho

---

## TÓM TẮT 3 LỖI LIÊN QUAN

| # | Vị trí | Lỗi | Mức độ |
|---|---|---|---|
| **L1** | Modal "Thêm sản phẩm mới" → trường **QUY CÁCH** | Đang là **text mô tả kích thước** ("2440x1220x18mm") thay vì **số lẻ/thùng** (vd: 24 chai/thùng) | 🟠 Cao — sai về nghiệp vụ |
| **L2** | Pallet detail → "Thêm dòng hàng" SL thùng | Hệ thống **KHÔNG quy đổi** `qty_box → qty_unit`. Hiện đang để `qty_unit = qty_box` (1:1) — luôn sai | 🔴 Nghiêm trọng — sai số tồn |
| **L3** | Bảng dòng hàng pallet | **Không hiển thị cột "SL LẺ"** — Quản lý/Thủ kho không thấy số chai/gói lẻ trong pallet | 🟡 Trung — gây khó truy vấn |

→ User yêu cầu: nhập **5 thùng** → hệ thống tự tính ra **5 × (số lẻ/thùng)** đơn vị lẻ + hiển thị ở bảng dòng hàng và danh sách sản phẩm.

---

## LỖI L1 — Trường QUY CÁCH đang sai mục đích

### 1. Hiện trạng (screenshot 2)

Modal **"Thêm sản phẩm mới"** trong `/master-data`:

```
QUY CÁCH *      [VD: 2440x1220x18mm]       ← User vẽ mũi tên đỏ
                                              "quy cách là số lẻ/thùng.
                                               để lát nữa còn tính
                                               đơn vị tính lẻ"
```

### 2. Root cause

**Schema:** `prisma/schema.prisma` (line 176)
```prisma
model ItemCode {
  ...
  specification    String?        @db.VarChar(200)  // Quy cách ← text 200 ký tự
  ...
}
```
Cùng vậy với `Product.specification` (line 152) — đều là VARCHAR(200).

**UI:** `src/app/master-data/page.tsx` line 666-667
```tsx
<label>Quy cách <span className="text-error">*</span></label>
<input type="text" placeholder="VD: 2440x1220x18mm" ... />
```

→ Field đang được hiểu là **mô tả kích thước/quy cách vật lý** (kích cỡ MDF), không phải số lẻ/thùng.

### 3. Hậu quả

- Không có chỗ nào lưu thông tin **"1 thùng = N đơn vị lẻ"** → không thể quy đổi
- Khi nhập 5 thùng → không biết = 60 chai (nếu thùng 12 chai) hay = 120 chai (thùng 24)
- Báo cáo tồn kho theo đơn vị lẻ luôn sai
- FEFO theo đơn vị lẻ không có ý nghĩa

### 4. Đề xuất fix

**ADDITIVE migration** (giữ field cũ, thêm field mới):

```sql
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS units_per_box INT DEFAULT 1;

ALTER TABLE item_codes
  ADD COLUMN IF NOT EXISTS units_per_box INT DEFAULT 1;
-- units_per_box: số đơn vị lẻ trong 1 thùng (vd: 24 chai/thùng)
-- specification: giữ làm mô tả kích thước (optional)
```

**Schema sửa:**
```prisma
model ItemCode {
  ...
  specification    String?        @db.VarChar(200)  // Mô tả kích thước (optional)
  units_per_box    Int            @default(1)       // ← MỚI: số lẻ/thùng
  ...
}
```

**UI fix:**
- Modal "Thêm sản phẩm" thêm field **"Số lẻ / thùng"** (number, required, min=1)
  - Vd: "24" cho thùng nước ngọt 24 chai
  - Vd: "1" cho mặt hàng bán lẻ theo cái (đv lẻ = đv thùng)
- Giữ trường "Quy cách" làm mô tả (đổi placeholder thành "VD: 24 chai/thùng" hoặc cho phép trống)
- Hoặc đổi label "Quy cách" → "Mô tả kích thước" để tránh nhầm lẫn

---

## LỖI L2 — qty_unit không quy đổi (NGHIÊM TRỌNG)

### 1. Hiện trạng (screenshot 1)

Trang `/pallets/PL260528.013`, section "Thêm dòng hàng":
- User nhập `SỐ LƯỢNG (THÙNG) = 5`
- Mũi tên đỏ: **"PHẢI QUY ĐỔI SANG ĐƠN VỊ TÍNH LẺ. TỪ 5 THÙNG"**
- Mong muốn: 5 thùng → 5 × 24 = **120 chai lẻ** (nếu thùng 24 chai)

### 2. Root cause

**File:** `src/app/api/pallets/[id]/lines/route.ts` line 102-118
```typescript
// Tính toán
const qtyBoxNum = Number(qty_box);
const weightPerBox = itemCode.weight_per_box ? Number(itemCode.weight_per_box) : 0;
const weightKg = qtyBoxNum * weightPerBox;

const line = await prisma.palletLine.create({
  data: {
    pallet_id: id,
    item_code_id,
    qty_box: new Prisma.Decimal(qtyBoxNum),
    qty_unit: new Prisma.Decimal(qtyBoxNum), // ← 1:1 cho đơn giản  ⚠ BUG
    ...
  },
});
```

Comment trong code thừa nhận **"1:1 cho đơn giản"** — đây là **tạm bợ chưa làm đúng**. Field `qty_unit` luôn bằng `qty_box`, hoàn toàn không quy đổi.

### 3. Hậu quả nghiệp vụ — RẤT NẶNG

- **Báo cáo tồn lẻ** (theo chai/gói) luôn ra số **bằng số thùng** → sai bản chất
- Khi **xuất bán lẻ** (vd: bán 6 chai cho khách): hệ thống tính sai SL còn lại
- Khi **kiểm kê theo đơn vị lẻ**: lệch khổng lồ
- Khi **cảnh báo HSD theo lô đơn vị lẻ**: sai số lô có nguy cơ
- **Đồng bộ với kế toán**: số liệu sai → không khớp sổ → kiểm kê toàn kho

### 4. Đề xuất fix

**Trong API POST `/api/pallets/[id]/lines`:**
```typescript
const qtyBoxNum = Number(qty_box);
const unitsPerBox = itemCode.units_per_box || 1;
const qtyUnit = qtyBoxNum * unitsPerBox;  // ← QUY ĐỔI ĐÚNG
const weightKg = qtyBoxNum * (itemCode.weight_per_box ? Number(itemCode.weight_per_box) : 0);

const line = await prisma.palletLine.create({
  data: {
    ...
    qty_box: new Prisma.Decimal(qtyBoxNum),
    qty_unit: new Prisma.Decimal(qtyUnit), // ← ĐÚNG: số thùng × số lẻ/thùng
    ...
  },
});
```

**Trong API PATCH dòng hàng (đã có ở phase trước):** cũng phải recalc `qty_unit` khi `qty_box` đổi.

**Trong API POST `/api/pallets` (khi auto-copy từ InboundLine):** cũng đảm bảo tính đúng `qty_unit`.

---

## LỖI L3 — Không hiển thị cột "SL LẺ"

### 1. Hiện trạng

Bảng "HÀNG HÓA" trong pallet detail có cột:
```
# | MÃ HÀNG | TÊN | SL THÙNG | LÔ | HSD | KG
```

→ **Thiếu cột SL LẺ** — Quản lý không thấy số đơn vị lẻ.

### 2. Đề xuất fix

Thêm cột **"SL LẺ"** sau "SL THÙNG":

```
# | MÃ HÀNG | TÊN | QUY CÁCH | SL THÙNG | SL LẺ | LÔ | HSD | KG
```

Trong đó:
- **QUY CÁCH**: hiển thị `units_per_box` + đơn vị (vd: "24 chai/thùng") — đọc từ `item_code.units_per_box` + `item_code.unit.name`
- **SL LẺ**: hiển thị `qty_unit` đã tính sẵn
- Format số có dấu phẩy: `120` thay vì `120.000`

Trong danh sách **Danh mục sản phẩm** (`/master-data`):
- Thêm cột **"Quy cách"** hiển thị `24 chai/thùng` (units_per_box + unit name)
- Tooltip giải thích "Số đơn vị lẻ trong 1 thùng"

---

## ĐỀ XUẤT IMPLEMENT — 4 BƯỚC

### Bước 1: Migration additive (~30 phút)
File: `prisma/migrations/2026-05-28_units_per_box.sql`
```sql
ALTER TABLE item_codes ADD COLUMN IF NOT EXISTS units_per_box INT DEFAULT 1;
ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_box INT DEFAULT 1;

-- Backfill: với data cũ, mặc định = 1 (đv lẻ = đv thùng). User sẽ chỉnh từng SP sau.
```

### Bước 2: Schema + API (~1 giờ)
- `prisma/schema.prisma`: thêm `units_per_box Int @default(1)` cho `ItemCode` + `Product`
- `npx prisma generate`
- API `/api/pallets/[id]/lines` POST: tính `qty_unit = qty_box × units_per_box`
- API `/api/pallets/[id]/lines/[lineId]` PATCH: cũng recalc `qty_unit` khi `qty_box` đổi
- API `/api/pallets` POST (auto-copy từ PHN): include `units_per_box` khi tính

### Bước 3: UI Master-data + Item-codes (~1 giờ)
- Modal "Thêm sản phẩm mới":
  - Thêm input "Số lẻ / thùng" (number, min=1, default=1, required)
  - Sửa label "Quy cách" → "Mô tả kích thước" (optional)
- Modal "Sửa sản phẩm": tương tự
- Danh sách sản phẩm: thêm cột "Quy cách" hiển thị `24 chai/thùng`
- Modal "Tạo mã hàng" trên thủ kho mobile: tương tự

### Bước 4: UI Pallet detail (~1 giờ)
- Bảng dòng hàng: thêm cột "Quy cách" + "SL LẺ"
- Section "Thêm dòng hàng": hiển thị **preview** dưới input SL thùng:
  ```
  SỐ LƯỢNG (THÙNG) [ 5 ]   → Tương đương 120 chai (24 chai/thùng)
  ```
  → Helper text live update khi user gõ.
- Tương đương trên `/thukho/pallet/[id]` mobile.

---

## CRITICAL DECISIONS CẦN CHỐT TRƯỚC KHI FIX

| # | Câu hỏi | Option A (Khuyến nghị) | Option B |
|---|---|---|---|
| D1 | Field "units_per_box" có required không khi tạo SP? | ✓ Required, min=1, default=1 | Optional, null = giữ qty_unit=qty_box |
| D2 | Backfill dữ liệu cũ: SP đã tồn tại nên gán units_per_box = ? | 1 (an toàn, user chỉnh từng cái) | Tự đoán từ specification (rủi ro) |
| D3 | Giữ trường "specification" cũ hay xóa? | Giữ (đổi label "Mô tả kích thước") | Xóa hẳn — phá data cũ |
| D4 | Recalc qty_unit cho PalletLine cũ? | Không (data cũ qty_unit = qty_box, để nguyên) | Chạy script migrate qty_unit cho lines IN_STORAGE |
| D5 | Cảnh báo khi units_per_box thay đổi (sau khi đã có pallet)? | ✓ Có — chỉ ảnh hưởng pallet tạo mới | Cập nhật retroactive (rủi ro sai sổ) |

---

## ƯỚC LƯỢNG TỔNG

| Hạng mục | Effort |
|---|---|
| Migration + schema | 30 phút |
| API update (3 endpoints) | 1 giờ |
| UI master-data (form + table) | 1 giờ |
| UI thủ kho mobile item-code/new | 30 phút |
| UI pallet detail (cột SL LẺ + helper preview) | 1 giờ |
| Test E2E | 30 phút |
| **TỔNG** | **~4-5 giờ** |

---

> **User confirm D1-D5 thì sẽ bắt đầu fix theo 4 bước trên. Nếu chọn mặc định Option A cho tất cả → có thể bắt đầu ngay không cần hỏi thêm.**

— **End of report —**

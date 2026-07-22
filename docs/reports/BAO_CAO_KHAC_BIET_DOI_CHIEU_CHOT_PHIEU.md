# BÁO CÁO: Khác biệt giữa giao diện hiện tại vs Mockup UC-IN-03 + UC-IN-04

**Ngày:** 2026-05-27
**Phạm vi:** Trang `/wms/inbound/[id]` (Chi tiết phiếu nhập) — phần Đối chiếu (RECONCILING) + Chốt phiếu
**Mockup tham chiếu:** UC-IN-03 (`/reconcile`) + UC-IN-04 (`/finalize`) trong `wms_mockups_2.html`
**File chính:** [src/app/inbound/[id]/page.tsx](src/app/inbound/[id]/page.tsx) — 1281 dòng

---

## 1. Đối chiếu tổng quan

| | **Mockup** | **Hiện tại** |
|---|---|---|
| **Cấu trúc URL** | 2 trang tách: `/reconcile` + `/finalize` | 1 trang gộp: `/inbound/[id]` |
| **Tư duy logic** | Theo **PALLET** (pallet đã XN/đưa vị trí) | Theo **DÒNG HÀNG** (line đối chiếu) |
| **KPI cards** | 4 cards (Yêu cầu / Thực nhập / Pallet / Mã tạm) | ❌ Không có |
| **Cột Pallet trong bảng** | ✅ Có (liệt kê PL chứa hàng) | ❌ Không có |
| **"Hàng phát sinh"** (mã TMP chưa có trong phiếu) | ✅ Có | ❌ Không hỗ trợ |
| **Trạng thái dòng chi tiết** | Đã khớp / Thiếu / Thừa / Hàng phát sinh | Chỉ có "✓ Khớp" / "Chênh lệch ±" |
| **Nút "Yêu cầu kiểm lại"** | ✅ Có | ❌ Không có |
| **Ghi chú khi chốt** | ✅ Có textarea | ❌ Không có |
| **Dropdown "Quyết định chênh lệch"** | Chọn 1 trong nhiều option | ✅ Có |

---

## 2. Chi tiết từng khác biệt

### 2.1 KPI Cards (UC-IN-03) — ❌ HOÀN TOÀN THIẾU

**Mockup yêu cầu 4 cards ở đầu trang `/reconcile`:**

| Card | Giá trị | Mục đích |
|---|---|---|
| **Tổng yêu cầu** | `920` (3 mã hàng) | Sum `qty_expected` các InboundLine |
| **Tổng thực nhập** | `876` (−44 / −4.8%) | Sum `qty_received` + % chênh |
| **Pallet đã tạo** | `5` (3 đã XN · 2 đang đếm) | Count Pallet link với PHN + breakdown status |
| **Mã tạm** | `1` (Cần KT chuẩn hóa) | Count line có mã tạm `TMP-...` chưa standardized |

**Hiện tại:** Chỉ có progress bar `4/4 dòng (100%)` đơn giản, không breakdown.

**Tác động:** Kế toán không nhìn nhanh được "phiếu này có vấn đề gì" — phải đọc từng dòng.

---

### 2.2 Cột "Pallet" trong bảng — ❌ THIẾU

**Mockup:**
```
MÃ HÀNG  | TÊN | SL YC | SL TN | CL | TRẠNG THÁI | PALLET
VG-NM-001| ...  | 500   | 500   | 0  | ✓ Đã khớp  | PL260506.005, .008, .011
VG-TT-002| ...  | 300   | 240   | -60| Thiếu      | PL260506.011
```

→ Mỗi dòng hàng hiển thị **danh sách pallet** chứa hàng đó. Kế toán biết hàng đã đóng vào pallet nào.

**Hiện tại:** Bảng không có cột Pallet. Phải vào `/wms/pallets?phn=X` query riêng → mất context.

**Effort fix:** Thêm 1 cột. BE cần query thêm — group PalletLine theo `item_code_id + inbound_request_id` → list pallet.code distinct.

---

### 2.3 Trạng thái dòng "chi tiết hơn" — ❌ THIẾU 1 trạng thái

**Mockup có 4 trạng thái dòng:**
- ✅ **Đã khớp** (qty_received == qty_expected)
- ⚠️ **Chênh lệch thiếu** (qty_received < qty_expected)
- ⚠️ **Chênh lệch thừa** (qty_received > qty_expected)
- 🆕 **Hàng phát sinh · Chờ chuẩn hóa** (line có `item_code.code` bắt đầu `TMP-` → chưa standardized)

**Hiện tại:** Chỉ có "Khớp" / "Chênh lệch ±X" — không phân biệt "Hàng phát sinh".

**Effort fix:** Render thêm badge theo điều kiện `item_code.code.startsWith("TMP-")`.

---

### 2.4 "Hàng phát sinh" (UC-INTMP) — ❌ THIẾU LUỒNG

**Mockup row 4:**
```
TMP-260506-007 | Mì gói lạ NCC X | — | 30 | +30 | Hàng phát sinh · Chờ chuẩn hóa | PL260506.012
```

→ Mockup cho phép thêm dòng hàng **không có trong phiếu gốc** — vì thực tế NCC giao kèm hàng lạ (lỗi đóng kiện, khuyến mãi...). Hệ thống ghi nhận dưới dạng `TMP-YYMMDD-NNN` chờ kế toán chuẩn hóa.

**Hiện tại:** Bảng `inbound_lines` chỉ hiển thị các line đã tạo lúc DRAFT. Nếu pallet có hàng "thừa" thì... không hiện ra ở đây.

**Effort fix:**
- BE query thêm: `SELECT DISTINCT pl.item_code FROM pallet_lines pl JOIN pallets p ON ... WHERE p.inbound_request_id = X AND pl.item_code_id NOT IN (SELECT item_code_id FROM inbound_lines WHERE inbound_request_id = X)`
- → "Hàng phát sinh" = PalletLine có ItemCode KHÔNG nằm trong InboundLine của phiếu đó
- Hiển thị các "hàng phát sinh" dưới bảng chính với badge cam

---

### 2.5 Nút "Yêu cầu kiểm lại" — ❌ THIẾU

**Mockup:** Có button "Yêu cầu kiểm lại" cạnh "Chốt phiếu"

→ Khi kế toán phát hiện chênh lệch quá lớn → gửi lại cho thủ kho re-check. Status: `RECONCILING` → `RECEIVING` (rollback).

**Hiện tại:** Không có. Kế toán chỉ có 2 lựa chọn: "Chấp nhận tất cả" hoặc "Chốt phiếu". Không có cách reject.

**Effort fix:**
- Tạo endpoint mới `POST /api/inbound/[id]/request-recheck` (RECONCILING → RECEIVING)
- Thêm nút màu cam "Yêu cầu kiểm lại" trong UI
- Có thể ghi `note` lý do recheck

---

### 2.6 Ghi chú khi chốt — ❌ THIẾU

**Mockup UC-IN-04:**
```
📝 GHI CHÚ KHI CHỐT
[VD: Chấp nhận chênh lệch theo biên bản XXX...]
```

**Hiện tại:** Không có textarea. Bấm "Chốt phiếu nhập" chốt thẳng.

**Effort fix:**
- Thêm textarea trong UI khi RECONCILING
- POST `/api/inbound/[id]/complete` body có `close_note` field
- Schema `InboundRequest.close_note` đã có sẵn (xem schema.prisma:405)

---

### 2.7 Điều kiện chốt phiếu KHÁC LOGIC — ⚠️ SAI ĐỊNH HƯỚNG

**Mockup UC-IN-04 (5 điều kiện theo PALLET):**
1. Tất cả pallet đã xác nhận (5/5)
2. Tất cả pallet đã đưa vào vị trí (5/5)
3. Mã tạm đã chuẩn hóa (1/1)
4. ⚠️ Có chênh lệch chưa xử lý (3 mã)
5. ✓ Tổng thực nhập = Tổng đã phân bổ (876 = 876)

**Hiện tại (5 điều kiện theo DÒNG HÀNG):**
1. Tất cả dòng đã đối chiếu
2. Đã có dòng nhận thực tế (qty > 0)
3. Mã tạm đã chuẩn hóa (không còn TMP-...)
4. Mọi chênh lệch đã xử lý
5. Tổng SL khớp ±5%

→ Cả 2 đều OK nhưng **logic khác hẳn**. Mockup focus "pallet đã sẵn sàng", hiện tại focus "line đã được đối chiếu".

**Lý tưởng:** Gộp cả 2 — kiểm tra cả **dòng đã đối chiếu** + **pallet đã vào vị trí**. Vì:
- Dòng đối chiếu xong → kế toán đã accept SL
- Pallet đã vào vị trí → xe nâng đã đẩy hàng vào kho thực tế → đủ điều kiện chốt sổ

**Effort fix:** Thêm 2 điều kiện check pallet status:
- `pallets.count({ where: { inbound_request_id: X, status: 'CONFIRMED' } })` === total
- `pallets.count({ where: { inbound_request_id: X, status: 'IN_STORAGE' } })` === total

---

### 2.8 Tách trang `/reconcile` + `/finalize` — ⚠️ KHÁC ARCHITECTURE

**Mockup:** 2 trang riêng biệt
- `/inbound/requests/[code]/reconcile` — UC-IN-03
- `/inbound/requests/[code]/finalize` — UC-IN-04

**Hiện tại:** 1 trang gộp `/inbound/[id]` chạy theo `status`:
- DRAFT → form sửa
- PENDING → action "Bắt đầu tiếp nhận"
- RECEIVING → form điền qty_received
- RECONCILING → đối chiếu + chốt cùng 1 màn

**Đánh giá:**
- ✅ **Gộp 1 trang dễ vận hành hơn** — kế toán không cần điều hướng
- ❌ Khác mockup, UX có thể rối nếu nhiều action trên 1 màn

**Khuyến nghị:** **Giữ 1 trang gộp** (như hiện tại) — không sửa. Chỉ bổ sung KPI cards + các tính năng thiếu.

---

## 3. Tóm tắt — DANH SÁCH 9 KHÁC BIỆT

| # | Khác biệt | Mức | Effort |
|---|---|---|---|
| **1** | Thiếu 4 KPI Cards (Yêu cầu / Thực nhập / Pallet / Mã tạm) | 🔴 HIGH | ~2h |
| **2** | Thiếu cột "Pallet" trong bảng dòng hàng | 🔴 HIGH | ~1.5h (BE query + FE cell) |
| **3** | Trạng thái dòng chưa phân biệt "Hàng phát sinh" | 🟡 MED | ~30 phút |
| **4** | Thiếu luồng "Hàng phát sinh" (TMP-) | 🔴 HIGH | ~2h (BE query + FE section) |
| **5** | Thiếu nút "Yêu cầu kiểm lại" | 🟡 MED | ~1.5h (endpoint mới + nút) |
| **6** | Thiếu textarea "Ghi chú khi chốt" | 🟢 LOW | ~20 phút |
| **7** | Điều kiện chốt phiếu chưa check pallet status | 🟡 MED | ~1h |
| **8** | Architecture 1 trang vs 2 trang | 🟢 LOW | KHÔNG sửa — giữ gộp |
| **9** | Dropdown "Quyết định chênh lệch" đã có | ✅ OK | — |

**Tổng effort fix (8 điểm phải làm):** ~9 giờ ≈ 1.5 ngày

---

## 4. KẾ HOẠCH FIX CHI TIẾT (THEO PHASE)

### Phase 1 — Must fix (Quan trọng nhất, ~4h)

#### Bước 1: Thêm KPI Cards (#1) — ~2h
**File:** [src/app/inbound/[id]/page.tsx](src/app/inbound/[id]/page.tsx)

**Logic backend (nếu chưa có trong GET `/api/inbound/[id]`):**
```typescript
// Trong response, thêm summary
const stats = {
  total_expected: sum(lines.qty_expected),
  total_received: sum(lines.qty_received),
  diff_percent: ((received - expected) / expected * 100).toFixed(1),
  pallets_total: count(pallets where inbound_request_id = X AND status != CANCELLED),
  pallets_confirmed: count(pallets ... status = CONFIRMED),
  pallets_counting: count(pallets ... status = COUNTING),
  temp_codes_count: count(lines where item_code.code starts with 'TMP-'),
};
```

**UI:**
```tsx
{(isReceiving || isReconciling) && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
    <KpiCard label="Tổng yêu cầu" value={stats.total_expected} subtitle={`${stats.lines_count} mã hàng`} />
    <KpiCard label="Tổng thực nhập" value={stats.total_received} subtitle={`${diff > 0 ? '+' : ''}${diff} (${stats.diff_percent}%)`} color="rose" />
    <KpiCard label="Pallet đã tạo" value={stats.pallets_total} subtitle={`${stats.pallets_confirmed} đã XN · ${stats.pallets_counting} đang đếm`} />
    <KpiCard label="Mã tạm" value={stats.temp_codes_count} subtitle="Cần KT chuẩn hóa" color="amber" />
  </div>
)}
```

#### Bước 2: Thêm cột "Pallet" (#2) — ~1.5h
**Backend:** Update `GET /api/inbound/[id]` include:
```typescript
include: {
  lines: {
    include: { item_code: { ... } },
  },
  // Thêm: query pallet.lines join inbound
}
```

→ Hoặc tạo endpoint riêng `/api/inbound/[id]/pallets-by-item` trả mapping `{item_code_id: [pallet_code, ...]}`.

**FE:** Thêm cột `<th>Pallet</th>` + render `{itemPallets[line.item_code_id]?.join(", ") || "—"}`.

#### Bước 3: Phân biệt trạng thái dòng (#3) — ~30 phút
**FE:** Trong cột "Chênh lệch":
```tsx
{line.item_code.code.startsWith("TMP-") ? (
  <Badge color="amber">Hàng phát sinh · Chờ chuẩn hóa</Badge>
) : diff === 0 ? (
  <Badge color="emerald">✓ Đã khớp</Badge>
) : diff < 0 ? (
  <Badge color="rose">Thiếu {Math.abs(diff)}</Badge>
) : (
  <Badge color="amber">Thừa +{diff}</Badge>
)}
```

### Phase 2 — Should fix (~3h)

#### Bước 4: Hàng phát sinh (#4) — ~2h
**Backend:** Update GET `/api/inbound/[id]` thêm `extra_lines`:
```typescript
const extraLines = await prisma.palletLine.findMany({
  where: {
    pallet: { inbound_request_id: id },
    NOT: { item_code_id: { in: inboundLineItemCodeIds } },
  },
  include: { item_code: true, pallet: { select: { code: true } } },
});
```

**FE:** Section riêng dưới bảng chính:
```tsx
{extraLines.length > 0 && (
  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
    <h3 className="text-sm font-bold text-amber-800">🆕 Hàng phát sinh ({extraLines.length})</h3>
    <table>...</table>
  </div>
)}
```

#### Bước 5: Nút "Yêu cầu kiểm lại" (#5) — ~1.5h
**Backend:** Tạo `POST /api/inbound/[id]/request-recheck`:
```typescript
export async function POST(...) {
  // Validate status === RECONCILING
  // Update status → RECEIVING
  // Save note in InboundRequest.note
  // Audit log
}
```

**FE:** Thêm nút cam trong action zone RECONCILING:
```tsx
<button onClick={handleRequestRecheck} className="...bg-amber-600">
  Yêu cầu kiểm lại
</button>
```

### Phase 3 — Nice to have (~1.5h)

#### Bước 6: Ghi chú khi chốt (#6) — ~20 phút
**FE:** Thêm textarea trên nút "Chốt phiếu nhập":
```tsx
<textarea
  value={closeNote}
  onChange={(e) => setCloseNote(e.target.value)}
  placeholder="VD: Chấp nhận chênh lệch theo biên bản XXX..."
/>
```

**Backend:** Update POST `/api/inbound/[id]/complete` body có `close_note`.

#### Bước 7: Điều kiện chốt phiếu nâng cấp (#7) — ~1h
**FE:** Thêm 2 dòng check trong "ĐIỀU KIỆN CHỐT PHIẾU":
- ✓ Tất cả pallet đã xác nhận (X/Y)
- ✓ Tất cả pallet đã đưa vào vị trí (X/Y)

**Backend:** GET response cần thêm `pallets_confirmed_count` và `pallets_in_storage_count`.

---

## 5. Câu hỏi cần leader quyết

| Câu hỏi | Lựa chọn |
|---|---|
| Giữ architecture 1 trang gộp hay tách `/reconcile` + `/finalize`? | (a) **Giữ gộp** / (b) Tách 2 trang |
| Khi "Yêu cầu kiểm lại" → status rollback về RECEIVING không? | (a) **Rollback** / (b) Tạo trạng thái mới RECHECK |
| "Hàng phát sinh" có cho phép chốt phiếu không? | (a) Chỉ cho chốt sau khi đã standardize TMP / (b) **Vẫn cho chốt + cảnh báo** |
| Ghi chú khi chốt bắt buộc khi có chênh lệch? | (a) **Bắt buộc** / (b) Tùy chọn |

**Đề xuất default:** (a, a, a, a)

---

## 6. Tóm tắt 1 phút cho leader

| | |
|---|---|
| **Vấn đề** | Trang RECONCILING/Chốt phiếu hiện thiếu 8 hạng mục so với mockup UC-IN-03 + UC-IN-04 |
| **Quan trọng nhất** | (1) KPI cards · (2) Cột Pallet · (4) Hàng phát sinh · (5) Nút Yêu cầu kiểm lại |
| **Effort** | ~9 giờ ≈ 1.5 ngày làm full Phase 1+2+3 |
| **Architecture quyết định** | Giữ **1 trang gộp** (không sửa) — chỉ bổ sung tính năng thiếu |

Mày confirm Phase 1 + 4 default → tao bắt tay làm + deploy.

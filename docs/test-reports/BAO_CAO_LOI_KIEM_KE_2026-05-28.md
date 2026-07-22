# BÁO CÁO LỖI — MODULE KIỂM KÊ (STOCK COUNT)

> **Ngày:** 2026-05-28
> **Người báo:** User (Quản lý)
> **Người phân tích:** Claude (đối chiếu code + DB thực tế)
> **Triệu chứng:** "Logic mobile kiểm kê hoàn toàn không hoạt động — lỗi tùm lum, xuất dữ liệu DB cũng chả có"

---

## 1. TÓM TẮT TÌNH HÌNH

### Verify thực tế DB trên VPS 188.166.210.73 (sau reset)
```
stocktake_sessions: 0 rows
stocktake_counts:   0 rows
```

→ **DB hoàn toàn rỗng** module kiểm kê. Người dùng có thể đã thử tạo phiên / quét đếm nhưng **data không bao giờ được ghi vào DB**.

### Đánh giá implement vs flow nghiệp vụ kỳ vọng

| Bước nghiệp vụ | Vai trò | Implementation | % done |
|---|---|---|---|
| 1. Tạo phiên kiểm kê | Quản lý (desktop) | `/stock-count/new` → POST `/api/stock-count` | **100%** ✓ |
| 2. Phân quyền KIEM_KE | Admin | RBAC `KIEM_KE` có `kiemke_mobile` | **100%** ✓ |
| 3. Quét vị trí + đếm nhanh | Kiểm kê (mobile) | `/kiemke/scan` | **0%** ✗ KHÔNG LƯU DB |
| 4. Edit count + ghi chú | Kiểm kê (mobile) | `/kiemke/tasks/[id]` | **40%** ✗ Body format sai |
| 5. Hoàn tất phiên | Kiểm kê (mobile) | `POST /api/stock-count/[id]/complete` | **80%** OK |
| 6. Auto-tạo phiếu điều chỉnh | Quản lý (desktop) | `/stock-count/[id]/discrepancy` | **90%** OK |
| 7. Duyệt phiếu điều chỉnh + cập nhật tồn | Quản lý | `/inventory/adjustments` | **95%** OK |

→ **Backbone đúng** nhưng **bước 3-4 (mobile data entry) đứt mạch** → data không bao giờ vào DB. Đây là lý do "xuất dữ liệu DB cũng chả có".

---

## 2. BUG CRITICAL — 3 LỖI LÀM DATA KHÔNG LƯU DB

### 🔴 BUG #1 — Quét & Đếm nhanh KHÔNG LƯU DB
**File:** `src/app/kiemke/scan/page.tsx:54` (function `handleSave()`)

**Root cause:** Hàm `handleSave()` chỉ toggle UI state, **KHÔNG gọi API** để ghi vào DB.

```typescript
// Code hiện tại (line ~54):
const handleSave = () => {
  // Chỉ reset form UI sau 1.5s
  setSaved(true);
  setTimeout(() => {
    setSaved(false);
    setStep("scan");
    setCounts({});
  }, 1500);
  // ⛔ KHÔNG có fetch POST nào để lưu counts!
};
```

**Hậu quả:**
- Kiểm kê viên quét QR vị trí, đếm hàng, nhập SL thực → bấm "Lưu"
- UI báo "Đã lưu ✓" nhưng **toàn bộ dữ liệu mất hết**
- Vào DB query `stocktake_counts` → vẫn rỗng

### 🔴 BUG #2 — PUT body format sai
**File mobile:** `src/app/kiemke/tasks/[id]/page.tsx:48-52`
**File API:** `src/app/api/stock-count/[id]/route.ts:55-93`

**Root cause:** Mismatch body format giữa FE và BE.

| Bên | Gửi/nhận |
|---|---|
| Mobile gửi | `{ counts: [{count_id, actual_qty, note}, …] }` (batch) |
| API expect | `{ count_id, actual_qty, note }` (single) |

```typescript
// Mobile (line 48-52):
const updates = Object.entries(localCounts).map(([countId, val]) => ({
  count_id: countId, actual_qty: val.actual_qty, note: val.note,
}));
await fetch(`/kiemke/api/stock-count/${id}`, {
  method: "PUT",
  body: JSON.stringify({ counts: updates }),  // ← batch
});

// API line 55-63:
const { count_id, actual_qty, note } = await req.json();
// ← chỉ đọc 1 count, ignore `counts: [...]`
```

**Hậu quả:** API nhận request nhưng `count_id` undefined → có thể fail silently hoặc throw 400 → mobile báo lỗi/không lưu.

### 🔴 BUG #3 — GET không hỗ trợ filter status
**File:** `src/app/api/stock-count/route.ts:1-21`

**Root cause:** Mobile gửi `?status=OPEN` để filter tabs (line 11-12 `/kiemke/tasks/page.tsx`), nhưng API **bỏ qua query param** này, luôn trả về full list.

```typescript
// API hiện tại — KHÔNG đọc searchParams.status
export async function GET() {
  const sessions = await prisma.stocktakeSession.findMany({ ... });
  // ⛔ không có WHERE status=...
}
```

**Hậu quả:**
- Tab "Đang đếm" hiện cả phiên OPEN/CLOSED
- Tab "Hoàn thành" hiện cả phiên mới mở
- KPI sai

---

## 3. BUG HIGH PRIORITY — 2 LỖI

### 🟠 BUG #4 — API GET không trả đủ field cho progress
**File:** `src/app/api/stock-count/route.ts:8`

```typescript
include: { counts: { select: { id: true, actual_qty: true } } }
// ⛔ THIẾU: discrepancy, system_qty, location_code, item_code
```

**Hậu quả:** Mobile không tính được progress chính xác → KPI "X/Y đã đếm" sai.

### 🟠 BUG #5 — POST tạo phiên dùng filter pallet status hẹp
**File:** `src/app/api/stock-count/route.ts:42-46`

```typescript
where: { status: { in: ["IN_STORAGE", "IN_STAGING"] } }
```

Trong khi scan page query inventory KHÔNG filter status → khi đếm thì có thể có sự khác biệt giữa "system_qty lúc tạo phiên" vs "system_qty lúc đếm".

**Hậu quả:** Discrepancy hiển thị sai khi pallet được nhập/xuất giữa lúc tạo phiên và lúc đếm.

---

## 4. BUG MEDIUM — 3 LỖI UX

### 🟡 BUG #6 — KPI "Có chênh lệch" hardcode
**File:** `src/app/kiemke/page.tsx:24`
```typescript
{ label: "Có chênh lệch", value: "—" }  // ← hardcode "—"
```
→ Luôn hiển thị "—" thay vì số thực tế.

### 🟡 BUG #7 — `progress` field không từ API
**File:** `src/app/kiemke/tasks/page.tsx:32`
→ Frontend tự tính progress từ `session.counts.length` vs `actual_qty != null`, nhưng vì BUG #4 thiếu data → sai.

### 🟡 BUG #8 — qty_adjust calc dựa trên discrepancy không validate
**File:** `src/app/stock-count/[id]/discrepancy/page.tsx:81-82`
```typescript
qty_before: Number(c.system_qty),
qty_adjust: Number(c.discrepancy),
```
Không validate `qty_before + qty_adjust === c.actual_qty`. Nếu discrepancy bị lệch (do BUG #5) → phiếu điều chỉnh tạo SAI số.

---

## 5. CHI TIẾT FILE LIÊN QUAN

### Frontend Mobile (instance `/kiemke`)
| File | Vai trò | Trạng thái |
|---|---|---|
| `src/app/kiemke/page.tsx` | Dashboard 4 KPI | 🟡 hardcode KPI |
| `src/app/kiemke/tasks/page.tsx` | List phiên + filter tab | 🔴 filter không hoạt động |
| `src/app/kiemke/tasks/[id]/page.tsx` | Edit count + ghi chú | 🔴 PUT body sai |
| `src/app/kiemke/scan/page.tsx` | Quét nhanh & đếm | 🔴 KHÔNG LƯU DB |
| `src/app/kiemke/history/page.tsx` | Lịch sử kiểm kê | 🟢 OK |

### Frontend Desktop
| File | Vai trò | Trạng thái |
|---|---|---|
| `src/app/stock-count/page.tsx` | List + filter + Excel | 🟢 OK |
| `src/app/stock-count/new/page.tsx` | Tạo phiên mới | 🟢 OK |
| `src/app/stock-count/[id]/page.tsx` | Detail + edit count | 🟢 OK |
| `src/app/stock-count/[id]/discrepancy/page.tsx` | Xử lý chênh lệch → tạo adj | 🟡 calc cần validate |

### API Backend
| File | Method | Trạng thái |
|---|---|---|
| `src/app/api/stock-count/route.ts` | GET / POST | 🔴 GET thiếu filter + field |
| `src/app/api/stock-count/[id]/route.ts` | GET / PUT | 🔴 PUT không batch |
| `src/app/api/stock-count/[id]/complete/route.ts` | POST | 🟡 không enforce uncounted |

### Data Model (đầy đủ, không có bug schema)
```prisma
enum StocktakeStatus { OPEN, COUNTING, RECONCILING, CLOSED }
enum StocktakeType { BY_LOCATION, BY_ITEM }
model StocktakeSession { code, type, status, started_at, completed_at, counts[] }
model StocktakeCount { session_id, location_id?, item_code_id?, system_qty, actual_qty?, discrepancy?, note?, counted_by?, counted_at? }
```

### RBAC
```typescript
KIEM_KE: ["dashboard", "inventory", "stock_count", "kiemke_mobile"]  // ✓ OK
```

---

## 6. KẾ HOẠCH FIX (THỨ TỰ ƯU TIÊN)

### Phase 1 — Bug Critical (CẦN FIX TRƯỚC)

**1.1** Fix `/kiemke/scan/page.tsx` `handleSave()`:
- Thêm fetch POST → mới endpoint `POST /api/stock-count/scan-batch`
- Body: `{ session_id?, location_id, counts: [{item_code_id, lot, actual_qty, note}] }`
- Backend: tìm/tạo session OPEN cho location đó, upsert StocktakeCount

**1.2** Fix PUT `/api/stock-count/[id]/route.ts` accept batch:
- Detect body: nếu có `counts: [...]` → loop update từng record
- Nếu có `count_id` → giữ behavior cũ (backward compat)

**1.3** Fix GET `/api/stock-count` thêm filter:
- Đọc `?status=OPEN|COUNTING|...` từ query
- Apply WHERE status nếu có

**Effort:** 4-5 giờ

### Phase 2 — Bug High

**2.1** Mở rộng GET response include đủ field:
```typescript
counts: {
  select: {
    id, system_qty, actual_qty, discrepancy, note, counted_at,
    location: { select: { id, code } },
    item_code: { select: { id, code, short_name } },
  },
}
```

**2.2** Thêm cache snapshot `system_qty_at_session_create` vào StocktakeCount để discrepancy chỉ tính theo snapshot lúc tạo phiên (không phụ thuộc tồn thực tế hiện tại).

**Effort:** 2-3 giờ

### Phase 3 — Bug Medium UX

**3.1** Sửa KPI hardcode trong `/kiemke/page.tsx` line 24 → tính từ API.

**3.2** Sửa `qty_adjust` calc trong discrepancy page — thêm assertion `qty_after === actual_qty`.

**3.3** Enforce `complete` API: nếu còn count chưa đếm → reject 400 (đã có rồi nhưng mobile bypass) — không cần fix BE, fix mobile để không gửi khi chưa đếm hết.

**Effort:** 2 giờ

**TỔNG EFFORT:** ~8-10 giờ (1 ngày làm việc)

---

## 7. KẾT LUẬN

| Đánh giá | Mức độ |
|---|---|
| Schema DB | ✅ Đủ và đúng |
| RBAC | ✅ OK |
| Desktop Manager flow | ✅ OK (tạo phiên, xử lý chênh lệch) |
| **Mobile data entry (Quét nhanh + Edit task)** | ❌ **HỎNG HOÀN TOÀN** |
| **API filter & batch update** | ❌ **HỎNG** |

**Vì sao DB rỗng:** Không phải vì user chưa thao tác, mà vì **mọi data người dùng nhập vào mobile đều bị discard (không gọi API) hoặc bị API reject vì body format sai**. Đây là lý do "xuất dữ liệu DB cũng chả có".

**Fix priority:** Phase 1 (3 bug critical, ~4-5h) → có thể tiếp tục dùng module ngay.

---

> *Sau khi user duyệt báo cáo, tao bắt đầu Phase 1 (3 bug critical) → test → deploy. Có thể fix luôn trong cùng session nếu cần.*

— End of report —

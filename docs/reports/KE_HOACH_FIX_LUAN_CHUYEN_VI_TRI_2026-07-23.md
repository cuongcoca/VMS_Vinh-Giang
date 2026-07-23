# Kế hoạch fix — Luân chuyển vị trí pallet (UC-FK-03)

**Ngày:** 2026-07-23 · **Liên quan:** [BAO_CAO_LOI_LUAN_CHUYEN_VI_TRI_2026-07-23.md](BAO_CAO_LOI_LUAN_CHUYEN_VI_TRI_2026-07-23.md)

> ## ✅ ĐÃ THỰC HIỆN XONG — 2026-07-23
>
> Cả 5 việc đã code và chạy thử trên app thật. Quyết định của chủ dự án:
> KPI = số pallet đang trong kho · tab Luân chuyển theo hướng A · Việc 2 làm **bản rút gọn** ·
> sửa luôn nhánh `RETURN`.
>
> | Việc | Trạng thái | Kiểm chứng |
> |---|---|---|
> | 0 — Tab Luân chuyển + Hoàn trả rỗng | ✅ | `RELOCATE` 0 → **2** · `RETURN` 0 → **1** |
> | 1 — Quét QR kệ | ✅ | Quét `A-02-02` → tự chọn `PL260520.002` |
> | 2 — Ô lọc nhanh (rút gọn) | ✅ | Gõ `A-03` → lọc đúng theo mã kệ |
> | 3 — Đọc `?pallet_id=` | ✅ | Mở link kèm id → ô Pallet điền sẵn |
> | 4 — Thông báo lỗi | ✅ | Quét pallet `IN_STAGING` → hiện link sang Hoàn trả |
>
> Luồng đầy đủ chạy qua giao diện: `PL260520.001: A-03-01 → A-01-02`, Movement + lý do đã ghi vào DB.
> `npx tsc --noEmit` sạch. Không có migration, không đổi schema.
>
> Phần dưới giữ nguyên làm hồ sơ phân tích.

---

## 0. Phát hiện mới khi lên kế hoạch — quan trọng hơn cả 4 điểm cũ

Khi đọc kỹ `src/app/api/forklift/queue/route.ts` để lên plan cho điểm #3, tôi tìm ra thứ khớp
chính xác với câu *"kho đang không có phần luân chuyển vị trí kho"*:

**Tab "Luân chuyển" trên Trang chủ Xe nâng LUÔN LUÔN rỗng — do code trả mảng rỗng cứng.**

`src/app/api/forklift/queue/route.ts:74-77`:

```ts
const pallets = !taskType || taskType === "PUT_AWAY"
  ? await prisma.pallet.findMany(putAwayQuery)
  : []; // Stub: chưa có schema movements pending → trả mảng rỗng để không lỗi
```

→ Mọi `task_type` khác `PUT_AWAY` (gồm `RELOCATE` và `RETURN`) đều nhận `[]`.
Giao diện hiển thị *"Không có yêu cầu luân chuyển."*

**Đã kiểm chứng bằng app đang chạy:**

```json
{"RELOCATE_count": 0, "RELOCATE_kpi": 1, "PUT_AWAY_count": 2}
```

Trong kho có 2 pallet `IN_STORAGE` sẵn sàng chuyển, nhưng tab trả 0.

Thêm một lỗi đi kèm: KPI **"Yêu cầu di chuyển"** không đếm việc cần làm mà đếm
`Movement` loại `RELOCATE` **đã thực hiện trong 24h qua** (`queue/route.ts:36-38`, comment ghi rõ `proxy`).
Tức là ô KPI đang hiển thị **việc đã xong**, dán nhãn **việc phải làm**. Số `1` ở trên chính là
lần chuyển thử tôi vừa chạy.

**Hệ quả với kế hoạch cũ:** điểm #3 (`?pallet_id=`) **hiện tại vô nghĩa** — danh sách rỗng thì
không có link nào để bấm. Phải sửa #0 trước, #3 mới có tác dụng.

---

## 1. Tổng quan 5 việc

| # | Việc | Mức | File chính | Đổi API? | Ước lượng |
|---|---|---|---|---|---|
| **0** | Tab "Luân chuyển" luôn rỗng + KPI sai nhãn | 🔴 Chặn | `api/forklift/queue/route.ts` | Có | ~1.5h |
| **1** | Quét QR kệ vào ô Pallet → nhận diện & liệt kê pallet trên kệ | 🔴 Cao | `forklift/relocate/page.tsx` | **Không** | ~2h |
| **2** | Bỏ trần 200 pallet + thêm tìm kiếm | 🔴 Cao | `api/pallets/route.ts` + `relocate/page.tsx` | Có | ~3h |
| **3** | Đọc `?pallet_id=` từ Dashboard | 🟡 Vừa | `forklift/relocate/page.tsx` | Không | ~30ph |
| **4** | Thông báo lỗi có hướng dẫn | 🟡 Vừa | `forklift/relocate/page.tsx` | Không | ~30ph |

**Không đụng** `api/forklift/relocate/route.ts` — backend đã validate đầy đủ và chạy đúng
(đã chạy thật: `PL260520.001: A-02-01 → A-03-01` ✅).

**Thứ tự đề xuất:** 1 → 3 → 4 (cùng một file, gộp 1 lần test) → 0 → 2.
Lý do: #1 gỡ được nút thắt ngay cho người dùng mà không cần đổi API, rủi ro thấp nhất.

---

## 2. Chi tiết từng việc

### Việc 0 — Tab "Luân chuyển" luôn rỗng

**File:** `src/app/api/forklift/queue/route.ts`

**Quyết định thiết kế cần chốt trước khi code.** Có 2 hướng:

| Hướng | Nội dung | Đánh giá |
|---|---|---|
| **A. Liệt kê pallet đang trong kho** | `task_type=RELOCATE` trả pallet `IN_STORAGE` (kèm vị trí hiện tại), sắp theo mới nhất, có phân trang | ✅ **Đề xuất** — khớp UC-FK-03 (luồng chính là xe nâng tự chọn pallet để sắp xếp lại kho, tài liệu **không** có khái niệm "lệnh luân chuyển") |
| B. Xây "lệnh luân chuyển" thật | Thêm model `MoveRequest`, người ra lệnh, trạng thái, giao việc | ❌ Không đề xuất lúc này — cần schema mới + migration + màn hình tạo lệnh; **tài liệu UC v3.1 không yêu cầu**. Để dành nếu sau này khách muốn điều phối |

**Nội dung sửa theo hướng A:**

1. Thêm nhánh `RELOCATE` vào query, dùng lại cấu trúc `putAwayQuery`:

```ts
// RELOCATE: pallet đang nằm trong vị trí chứa → có thể sắp xếp lại
const relocateQuery = {
  where: { status: "IN_STORAGE" as const, location_id: { not: null } },
  orderBy: { updated_at: "desc" as const },
  take: 50,                       // phân trang, không đổ hết
  include: {
    supplier: { select: { id: true, code: true, name: true } },
    location: { select: { id: true, code: true, zone: true } },
    lines: { select: { qty_box: true, expiry_date: true } },
  },
};
```

2. Sửa dòng 74-77 để chọn query theo `taskType` thay vì trả `[]`.

3. **Sửa KPI cho đúng nghĩa** (`queue/route.ts:44-50`):
   - `RELOCATE` hiện = số movement đã chuyển trong 24h → đổi thành `inStorageCount`
     (số pallet **có thể** chuyển) HOẶC giữ nguyên nhưng **đổi nhãn ở UI**.
   - Nhãn UI ở `ForkliftMobileDashboard.tsx:~232` đang là *"Yêu cầu di chuyển"* → đổi thành
     *"Pallet trong kho"* (nếu dùng `inStorageCount`) hoặc *"Đã chuyển 24h"* (nếu giữ proxy).
   - **Cần bạn chốt** muốn ô KPI đó nói gì.

4. Nhánh `RETURN` cũng đang rỗng vì cùng dòng code đó — cân nhắc trả pallet `IN_STAGING`
   trong cùng lần sửa (đúng UC-FK-05: hoàn trả từ khu chờ xuất về vị trí chứa).

**Rủi ro:** kho lớn → `IN_STORAGE` rất nhiều. Bắt buộc `take` + sắp xếp ổn định. Việc 2 sẽ bổ sung tìm kiếm.

**Cách kiểm thử:**
```bash
curl "http://localhost:3002/xenang/api/forklift/queue?task_type=RELOCATE" | head -c 400
```
Kỳ vọng: `data.length > 0`, mỗi phần tử có `location.code`.
Rồi mở Trang chủ Xe nâng → tab "Luân chuyển" → phải thấy danh sách + bấm được vào từng dòng.

---

### Việc 1 — Quét QR kệ vào ô Pallet

**File:** `src/app/forklift/relocate/page.tsx`, hàm `onScan` của `BarcodeScanner` cuối file (dòng ~222-262).

**Điều chỉnh so với báo cáo trước.** Báo cáo trước tôi đề xuất dùng `/api/scan/resolve`.
Đọc kỹ hơn thì **`/api/locations/by-code` là lựa chọn tốt hơn**, vì:

| | `/api/scan/resolve` | `/api/locations/by-code` |
|---|---|---|
| Trả pallet tại vị trí | Có, nhưng **`take: 5`** — cắt mất pallet | **Trả hết** |
| Trường trả về | `id, code, status` — **thiếu `total_weight_kg`** (cần để lọc vị trí đích theo tải trọng) | `id, code, status, total_lines, total_weight_kg` ✅ |
| Đã dùng trong file này chưa | Chưa | **Rồi** — ô "Vị trí mới" đã gọi (dòng 190) |

→ Dùng `locations/by-code`, **không phải sửa API nào cả**.

**Logic mới cho `onScan` ô Pallet:**

```
1. extractScannedCode(raw)                       // đã có sẵn, giữ nguyên
2. Nếu khớp /^[A-Za-z]+-\d{2}-\d{2}$/  → đây là MÃ VỊ TRÍ:
     GET /api/locations/by-code?code=...
     lọc data.pallets theo status === "IN_STORAGE"
       - 0 pallet  → toast: "Vị trí X hiện không có pallet nào trong kho."
       - 1 pallet  → tự chọn luôn + toast "Đã chọn pallet Y đang ở X"
       - nhiều     → mở modal chọn pallet (danh sách code + số dòng + cân)
3. Ngược lại → giữ nguyên luồng cũ: GET /api/pallets/by-code
```

**Lưu ý kỹ thuật:**
- Regex phải chấp nhận `AB-01-01` (2 chữ cái) — `[A-Za-z]+` đã đúng. Backend
  `relocate/route.ts:29` dùng `/^[A-Z]+-\d{2}-\d{2}$/` sau khi `.toUpperCase()` → khớp.
- Pallet chọn từ vị trí phải nạp vào `pallets` state (giống nhánh hiện có ở dòng 248-258)
  để `selected?.location` và bộ lọc `locations/available?pallet_weight_kg=` hoạt động đúng.
- `total_weight_kg` từ `locations/by-code` là chuỗi Decimal → nhớ `Number(...)`.
- Cần một modal chọn pallet — dùng `Modal` có sẵn ở `src/components/ui/Modal.tsx`.

**Cách kiểm thử:**
1. Mở `/xenang/forklift/relocate`, bấm "Quét QR" ở ô PALLET.
2. Quét (hoặc dùng nhập tay trong modal scanner) mã `A-02-02` → phải tự chọn `PL260520.002`.
3. Quét mã vị trí trống `A-01-01` → toast "hiện không có pallet nào trong kho".
4. Quét mã pallet thật `PL260520.002` → vẫn chọn được như cũ (không regression).

---

### Việc 2 — Bỏ trần 200 pallet + thêm tìm kiếm

**2a. Sửa API** — `src/app/api/pallets/route.ts`

Ba thay đổi nhỏ:

1. **Mở rộng `q`** để tìm được cả theo mã vị trí (xe nâng nghĩ theo kệ, không theo mã pallet):

```ts
where.OR = [
  { code: { contains: q, mode: "insensitive" } },
  { note: { contains: q, mode: "insensitive" } },
  { location: { code: { contains: q, mode: "insensitive" } } },   // ← thêm
];
```

2. **Cho `take` cấu hình được** thay vì cứng 200:

```ts
const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
// ... take: limit
```

3. **Cho bỏ qua KPI** — hiện mỗi lần gọi đều chạy thêm một `groupBy` trên **toàn bộ** bảng pallet
   (`route.ts`, phần `allPallets`). Với kho lớn + gõ tìm kiếm liên tục thì rất phí:

```ts
const skipKpis = searchParams.get("skip_kpis") === "1";
```

**Tương thích ngược:** `limit` mặc định nên giữ 200 để các màn hình khác đang gọi
`/api/pallets` không đổi hành vi. Cần rà: `grep -rn "api/pallets?" src` trước khi đổi.

**2b. Sửa giao diện** — `src/app/forklift/relocate/page.tsx`

Thay `<select>` pallet (dòng 122-127) bằng ô nhập có gợi ý:
- Input text + debounce ~300ms → `GET /api/pallets?status=IN_STORAGE&q=...&limit=20&skip_kpis=1`
- Hiện danh sách gợi ý: `mã pallet — vị trí — số dòng — cân`
- Khi chưa gõ gì: nạp sẵn 20 pallet gần nhất (giữ trải nghiệm cũ cho kho nhỏ)
- Giữ nguyên nút "Quét QR" bên cạnh

**Rủi ro:** đây là thay đổi giao diện lớn nhất trong 5 việc. Nếu muốn giảm rủi ro, có thể làm
**bước rút gọn**: giữ `<select>` nhưng thêm một ô "Lọc nhanh" phía trên, gõ vào thì gọi lại API
với `q`. Ít đẹp hơn nhưng sửa nhanh và gần như không thể vỡ.

**Cách kiểm thử:** cần dữ liệu lớn. Đề xuất viết script seed tạm sinh ~300 pallet `IN_STORAGE`,
xác nhận pallet cũ nhất vẫn tìm ra được bằng cách gõ mã và bằng cách gõ mã kệ.

---

### Việc 3 — Đọc `?pallet_id=`

**File:** `src/app/forklift/relocate/page.tsx`

Copy đúng khuôn `src/app/forklift/put-away/page.tsx`:

1. `import { useSearchParams } from "next/navigation";` và `Suspense` từ react.
2. Trong component: `const preselectedPalletId = useSearchParams().get("pallet_id") || "";`
   rồi `useState(preselectedPalletId)` cho `palletId`.
3. **Bắt buộc**: đổi tên component hiện tại thành `RelocateContent`, thêm wrapper:

```tsx
export default function RelocatePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-[60vh]">
      <span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>
    </div>}>
      <RelocateContent />
    </Suspense>
  );
}
```

> ⚠️ Không có `Suspense` bọc thì `useSearchParams` sẽ làm cả trang rơi vào client-side rendering
> lúc build (Next.js App Router). `put-away/page.tsx` đã làm đúng — bám theo file đó.

**Điểm cần lưu ý:** pallet preselect đến từ Dashboard **có thể không nằm trong 200 bản ghi đầu**
của dropdown. Nên sau khi lấy được `pallet_id` cần gọi thêm `GET /api/pallets/by-code` (hoặc theo id)
để nạp pallet đó vào `pallets` state — nếu không, `<select>` sẽ hiển thị rỗng dù `palletId` đã có giá trị.
Việc 2 làm xong thì vấn đề này tự hết.

**Cách kiểm thử:** sau khi xong Việc 0, vào Trang chủ Xe nâng → tab "Luân chuyển" → bấm 1 dòng →
màn hình Luân chuyển phải mở với ô Pallet **đã điền sẵn** và khối "Vị trí hiện tại" hiện đúng.

---

### Việc 4 — Thông báo lỗi có hướng dẫn

**File:** `src/app/forklift/relocate/page.tsx`

| Tình huống | Hiện tại | Đề xuất |
|---|---|---|
| Quét mã vị trí vào ô Pallet | `Pallet "B-24-02" không tồn tại.` | `"B-24-02" là mã vị trí, không phải mã pallet. Vị trí này đang có N pallet — chọn bên dưới.` *(Việc 1 đã xử lý)* |
| Mã hoàn toàn không có | `Pallet "X" không tồn tại.` | `Không tìm thấy "X". Kiểm tra lại nhãn, hoặc chọn pallet từ danh sách.` |
| Pallet không ở trong kho | `Pallet Y không ở trong kho (trạng thái: IN_STAGING).` | `Pallet Y đang ở khu chờ xuất — muốn đưa về vị trí chứa thì dùng chức năng "Hoàn trả".` |
| Vị trí đích không hợp lệ | (đã tốt sẵn, giữ nguyên) | — |

Nhánh `IN_STAGING` nên kèm link sang `/forklift/return?pallet_id=...` cho người dùng đi tiếp được.

---

## 3. Kiểm thử hồi quy sau khi xong

| Luồng | Cách chạy |
|---|---|
| Chuyển vị trí bình thường | Chọn pallet từ danh sách → chọn vị trí → Xác nhận → kiểm tra toast + `/movements` có dòng RELOCATE |
| Quét QR pallet | Không được vỡ so với trước |
| Quét QR vị trí (mới) | Ra danh sách pallet trên kệ |
| Chặn trùng vị trí | Chọn đúng vị trí đang đứng → phải báo "Vị trí mới trùng vị trí cũ" |
| Chặn quá tải | Chọn vị trí gần đầy → phải báo vượt sức chứa |
| Các màn dùng chung `/api/pallets` | `/wms/pallets`, `/wms/inventory/by-pallet`, `/thukho/pallet` — kiểm tra không đổi hành vi sau khi sửa `take` |

E2E hiện có: `e2e/pallets.spec.ts` — chạy `npm run e2e` sau khi sửa.

---

## 4. Việc cần bạn quyết trước khi bắt tay

1. **KPI "Yêu cầu di chuyển"** nên hiển thị gì — số pallet đang trong kho (việc có thể làm),
   hay số lần đã chuyển trong 24h (đổi nhãn thành "Đã chuyển 24h")?
2. **Tab Luân chuyển** — đồng ý hướng A (liệt kê pallet `IN_STORAGE`) chứ không xây "lệnh luân chuyển"
   có người giao việc?
3. **Việc 2** — làm bản đầy đủ (ô nhập có gợi ý) hay bản rút gọn (thêm ô lọc nhanh trên `<select>`)?
4. Có sửa luôn nhánh **`RETURN`** đang rỗng cùng lúc với `RELOCATE` không (cùng một dòng code)?

---

## 5. Tóm tắt thay đổi theo file

| File | Việc | Loại thay đổi |
|---|---|---|
| `src/app/api/forklift/queue/route.ts` | 0 | Thêm nhánh RELOCATE (+RETURN), sửa KPI |
| `src/components/forklift/ForkliftMobileDashboard.tsx` | 0 | Đổi nhãn KPI |
| `src/app/forklift/relocate/page.tsx` | 1, 2b, 3, 4 | Nhận diện mã vị trí, ô tìm kiếm, `useSearchParams` + `Suspense`, sửa thông báo |
| `src/app/api/pallets/route.ts` | 2a | `q` tìm theo vị trí, `limit`, `skip_kpis` |

**Không đổi:** `api/forklift/relocate/route.ts`, `api/locations/by-code/route.ts`,
`api/locations/available/route.ts`, schema Prisma, migration.

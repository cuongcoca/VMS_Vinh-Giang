# Kế hoạch fix — Phân trang Pallet (Thủ kho + 32 màn danh sách)

**Ngày:** 2026-07-23 · **Liên quan:** [BAO_CAO_LOI_PHAN_TRANG_PALLET_2026-07-23.md](BAO_CAO_LOI_PHAN_TRANG_PALLET_2026-07-23.md)

> ## ✅ ĐÃ THỰC HIỆN XONG — 2026-07-23
>
> Quyết định của chủ dự án: làm luôn `/wms/pallets` desktop · áp đủ 17 màn nhóm A ·
> quay lại giữ nguyên trang đang xem · debounce 500ms.
>
> | Việc | Trạng thái | Kiểm chứng trên app thật (230 pallet) |
> |---|---|---|
> | 5 — `status` nhiều giá trị | ✅ | `?status=IN_STORAGE,IN_STAGING` 500 → 200; màn phiếu điều chỉnh có 3 pallet |
> | 3 — Nhớ trang khi quay lại | ✅ | Trang 3 → mở pallet → Quay lại → vẫn trang 3 (cả mobile lẫn desktop) |
> | 1 — Phân trang server-side | ✅ | Duyệt 23 trang lấy đúng 230 bản ghi, **không trùng không sót** |
> | 2 — Thủ kho + desktop | ✅ | Chân trang `1 - 10 / 230` (hết cảnh 230 vs 200); trang 23 mở được |
> | 4 — Debounce + nhóm A/B | ✅ | Gõ 4 ký tự → 1 lần tìm thay vì 4 request |
>
> **Hai điều chỉnh so với kế hoạch, do đo thực tế:**
>
> 1. **Không lưu trang vào URL được.** Kế hoạch chọn `history.replaceState` sau khi thử nghiệm
>    thấy query được giữ. Nhưng khi cắm vào hook thật thì hỏng: App Router lưu
>    `renderedSearch: ""` trong state nội bộ và dựng lại địa chỉ từ đó khi `router.back()`,
>    nên query bị xoá. Đã chuyển sang **`sessionStorage`** — không phụ thuộc router,
>    tự hết khi đóng tab.
> 2. **Cờ "lần chạy đầu" không đủ.** React StrictMode chạy effect hai lần lúc mount nên
>    `useRef(true)` bị lượt thứ hai vượt qua, `setPage(1)` xoá mất trang vừa khôi phục.
>    Đã đổi sang **so sánh giá trị `resetKey`** (`Object.is`) — idempotent với double-invoke.
>
> `npx tsc --noEmit` sạch. `npx eslint` không phát sinh lỗi mới. Không có migration.
>
> Phần dưới giữ nguyên làm hồ sơ phân tích.

---

## 0. Phát hiện thêm khi khảo sát — màn "Tạo phiếu điều chỉnh tồn" đang hỏng

Trong lúc rà các nơi gọi `/api/pallets` để đánh giá rủi ro, tìm ra một lỗi **không liên quan phân trang
nhưng cùng file API**:

`src/app/inventory/adjustments/new/page.tsx:63` gọi:

```ts
fetch(`${basePath}/api/pallets?status=IN_STORAGE,IN_STAGING`)
```

API xử lý `status` bằng `where.status = status` (gán thẳng chuỗi), nên `"IN_STORAGE,IN_STAGING"`
không phải giá trị enum hợp lệ → Prisma ném lỗi. Đo thực tế:

```
GET /api/pallets?status=IN_STORAGE,IN_STAGING
→ 500 {"success":false,"error":"Lỗi khi tải danh sách pallet."}
```

Vì `r.success` là `false` nên `setPallets` không bao giờ chạy → **ô chọn pallet trên màn lập phiếu
điều chỉnh tồn (UC-INV-09) luôn rỗng**. Người dùng không lập được phiếu điều chỉnh theo pallet.

Sửa rất rẻ (cùng file với Việc 1), nên gộp vào kế hoạch này — xem **Việc 5**.

---

## 1. Khảo sát đã làm để chọn phương án

Ba số liệu quyết định thiết kế bên dưới, đều đo trên app đang chạy với 230 pallet:

| Đo | Kết quả | Ảnh hưởng quyết định |
|---|---|---|
| Kích thước response `/api/pallets` (200 bản ghi) | **167 KB** | Không nâng trần lên 1000 (≈840 KB/lần tải trên mạng kho) → chọn phân trang server-side |
| Số màn dùng `useClientPagination` có `Suspense` | **2/32** | Không dùng `useSearchParams` trong hook (sẽ bắt buộc bọc `Suspense` cho 30 màn) |
| `history.replaceState` + `router.back()` có giữ query không | **Có** | Chọn lưu trang vào URL bằng History API thuần |

### Kiểm chứng cơ chế lưu trang vào URL

Chạy trực tiếp trên `/thukho/pallet`:

```js
history.replaceState(null, '', '?page=2&q=PL26')   // giả lập hook ghi URL
// → bấm vào 1 pallet → mở chi tiết
// → bấm "Quay lại" (BackLink dùng router.back())
location.pathname + location.search
// → "/thukho/pallet?page=2&q=PL26"   ✅ query được giữ nguyên
```

Tài liệu Next.js đi kèm dự án xác nhận cách này được hỗ trợ chính thức:
`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:343`
— *"Next.js allows you to use the native `window.history.pushState` and `window.history.replaceState`
methods… calls integrate into the Next.js Router"*.

→ **Ghi** URL bằng `history.replaceState` (không cần hook Next), **đọc** bằng `window.location.search`
trong effect sau khi mount (không cần `useSearchParams` → không cần `Suspense`).

---

## 2. Tổng quan 5 việc

| # | Việc | Mức | File chính | Đổi API? | Ước lượng |
|---|---|---|---|---|---|
| **1** | Phân trang server-side cho `/api/pallets` (opt-in, tương thích ngược) | 🔴 | `api/pallets/route.ts` | Có (thêm, không phá) | ~2.5h |
| **2** | Màn Thủ kho dùng phân trang server + debounce | 🔴 | `thukho/pallet/page.tsx` | Không | ~2.5h |
| **3** | Lưu trang + từ khoá vào URL trong `useClientPagination` | 🔴 | `ui/ListPagination.tsx` | Không | ~2h |
| **4** | Hook `useDebouncedValue` dùng chung + áp cho nhóm A | 🟡 | `lib/` + ~17 màn | Không | ~2h |
| **5** | Sửa `status` nhiều giá trị (mở lại màn phiếu điều chỉnh) | 🟡 | `api/pallets/route.ts` | Có (mở rộng) | ~30ph |

**Thứ tự đề xuất:** 5 → 3 → 1 → 2 → 4.

Lý do: Việc 5 rẻ nhất và mở lại một màn đang chết. Việc 3 sửa **một chỗ, 32 màn cùng hưởng** và không
phụ thuộc gì — làm sớm để có giá trị ngay. Việc 1+2 là cặp phải đi cùng nhau. Việc 4 làm cuối vì
chạm nhiều file nhưng mỗi file rất nhỏ.

---

## 3. Chi tiết từng việc

### Việc 5 — `status` nhận nhiều giá trị (làm trước, rẻ nhất)

**File:** `src/app/api/pallets/route.ts`

```ts
// Trước
if (status) { where.status = status; }

// Sau — hỗ trợ "IN_STORAGE,IN_STAGING"
if (status) {
  const list = status.split(",").map((s) => s.trim()).filter(Boolean);
  where.status = list.length > 1 ? { in: list } : list[0];
}
```

**Kiểm thử:**
```bash
curl "http://localhost:3003/thukho/api/pallets?status=IN_STORAGE,IN_STAGING"
```
Kỳ vọng 200 OK, `data.length > 0`. Rồi mở `/wms/inventory/adjustments/new` → ô chọn pallet phải có dữ liệu.

**Rủi ro:** thấp. Truyền 1 giá trị vẫn chạy y như cũ.

---

### Việc 3 — Lưu trang vào URL trong `useClientPagination`

**File:** `src/components/ui/ListPagination.tsx`

Sửa **một hook**, cả 32 màn cùng hết lỗi "bấm 1 pallet là mất trang".

**Thiết kế:**

```ts
export function useClientPagination<T>(
  items: T[],
  opts?: {
    initialLimit?: number;
    resetKey?: unknown;
    /** Bật lưu trang vào URL. Đặt key riêng nếu 1 trang có 2 bảng. */
    urlKey?: string | false;
  }
)
```

Luồng:
1. **Đọc lúc mount** — trong `useEffect` chạy 1 lần, đọc `new URLSearchParams(window.location.search)`
   lấy `page` / `limit`, `setPage`/`setLimit` nếu hợp lệ.
   *Bắt buộc đọc trong effect, không đọc lúc render* — đọc lúc render sẽ lệch hydration
   vì server render ra `page=1`.
2. **Ghi khi đổi** — trong effect theo dõi `page`/`limit`:
   ```ts
   const params = new URLSearchParams(window.location.search);
   page > 1 ? params.set(k("page"), String(page)) : params.delete(k("page"));
   limit !== initialLimit ? params.set(k("limit"), String(limit)) : params.delete(k("limit"));
   const qs = params.toString();
   window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
   ```
   Dùng `replaceState` (không phải `pushState`) để nút Back của điện thoại không phải bấm
   qua từng số trang mới thoát được màn hình.
3. **Bỏ qua lần reset đầu** — effect `setPage(1)` theo `resetKey` hiện chạy ngay lần mount đầu,
   sẽ ghi đè giá trị vừa đọc từ URL. Cần một `useRef` đánh dấu lần chạy đầu:
   ```ts
   const firstRun = useRef(true);
   useEffect(() => {
     if (firstRun.current) { firstRun.current = false; return; }
     setPage(1);
   }, [resetKey]);
   ```
   ⚠️ Đây là điểm dễ sai nhất của cả việc này.

**Mặc định:** `urlKey` bật sẵn (dùng tiền tố rỗng). Màn nào có 2 bảng thì truyền `urlKey: "b"`.
Màn nào không muốn thì truyền `urlKey: false`.

**Rủi ro & cách giảm:**
- Trang đọc từ URL có thể vượt `totalPages` khi dữ liệu đổi → effect kẹp trang sẵn có
  (`ListPagination.tsx:37-39`) đã xử lý.
- 2 màn đang dùng `useSearchParams` (`pallets/page.tsx`, `forklift/pallet/page.tsx`) — `replaceState`
  có đồng bộ với `useSearchParams` theo tài liệu Next, cần **test riêng 2 màn này** xem có vòng lặp
  render không.

**Kiểm thử:** trang 2 → mở 1 pallet → Quay lại → phải vẫn ở trang 2. Làm lại trên desktop `/wms/pallets`.

---

### Việc 1 — Phân trang server-side cho `/api/pallets`

**File:** `src/app/api/pallets/route.ts`

**Nguyên tắc: tương thích ngược tuyệt đối.** Client cũ không truyền `page` → hành vi y như hiện tại.

```ts
const pageParam = Number(searchParams.get("page"));
const usePaging = Number.isFinite(pageParam) && pageParam > 0;

if (usePaging) {
  const [rows, total] = await prisma.$transaction([
    prisma.pallet.findMany({ where, orderBy, include, skip: (pageParam - 1) * limit, take: limit }),
    prisma.pallet.count({ where }),
  ]);
  return NextResponse.json({
    success: true,
    data: mapped,
    kpis,
    pagination: { page: pageParam, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
// … nhánh cũ giữ nguyên
```

**Điểm cần lưu ý:**
- `orderBy: { created_at: "desc" }` hiện tại **không đảm bảo thứ tự ổn định** nếu nhiều pallet cùng
  `created_at` (seed hàng loạt, import). Phải thêm khoá phụ: `orderBy: [{ created_at: "desc" }, { id: "desc" }]`
  — nếu không, cùng một pallet có thể xuất hiện ở 2 trang hoặc biến mất.
- `total` trong `pagination` là **tổng sau khi lọc**, khác `kpis.TOTAL` (tổng toàn bảng).
  Chính chỗ lẫn lộn này gây ra "224 vs 200". Chân trang phải dùng `pagination.total`.
- Giữ `skip_kpis=1` để lúc gõ tìm kiếm không chạy `groupBy` toàn bảng.

**Kiểm thử:**
```bash
curl "http://localhost:3003/thukho/api/pallets?page=1&limit=10" | head -c 300
curl "http://localhost:3003/thukho/api/pallets?page=24&limit=10" | head -c 300
```
Trang 24 phải trả về pallet cũ nhất — chính là nhóm 30 pallet hiện không xem được.

---

### Việc 2 — Màn Thủ kho dùng phân trang server + debounce

**File:** `src/app/thukho/pallet/page.tsx`

Bốn thay đổi:

1. **Debounce ô tìm kiếm** — thêm `debouncedSearch`, dùng nó trong `fetchPallets` và `resetKey`
   thay cho `search` thô.
2. **Bỏ lọc client trùng lặp** — xoá khối `filtered` (dòng 81-86). Để server lọc một mình, tránh
   tình trạng server trả về rồi client giấu đi. Kèm theo mở rộng `q` phía server để tìm được cả
   **tên nhà cung cấp** (hiện chỉ có `code`, `note`, `location.code`) — đúng như placeholder của ô
   tìm kiếm đang hứa: *"Tìm theo mã pallet, NCC…"*.
3. **Chuyển sang phân trang server** — bỏ `useClientPagination`, tự quản `page`/`limit`, truyền
   `page`, `limit`, `skip_kpis` vào API, đọc `pagination` từ response, đưa vào `ListPageFooter`.
4. **Giữ trang trong URL** — vì không còn dùng hook ở Việc 3 nữa nên màn này phải tự ghi/đọc
   `?page=`. Dùng lại đúng cách làm ở Việc 3 để không lệch nhau.

> **Đánh đổi cần biết:** sau khi bỏ `useClientPagination`, màn này không hưởng lợi tự động từ Việc 3.
> Đây là cái giá của việc chuyển sang server-side. Đổi lại, xem được toàn bộ 230+ pallet và mỗi
> lần tải chỉ ~8 KB thay vì 167 KB.

**Kiểm thử:**
- Chân trang phải hiện `1 - 10 / 230 pallet` (không còn 200).
- Bấm tới trang cuối → phải mở được pallet cũ nhất.
- Gõ 4 ký tự liên tiếp → chỉ **1** request (hiện tại là 4).
- Đang ở trang 2 → gõ tìm kiếm → về trang 1 **sau khi ngừng gõ**, không phải theo từng ký tự.
- Trang 2 → mở 1 pallet → Quay lại → vẫn ở trang 2.

---

### Việc 4 — Hook `useDebouncedValue` dùng chung

**File mới:** `src/lib/use-debounced-value.ts`

Khuôn debounce hiện đang **chép tay 3 lần** (`inbound/page.tsx:105-109`, `inbound-adhoc`, `movements`),
và 17 màn khác thì thiếu hẳn. Gom lại:

```ts
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

Áp cho **nhóm A** — 17 màn có `resetKey` chứa ô tìm kiếm chưa debounce:

`forklift/pallet` · `forklift/history` · `inventory` · `inventory/adjustments` · `inventory/by-lot` ·
`inventory/by-pallet` · `kiemke/history` · `locations` · `outbound/requests` · `pallets` ·
`product-groups` · `suppliers` · `system/users` · `thukho/warehouse/inventory` ·
`thukho/warehouse/movements` · `units`

Mỗi màn chỉ 2 dòng: thêm `const dq = useDebouncedValue(search)` và thay `search` → `dq` trong `resetKey`.

**Nhóm B** — 5 màn dùng số lượng bản ghi làm `resetKey`, trang nhảy về 1 mỗi khi danh sách đổi
số lượng dù người dùng không làm gì:

| Màn | Hiện tại | Đề xuất |
|---|---|---|
| `stock-count:18` | `${sessions.length}` | `${filterStatus ?? ""}` hoặc `urlKey` + bỏ resetKey |
| `thukho/adhoc:22` | `${items.length}` | bỏ resetKey |
| `thukho/warehouse/queue:15` | `len-${queue.length}` | bỏ resetKey |
| `thukho/warehouse/stocktake:16` | `${sessions.length}` | bỏ resetKey |
| `outbound:74` | `${summary.total_pallets}` | bỏ resetKey |

Bỏ hẳn `resetKey` là an toàn vì hook đã có sẵn effect kẹp trang khi danh sách thu nhỏ.

---

## 4. Việc cần bạn quyết trước khi bắt tay

1. **Phạm vi Việc 2** — chỉ chuyển màn Thủ kho sang phân trang server-side, hay làm luôn cả
   `/wms/pallets` (desktop, cũng đang cắt 200)? Desktop màn hình to nên ít đau hơn, nhưng cùng lỗi.
2. **Việc 4** — làm hết 17 màn nhóm A một lượt, hay chỉ làm các màn Thủ kho / Xe nâng / Kiểm kê
   (mobile, nơi người dùng thật đang gặp) rồi để desktop lại sau?
3. **Hành vi khi quay lại** — giữ nguyên trang đang xem (đề xuất), hay bạn muốn luôn về trang 1
   cho "sạch"?
4. **Ngưỡng debounce** 300ms — giữ hay tăng lên 500ms cho mạng trong kho?

---

## 5. Rủi ro và cách kiểm soát

| Rủi ro | Mức | Cách giảm |
|---|---|---|
| Việc 3 chạm hook dùng chung cho 32 màn | 🔴 | Bật `urlKey` mặc định nhưng **test 5 màn đại diện** trước (thukho/pallet, pallets, inventory, movements, stock-count). Có thể tắt nhanh bằng `urlKey: false` từng màn |
| `firstRun` ref làm sai reset khi đổi bộ lọc | 🟡 | Test riêng: đổi tab/bộ lọc ở trang 3 phải về trang 1 |
| `replaceState` xung đột với `useSearchParams` ở 2 màn | 🟡 | Test riêng `pallets/page.tsx` và `forklift/pallet/page.tsx`, xem có render lặp không |
| Thứ tự không ổn định gây trùng/mất bản ghi giữa các trang | 🟡 | Thêm `id` làm khoá sắp xếp phụ (đã nêu ở Việc 1) |
| Đổi shape response API phá client cũ | 🟢 | Nhánh `page` là opt-in; không truyền `page` thì giữ nguyên hành vi |

**Hồi quy bắt buộc sau khi xong:** 10 màn gọi `/api/pallets` — `thukho/pallet`, `forklift/pallet`,
`forklift/relocate`, `forklift/return`, `inventory/adjustments/new`, `kiemke/history`, `pallets`,
`pallets/qr-print`, Dashboard Xe nâng, `UcHeader` (ô tìm kiếm trên thanh tiêu đề).

E2E có sẵn: `npm run e2e` (`e2e/pallets.spec.ts`).

---

## 6. Tóm tắt thay đổi theo file

| File | Việc | Loại |
|---|---|---|
| `src/app/api/pallets/route.ts` | 1, 5 | Nhánh phân trang server (opt-in), `status` nhiều giá trị, `q` tìm thêm tên NCC, khoá sắp xếp phụ |
| `src/components/ui/ListPagination.tsx` | 3 | Đọc/ghi `?page=`/`?limit=`, bỏ qua reset lần mount đầu |
| `src/app/thukho/pallet/page.tsx` | 2 | Debounce, bỏ lọc client, phân trang server, giữ trang trong URL |
| `src/lib/use-debounced-value.ts` | 4 | File mới |
| ~17 màn nhóm A + 5 màn nhóm B | 4 | Mỗi màn 1-2 dòng `resetKey` |

**Không đổi:** schema Prisma, migration, `api/forklift/*`.

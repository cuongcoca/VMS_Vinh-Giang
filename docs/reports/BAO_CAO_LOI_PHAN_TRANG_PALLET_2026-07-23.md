# Báo cáo lỗi — Phân trang Pallet tự nhảy về trang 1 (Thủ kho)

**Ngày:** 2026-07-23 · **Màn hình:** Thủ kho → 📦 Pallet của tôi (`/thukho/pallet`)
**Triệu chứng người dùng:** *"Ở trang từ thứ 2 trở đi, mỗi lần chỉ ấn được 1 pallet thì nó lại tự động trở về trang thứ nhất."*

---

## 1. Kết luận ngắn

Tái hiện được **100%**. Không phải một lỗi mà là **ba lỗi khác nhau chồng lên nhau** trên cùng màn hình,
cộng thêm một lỗi thứ tư khiến 30 pallet **không bao giờ xem được**.

| # | Lỗi | Mức |
|---|---|---|
| 1 | Bấm vào 1 pallet → quay lại → mất trang đang xem, về trang 1 | 🔴 Đúng thứ người dùng gặp |
| 2 | Gõ **mỗi 1 ký tự** vào ô tìm kiếm → về trang 1 ngay | 🔴 |
| 3 | Danh sách bị chặn 200 bản ghi → **30 pallet cuối không truy cập được** | 🔴 |
| 4 | Không debounce → mỗi ký tự gõ bắn 1 request + 1 lần đếm KPI toàn bảng | 🟡 |

Môi trường tái hiện: seed 230 pallet vào DB local, đúng bối cảnh kho thật (ảnh chụp của bạn: 224 pallet).

---

## 2. Lỗi 1 — Bấm 1 pallet là mất trang (đúng triệu chứng báo)

### Tái hiện
1. Vào `/thukho/pallet` → sang **trang 2** → chân trang hiện `11 - 20 / 200 pallet` ✅
2. Bấm vào 1 pallet bất kỳ → mở màn chi tiết
3. Bấm **Quay lại** → chân trang thành `1 - 10 / 200 pallet` ❌

### Nguyên nhân
Số trang đang lưu bằng `useState` trong chính trang danh sách
(`src/components/ui/ListPagination.tsx:26` — `const [page, setPage] = useState(1)`).

Nút Quay lại ở màn chi tiết dùng `router.back()`
(`src/components/mobile/BackLink.tsx:28`). Với Next.js App Router, quay lại = **mount lại**
component danh sách → toàn bộ state (số trang, từ khoá, bộ lọc) **bị xoá về mặc định**.

Không có gì lưu trạng thái ra ngoài component: không đẩy lên URL (`?page=2`), không sessionStorage.

→ Người dùng phải bấm lại số trang sau **mỗi một** pallet xem xong. Với 20 trang thì gần như không dùng được.

---

## 3. Lỗi 2 — Gõ 1 ký tự là về trang 1

### Tái hiện
Đang ở trang 2 (`11 - 20 / 200`) → gõ đúng **1 chữ "P"** → ngay lập tức `1 - 10 / 200`.

### Nguyên nhân
`src/app/thukho/pallet/page.tsx:102-105`:

```ts
const pg = useClientPagination(filtered, {
  resetKey: `${activeTab}|${search}|${filterFrom}|${filterTo}|${filterSupplier}`,
});
```

`resetKey` chứa **`search` thô** (chưa debounce). Trong hook:

```ts
useEffect(() => { setPage(1); }, [resetKey]);   // ListPagination.tsx:32-34
```

→ Mỗi lần state `search` đổi (tức mỗi ký tự) là `setPage(1)`.

### Lưu ý khi sửa
Về trang 1 khi **kết thúc** một lượt tìm kiếm là **đúng** — kết quả đổi thì trang cũ có thể không còn.
Cái sai là reset theo **từng ký tự** thay vì theo từ khoá đã ổn định.

Trong repo đã có sẵn cách làm đúng — 3 màn hình khác dùng giá trị đã debounce:

| Màn hình | resetKey |
|---|---|
| `src/app/inbound/page.tsx:217` | `${debouncedQuery}\|...` ✅ |
| `src/app/inbound-adhoc/page.tsx:68` | `${debouncedQuery}\|...` ✅ |
| `src/app/movements/page.tsx:101` | `...\|${debouncedQ}` ✅ |
| **`src/app/thukho/pallet/page.tsx:104`** | `...\|${search}\|...` ❌ |

---

## 4. Lỗi 3 — 30 pallet không xem được

### Bằng chứng
Ảnh chụp của bạn: đầu trang ghi **"224 pallet"**, chân trang ghi **"1 - 10 / 200 pallet"**, trang cuối là **20**.

Tái hiện tại local với 230 pallet:

```
header = 230 pallet · Mã sinh    ← kpis.TOTAL, đếm toàn bảng
footer = 1 - 10 / 200 pallet     ← danh sách thật, bị cắt
```

### Nguyên nhân
`src/app/api/pallets/route.ts` lấy tối đa **200** bản ghi (`take: limit`, mặc định 200),
trong khi KPI `TOTAL` lại `groupBy` **toàn bộ** bảng.

Màn Thủ kho gọi API **không truyền `limit`** (`thukho/pallet/page.tsx:64`) → nhận đúng 200 dòng,
rồi phân trang **client-side** trên 200 dòng đó.

→ Kho 230 pallet thì **30 pallet cũ nhất không có cách nào mở được** từ màn hình này — kể cả bấm hết 20 trang.
Với kho của bạn (224) là **24 pallet**.

Hai con số lệch nhau ngay trên cùng một màn hình cũng khiến người dùng nghi ngờ dữ liệu.

---

## 5. Lỗi 4 — Mỗi ký tự gõ là một request

Đo thực tế khi gõ `P` → `PL` → `PL2` → `PL26`:

```
GET /thukho/api/pallets?q=P     → 200 OK
GET /thukho/api/pallets?q=PL    → 200 OK
GET /thukho/api/pallets?q=PL2   → 200 OK
GET /thukho/api/pallets?q=PL26  → 200 OK
```

4 ký tự = 4 request. Mỗi request còn kèm một `groupBy` đếm KPI trên **toàn bộ** bảng pallet
(`api/pallets/route.ts`, khối `allPallets`) — trong khi màn hình chỉ cần KPI một lần lúc mở trang.

Trên mạng 3G/4G trong kho, đây là nguyên nhân chính gây giật và hiện kết quả nhấp nháy.

### Kèm theo: lọc hai lần, hai tiêu chí khác nhau

- **Server** (`api/pallets/route.ts`) tìm theo: `code`, `note`, `location.code`
- **Client** (`thukho/pallet/page.tsx:81-86`) lọc lại theo: `code`, `supplier.name`

→ Pallet khớp `note` hoặc mã kệ được server trả về nhưng bị client lọc bỏ; ngược lại pallet khớp
tên NCC lại không được server trả về. Kết quả tìm kiếm không đoán trước được.

---

## 6. Phạm vi — không chỉ màn Pallet

`useClientPagination` đang dùng ở **32 màn hình**. Hai nhóm có cùng vấn đề:

**Nhóm A — resetKey chứa ô tìm kiếm chưa debounce** (gõ 1 ký tự là về trang 1):

`thukho/pallet` · `forklift/pallet` · `forklift/history` · `inventory` · `inventory/adjustments` ·
`inventory/by-lot` · `inventory/by-pallet` · `kiemke/history` · `locations` · `outbound/requests` ·
`pallets` · `product-groups` · `suppliers` · `system/users` · `thukho/warehouse/inventory` ·
`thukho/warehouse/movements` · `units`

**Nhóm B — resetKey là số lượng bản ghi** (`${items.length}`): trang nhảy về 1 mỗi khi danh sách
đổi số lượng, kể cả do tự động tải lại:

`stock-count:18` · `thukho/adhoc:22` · `thukho/warehouse/queue:15` · `thukho/warehouse/stocktake:16` ·
`outbound:74` (dùng `summary.total_pallets`)

**Lỗi 1 (mất trang khi quay lại)** thì ảnh hưởng **cả 32 màn** — vì không màn nào lưu số trang ra ngoài component.

---

## 7. Đề xuất sửa

| # | Việc | Mức | Phạm vi | Ghi chú |
|---|---|---|---|---|
| 1 | Bỏ trần 200 cho màn Thủ kho: truyền `limit` lớn hơn, hoặc chuyển sang phân trang **server-side** | 🔴 | `api/pallets` + `thukho/pallet` | Sửa gốc; phân trang server-side là hướng đúng lâu dài |
| 2 | Debounce ô tìm kiếm (~300ms) và đưa **giá trị đã debounce** vào `resetKey` | 🔴 | `thukho/pallet` trước, rồi nhóm A | Có sẵn khuôn ở `inbound/page.tsx` |
| 3 | Lưu số trang + từ khoá vào URL (`?page=2&q=...`) để quay lại không mất | 🔴 | `useClientPagination` | Sửa một chỗ, 32 màn cùng hưởng |
| 4 | Bỏ lọc client trùng lặp, để server lọc; hoặc cho server tìm thêm theo tên NCC | 🟡 | `thukho/pallet` + `api/pallets` | Cho kết quả tìm kiếm nhất quán |
| 5 | Thêm `skip_kpis=1` cho các lần gọi khi đang gõ | 🟡 | `thukho/pallet` | Tham số đã có sẵn từ lần sửa trước |
| 6 | Nhóm B: đổi `resetKey` từ `items.length` sang bộ lọc thật | 🟡 | 5 màn | |

**Gợi ý thứ tự:** 1 → 2 → 3. Ba việc này giải quyết trọn vẹn triệu chứng người dùng báo.
Việc 3 đáng làm nhất về lâu dài vì sửa trong `useClientPagination` là 32 màn cùng hết lỗi.

---

## 8. Ghi chú môi trường

DB local hiện có **230 pallet** (5 pallet demo gốc + 225 pallet sinh thêm để tái hiện, mã `PL*.5xx`,
ghi chú `Pallet test phân trang #N`). Script seed chỉ nằm ở thư mục tạm, **không đưa vào repo**.

Xoá dữ liệu test khi không cần nữa:

```sql
DELETE FROM pallet_lines WHERE pallet_id IN (SELECT id FROM pallets WHERE note LIKE 'Pallet test phân trang%');
DELETE FROM pallets WHERE note LIKE 'Pallet test phân trang%';
```

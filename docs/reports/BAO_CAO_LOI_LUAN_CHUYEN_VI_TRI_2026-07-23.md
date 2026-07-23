# Báo cáo lỗi — "Luân chuyển vị trí báo không có hàng" (UC-FK-03)

**Ngày:** 2026-07-23 · **Người báo:** vận hành kho · **Màn hình:** Xe nâng → Luân chuyển
**Triệu chứng:** `Pallet "B-24-02" không tồn tại.` — trong khi kệ B-24-02 đang có hàng thật.

---

## 1. Kết luận ngắn

**Chức năng luân chuyển vị trí CÓ tồn tại và backend chạy đúng.** Tôi đã chạy thử thành công:
`Pallet PL260520.001: A-02-01 → A-03-01` (có ghi Movement + audit log + thông báo cho Thủ kho).

Lỗi nằm ở **cách chọn pallet trên giao diện**, không phải ở nghiệp vụ chuyển kho.

**Nguyên nhân trực tiếp:** người dùng quét **QR dán trên kệ** (mã vị trí `B-24-02`) vào ô **PALLET**.
Ô này chỉ tra bảng pallet → không có pallet nào tên `B-24-02` → báo "không tồn tại".

**Đã tái hiện 100%** trên môi trường local:

```
GET /api/pallets/by-code?code=A-02-01
→ {"success":false,"error":"Pallet \"A-02-01\" không tồn tại."}
```

Y hệt thông báo trong ảnh chụp màn hình, chỉ khác mã vị trí.

---

## 2. Bằng chứng pallet đó thực sự hợp lệ

Ảnh màn hình FEFO cho thấy `PL260717.012` · vị trí `B-24-02` · 40 thùng · HSD 11/7/2029 · nhãn "Bình thường".

Màn hình FEFO gọi `/api/forklift/fefo-suggest`, mà API này **chỉ trả pallet có `status = IN_STORAGE`**
(`src/app/api/forklift/fefo-suggest/route.ts:14`). Điều kiện của luân chuyển cũng đúng là `IN_STORAGE`
(`src/app/api/forklift/relocate/route.ts:38`).

→ Pallet này **đủ điều kiện luân chuyển**. Không phải lỗi dữ liệu, không phải lỗi trạng thái.

---

## 3. Bốn lỗi thiết kế đứng sau (đây mới là thứ cần sửa)

### 3.1 🔴 Ô "Pallet" không nhận diện được mã vị trí — dù hệ thống đã có sẵn công cụ

`src/app/forklift/relocate/page.tsx:229` — khi quét QR vào ô Pallet, code chỉ gọi:

```ts
fetch(`${basePath}/api/pallets/by-code?code=${encodeURIComponent(code)}`)
```

Nếu không thấy → in thẳng `Pallet "..." không tồn tại.` Không hề kiểm tra xem chuỗi vừa quét
có phải **mã vị trí** hay không.

**Nghịch lý:** hệ thống ĐÃ có sẵn API thông minh làm đúng việc này —
`POST /api/scan/resolve` (UC-INT-01) tự phân biệt Location → Pallet → ItemCode → Barcode → Phiếu nhập,
và khi gặp mã vị trí còn **trả kèm danh sách pallet đang nằm ở đó**:

```ts
if (loc) return NextResponse.json({ success: true, type: "location",
  data: { ...loc, current_pallets_count: loc.pallets.length } });
```

Nhưng grep toàn repo: **không màn hình nào gọi `/api/scan/resolve`** — endpoint chết hoàn toàn.

Nếu ô Pallet dùng resolver này, quét `B-24-02` sẽ ra: *"Đây là vị trí B-24-02, có 1 pallet: PL260717.012 — chọn?"*
Đúng bằng đúng thao tác thực tế của người lái xe nâng.

### 3.2 🔴 Danh sách pallet bị cắt ở 200 bản ghi và không có ô tìm kiếm

`src/app/api/pallets/route.ts` — truy vấn danh sách kết thúc bằng `take: 200`, sắp xếp `created_at desc`.
Màn hình luân chuyển nạp toàn bộ danh sách này vào một `<select>` thuần (`relocate/page.tsx:70`):

```ts
fetch(`${basePath}/api/pallets?status=IN_STORAGE`)
```

Hệ quả trong kho thật:
- Pallet cũ hơn 200 pallet gần nhất **biến mất khỏi dropdown**. `PL260717.012` tạo ngày 17/7, nếu từ đó
  đến nay đã tạo hơn 200 pallet thì nó không có trong danh sách → đúng cảm giác **"báo không có hàng"**.
- `<select>` không gõ tìm được, không phân trang → dù còn trong danh sách cũng rất khó tìm giữa 200 dòng
  trên màn hình điện thoại.

**Cách kiểm chứng trên VPS** — chạy câu này, nếu kết quả > 200 thì lỗi này chắc chắn đang xảy ra:

```sql
SELECT COUNT(*) FROM pallets WHERE status = 'IN_STORAGE';
```

Và kiểm tra riêng pallet đang nghi ngờ:

```sql
SELECT p.code, p.status, l.code AS vi_tri,
       (SELECT COUNT(*) FROM pallets x
         WHERE x.status='IN_STORAGE' AND x.created_at > p.created_at) AS so_pallet_moi_hon
FROM pallets p LEFT JOIN locations l ON l.id = p.location_id
WHERE p.code = 'PL260717.012';
```

Nếu `so_pallet_moi_hon >= 200` → pallet bị đẩy ra khỏi dropdown.

### 3.3 🟡 Màn hình Luân chuyển bỏ qua tham số `?pallet_id=` từ Dashboard

`src/components/forklift/ForkliftMobileDashboard.tsx:203` tạo link:

```ts
if (activeTab === "RELOCATE") return `/forklift/relocate?pallet_id=${palletId}`;
```

Nhưng `src/app/forklift/relocate/page.tsx` **không có `useSearchParams`** (grep = 0 kết quả),
trong khi hai màn hình anh em thì có:

| Màn hình | Đọc `?pallet_id=` |
|---|---|
| `forklift/put-away/page.tsx:24-25` | ✅ |
| `forklift/return/page.tsx` | ✅ |
| **`forklift/relocate/page.tsx`** | ❌ **thiếu** |

→ Bấm một nhiệm vụ "Luân chuyển" từ danh sách ở Trang chủ thì sang màn hình mới ô Pallet **vẫn rỗng**,
người dùng phải tự dò lại trong dropdown 200 dòng. Đây là con đường tự nhiên nhất mà lại đứt.

### 3.4 🟡 Thông báo lỗi không hướng dẫn

Hiện tại: `Pallet "B-24-02" không tồn tại.` — cụt, khiến người dùng kết luận "kho không có hàng".

Đúng ra nên là: *"B-24-02 là mã vị trí, không phải mã pallet. Vị trí này đang có 1 pallet: PL260717.012. Chọn?"*

---

## 4. Vì sao rất dễ mắc lỗi này

- QR vị trí và QR pallet **đều là plain text**, không có tiền tố phân biệt:
  - `api/locations/[id]/qr-png` → nội dung = `B-24-02`
  - `api/pallets/[id]/qr-png` → nội dung = `PL260717.012`
- Trên form, hai ô Pallet và Vị trí mới có **nút "Quét QR" trông giống hệt nhau**.
- Người lái xe nâng đứng trước kệ thì thứ nhìn thấy và quét được ngay là **nhãn dán trên kệ**.
- Nếu pallet trong kho **chưa được dán nhãn QR in ra** (`/pallets/qr-print`), thì không còn cách nào
  chọn pallet ngoài dropdown — quay lại đúng vấn đề §3.2.

---

## 5. Đề xuất sửa, theo thứ tự

| # | Việc | Mức | Ghi chú |
|---|---|---|---|
| 1 | Ô Pallet chuyển sang gọi `/api/scan/resolve` thay vì `pallets/by-code`; nếu `type = "location"` thì hiện danh sách pallet tại vị trí đó để chọn | 🔴 Cao | API đã có sẵn, chỉ cần đấu nối — sửa ít, hiệu quả lớn nhất |
| 2 | Thay `<select>` bằng ô tìm kiếm có gợi ý (server-side search), bỏ giới hạn 200 | 🔴 Cao | Hoặc tối thiểu: truyền `q` xuống `/api/pallets` khi người dùng gõ |
| 3 | Thêm `useSearchParams` đọc `?pallet_id=` vào `relocate/page.tsx` | 🟡 Vừa | Copy y hệt `put-away/page.tsx:24-25` |
| 4 | Viết lại thông báo lỗi có hướng dẫn | 🟡 Vừa | |
| 5 | Cân nhắc thêm luồng "Quét kệ → xem pallet trên kệ → chọn việc" cho Xe nâng | 🟢 Thấp | Đúng thói quen vận hành thực tế hơn |
| 6 | Rà soát xem pallet trong kho đã dán nhãn QR chưa | 🟢 Thấp | Việc vận hành, không phải code |

**Lưu ý:** không đụng vào `api/forklift/relocate/route.ts` — phần backend đã đúng và đầy đủ
(validate trạng thái, trùng vị trí, bảo trì, không phải vị trí chứa, quá số pallet, quá tải trọng,
ghi Movement + audit log + thông báo Thủ kho).

---

## 6. Ghi chú phụ (chỉ ảnh hưởng môi trường demo local)

Seed `prisma/seed-forklift.ts` tạo `STG-IN-01/02` và `STG-OUT-01/02` với `type = STORAGE` thay vì
`INBOUND_STAGING` / `OUTBOUND_STAGING`. Hệ quả: dropdown "Vị trí mới" ở local hiện cả khu chờ nhập/chờ xuất
như thể là vị trí chứa. Không ảnh hưởng dữ liệu thật trên VPS, nhưng nên sửa seed để demo phản ánh đúng.

# BÁO CÁO LỖI — Tồn kho theo mã (Thủ kho mobile) thiếu mã hàng & tên

**Ngày:** 16/06/2026
**Trang lỗi:** `https://khohangvinhgiang.io.vn/thukho/warehouse/inventory` — "Tồn kho theo mã"
**File:** `src/app/thukho/warehouse/inventory/page.tsx`
**Mức độ:** Cao (màn hình không dùng được — không biết đang xem mã hàng nào)
**Loại lỗi:** Lệch hợp đồng dữ liệu Frontend ↔ Backend (field name drift)

---

## 1. Hiện tượng
Trên màn "Tồn kho theo mã" của vai trò **Thủ kho**, mỗi thẻ chỉ hiển thị 3 con số
**Tổng / Khả dụng / Chờ xuất**, còn **mã hàng và tên hàng bị trống**. Người dùng nhìn vào
không biết mỗi dòng là sản phẩm nào. Ô "Tìm mã hàng, tên..." cũng **không lọc được**.

> Đây KHÔNG phải lỗi thiếu/chưa đồng bộ dữ liệu: số liệu tồn kho vẫn về đủ và đúng.
> Vấn đề là phần nhãn (mã + tên) không hiển thị.

## 2. Nguyên nhân gốc
Trang đọc dữ liệu theo **tên trường sai** so với dữ liệu API trả về.

| Thông tin | Trang mobile đang đọc (SAI) | API `/api/inventory/by-item` trả về (ĐÚNG) |
|---|---|---|
| Mã hàng | `item.code` | `item_code` |
| Tên hàng | `item.name` / `item.short_name` | `item_name` |
| Khoá/định danh | `item.id` | `item_code_id` |
| Tổng tồn | `item.total_qty` ✅ | `total_qty` |
| Khả dụng | `item.available_qty` ✅ | `available_qty` |
| Chờ xuất | `item.staging_qty` ✅ | `staging_qty` |

Vì 3 trường số (`total_qty`, `available_qty`, `staging_qty`) **tình cờ trùng tên** nên vẫn hiện;
còn `code`, `name`, `id` **không khớp** nên trả về `undefined` → ô trống. Ô tìm kiếm cũng lọc theo
`i.code` / `i.name` (sai) nên luôn rỗng.

## 3. Bằng chứng — trang desktop làm ĐÚNG
Cùng gọi API `/api/inventory/by-item`, nhưng trang desktop `src/app/inventory/page.tsx`
khai báo và đọc đúng tên trường:

```
type InventoryItem = { item_code_id: string; item_code: string; item_name: string; ... }
... {d.item_code} ... {d.item_name} ...   // hiển thị đầy đủ, bình thường
```

→ Khẳng định: **API đúng**, **trang desktop đúng**, chỉ **trang mobile thủ kho sai tên trường**.
Lỗi này thuộc nhóm "drift" frontend/backend (giao diện sửa lệch khỏi hợp đồng API).

## 4. Phạm vi ảnh hưởng
- Chỉ ảnh hưởng màn **Thủ kho mobile → Kho hàng → Tồn kho theo mã**.
- Không ảnh hưởng số liệu tồn kho (dữ liệu vẫn đúng), không ảnh hưởng trang desktop.
- Hệ quả: thủ kho không tra cứu được tồn theo mã trên điện thoại, không tìm kiếm được.

## 5. Cách khắc phục (sửa đúng 1 file)
Sửa `src/app/thukho/warehouse/inventory/page.tsx`, đổi tên trường cho khớp API:

| Vị trí | Sửa từ | Thành |
|---|---|---|
| Ô tìm kiếm (filter) | `i.code` , `i.name` | `i.item_code` , `i.item_name` |
| `key` của thẻ | `item.id \|\| item.code` | `item.item_code_id \|\| item.item_code` |
| Hiển thị mã | `{item.code}` | `{item.item_code}` |
| Hiển thị tên | `{item.name \|\| item.short_name}` | `{item.item_name}` |

Các trường số (`total_qty`, `available_qty`, `staging_qty`) giữ nguyên — đã đúng.

## 6. Khuyến nghị
- Sửa ngay trường hợp này (1 file, rủi ro thấp).
- Về lâu dài nên **dùng chung 1 type/`interface`** cho `InventoryItem` giữa desktop và mobile
  (import từ một file dùng chung) để không lệch tên trường nữa.
- Rà soát các màn mobile khác cùng kiểu (xe nâng, kiểm kê) xem có lệch tên trường tương tự không.

---
*Báo cáo tạo tự động sau khi soi mã nguồn `origin/main` (bản đang chạy production).*

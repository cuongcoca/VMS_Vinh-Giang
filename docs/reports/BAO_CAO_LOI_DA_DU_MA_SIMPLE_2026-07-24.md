# Báo cáo — Mã 467 (SIMPLE) báo "đã đủ" khi mới nhập 6/12 thùng

**Ngày:** 2026-07-24 · **Phiếu:** PHN-2026-0109 · **Mã:** 64999467 (114SIMPLE Gel Rửa Mặt Micellar 150ml)
**Triệu chứng:** *"Tổng 12 thùng, mới nhập 6, khi nhập nốt 6 còn lại thì báo 'đã đủ' trong khi mới nhập 6."*

> ## ✅ ĐÃ LÀM CẢI THIỆN — 2026-07-24
>
> Chốt: làm badge "đã đủ" **bấm được → hiện danh sách pallet đang chứa mã + SL từng pallet**,
> để thủ kho tự soi "12 nằm ở đâu" và sửa.
>
> **Thêm 1 API + sửa 1 màn:**
> - `GET /api/pallets/by-item?item_code_id=&inbound_request_id=` — liệt kê pallet (chưa hủy) của phiếu chứa mã, kèm SL/trạng thái/vị trí.
> - `thukho/pallet/[id]`: khối "đã lên N thùng" giờ có link **"Xem N thùng đang ở pallet nào →"** → modal liệt kê pallet, mỗi dòng bấm mở được pallet đó.
>
> | Kiểm chứng trên app thật (dựng 2 pallet 6+6 = 12 → "đã đủ") | Kết quả |
> |---|---|
> | Chọn mã → panel hiện "ĐK 12 · đã lên 12 · còn 0 ✓" + link | ✅ đúng ca của user |
> | Bấm "Xem 12 thùng đang ở pallet nào →" | Modal: **PLDADU.001 — 6 thùng**, **PLDADU.002 (A-02-03) — 6 thùng** · Tổng 12 |
> | Bấm 1 pallet trong modal | Mở đúng trang pallet đó để soi/sửa |
>
> `npx tsc` sạch, API mới lint sạch, không phát sinh lỗi mới, không đụng công thức cũ.
>
> → Giờ khi báo "đã đủ", thủ kho bấm là biết ngay số đó nằm ở pallet nào, phát hiện pallet trùng/nhầm và sửa.
>
> Phần dưới là báo cáo phân tích ban đầu.

---

## 1. Kết luận — phép tính KHÔNG sai; hệ thống đang thấy 12 thùng thật trên pallet

Badge **"đã đủ ✓"** = `SL còn lại = SL dự kiến − SL đã lên pallet ≤ 0`. Nó báo "đã đủ" **chỉ khi tổng thùng của mã đó trên các pallet của phiếu ≥ 12**.

**Đã kiểm chứng phép tính** (dựng phiếu dự kiến 12, để 6 lên 1 pallet):
```
dự kiến 12 · trên pallet 6 · CÒN LẠI = 6   → badge hiện "còn 6" (KHÔNG phải "đã đủ")
```
→ Khi thực sự chỉ có 6 trên pallet, hệ thống hiện "còn 6" đúng. Badge chỉ ra "đã đủ" khi **trên pallet đã là 12**.

**Nghĩa là:** ở phiếu 0109, tổng thùng của mã 467 nằm trên các pallet (chưa hủy) **đang là 12**, không phải 6. Ảnh đối chiếu cũng khớp: cột "Lấy **12** từ pallet" = đã lên pallet 12; ô "Thực nhận" còn trống nên "Chênh lệch −12".

---

## 2. Vì sao lại thành 12 khi anh/chị chỉ nhớ nhập 6

Điểm mấu chốt trong ảnh đối chiếu: **mọi mã đều có "đã lên pallet" = đúng bằng "dự kiến"** (4=4, 14=14, 12=12, 20=20). Đây không phải con số đếm thực tế ngẫu nhiên — nó cho thấy pallet được nhập **theo số DỰ KIẾN trên chứng từ**, không phải số thực đếm. Ba khả năng (cần tra để chốt):

| Khả năng | Dấu hiệu |
|---|---|
| **A. Mã 467 nằm trên 2 pallet** (6 + 6) | Ngoài PL260723.008 còn 1 pallet khác cùng phiếu chứa mã này |
| **B. Một pallet nhập nhầm 12** (gõ 12 thay vì 6, hoặc quét 2 lần) | PL260723.008 (hoặc pallet chứa mã) có đúng 12 thùng mã 467 |
| **C. Nhập theo số chứng từ (12) rồi thực nhận mới có 6** | Thủ kho xếp 12 lên pallet theo hóa đơn, nhưng hàng về thực chỉ 6 |

Hệ thống coi **"đã xếp lên pallet = đã nhận"**, nên dù hàng thực về 6, khi pallet ghi 12 thì vẫn tính đủ 12.

> Lưu ý: code **hiện tại** đã BỎ việc tự sao chép toàn bộ dòng phiếu vào pallet (mỗi pallet bắt đầu trống). Nếu bản trên VPS còn cũ (từng auto-fill số dự kiến vào pallet đầu), thì đây chính là nguồn của "12" — cần cập nhật bản mới.

---

## 3. Cách xác định chính xác (chạy trên VPS)

Tra xem mã 467 của phiếu 0109 đang nằm ở pallet nào, mỗi pallet bao nhiêu:

```sql
SELECT p.code AS pallet, p.status, pl.qty_box, l.code AS vi_tri
FROM pallet_lines pl
JOIN pallets p         ON p.id = pl.pallet_id
JOIN item_codes ic     ON ic.id = pl.item_code_id
LEFT JOIN locations l  ON l.id = p.location_id
WHERE ic.code = '64999467'
  AND p.inbound_request_id = (SELECT id FROM inbound_requests WHERE code = 'PHN-2026-0109')
  AND p.status <> 'CANCELLED'
ORDER BY p.code;
```

- Ra **2 dòng 6 + 6** → khả năng A (mã nằm 2 pallet).
- Ra **1 dòng 12** → khả năng B (nhập nhầm 12).

Cùng lúc, trong app: mở lần lượt các pallet của phiếu 0109, xem dòng mã 467 để đối chiếu.

---

## 4. Cách xử lý ngay + đề xuất phòng ngừa

**Xử lý ngay (nghiệp vụ):**
- Nếu 1 pallet ghi 12 mà thực chỉ 6 → **sửa dòng đó về 6** (pallet đang COUNTING/EMPTY sửa trực tiếp; đã xác nhận thì mở khóa/hoàn trả theo quyền). Sau đó badge sẽ hiện "còn 6", nhập nốt 6 được.
- Nếu 2 pallet mỗi cái 6 (tổng 12 đã đúng thực tế) → thực ra **đã đủ 12 rồi**, không cần nhập thêm; con số "mới nhập 6" là do một pallet bị quên.

**Đề xuất cải thiện (để không tái diễn / dễ tự xử):**
1. **Badge "đã đủ" nên bấm được → hiện danh sách pallet đang chứa mã đó + SL từng pallet**, để thủ kho thấy ngay "12 nằm ở đâu" và sửa. Hiện badge chỉ báo "đã đủ" mà không nói ở đâu → gây bối rối đúng như phản ánh.
2. **Không để pallet nhận số dự kiến làm mặc định** — đảm bảo bản VPS đã có phiên bản "pallet bắt đầu trống" (đã có trong code hiện tại).
3. Cân nhắc **cảnh báo khi tổng lên pallet vượt dự kiến** ngay lúc thêm dòng (không chỉ ở màn đối chiếu).

---

## 5. Cần bạn xác nhận

1. Chạy câu SQL ở mục 3 (hoặc mở các pallet của phiếu 0109) và cho mình biết mã 467 đang nằm **1 pallet 12 thùng** hay **2 pallet 6+6** — để chốt đúng khả năng A/B/C.
2. Có muốn mình làm cải thiện **#1 (badge "đã đủ" bấm ra được danh sách pallet chứa mã + SL)** để lần sau tự soi và sửa nhanh không?

> Ghi chú: phép tính badge và đối chiếu đã được kiểm chứng đúng trên máy local (dựng phiếu dự kiến 12 / để 6 → hiện "còn 6"). Đây là vấn đề **dữ liệu số lượng trên pallet**, không phải lỗi công thức.

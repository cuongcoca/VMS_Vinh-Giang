# Báo cáo — Số hóa đơn trên phiếu nhập (PHN) cho Thủ kho tìm nhanh

**Ngày:** 2026-07-24 · **Màn hình gặp:** Thủ kho → Nhập kho → "Phiếu cần tiếp nhận" (`/thukho/inbound`)
**Yêu cầu:** *"Ở PHN chèn thêm phần số hóa đơn để bộ phận thủ kho tìm và thao tác nhập nhanh."*

> ## ✅ ĐÃ THỰC HIỆN XONG — 2026-07-24
>
> Chốt của chủ dự án: 1) làm luôn cột "Số HĐ" desktop · 2) tìm qua API · 3) một ô tìm chung.
>
> | Thay đổi | Kiểm chứng trên app thật |
> |---|---|
> | **Thủ kho**: mỗi thẻ phiếu hiện `🧾 HĐ: …` | PHN-2026-0092 hiện "HĐ: HD0034521" |
> | **Thủ kho**: ô tìm chung (số HĐ hoặc mã PHN) qua `/api/inbound?q=` debounce | Gõ "778" → ra phiếu HĐ VNM-778123; gõ "0092" → ra đúng mã |
> | **Thủ kho**: số badge từng tab đổi theo kết quả tìm | "778" → Đang chuẩn bị (1), Hoàn tất (1) — chỉ đúng tab có phiếu |
> | **Desktop**: thêm cột "Số HĐ" vào bảng | Cột hiện VNM-778001, HD0034518… |
> | **Desktop**: placeholder nhắc "số hóa đơn" + cột trong Excel export | Tìm "778" ra đúng 2 phiếu |
>
> Sửa **2 file** (`thukho/inbound/page.tsx`, `inbound/page.tsx`), tận dụng `useDebouncedValue` sẵn có.
> `npx tsc --noEmit` sạch, không lỗi console, lint không phát sinh lỗi mới.
> **Không** đụng schema/API/migration — dữ liệu `invoice_no` vốn đã có sẵn.
>
> Phần dưới là báo cáo phân tích ban đầu.

---

## 1. Tin tốt — dữ liệu số hóa đơn ĐÃ CÓ SẴN, chỉ thiếu ở đúng màn này

Số hóa đơn không phải làm mới từ đầu. Cột `invoice_no` đã có trong hệ thống từ 2026-06-08 và đang được dùng ở nhiều nơi:

| Nơi | Số hóa đơn đã có? | Bằng chứng |
|---|---|---|
| **Cơ sở dữ liệu** | ✅ | `inbound_requests.invoice_no` (migration `2026-06-08_inbound_invoice_no.sql`) |
| **Form lập phiếu (Kế toán)** | ✅ | Ô "Số hoá đơn" **bắt buộc** khi tạo PHN (`inbound/new/page.tsx:589`) |
| **API tìm kiếm** | ✅ | `/api/inbound?q=...` đã tìm theo `invoice_no` (`api/inbound/route.ts:49`) |
| **Chi tiết phiếu Thủ kho** | ✅ | Màn tiếp nhận hiện "Số hoá đơn: …" (`thukho/inbound/[id]/page.tsx:251`) |
| **Danh sách tiếp nhận Thủ kho** ⭐ | ❌ **THIẾU** | Đúng màn trong ảnh — xem mục 2 |

→ Việc cần làm là **UI trên một màn**, không đụng dữ liệu, không migration.

---

## 2. Thiếu gì ở màn Thủ kho (ảnh bạn gửi)

`src/app/thukho/inbound/page.tsx` — màn "Phiếu cần tiếp nhận":

**a) Thẻ phiếu KHÔNG hiện số hóa đơn.** Mỗi thẻ hiện: mã PHN, tên NCC, số mã hàng, ngày dự kiến, người lập. Không có số hóa đơn — dù API đã trả về. Kiểu dữ liệu `InboundItem` (dòng 8-19) thậm chí không khai báo trường `invoice_no`, nên component không đọc tới.

**b) KHÔNG có ô tìm kiếm.** Màn này tải toàn bộ phiếu rồi lọc theo tab (Chờ tiếp nhận / Đang chuẩn bị / Hoàn tất). Thủ kho không gõ tìm được — trong ảnh có **84 phiếu** ở tab "Đang chuẩn bị", muốn tìm đúng một phiếu theo hóa đơn phải cuộn tay qua từng thẻ.

Đây chính là điểm khiến "thao tác nhập chậm": hàng về kèm tờ hóa đơn giấy, thủ kho cầm số hóa đơn trên tay nhưng trên app chỉ tra được theo mã PHN.

---

## 3. Đề xuất — hiển thị + tìm theo số hóa đơn ngay trên màn Thủ kho

**a) Hiện số hóa đơn trên mỗi thẻ phiếu.** Thêm một dòng nhỏ dưới tên NCC, vd:

```
PHN-2026-0092                    [Mới]
Cty Quốc Tế Unilever Việt Nam · 12 mã
🧾 HĐ: 0034521          📅 Dự kiến 17/07
```

Thủ kho liếc là thấy hóa đơn khớp với tờ giấy đang cầm.

**b) Thêm ô tìm kiếm** phía trên danh sách — gõ **số hóa đơn** hoặc **mã PHN** là lọc ngay. Đặt placeholder rõ: *"Tìm theo số hóa đơn hoặc mã phiếu…"*. Có hai cách làm:

| Cách | Ưu | Nhược |
|---|---|---|
| **Lọc tại máy (client)** — *đề xuất* | Đơn giản, tức thì, không đổi API; màn này vốn đã tải sẵn cả danh sách (≤200 phiếu, ảnh cho thấy ~90) | Nếu vượt 200 phiếu sẽ sót |
| Tìm qua API (`q`) | Không giới hạn số phiếu; API đã hỗ trợ sẵn | Cần đổi màn sang gọi API theo từ khóa + debounce |

Đề xuất làm **client trước** cho nhanh và chắc; khi nào kho vượt ~200 phiếu/kỳ thì nâng lên API sau (API đã sẵn sàng).

**c) Bổ sung `invoice_no` vào type `InboundItem`** để component đọc được (API đã trả sẵn trong dữ liệu).

**Kỹ thuật:** sửa gọn trong 1 file `thukho/inbound/page.tsx`. Có sẵn `useDebouncedValue` (vừa tạo) để dùng cho ô tìm. Không đụng API, không schema, không migration.

---

## 4. Tùy chọn kèm theo (không bắt buộc)

Màn **desktop** `/wms/inbound` cũng nên đồng bộ cho Kế toán/Quản lý:
- Ô tìm kiếm desktop **đã tìm** theo số hóa đơn (qua `q`), nhưng placeholder ghi "Tìm mã phiếu, ghi chú…" và **bảng không có cột Số hóa đơn** → người dùng gõ đúng số nhưng không thấy nó trong kết quả.
- Đề xuất: thêm **cột "Số HĐ"** vào bảng + sửa placeholder nhắc luôn "số hóa đơn".

Đây là cải thiện nhỏ, làm cùng lúc thì trọn vẹn, nhưng có thể tách riêng nếu muốn tập trung màn Thủ kho trước.

---

## 5. Việc cần bạn quyết

1. **Phạm vi** — chỉ màn Thủ kho (đúng yêu cầu), hay làm luôn cột "Số HĐ" cho bảng desktop?
2. **Cách tìm ở màn Thủ kho** — lọc tại máy (đề xuất, nhanh), hay tìm qua API để không giới hạn số phiếu?
3. **Ô tìm** — tìm chung "số hóa đơn hoặc mã PHN" trong một ô (đề xuất), hay bạn muốn tách riêng chỉ tìm số hóa đơn?

# Báo cáo — Một pallet chứa mã hàng của nhiều phiếu nhập (PHN)

**Ngày:** 2026-07-24 · **Màn hình gặp:** Thủ kho → chi tiết pallet → Thêm hàng vào pallet
**Yêu cầu:** *"Trên 1 pallet có 2–3 mã hàng của 2 phiếu khác nhau. Nhập mã của phiếu này xong, nhập tiếp mã của phiếu khác thì không tìm thấy → làm sao liên kết cùng lúc 2 hóa đơn trên một pallet?"*

---

## 1. Vì sao màn hình chặn — đã truy đúng gốc

Đây **không phải lỗi**, mà là **giới hạn thiết kế có chủ đích**. Ba tầng đang giả định "một pallet chỉ thuộc **một** phiếu nhập":

**a) Cơ sở dữ liệu:** pallet chỉ có **một** ô liên kết phiếu.
`prisma/schema.prisma` — `Pallet.inbound_request_id` (một khóa duy nhất). Còn `PalletLine` (dòng hàng)
**không có** trường phiếu nào — mỗi dòng hàng chỉ biết mã hàng, không biết nó thuộc phiếu nào; phải suy ra từ phiếu của cả pallet.

**b) Ô tìm mã hàng bị lọc theo đúng phiếu của pallet.**
`src/app/thukho/pallet/[id]/page.tsx:163-165` — khi pallet đã link PHN, tìm mã hàng gửi kèm `inbound_request_id`.
`src/app/api/item-codes/route.ts:47` — server chỉ trả mã hàng **có trong dòng của phiếu đó**:
```ts
where.inboundLines = { some: { inbound_request_id: inboundRequestId } };
```
→ Mã hàng của phiếu **khác** bị loại → ô tìm trả **rỗng**. Đúng bằng ảnh: pallet gắn `PHN-2026-0096`, gõ mã `71545` (thuộc phiếu khác) → không ra gì. Dòng chữ xanh *"Tìm kiếm chỉ trong mã hàng thuộc PHN-2026-0096 — tránh nhập sai"* chính là quy tắc này.

**c) Đối chiếu (UC-IN-03) gom pallet theo một phiếu.**
`src/app/api/inbound/[id]/route.ts:45-46` — đối chiếu một phiếu bằng cách lấy `pallets where inbound_request_id = phiếu`. Mã hàng trên pallet mà không thuộc phiếu đó bị đánh dấu **"hàng phát sinh"**.

→ Toàn bộ luồng nhập kho đang xây trên **1 pallet = 1 phiếu**. Muốn 1 pallet gánh 2 phiếu thì phải nới đúng chỗ này.

---

## 2. Có cách chữa cháy ngay hôm nay (nhưng không trọn)

Hệ thống **cho phép tạo pallet KHÔNG gắn phiếu**. Khi đó ô tìm hiện **tất cả** mã hàng
(`page.tsx:399` — pallet không link PHN thì bỏ lọc), nên thủ kho thêm được mã của cả 2 phiếu lên cùng pallet.

**Nhược điểm:** pallet không gắn phiếu nào thì **cả 2 phiếu đều không tự đối chiếu** được pallet này
(vì đối chiếu lọc theo `inbound_request_id`). Hàng vẫn **lên tồn kho bình thường** (tồn kho đếm theo dòng pallet, không theo phiếu), nhưng kế toán phải **tự khớp tay** — đúng cái mà yêu cầu "thao tác nhập nhanh" muốn tránh.

→ Dùng tạm được, không nên làm cách chính thức.

---

## 3. Cách làm đúng — gắn phiếu ở TỪNG DÒNG hàng

Bản chất vấn đề: đơn vị "thuộc phiếu nào" phải là **dòng hàng**, không phải cả pallet. Một thùng SUNSILK
thuộc PHN-0096, một thùng khác thuộc PHN-0097 — dù nằm chung một pallet vật lý.

**Giải pháp:** thêm liên kết phiếu vào `PalletLine`, để một pallet chứa dòng của nhiều phiếu, mỗi dòng
đối chiếu về đúng phiếu của nó.

| Việc | Nội dung |
|---|---|
| **Schema + migration** | Thêm `inbound_request_id` (nullable) vào `PalletLine`. Backfill dòng cũ = phiếu của pallet cha. Additive, không phá dữ liệu cũ. |
| **Màn thêm hàng** | Bỏ lọc cứng theo 1 phiếu. Gõ mã hàng ra kết quả kèm **thuộc phiếu nào**; chọn xong lưu phiếu đó vào dòng. Nếu mã thuộc phiếu chưa gắn → hỏi "Gắn thêm phiếu này vào pallet?" |
| **Đối chiếu (UC-IN-03)** | Đổi từ *"pallet nào thuộc phiếu X"* sang *"dòng pallet nào thuộc phiếu X"*. Mỗi phiếu chỉ đếm dòng của mình. |
| **Hiển thị pallet** | Nhóm dòng hàng theo phiếu, mỗi nhóm ghi mã PHN, để thủ kho/kế toán thấy rõ. |
| **Chốt phiếu (UC-IN-04)** | Một pallet có thể liên quan nhiều phiếu; chốt phiếu này không đụng dòng của phiếu kia. |

Đây là cách chuẩn, về sau không vướng. Nhưng là **thay đổi lớn**: chạm schema + migration + màn thêm hàng
+ engine đối chiếu + màn chi tiết + luồng chốt. Cần làm cẩn thận và test kỹ vì đụng đúng tim của nghiệp vụ nhập kho.

---

## 4. Ba hướng để bạn chọn

| Hướng | Nội dung | Ưu | Nhược |
|---|---|---|---|
| **A. Gắn phiếu theo dòng** *(đề xuất)* | Như mục 3 | Đúng bản chất, đối chiếu tự động chuẩn cho mọi trường hợp | Thay đổi lớn: schema + migration + 5 chỗ; cần test kỹ |
| **B. Cho pallet gắn nhiều phiếu + suy ra theo mã** | Thêm bảng nối pallet↔nhiều phiếu, ô tìm hiện mã của mọi phiếu đã gắn, mỗi dòng tự gán về phiếu chứa mã đó | Nhẹ hơn A, phủ đúng ca của bạn (các mã **khác nhau** giữa 2 phiếu) | Hỏng khi **cùng một mã** xuất hiện ở 2 phiếu (không biết dòng thuộc phiếu nào) |
| **C. Chữa cháy: pallet không gắn phiếu** | Không đụng code | Dùng được ngay | Kế toán phải khớp phiếu bằng tay; mất tự động hóa |

Hướng B nhẹ và phủ đúng tình huống trong ảnh (các mã khác nhau), nhưng A mới là nền vững nếu về sau
có ca "cùng mã, khác phiếu".

---

## 5. Cần bạn xác nhận trước khi làm

1. **Chọn hướng nào** — A (đúng, lớn), B (nhẹ, đủ cho ca hiện tại), hay C (tạm, không code)?
2. **Thực tế kho**: có bao giờ **cùng một mã hàng** xuất hiện ở **2 phiếu khác nhau** trên cùng pallet không?
   Nếu có → phải chọn A. Nếu chắc chắn không → B là đủ.
3. **Khi thêm mã của phiếu chưa gắn**: hệ thống **tự gắn thêm phiếu** vào pallet, hay **hỏi xác nhận** thủ kho trước?

> ⚠️ Đây là thay đổi chạm cơ sở dữ liệu và engine đối chiếu — khác hẳn các sửa UI trước. Tôi sẽ **không tự làm**
> mà chờ bạn chốt hướng, rồi lên kế hoạch chi tiết như các lần trước.

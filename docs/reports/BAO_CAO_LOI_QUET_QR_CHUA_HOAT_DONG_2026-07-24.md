# Báo cáo — "Quét mã QR chưa hoạt động"

**Ngày:** 2026-07-24 · **Màn hình:** Thủ kho → Thêm hàng vào pallet (PHN-2026-0096) · **Thiết bị trong ảnh:** iPhone (iOS Safari)
**Triệu chứng:** *"Quét mã QR chưa hoạt động."*

> **Tóm tắt 1 dòng:** Không phải lỗi code. Camera của điện thoại **chỉ được phép chạy khi trang là "secure context"** (HTTPS chứng chỉ HỢP LỆ hoặc localhost). App đang mở bằng **IP + chứng chỉ tự ký** (`https://188.166.210.73/...`) → trình duyệt, nhất là **iOS Safari**, coi là KHÔNG bảo mật và **chặn camera**. → **Mở app bằng tên miền hợp lệ `https://khohangvinhgiang.io.vn/thukho`** là chạy được ngay, không cần sửa dòng code nào.

> ## ✅ ĐÃ LÀM — 2026-07-24
>
> **1. Xác minh giải pháp gốc chạy được:** đã kiểm tra `https://khohangvinhgiang.io.vn/thukho` — **đang sống, HTTPS hợp lệ** (trả về app "Vĩnh Giang WMS"). → Cho nhân viên mở bằng tên miền này là camera quét chạy, **không cần sửa code**.
>
> **2. Cải thiện code để app tự hướng dẫn khi mở nhầm địa chỉ không bảo mật** — sửa **1 file** `src/components/shared/BarcodeScannerModal.tsx`:
> - Modal quét **tự phát hiện** không phải secure context (`window.isSecureContext` / `navigator.mediaDevices`).
> - Khi bị chặn: **không** mount viewfinder (tránh quay vòng vô nghĩa), thay bằng bảng hướng dẫn rõ ràng: *"Camera chưa dùng được ở địa chỉ này — hãy mở app bằng https://khohangvinhgiang.io.vn"* + nút to **"Chụp / chọn ảnh mã"** (đọc mã từ ảnh, chạy được cả khi camera bị chặn) + gợi ý **Nhập tay**.
> - `npx tsc --noEmit` **sạch**; chỉ đụng đúng 1 file component.
>
> **3. Ghi chú vận hành:** cập nhật `DEPLOY.md` cảnh báo camera cần tên miền hợp lệ + cách dùng nút "Ảnh" khi buộc dùng IP.
>
> **Chưa làm (chờ bạn duyệt):** hoàn thiện cấu hình domain trên VPS (bổ sung block `/wms`, xác nhận cert/DNS) — cần truy cập VPS, xem mục 4 & 5.
>
> **Lưu ý kiểm thử:** bảng hướng dẫn "camera bị chặn" **chỉ hiện trên địa chỉ không bảo mật** (đúng ca lỗi ngoài thực tế). Trên máy local (`localhost` luôn là secure context) nó **không** kích hoạt, nên đã kiểm chứng bằng `tsc` + rà code; khi deploy và mở bằng IP sẽ thấy bảng này.
>
> Phần dưới là báo cáo phân tích ban đầu.

---

## 1. Kết luận — gốc rễ là MÔI TRƯỜNG, không phải code

Đã đọc kỹ toàn bộ luồng quét và xác nhận **code phía ứng dụng đã đầy đủ và đúng**:

- Nút quét (`thukho/pallet/[id]/page.tsx:531`) → mở modal đúng (`setScannerOpen(true)`).
- Modal (`src/components/shared/BarcodeScannerModal.tsx`) mount `BarcodeScanner`, có sẵn **Nhập tay** và **Ảnh** để dự phòng, có `ScannerErrorBoundary`.
- `BarcodeScanner` (`src/components/shared/BarcodeScanner.tsx`) khởi tạo `html5-qrcode`, chọn camera sau, xử lý lỗi quyền/không có camera rõ ràng.

Vấn đề nằm ở **quy tắc bảo mật của trình duyệt**: API camera `navigator.mediaDevices.getUserMedia` **chỉ tồn tại trong secure context**. Khi mở bằng IP kèm chứng chỉ tự ký, trình duyệt đánh dấu trang là *"không bảo mật"* và **ẩn luôn `navigator.mediaDevices`** → không có cách nào bật camera. iOS Safari đặc biệt nghiêm ngặt về điều này.

Chính code cũng đã ghi chú cảnh báo này ở đầu file (`BarcodeScanner.tsx:11-13`):

> Camera CHỈ hoạt động trong "secure context": HTTPS với chứng chỉ HỢP LỆ, hoặc localhost. Mở bằng IP + chứng chỉ tự ký → trình duyệt coi là KHÔNG bảo mật và CHẶN camera.

Và có xử lý sẵn (`BarcodeScanner.tsx:119-130`): nếu `getUserMedia` không tồn tại → gọi `onError` với thông báo *"Trình duyệt chặn camera vì trang KHÔNG bảo mật…"*.

---

## 2. Bằng chứng từ cấu hình triển khai

| Nguồn | Nội dung | Ý nghĩa |
|---|---|---|
| `DEPLOY.md` (mục Live URLs) | URL chính thức là `https://188.166.210.73/wms`, `.../xenang`, `.../thukho` | Đang dùng **IP** → chứng chỉ **tự ký** → **không** phải secure context → camera bị chặn |
| `infra/nginx-khohangvinhgiang.conf` | Đã cấu hình domain `khohangvinhgiang.io.vn` với chứng chỉ **Let's Encrypt** (`/etc/letsencrypt/live/...`) + redirect 80→443 | Đã có sẵn **tên miền HTTPS hợp lệ** — mở qua đây thì camera **chạy** |

→ Hạ tầng đã có tên miền tốt; chỉ là **đang truy cập nhầm bằng IP**.

---

## 3. Vì sao trong ảnh vẫn thấy màn thêm hàng bình thường

Camera bị chặn **không** làm hỏng màn hình — nút quét vẫn bấm được, modal vẫn mở. Nhưng khi vào modal:
- Trên iOS với trang không bảo mật, `navigator.mediaDevices` = `undefined` → viewfinder không lên hình, hoặc hiện dòng lỗi vàng *"Trình duyệt chặn camera vì trang KHÔNG bảo mật…"*.
- Người dùng thấy "camera không lên / không quét được" → phản ánh **"Quét mã QR chưa hoạt động"**.

(Ảnh chụp là màn *trước* khi mở modal nên chưa thấy thông báo lỗi — hoàn toàn khớp với chẩn đoán trên.)

---

## 4. Cách khắc phục

### ✅ Cách chính (khuyến nghị) — đổi đường truy cập, KHÔNG sửa code
Cho thủ kho / xe nâng mở app bằng **tên miền hợp lệ** thay vì IP:

```
https://khohangvinhgiang.io.vn/thukho      (thay cho https://188.166.210.73/thukho)
https://khohangvinhgiang.io.vn/xenang
https://khohangvinhgiang.io.vn/kiemke
```

Cần **kiểm tra trên VPS** để đảm bảo tên miền dùng được ngay:
1. DNS `khohangvinhgiang.io.vn` trỏ đúng IP server đang chạy 4 instance.
2. Chứng chỉ Let's Encrypt còn hạn (`certbot certificates`).
3. Nginx bản `nginx-khohangvinhgiang.conf` đang active và proxy đủ 4 nhánh (`/wms /xenang /thukho /kiemke`) — hiện file mẫu **thiếu block `/wms`** cho domain (chỉ có `/xenang`, `/thukho`, `/kiemke` và `location /` về cổng 4200) → cần rà lại để `/wms` cũng chạy trên domain.
4. Đặt lại lối tắt / mã QR / bookmark trên điện thoại nhân viên sang địa chỉ domain.

> Sau khi mở bằng domain, camera là secure context → quét chạy bình thường, **không đụng gì tới mã nguồn**.

### 🟡 Giải pháp tạm nếu buộc phải dùng IP
Hai nút dự phòng **đã có sẵn trong modal**, hoạt động **ngay cả khi camera bị chặn**:
- **"Ảnh"** — mở camera/thư viện của hệ điều hành (native, không cần secure context), chụp/chọn ảnh mã vạch → app giải mã từ ảnh (`scanFile`). Đây là cách quét được **không cần** `getUserMedia`.
- **"Nhập tay"** — gõ mã trực tiếp.

Hướng dẫn nhân viên dùng nút **Ảnh** trong lúc chờ chuyển sang domain.

### ⚙️ (Tuỳ chọn) cải thiện trải nghiệm — cần bạn duyệt trước khi làm
Hiện khi camera bị chặn do non-secure context, thông báo hiện qua `onError`. Có thể làm rõ hơn cho người dùng cuối:
- Khi phát hiện **không phải secure context**, hiển thị ngay 1 dải hướng dẫn to trong modal: *"Hãy mở app bằng https://khohangvinhgiang.io.vn để quét bằng camera, hoặc bấm **Ảnh** để chụp mã."* kèm nút chuyển thẳng sang nút **Ảnh**.
- Đây chỉ là cải thiện thông báo, **không** phải sửa lỗi cốt lõi.

---

## 5. Việc cần bạn xác nhận

1. Cho mình **kiểm tra/hoàn thiện cấu hình domain `khohangvinhgiang.io.vn`** trên VPS (bổ sung block `/wms`, xác nhận cert + DNS) để nhân viên mở qua domain là quét được — đây là cách xử lý gốc và **không cần sửa code**?
2. Trong lúc đó, mình soạn **hướng dẫn ngắn cho nhân viên dùng nút "Ảnh"** làm phương án tạm chứ?
3. Có muốn mình làm thêm **cải thiện thông báo trong modal** (mục 4 ⚙️) để lần sau ai gặp cũng biết ngay phải mở bằng domain không?

> Ghi chú: Đây là báo cáo phân tích theo yêu cầu "nghiên cứu kỹ rồi báo lại" — **chưa sửa code**. Chờ bạn chốt hướng ở mục 5.

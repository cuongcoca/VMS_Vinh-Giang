# BÁO CÁO: Gửi OTP THẬT qua Email / SMS / Zalo — Cách làm & Chi phí

> **Ngày:** 01/06/2026
> **Dự án:** WMS Vĩnh Giang
> **Câu hỏi:** Làm sao để mã OTP gửi thật về **số điện thoại** hoặc **email**? Có **miễn phí** không?

---

## 0. TÓM TẮT NHANH (đọc cái này trước)

| Kênh gửi OTP | Miễn phí? | Chi phí thực tế | Code đã có sẵn? | Thời gian làm được |
|---|---|---|---|---|
| **📧 Email** | ✅ **CÓ (gần như free)** | 0đ (Gmail/Brevo free tier) | **✅ 90% đã có** (`lib/mailer.ts`) | **~1 buổi** |
| **📱 SMS Brandname** | ❌ KHÔNG | Setup + ~150.000đ/tháng + **500–800đ/tin** | ❌ Chưa có | 1–2 tuần (chờ duyệt) |
| **💬 Zalo ZNS** | ❌ KHÔNG (nhưng rẻ) | **~300đ/tin OTP** + duyệt OA | ❌ Chưa có | 1–2 tuần (chờ duyệt) |
| **🔥 Firebase Phone** | ❌ KHÔNG cho production | ~$0.01–0.10/SMS | ❌ Chưa có | Vài ngày |

**Kết luận 1 dòng:** **Email thì MIỄN PHÍ và gần như đã code xong** — chỉ cần nối dây + khai báo tài khoản gửi. **SMS/Zalo về điện thoại thì KHÔNG có cái nào miễn phí thật ở Việt Nam** (luật bắt buộc đăng ký brandname/OA + trả tiền mỗi tin). **Khuyến nghị: bật Email OTP trước (miễn phí, làm ngay), điện thoại để giai đoạn sau nếu thực sự cần.**

---

## 1. HIỆN TRẠNG TRONG CODE (đang ở đâu)

### 1.1. OTP đã được sinh và lưu — nhưng **KHÔNG gửi đi đâu cả**

File [`send-otp/route.ts`](src/app/api/auth/forgot-password/send-otp/route.ts) hiện làm:
1. ✅ Nhận email/SĐT, validate, tìm user.
2. ✅ Chống spam: tối đa 5 OTP / 30 phút.
3. ✅ Sinh mã OTP 6 số, lưu vào bảng `otp_codes`, hết hạn sau **5 phút**.
4. ❌ **KHÔNG gọi hàm gửi nào** — chỉ `console.log` mã khi bật biến môi trường `MOCK_OTP=1` (chỉ ở máy dev).

```ts
// Đoạn cuối send-otp/route.ts — đây là TẤT CẢ những gì xảy ra với mã OTP:
const allowMockOtp = process.env.NODE_ENV !== "production" && process.env.MOCK_OTP === "1";
if (allowMockOtp) {
  console.log(`[MOCK OTP] User: ${identifier} | OTP: ${otpCode} ...`); // chỉ in ra log
}
return NextResponse.json({ success: true, message: `Mã OTP đã được gửi tới ${identifier}.` });
//                                                  ^^^ NÓI "đã gửi" nhưng THỰC TẾ KHÔNG GỬI
```

> ⚠️ **Đây chính là lý do** trên production người dùng bấm "Gửi OTP" thấy báo thành công nhưng **không bao giờ nhận được mã** — vì hệ thống chỉ tạo mã trong database rồi thôi.

### 1.2. Hạ tầng EMAIL thì **đã xây gần xong** (tin tốt!)

File [`lib/mailer.ts`](src/lib/mailer.ts) đã có hàm `sendMail()` hoàn chỉnh, hỗ trợ sẵn **3 nhà cung cấp**:
- **SMTP** (nodemailer — dùng được Gmail, hoặc server mail riêng)
- **Mailgun** (API)
- **SendGrid** (API)

Cấu hình lưu trong bảng `system_configs`, chỉnh qua trang Admin **`/system/mail`** (đã có UI nhập host/user/password/API key + nút kiểm tra kết nối).

👉 Nghĩa là gửi email **chỉ còn thiếu 2 việc nhỏ:**
1. Gọi `sendMail()` bên trong `send-otp` (hiện chưa gọi).
2. Vào `/system/mail` khai báo 1 tài khoản gửi thật.

### 1.3. Hạ tầng SMS: **chưa có gì**

Không có thư viện/route nào tích hợp nhà mạng hay Zalo. Phải làm mới hoàn toàn nếu muốn gửi về điện thoại.

### 1.4. Luồng đã sẵn sàng cho cả 2 kênh

`send-otp` đã **tự phân biệt email vs SĐT** (regex). Nên kiến trúc cho phép: nếu nhập email → gửi email; nếu nhập SĐT → gửi SMS/Zalo. Chỉ cần điền phần "gửi" cho từng nhánh.

---

## 2. PHƯƠNG ÁN A — EMAIL OTP ✅ (KHUYẾN NGHỊ LÀM TRƯỚC)

### 2.1. Vì sao nên làm đầu tiên
- **Miễn phí** (xem bảng dưới).
- **Code đã có 90%**, chỉ nối dây.
- Không cần giấy phép, không chờ duyệt, không phụ thuộc nhà mạng.
- Đủ dùng cho nội bộ kho (số nhân viên ít, vài chục tài khoản).

### 2.2. Các nhà cung cấp email & gói MIỄN PHÍ (cập nhật 2026)

| Nhà cung cấp | Gói miễn phí | Ghi chú |
|---|---|---|
| **Gmail (SMTP)** | ~400–500 email/ngày | Free 100%. Dùng "App Password". Hợp cho nội bộ ít người. Có thể vào spam nếu gửi nhiều. |
| **Brevo** (Sendinblue) | **300 email/ngày** (9.000/tháng) | **Free tier tốt nhất cho production**, không cần thẻ tín dụng. Có SMTP + API. |
| **Resend** | 3.000 email/tháng (100/ngày) | Tích hợp Next.js cực mượt, dành cho dev. |
| **SendGrid** | 100/ngày (chỉ tài khoản cũ) | Tài khoản mới đăng ký từ 27/05/2025 **không còn free vĩnh viễn** — chỉ trial 60 ngày rồi $19.95/tháng. |
| **Amazon SES** | ~$0.10 / 1.000 email (gần như free) | Rẻ nhất khi volume lớn, nhưng setup phức tạp hơn. |

> 💡 **Khuyến nghị: Gmail SMTP** (làm nhanh nhất, 0đ) cho giai đoạn đầu, hoặc **Brevo** (chuyên nghiệp hơn, vẫn free 300 mail/ngày). Cả hai đều cắm thẳng vào `lib/mailer.ts` đã có.

### 2.3. Các bước thực hiện (Email)

**Bước 1 — Lấy tài khoản gửi (ví dụ Gmail):**
1. Tạo/ dùng 1 Gmail của công ty (vd `kho.vinhgiang@gmail.com`).
2. Bật 2FA → tạo **App Password** (16 ký tự) tại Google Account → Security → App passwords.

**Bước 2 — Khai báo trong app:** vào `/system/mail`, chọn provider = SMTP, nhập:
```
smtp_host     = smtp.gmail.com
smtp_port     = 587
smtp_user     = kho.vinhgiang@gmail.com
smtp_password = <App Password 16 ký tự>
smtp_secure   = false   (587 dùng STARTTLS)
smtp_from     = "WMS Vĩnh Giang <kho.vinhgiang@gmail.com>"
```
Bấm nút "Kiểm tra kết nối" (hàm `verifyMail()` đã có).

**Bước 3 — Nối `sendMail` vào `send-otp`** (đây là phần code cần thêm, ~15 dòng):
```ts
import { sendMail } from "@/lib/mailer";

// ... sau khi tạo otpCode và lưu DB ...
if (looksLikeEmail) {
  const result = await sendMail({
    to: identifier,
    subject: "Mã OTP đặt lại mật khẩu — WMS Vĩnh Giang",
    html: `
      <div style="font-family:sans-serif">
        <p>Xin chào ${user.full_name},</p>
        <p>Mã OTP đặt lại mật khẩu của bạn là:</p>
        <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${otpCode}</p>
        <p>Mã có hiệu lực trong <b>5 phút</b>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.</p>
      </div>`,
  });
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: "Không gửi được email OTP. Vui lòng liên hệ Admin." },
      { status: 502 }
    );
  }
}
```

**Chi phí Email: 0đ** (trong giới hạn free tier — thừa sức cho 1 kho).

---

## 3. PHƯƠNG ÁN B — SMS về điện thoại 📱 (THẬT, NHƯNG TRẢ PHÍ)

### 3.1. Sự thật quan trọng: **KHÔNG có SMS miễn phí ở Việt Nam**
Luật VN bắt buộc tin nhắn doanh nghiệp phải gửi qua **SMS Brandname** (tên thương hiệu đã đăng ký với nhà mạng). Muốn vậy phải:
- Có **giấy phép kinh doanh** của công ty.
- **Đăng ký brandname** với **từng nhà mạng** (Viettel, MobiFone, VinaPhone…).
- Chờ duyệt **3–5 ngày làm việc**.
- **Trả tiền theo mỗi tin nhắn**.

(Các dịch vụ "SMS đầu số ngẫu nhiên" rẻ hơn nhưng **bị cấm dùng cho OTP/thương hiệu** và dễ bị chặn — không khuyến nghị.)

### 3.2. Bảng giá SMS Brandname (loại chăm sóc KH / OTP, 2025–2026)

| Khoản | Chi phí |
|---|---|
| Phí khởi tạo brandname | **50.000đ / nhà mạng** (một lần) |
| Phí duy trì hàng tháng | **50.000đ / nhà mạng / tháng** |
| Giá mỗi tin OTP/CSKH (Viettel/MobiFone/VinaPhone) | **500 – 800đ / tin** (đã gồm VAT) |
| Giá mỗi tin (Vietnamobile) | ~1.600đ / tin |

> Để phủ hết thuê bao, thường phải đăng ký **cả 3 nhà mạng** → duy trì **~150.000đ/tháng** + setup ~150.000đ một lần, **chưa tính tiền tin nhắn**.

**Ví dụ chi phí vận hành:** kho có ~30 nhân viên, mỗi tháng quên mật khẩu ~20 lần → 20 tin × 700đ ≈ **14.000đ tiền tin** + 150.000đ duy trì = **~164.000đ/tháng**. (Tiền tin rất nhỏ; tiền duy trì brandname mới là chính.)

### 3.3. Nhà cung cấp SMS phổ biến tại VN
- **eSMS.vn (VIHAT)** — phổ biến nhất, API đơn giản, có cả SMS + Zalo ZNS.
- **FPT SMS**, **VNPT/Viettel** (trực tiếp nhà mạng), **SpeedSMS**, **Stringee**, **VietGuys**.

### 3.4. Các bước thực hiện (SMS)
1. Chuẩn bị giấy phép KD → ký hợp đồng với 1 nhà cung cấp (vd eSMS).
2. Đăng ký brandname (vd `VINHGIANG`) + mẫu tin OTP → chờ duyệt 3–5 ngày.
3. Nạp tiền vào tài khoản SMS.
4. Lấy `ApiKey` + `SecretKey` → code thêm `lib/sms.ts` và gọi trong nhánh SĐT của `send-otp`.

**Phác thảo code `lib/sms.ts` (ví dụ eSMS):**
```ts
export async function sendSms(phone: string, content: string) {
  const cfg = await loadSmsConfig(); // esms_api_key, esms_secret, esms_brandname (lưu system_configs)
  const res = await fetch(
    "https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ApiKey: cfg.esms_api_key,
        SecretKey: cfg.esms_secret,
        Brandname: cfg.esms_brandname,
        SmsType: "2",           // 2 = brandname CSKH (dùng cho OTP)
        Phone: phone,           // vd 0901234567
        Content: content,       // "Ma OTP cua ban la 123456, hieu luc 5 phut. WMS Vinh Giang"
      }),
    }
  );
  const data = await res.json();
  return { ok: data.CodeResult === "100", raw: data };
}
```
> Lưu ý: nội dung SMS brandname **không dấu**, đúng mẫu đã đăng ký, nếu sai mẫu sẽ bị từ chối.

---

## 4. PHƯƠNG ÁN C — Zalo ZNS 💬 (RẺ HƠN SMS, RẤT HỢP VN)

### 4.1. Vì sao đáng cân nhắc
- **Hầu hết người Việt dùng Zalo** → tỷ lệ nhận cao.
- **Rẻ hơn SMS brandname nhiều.**
- Giao diện đẹp (logo, nút bấm), uy tín hơn SMS.

### 4.2. Giá Zalo ZNS (2025–2026)
| Loại tin | Giá (chưa VAT) |
|---|---|
| **ZNS OTP** | **300đ / tin** |
| ZNS thường (thông báo) | 200đ / tin |
| ZNS tiện ích | 120đ / tin |

> ZNS OTP **miễn phí với người nhận**, doanh nghiệp trả ~300đ/tin — **rẻ hơn ~40–60% so với SMS brandname**.

### 4.3. Điều kiện
- Phải có **Zalo Official Account (OA)** đã **xác thực doanh nghiệp** (cần giấy phép KD).
- Đăng ký **template ZNS OTP** → Zalo duyệt mẫu.
- Tích hợp qua ZNS API (hoặc qua trung gian như eSMS để đỡ phức tạp).
- ⚠️ Hạn chế: chỉ gửi được tới người có **số Zalo** (gần như ai cũng có, nhưng không tuyệt đối 100%). Nên dùng kèm fallback SMS/Email.

---

## 5. PHƯƠNG ÁN D — Firebase Phone Auth 🔥 (tham khảo)

- Google lo phần gửi SMS, đỡ phải đăng ký brandname.
- **Nhưng KHÔNG miễn phí cho production**: chỉ 10 SMS/ngày để test; thật thì tính ~$0.01–0.10/SMS (giá VN không rõ ràng, thường đắt hơn nhà mạng nội địa).
- **Nhược điểm lớn:** phải đổi kiến trúc đăng nhập sang Firebase (OTP xác thực ở client của Google), không khớp với hệ thống OTP + JWT hiện tại. **Không khuyến nghị** cho dự án này.

---

## 6. SO SÁNH TỔNG HỢP & TRẢ LỜI "CÓ MIỄN PHÍ KHÔNG?"

| Tiêu chí | 📧 Email | 📱 SMS Brandname | 💬 Zalo ZNS | 🔥 Firebase |
|---|---|---|---|---|
| **Miễn phí?** | ✅ Có (free tier) | ❌ Không | ❌ Không (rẻ) | ❌ Không |
| Chi phí/tin | **0đ** | 500–800đ | ~300đ | ~$0.01–0.10 |
| Phí cố định/tháng | 0đ | ~150.000đ | tùy gói | 0đ |
| Cần giấy phép KD | Không | **Có** | **Có** | Không |
| Thời gian triển khai | **~1 buổi** | 1–2 tuần | 1–2 tuần | vài ngày |
| Code đã có sẵn | **✅ 90%** | ❌ | ❌ | ❌ |
| Độ tin cậy nhận | Cao (có thể vào spam) | Rất cao | Cao | Rất cao |
| Hợp với dự án này | **✅ Nhất** | Khi cần SĐT | Khi cần SĐT, tiết kiệm | ❌ |

**Trả lời thẳng câu "có miễn phí không":**
- **Email: CÓ — miễn phí thật** (Gmail/Brevo/Resend free tier, thừa cho 1 kho).
- **Điện thoại (SMS/Zalo): KHÔNG có cái nào miễn phí thật** ở VN — luật bắt buộc đăng ký brandname/OA (cần giấy phép KD) và trả tiền mỗi tin. Rẻ nhất là **Zalo ZNS ~300đ/tin**.

---

## 7. KHUYẾN NGHỊ LỘ TRÌNH

### ✅ Giai đoạn 1 — LÀM NGAY (miễn phí, ~1 buổi)
**Bật Email OTP** qua hạ tầng `lib/mailer.ts` đã có:
1. Tạo Gmail công ty + App Password (hoặc đăng ký Brevo free).
2. Khai báo ở `/system/mail`.
3. Thêm ~15 dòng gọi `sendMail()` trong `send-otp` (nhánh email).
4. (Nên) xóa câu trả về `message: "đã gửi"` khi thực ra chưa gửi, để không gây hiểu nhầm.

→ Người dùng quên mật khẩu **nhập email** sẽ nhận mã thật ngay. **0đ.**

### 🔜 Giai đoạn 2 — KHI THỰC SỰ CẦN GỬI VỀ SĐT
Chọn **một** trong hai (đều cần giấy phép KD + chờ duyệt):
- **Zalo ZNS** (~300đ/tin) — khuyên dùng vì rẻ + người Việt hay dùng Zalo.
- **SMS Brandname** (~500–800đ/tin + 150k/tháng) — phủ rộng nhất, kể cả người không dùng Zalo.

Khi đó thêm `lib/sms.ts` + khai báo key trong `/system/mail` (mở rộng thành "Cấu hình gửi tin").

### 💡 Mẹo tiết kiệm
Cho nhân viên **đăng nhập/khôi phục bằng EMAIL là chính** (miễn phí). Chỉ bật SMS/Zalo cho trường hợp đặc biệt → gần như **không tốn tiền tin nhắn**.

---

## 8. LƯU Ý BẢO MẬT (phần code hiện đã làm đúng)
- ✅ OTP hết hạn **5 phút**, dùng 1 lần, vô hiệu hóa mã cũ — đã có.
- ✅ Chống spam **5 lần/30 phút** — đã có.
- ✅ **Không trả mã OTP trong response** ở production — đã có (chỉ mock ở dev).
- ⚠️ Nên thêm: giới hạn **số lần nhập sai OTP** (vd khóa sau 5 lần sai) ở `verify-otp` để chống dò mã.
- ⚠️ Nội dung SMS brandname phải **đúng mẫu đã đăng ký** và **không dấu**.

---

## 9. CHỐT
| | |
|---|---|
| **Nhanh nhất + miễn phí** | 📧 Email — đã có sẵn 90% code, nối dây là chạy |
| **Rẻ nhất cho điện thoại** | 💬 Zalo ZNS ~300đ/tin |
| **Phủ rộng nhất cho điện thoại** | 📱 SMS Brandname ~500–800đ/tin + 150k/tháng |
| **Không khuyến nghị** | 🔥 Firebase (đổi kiến trúc, không free) |

👉 **Đề xuất: tôi bật luôn Email OTP (miễn phí) cho bạn ngay bây giờ — chỉ cần bạn cung cấp 1 email Gmail công ty + App Password (hoặc tài khoản Brevo). Phần SĐT để khi nào bạn quyết định đăng ký brandname/Zalo thì tôi tích hợp tiếp.**

---

### Nguồn tham khảo (giá cập nhật 2025–2026)
- [eSMS.vn — Chính sách giá SMS Brandname](https://esms.vn/chinh-sach-gia)
- [Phúc Digital — Chi phí SMS Marketing & Zalo ZNS](https://phuctdigital.com/chi-phi-sms-marketing/)
- [Zalo Business Solutions — Bảng giá ZNS](https://zalo.solutions/zns/pricing)
- [Firebase — Phone Number Verification pricing](https://firebase.google.com/docs/phone-number-verification/pricing)
- [Brevo — Best Email API 2026 (free tier 300 mail/ngày)](https://www.brevo.com/blog/best-email-api/)
- [EmailToolTester — Best Transactional Email Services 2026](https://www.emailtooltester.com/en/blog/best-transactional-email-service/)

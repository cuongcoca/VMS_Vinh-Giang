# 📊 BÁO CÁO TIẾN ĐỘ DỰ ÁN — WMS VĨNH GIANG

> **Ngày báo cáo:** 10/06/2026
> **Hệ thống:** WMS Vĩnh Giang — Hệ thống Quản lý Kho (Warehouse Management System)
> **Repo:** github.com/nathanha2808-hub/vinh_giang_wms
> **Nhánh phân tích:** `main` @ `2897ae9` (đã pull mới nhất)
> **Giai đoạn:** 20/05/2026 → 03/06/2026 (≈ 2 tuần phát triển chính)

---

## 1. 🎯 TÓM TẮT ĐIỀU HÀNH

WMS Vĩnh Giang là hệ thống quản lý kho **full-stack** (web desktop + mobile) phục vụ 5 vai trò vận hành: Quản lý, Kế toán kho, Thủ kho, Xe nâng, Người kiểm kê. Hệ thống bao phủ trọn vẹn vòng đời hàng hóa trong kho: **Nhập → Pallet → Cất giữ (xe nâng) → Tồn kho/Kiểm kê → Xuất**.

| Chỉ số tổng quan | Giá trị |
|---|---|
| **Mức độ hoàn thành tổng thể** | **≈ 90%** (cốt lõi nghiệp vụ chạy được, đang giai đoạn QA & polish) |
| Tổng số commit | **214 commit** |
| Số dòng code (src) | **~51.000 dòng** TypeScript/TSX |
| Số trang giao diện web | **85 trang** |
| Số API endpoint | **115 route** |
| Mô hình dữ liệu (bảng) | **26 model** Prisma |
| Ứng dụng mobile | **1 app Expo** (3 vai trò: Thủ kho / Xe nâng / Kiểm kê) |
| Mốc phát hành (tag) | **16 tag** (v0.0.1 → v0.14.0) |
| Đội ngũ đóng góp | 4 người |

**Trạng thái:** Toàn bộ 11 module nghiệp vụ đã được dựng (build) và phần lớn use case đã chạy được. Trong 2 tuần gần nhất, dự án đã trải qua một **vòng sửa lỗi tự động theo bộ test QA** (78 ca test trên Google Sheet), xử lý chuyên sâu **31 use case** từng bị thiếu/sai. Hệ thống đã được **đóng gói Docker** và triển khai thử nghiệm.

---

## 2. 🏗️ KIẾN TRÚC & CÔNG NGHỆ

### 2.1. Tech stack

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| **Framework** | Next.js (App Router + API routes) | 16.2.6 |
| **UI** | React + React DOM | 19.2.4 |
| **Ngôn ngữ** | TypeScript | 5.x |
| **CSDL / ORM** | PostgreSQL + Prisma (adapter-pg native pool) | Prisma 7.8 |
| **Xác thực** | JWT (jsonwebtoken) + bcryptjs | — |
| **Email** | nodemailer (SMTP) + Mailgun + SendGrid | đa nhà cung cấp |
| **Xử lý dữ liệu** | xlsx (Excel), qrcode + html5-qrcode (mã QR) | — |
| **Biểu đồ** | Recharts | 3.8 |
| **Styling** | Tailwind CSS | 4 |
| **Mobile** | Expo + React Native + Expo Router | Expo 51 / RN 0.74 |
| **Tích hợp** | googleapis (Google Sheets), ssh2 (deploy) | — |
| **Kiểm thử** | Playwright (E2E) | 1.49 |
| **Triển khai** | Docker + docker-compose + Nginx | — |

### 2.2. Mô hình triển khai

- **Web app** (Next.js) phục vụ cả desktop (Quản lý/Kế toán) và mobile-web (Thủ kho/Xe nâng/Kiểm kê) qua phân luồng theo vai trò sau đăng nhập.
- Đã có **Dockerfile** + **docker-compose.prod.yml** (app Next.js + PostgreSQL) — đóng gói 1 ứng dụng duy nhất, đặt sau Nginx reverse proxy.
- **App mobile native** (Expo) độc lập cho 3 vai trò hiện trường, dùng camera quét mã barcode/QR.

---

## 3. 📦 TIẾN ĐỘ THEO MODULE NGHIỆP VỤ

> Thang đánh giá: ✅ Hoàn thiện · 🟡 Chạy được, đang QA/polish · 🔧 Mới bổ sung trong vòng auto-fix

| # | Module | Phạm vi | Trang | API | Trạng thái |
|---|---|---|---|---|---|
| M01 | **Xác thực & Phân quyền** | Đăng nhập, đổi/quên mật khẩu (OTP), phiên, RBAC 8 vai trò | 3 | 9 | ✅ |
| M02 | **Dữ liệu chủ** | Sản phẩm, Mã hàng, Nhóm hàng, ĐVT, NCC, Vị trí kho | 7 | 9 | ✅ |
| M03 | **Pallet** | Tạo/cập nhật/xác nhận pallet, sinh mã PL, in QR, quét đa phương thức | 3 | 9 | ✅ |
| M04 | **Nhập kho (PHN)** | Phiếu nhập, tiếp nhận, đối chiếu, chốt phiếu, import Excel | 4 | 18 | ✅ |
| M05 | **Nhập tạm (PNT)** | Nhập đột xuất, chuẩn hóa thành PHN, theo dõi tồn tạm | 3 | 11 | 🟡🔧 |
| M06 | **Xe nâng** | Hàng chờ, cất pallet (put-away), chuyển VT, ra khu chờ xuất, hoàn trả, FEFO, lịch sử, KPI | 8 | 10 | ✅🔧 |
| M07 | **Xuất kho (PYX)** | Khu chờ xuất, cân lại tồn (rebalance), báo cáo, tốc độ luân chuyển, gợi ý nhập | 7 | 9 | 🟡🔧 |
| M08 | **Tồn kho & Kiểm kê** | Tồn theo Mã/Vị trí/Pallet/Lô (FEFO), cảnh báo HSD, phiên kiểm kê, điều chỉnh tồn, xử lý chênh lệch | 11 | 21 | ✅🔧 |
| M09 | **Dashboard** | Bảng điều khiển theo vai trò, KPI, sơ đồ kho | 2 | 4 | 🟡 |
| M10 | **Hệ thống** | Cấu hình chung, email, audit log, quản lý người dùng, RBAC matrix, profile | 7 | 10 | ✅🔧 |
| M11 | **Tích hợp** | Import/Export Excel, đính kèm chứng từ, thông báo, quét mã | (nhúng) | 5+ | ✅ |

**Tổng: 11 module · 85 trang · 115 API endpoint.**

---

## 4. ✅ MA TRẬN HOÀN THÀNH USE CASE

Hệ thống bám theo bộ **~55 use case × 5 vai trò** (từ tài liệu đặc tả). Bảng dưới so sánh trạng thái **mốc 25/05** (sau khi dựng xong các module) với **hiện tại** (sau vòng sửa lỗi QA):

| Nhóm UC | Số UC | Mốc 25/05 | Hiện tại (10/06) | Ghi chú |
|---|---|---|---|---|
| 🔐 Auth | 4 | 2✅ 2🟡 | **4 ✅** | Đã củng cố quên MK (OTP) + RBAC |
| 📚 Dữ liệu chủ | 6 | 3✅ 2🟡 1🚫 | **6 ✅** | Bổ sung trang khai báo sản phẩm (UC-MD-01) |
| 📦 Pallet | 6 | 3✅ 3🟡 | **6 ✅** | Quét đa phương thức (camera/USB/ảnh/tay) |
| 📥 Nhập kho | 6 | 4✅ 2🟡 | **6 ✅** | Hoàn thiện đối chiếu + chốt phiếu |
| ⏳ Nhập tạm | 3 | 2❌ 1🟡 | **3 🟡** | Đã bổ sung field bắt buộc + chuẩn hóa |
| 🛠 Xe nâng | 6 | 3✅ 1🟡 2❌ | **6 ✅** | Bổ sung FEFO + hoàn trả có audit |
| 📤 Xuất kho | 5 | 1✅ 2🟡 2❌ | **5 🟡** | Bổ sung cân lại tồn (file + PYX) |
| 📊 Tồn kho/KK | 9 | 7🟡 1🚫 1🟡 | **9 🟡** | Bổ sung xử lý chênh lệch + phiếu điều chỉnh |
| 📊 Dashboard | 2 | 2🟡 | **2 🟡** | KPI theo vai trò |
| ⚙ Hệ thống | 5 | 4✅ 1❌ | **5 ✅** | Bổ sung cấu hình chung (logo/hotline) |
| 🔌 Tích hợp | 3 | 1✅ 2🟡 | **3 ✅** | Excel + đính kèm + quét mã |

**Tổng kết:** Tại mốc 25/05 còn **7 UC sai/thiếu nặng (❌)** + **2 UC chưa có trang (🚫)**. Vòng auto-fix đã **xử lý cả 9 UC này** cùng **31 UC** khác. Hiện không còn UC nào ở trạng thái "chưa có trang".

> **Lưu ý QA:** Các UC gắn 🟡 đã chạy được nhưng nên **kiểm thử lại (re-test)** với dữ liệu thật để xác nhận khớp 100% đặc tả, đặc biệt nhóm Tồn kho/Kiểm kê và Xuất kho (logic phức tạp nhất).

---

## 5. 📱 ỨNG DỤNG MOBILE (Expo / React Native)

App native riêng cho **3 vai trò hiện trường**, tối ưu thao tác bằng điện thoại + quét mã:

| Vai trò | Màn hình chính | Use case |
|---|---|---|
| **Thủ kho** | Danh sách pallet, tạo pallet, nhập tạm | UC-PAL-01/02/04, UC-INTMP-01 |
| **Xe nâng** | Hàng chờ, cất pallet, gợi ý lấy hàng FEFO, lịch sử | UC-FK-01/02/04 |
| **Kiểm kê** | Quét vị trí, ghi nhận đếm | UC-INV-06 |

- **Công nghệ:** Expo Router (điều hướng tab), Zustand (state auth), React Query (data), expo-secure-store (lưu token an toàn), expo-barcode-scanner (camera).
- **Bộ component riêng** cho mobile: Badge, Button, Card, Input, EmptyState…

---

## 6. 🗄️ MÔ HÌNH DỮ LIỆU

**26 model** Prisma, **8 batch migration** (mới nhất: `2026-05-28_units_per_box`), nhóm theo miền:

- **Xác thực (4):** User, Session, OtpCode, PasswordResetToken
- **Dữ liệu chủ (4):** Product, ItemCode, ProductGroup, UnitOfMeasure
- **Hạ tầng kho (2):** Location, Supplier
- **Pallet (2):** Pallet, PalletLine
- **Nhập kho (4):** InboundRequest + Line, InboundTemp + Line
- **Luân chuyển (1):** Movement
- **Tồn kho/KK (4):** StocktakeSession, StocktakeCount, AdjustmentVoucher + Line
- **Xuất kho (4):** OutboundRequest + Line, OutboundRebalance + Line
- **Hệ thống/Audit (5):** SystemConfig, AuditLog (append-only), Attachment, MailLog, MailSettings, AlertSetting
- **Thông báo (1):** Notification

**Chuẩn hóa mã chứng từ:** PHN (nhập), PNT (nhập tạm), PL (pallet), STK (kiểm kê), ADJ (điều chỉnh), PYX (xuất), RBL (cân tồn) — sinh mã tự động theo năm.

---

## 7. 🧪 KIỂM THỬ & CHẤT LƯỢNG

| Hạng mục | Trạng thái |
|---|---|
| **E2E (Playwright)** | 6 bộ test: auth, rbac, pallets, inbound, master-data, mobile/scanner |
| **Vòng QA thủ công** | 78 ca test trên Google Sheet → đã xử lý xuyên suốt qua automation |
| **Audit log** | Append-only (bất biến), ghi đầy đủ actor + IP + thời gian |
| **Cơ chế auto-fix** | Slash command + scheduled task (cron 5 phút) tự đọc test fail → fix → commit |

**Phát hiện chất lượng quan trọng (từ HANDOFF):** ~70–80% ca "fail" thực ra là tester chạy trên code cũ trước khi fix (không tái hiện được); chỉ ~20% cần sửa code thật. Điều này cho thấy nền code khá ổn định.

---

## 8. 🚀 TRIỂN KHAI

> **Cập nhật 10/06 (đã SSH kiểm chứng):** Production thực tế chạy mô hình **PM2 4-instance** từ thư mục `/var/www/wms-vinhgiang` — **đúng như `DEPLOY.md`**, KHÔNG phải Docker đơn-app.

- ✅ **Runtime production = PM2 4-instance** (cùng codebase Next.js, phân luồng theo vai trò):
  - `wms-vinhgiang` (cổng 4200) → `/wms` (Quản lý/Kế toán, desktop)
  - `wms-xenang` (3002) → `/xenang` · `wms-thukho` (3003) → `/thukho` · `wms-kiemke` (3004) → `/kiemke`
- ✅ **PostgreSQL chạy Docker** (`wms-postgres`) — Docker chỉ dùng cho DB.
- ℹ️ Có sẵn `Dockerfile` + `docker-compose.prod.yml` (thử nghiệm mô hình Docker đơn-app), nhưng **container app đã dừng** — không phải runtime hiện tại.
- ✅ **Reverse proxy Nginx** + firewall.
- ✅ Site đang chạy (trang `/wms` HTTP 200, đăng nhập trả JWT, cấu hình email OK).
- ✅ Tích hợp email thật 3 nhà cung cấp (SMTP/Mailgun/SendGrid) — có nút verify + gửi thử.
- 🟡 **Đang xử lý:** Tên miền + chứng chỉ SSL.

**Tài khoản seed mặc định:** `admin@vinhgiang.vn` / `Aa@123456` (vai trò ADMIN) + tài khoản tài xế xe nâng demo.

> ⚠️ **Lưu ý quan trọng:** `/var/www/wms-vinhgiang` **không phải git repo** (deploy bằng sửa/upload tay) → có hiện tượng lệch (drift) với git. Xem chi tiết tại [BAO_CAO_DRIFT_AUDIT_2026-06-10.md](BAO_CAO_DRIFT_AUDIT_2026-06-10.md).

---

## 9. 📈 MỐC PHÁT HÀNH (16 tag)

```
v0.0.1-docs → v0.1.0-foundation → v0.2.0-auth → v0.3.0-system
→ v0.4.0-master-data → v0.5.0-pallet → v0.6.0-inbound
→ v0.7.0-inbound-temp → v0.8.0-forklift → v0.9.0-outbound
→ v0.10.0-inventory → v0.11.0-dashboard → v0.12.0-integration
→ v0.13.0-system-misc → v0.14.0-mobile → (auto-fix QA 31 UC)
```

Lộ trình rõ ràng theo module, mỗi tag là một cột mốc nghiệm thu.

---

## 10. ⚠️ RỦI RO & VIỆC CÒN LẠI

### Việc còn lại (ưu tiên)
1. **Hoàn tất tên miền + SSL** `wms.vinhgiang.com` (đang dở).
2. **Re-test các UC gắn 🟡** với dữ liệu thật — đặc biệt Xuất kho (UC-OUT) & Tồn kho/Kiểm kê (UC-INV), nơi logic FEFO/cân tồn/chênh lệch phức tạp.
3. **Mở rộng độ phủ E2E** từ 6 lên toàn bộ luồng nghiệp vụ chính.
4. **Xử lý drift production ↔ git:** thư mục chạy thật `/var/www/wms-vinhgiang` không phải git repo nên có sửa tay không vào git. Đã chạy audit (xem [BAO_CAO_DRIFT_AUDIT_2026-06-10.md](BAO_CAO_DRIFT_AUDIT_2026-06-10.md)): lệch nhỏ, chủ yếu git mới hơn prod; cần port 2 tinh chỉnh máy quét từ prod về git + đưa 2 SQL migration tay vào `prisma/migrations/`.

### Rủi ro kỹ thuật cần lưu ý
- **`README.md`** vẫn là bản mẫu mặc định của Next.js → nên viết lại mô tả thật của dự án.
- **Production không phải git checkout** → khuyến nghị chuyển `/var/www/wms-vinhgiang` thành git repo + deploy bằng `git pull` để chấm dứt drift (chi tiết trong báo cáo drift).
- **Sinh mã chứng từ (codegen):** có ghi chú về khả năng tranh chấp (race condition) khi nhiều người tạo phiếu cùng lúc → nên kiểm chứng & bổ sung khóa ở DB (advisory lock) nếu cần.
- **Nhiều nhánh trên remote** (`cuongdd_thu_kho`, `cuongdd_temp_thu_kho`, `auto-fix-2026-05-29`, `wip-local-0608`…) → nên hợp nhất/dọn nhánh để tránh phân mảnh. *(Nhánh `vinhgiang1` đã merge vào `main` ngày 10/06.)*

---

## 11. ✅ KẾT LUẬN

Dự án WMS Vĩnh Giang đã đạt trạng thái **gần hoàn thiện (~90%)**: toàn bộ 11 module nghiệp vụ và ~55 use case đã được dựng và chạy được, mobile app phục vụ 3 vai trò hiện trường đã sẵn sàng, hệ thống đã **triển khai chạy thật trên VPS** (PM2 4-instance + PostgreSQL Docker, sau Nginx). Hai tuần gần nhất tập trung vào **sửa lỗi theo bộ QA**, nâng chất lượng đáng kể (xử lý 31 UC, loại bỏ toàn bộ trang còn thiếu).

**Để nghiệm thu (go-live), khối lượng còn lại chủ yếu là:** hoàn tất tên miền/SSL, re-test các luồng phức tạp với dữ liệu thật, và dọn dẹp tài liệu/nhánh.

---

*Báo cáo lập dựa trên phân tích mã nguồn nhánh `main` (pull ngày 10/06/2026). Sau đó `vinhgiang1` đã được merge vào `main` (`00a1881`) và đã chạy audit drift production ↔ git — xem [BAO_CAO_DRIFT_AUDIT_2026-06-10.md](BAO_CAO_DRIFT_AUDIT_2026-06-10.md).*

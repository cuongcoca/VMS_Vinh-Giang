# 📊 BÁO CÁO TIẾN ĐỘ DỰ ÁN — WMS VĨNH GIANG

> **Ngày báo cáo:** 15/06/2026
> **Hệ thống:** WMS Vĩnh Giang — Hệ thống Quản lý Kho (Warehouse Management System)
> **Repo:** github.com/nathanha2808-hub/vinh_giang_wms
> **Nhánh phân tích:** `main` @ `df8a29a` (Merge PR #6 — đã pull mới nhất ngày 15/06)
> **Giai đoạn:** 20/05/2026 → 11/06/2026 (commit gần nhất 11/06)
> **Báo cáo trước:** [BAO_CAO_TIEN_DO_DU_AN_2026-06-10.md](BAO_CAO_TIEN_DO_DU_AN_2026-06-10.md) (`main @ 2897ae9`)

---

## 0. 🆕 ĐIỂM MỚI KỂ TỪ BÁO CÁO 10/06 (43 commit)

Từ mốc 10/06 đến nay, dự án bổ sung **43 commit** — chủ yếu là polish theo QA, kèm **một tính năng tự động hóa mới** và **một hạ tầng mới**:

| # | Hạng mục | Loại | Tóm tắt |
|---|---|---|---|
| 1 | **Tự động điều phối xe nâng (FEFO auto-dispatch)** | 🆕 Tính năng | API phiếu xuất tự sinh gợi ý `suggested_pallets` theo FEFO; hàng đợi xe nâng trả phiếu trạng thái `PICKING`; **màn hình nhiệm vụ mobile mới** cho tài xế (`/forklift/outbound/[id]`) hỗ trợ lấy nguyên pallet (`FULL`) / lấy một phần (`PARTIAL`); dashboard xe nâng hiển thị hàng đợi. |
| 2 | **Hạ tầng Push Notification** | 🆕 Hạ tầng | Thêm model `DeviceToken` (FCM token iOS/Android), API `/api/push-tokens`, service `src/lib/push-service.ts` — nền tảng gửi thông báo đẩy cho app mobile. |
| 3 | **Quét mã vạch (barcode) cho mã hàng** | 🔧 Bổ sung | Thêm field `barcode` vào `ItemCode`; form tạo/chuẩn hóa mã hàng tích hợp `BarcodeScannerModal` (quét camera); tự copy barcode sang `Product` khi chuẩn hóa. |
| 4 | **Sửa triệt để lỗi 404 thông báo** | 🐛 Fix | Bộ dịch đường dẫn tập trung `getNormalizedRoute` trong `NotificationBell` — ánh xạ link theo vai trò (Thủ kho/Kiểm kê/Xe nâng/Kế toán), loại bỏ double basePath & sai route số nhiều/số ít. |
| 5 | **UC-INT-02 — Đính kèm chứng từ** | 🐛 Fix | Chọn ảnh từ thư viện (bỏ `capture=environment`), ghi chú ≤500 ký tự (validate cả server), lightbox phóng to, nút xóa lớn. |
| 6 | **Hồ sơ & avatar mobile (UC-SYS-05)** | 🔧 Bổ sung | Upload avatar đồng bộ 3 phân hệ (kiemke/thukho/forklift), hiển thị ở header, giới hạn 5MB; khóa sửa SĐT trên mobile; xác nhận khóa/mở tài khoản. |
| 7 | **Tồn kho (`/inventory`)** | 🐛 Fix | Chuẩn hóa phân trang client-side (`useClientPagination` + `<ListPageFooter/>`); bỏ filter nhóm hàng; đồng bộ số SKU dưới định mức giữa trang Tồn kho và Trung tâm cảnh báo. |
| 8 | **Sửa 9 testcase Xe nâng & luân chuyển** | 🐛 Fix | Cảnh báo timeout 15s khi không nhận diện QR, hiển thị lỗi camera, sửa lịch sử relocate. |
| 9 | **Khác (QA polish)** | 🐛 Fix | Email config select TLS/SSL/None; Excel export master-data đầy đủ (không còn chỉ 1 trang); modal mobile dùng React Portal (sửa z-index đè bottom nav); màu nút "Tạo phiếu nhập"; đổi header bảng cân tồn. |
| 10 | **Migration DB mới** | 🗄️ Schema | `2026-06-04_movement_ship.sql`, `2026-06-08_inbound_invoice_no.sql` (+ barcode/DeviceToken). |

> **Đọc thêm:** chi tiết từng thay đổi nằm trong [docs/CHANGELOG.md](docs/CHANGELOG.md) (mục `[2026-06-11]`).

---

## 1. 🎯 TÓM TẮT ĐIỀU HÀNH

WMS Vĩnh Giang là hệ thống quản lý kho **full-stack** (web desktop + mobile) phục vụ 5 vai trò vận hành: Quản lý, Kế toán kho, Thủ kho, Xe nâng, Người kiểm kê. Hệ thống bao phủ trọn vẹn vòng đời hàng hóa trong kho: **Nhập → Pallet → Cất giữ (xe nâng) → Tồn kho/Kiểm kê → Xuất**.

| Chỉ số tổng quan | Giá trị | So với 10/06 |
|---|---|---|
| **Mức độ hoàn thành tổng thể** | **≈ 91%** (cốt lõi chạy được, đang QA & polish + bắt đầu tự động hóa) | ↑ |
| Tổng số commit | **280 commit** | +66 |
| Số dòng code (src) | **~58.000 dòng** TypeScript/TSX | +7.000 |
| Số trang giao diện web | **86 trang** | +1 |
| Số API endpoint | **120 route** | +5 |
| Mô hình dữ liệu (bảng) | **33 model** Prisma | +1 (`DeviceToken`) |
| Migration DB | **12 migration** (mới nhất `2026-06-08_inbound_invoice_no`) | +4 |
| Ứng dụng mobile | **1 app Expo** (3 vai trò: Thủ kho / Xe nâng / Kiểm kê) | — |
| Mốc phát hành (tag) | **16 tag** (v0.0.1 → v0.14.0) | — |
| Đội ngũ đóng góp | 4 người | — |

**Trạng thái:** Toàn bộ 11 module nghiệp vụ đã được dựng (build) và phần lớn use case đã chạy được. Sau **vòng sửa lỗi tự động theo bộ test QA** (78 ca test trên Google Sheet) xử lý 31 use case, dự án tiếp tục bước polish sâu (đính kèm, thông báo, hồ sơ mobile, tồn kho) và bổ sung **tự động điều phối xe nâng theo FEFO** cùng **hạ tầng push notification**. Hệ thống đã **triển khai chạy thật trên VPS**.

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
| **Push notification** | FCM (Firebase Cloud Messaging) — `DeviceToken` + `push-service` | 🆕 |
| **Xử lý dữ liệu** | xlsx (Excel), qrcode + html5-qrcode (mã QR/barcode) | — |
| **Biểu đồ** | Recharts | 3.8 |
| **Styling** | Tailwind CSS | 4 |
| **Mobile** | Expo + React Native + Expo Router | Expo 51 / RN 0.74 |
| **Tích hợp** | googleapis (Google Sheets), ssh2 (deploy) | — |
| **Kiểm thử** | Playwright (E2E) | 1.49 |
| **Triển khai** | PM2 (production) · Docker (PostgreSQL) + Nginx | — |

### 2.2. Mô hình triển khai

- **Web app** (Next.js) phục vụ cả desktop (Quản lý/Kế toán) và mobile-web (Thủ kho/Xe nâng/Kiểm kê) qua phân luồng theo vai trò sau đăng nhập.
- **App mobile native** (Expo) độc lập cho 3 vai trò hiện trường, dùng camera quét mã barcode/QR; nay có nền tảng nhận **thông báo đẩy (push)** qua FCM.
- Production thực tế chạy **PM2 4-instance** (xem mục 8), không phải Docker đơn-app.

---

## 3. 📦 TIẾN ĐỘ THEO MODULE NGHIỆP VỤ

> Thang đánh giá: ✅ Hoàn thiện · 🟡 Chạy được, đang QA/polish · 🔧 Mới bổ sung/cải tiến gần đây

| # | Module | Phạm vi | Trang | API | Trạng thái |
|---|---|---|---|---|---|
| M01 | **Xác thực & Phân quyền** | Đăng nhập, đổi/quên mật khẩu (OTP), phiên, RBAC | 3 | 9 | ✅ |
| M02 | **Dữ liệu chủ** | Sản phẩm, Mã hàng (+barcode), Nhóm hàng, ĐVT, NCC, Vị trí kho | 7 | 9 | ✅🔧 |
| M03 | **Pallet** | Tạo/cập nhật/xác nhận pallet, sinh mã PL, in QR, quét đa phương thức | 3 | 9 | ✅ |
| M04 | **Nhập kho (PHN)** | Phiếu nhập, tiếp nhận, đối chiếu, chốt phiếu, import Excel, số hóa đơn | 4 | 18 | ✅ |
| M05 | **Nhập tạm (PNT)** | Nhập đột xuất, chuẩn hóa thành PHN, theo dõi tồn tạm | 3 | 11 | 🟡 |
| M06 | **Xe nâng** | Hàng chờ, cất pallet, chuyển VT, hoàn trả, **auto-dispatch FEFO + nhiệm vụ mobile**, lịch sử, KPI | 8 | 10 | ✅🔧 |
| M07 | **Xuất kho (PYX)** | Khu chờ xuất, cân lại tồn (rebalance), gợi ý FEFO, báo cáo, gợi ý nhập | 7 | 9 | 🟡🔧 |
| M08 | **Tồn kho & Kiểm kê** | Tồn theo Mã/Vị trí/Pallet/Lô (FEFO), cảnh báo HSD, phiên kiểm kê, điều chỉnh, **phân trang chuẩn** | 11 | 21 | ✅🔧 |
| M09 | **Dashboard** | Bảng điều khiển theo vai trò, KPI, sơ đồ kho | 2 | 4 | 🟡 |
| M10 | **Hệ thống** | Cấu hình chung, email (TLS/SSL), audit log, người dùng, RBAC, **profile + avatar mobile** | 7 | 10 | ✅🔧 |
| M11 | **Tích hợp** | Import/Export Excel, **đính kèm chứng từ (UC-INT-02)**, **thông báo (404 fixed) + push**, quét mã | (nhúng) | 6+ | ✅🔧 |

**Tổng: 11 module · 86 trang · 120 API endpoint.**

---

## 4. ✅ MA TRẬN HOÀN THÀNH USE CASE

Hệ thống bám theo bộ **~55 use case × 5 vai trò** (từ tài liệu đặc tả). Bảng dưới so sánh trạng thái **mốc 25/05** với **hiện tại** (sau vòng QA + polish 06/06–11/06):

| Nhóm UC | Số UC | Mốc 25/05 | Hiện tại (15/06) | Ghi chú |
|---|---|---|---|---|
| 🔐 Auth | 4 | 2✅ 2🟡 | **4 ✅** | RBAC cho phép mọi vai trò vào profile/đổi MK |
| 📚 Dữ liệu chủ | 6 | 3✅ 2🟡 1🚫 | **6 ✅** | Bổ sung barcode + quét mã + export Excel đầy đủ |
| 📦 Pallet | 6 | 3✅ 3🟡 | **6 ✅** | Quét đa phương thức; sửa modal mobile (Portal) |
| 📥 Nhập kho | 6 | 4✅ 2🟡 | **6 ✅** | Đối chiếu + chốt phiếu + số hóa đơn |
| ⏳ Nhập tạm | 3 | 2❌ 1🟡 | **3 🟡** | Field bắt buộc + chuẩn hóa |
| 🛠 Xe nâng | 6 | 3✅ 1🟡 2❌ | **6 ✅** | FEFO + **auto-dispatch picking** + 9 TC đã fix |
| 📤 Xuất kho | 5 | 1✅ 2🟡 2❌ | **5 🟡** | Cân lại tồn + gợi ý FEFO `suggested_pallets` |
| 📊 Tồn kho/KK | 9 | 7🟡 1🚫 1🟡 | **9 🟡** | Xử lý chênh lệch + phân trang chuẩn + cảnh báo |
| 📊 Dashboard | 2 | 2🟡 | **2 🟡** | KPI theo vai trò |
| ⚙ Hệ thống | 5 | 4✅ 1❌ | **5 ✅** | Email TLS/SSL + avatar mobile + khóa tài khoản |
| 🔌 Tích hợp | 3 | 1✅ 2🟡 | **3 ✅** | Excel + đính kèm (UC-INT-02) + thông báo + push |

**Tổng kết:** Toàn bộ UC sai/thiếu nặng (❌) và chưa-có-trang (🚫) của mốc 25/05 đã được xử lý. Đợt 06–11/06 tập trung **làm sạch QA** (đính kèm, thông báo 404, hồ sơ mobile, tồn kho) và **tự động hóa điều phối xe nâng**.

> **Lưu ý QA:** Các UC gắn 🟡 (Nhập tạm, Xuất kho, Tồn kho/Kiểm kê, Dashboard) đã chạy được nhưng nên **re-test với dữ liệu thật** để xác nhận khớp 100% đặc tả — đặc biệt logic FEFO/cân tồn/chênh lệch. Tính năng **auto-dispatch xe nâng** và **push notification** vừa thêm cần kiểm thử end-to-end trên thiết bị thật.

---

## 5. 📱 ỨNG DỤNG MOBILE (Expo / React Native)

App native riêng cho **3 vai trò hiện trường**, tối ưu thao tác bằng điện thoại + quét mã:

| Vai trò | Màn hình chính | Use case |
|---|---|---|
| **Thủ kho** | Danh sách pallet, tạo pallet, nhập tạm, chi tiết pallet | UC-PAL-01/02/04, UC-INTMP-01 |
| **Xe nâng** | Hàng chờ, cất pallet, **nhiệm vụ lấy hàng FEFO (mới)**, gợi ý FEFO, lịch sử | UC-FK-01/02/04 |
| **Kiểm kê** | Quét vị trí, ghi nhận đếm | UC-INV-06 |

- **Công nghệ:** Expo Router (điều hướng tab), Zustand (state auth), React Query (data), expo-secure-store (token), expo-barcode-scanner (camera).
- **Mới:** màn hình nhiệm vụ lấy hàng cho xe nâng (FULL/PARTIAL), avatar trên header 3 phân hệ, nền tảng **push notification (FCM)**.
- **Bộ component riêng** cho mobile: Badge, Button, Card, Input, EmptyState…

---

## 6. 🗄️ MÔ HÌNH DỮ LIỆU

**33 model** Prisma, **12 migration** (mới nhất: `2026-06-08_inbound_invoice_no`), nhóm theo miền:

- **Xác thực (4):** User, Session, OtpCode, PasswordResetToken
- **Dữ liệu chủ (4):** Product, ItemCode *(thêm barcode)*, ProductGroup, UnitOfMeasure
- **Hạ tầng kho (2):** Location, Supplier
- **Pallet (2):** Pallet, PalletLine
- **Nhập kho (4):** InboundRequest + Line, InboundTemp + Line
- **Luân chuyển (1):** Movement
- **Tồn kho/KK (4):** StocktakeSession, StocktakeCount, AdjustmentVoucher + Line
- **Xuất kho (4):** OutboundRequest + Line, OutboundRebalance + Line
- **Hệ thống/Audit (6):** SystemConfig, AuditLog (append-only), Attachment, MailLog, MailSettings, AlertSetting
- **Thông báo (1):** Notification
- **Mobile/Push (1):** 🆕 **DeviceToken** (FCM token: platform iOS/Android, device_name, app_version)

**Chuẩn hóa mã chứng từ:** PHN (nhập), PNT (nhập tạm), PL (pallet), STK (kiểm kê), ADJ (điều chỉnh), PYX (xuất), RBL (cân tồn) — sinh mã tự động theo năm.

---

## 7. 🧪 KIỂM THỬ & CHẤT LƯỢNG

| Hạng mục | Trạng thái |
|---|---|
| **E2E (Playwright)** | 6 bộ test: auth, rbac, pallets, inbound, master-data, mobile/scanner |
| **Vòng QA thủ công** | 78 ca test trên Google Sheet → xử lý xuyên suốt qua automation |
| **Audit log** | Append-only (bất biến), ghi đầy đủ actor + IP + thời gian |
| **Cơ chế auto-fix** | Slash command + scheduled task (cron 5 phút) tự đọc test fail → fix → commit |

**Phát hiện chất lượng quan trọng (từ HANDOFF):** ~70–80% ca "fail" thực ra là tester chạy trên code cũ trước khi fix (không tái hiện được); chỉ ~20% cần sửa code thật — nền code khá ổn định.

---

## 8. 🚀 TRIỂN KHAI

> **Mô hình production (đã SSH kiểm chứng 10/06, còn hiệu lực):** chạy **PM2 4-instance** từ `/var/www/wms-vinhgiang` — đúng như `DEPLOY.md`, KHÔNG phải Docker đơn-app.

- ✅ **Runtime production = PM2 4-instance** (cùng codebase Next.js, phân luồng theo vai trò):
  - `wms-vinhgiang` (cổng 4200) → `/wms` (Quản lý/Kế toán, desktop)
  - `wms-xenang` (3002) → `/xenang` · `wms-thukho` (3003) → `/thukho` · `wms-kiemke` (3004) → `/kiemke`
- ✅ **PostgreSQL chạy Docker** (`wms-postgres`) — Docker chỉ dùng cho DB.
- ℹ️ Có sẵn `Dockerfile` + `docker-compose.prod.yml` (thử nghiệm), nhưng container app **đã dừng** — không phải runtime hiện tại.
- ✅ **Reverse proxy Nginx** + firewall.
- ✅ Site đang chạy (trang `/wms` HTTP 200, đăng nhập trả JWT, cấu hình email OK).
- ✅ Email thật 3 nhà cung cấp (SMTP/Mailgun/SendGrid) — có nút verify + gửi thử.
- 🟡 **Đang xử lý:** Tên miền + chứng chỉ SSL.

**Tài khoản seed mặc định:** `admin@vinhgiang.vn` / `Aa@123456` (vai trò ADMIN) + tài khoản tài xế xe nâng demo.

> ⚠️ **Lưu ý:** `/var/www/wms-vinhgiang` **không phải git repo** (deploy bằng sửa/upload tay) → có drift với git. Xem [BAO_CAO_DRIFT_AUDIT_2026-06-10.md](BAO_CAO_DRIFT_AUDIT_2026-06-10.md). **Cần kiểm tra lại drift** sau đợt commit 06–11/06 (đặc biệt auto-dispatch xe nâng + push) đã đưa lên prod chưa.

---

## 9. 📈 MỐC PHÁT HÀNH (16 tag)

```
v0.0.1-docs → v0.1.0-foundation → v0.2.0-auth → v0.3.0-system
→ v0.4.0-master-data → v0.5.0-pallet → v0.6.0-inbound
→ v0.7.0-inbound-temp → v0.8.0-forklift → v0.9.0-outbound
→ v0.10.0-inventory → v0.11.0-dashboard → v0.12.0-integration
→ v0.13.0-system-misc → v0.14.0-mobile → (QA auto-fix 31 UC → polish + auto-dispatch xe nâng)
```

Sau `v0.14.0-mobile`, các thay đổi đi theo nhánh `vinhgiang1` và được merge vào `main` qua PR #4/#5/#6 (chưa gắn tag mới). **Khuyến nghị gắn tag** `v0.15.0` cho đợt auto-dispatch + push notification để chốt mốc nghiệm thu.

---

## 10. ⚠️ RỦI RO & VIỆC CÒN LẠI

### Việc còn lại (ưu tiên)
1. **Hoàn tất tên miền + SSL** `wms.vinhgiang.com` (đang dở).
2. **Re-test các UC gắn 🟡** với dữ liệu thật — Xuất kho (UC-OUT) & Tồn kho/Kiểm kê (UC-INV).
3. **Kiểm thử end-to-end 2 hạng mục mới:** auto-dispatch xe nâng (FEFO picking, FULL/PARTIAL) và push notification (FCM) trên thiết bị thật.
4. **Mở rộng độ phủ E2E** từ 6 lên toàn bộ luồng nghiệp vụ chính.
5. **Đồng bộ drift production ↔ git** sau đợt 06–11/06 (xác nhận auto-dispatch + push đã lên prod); đưa migration tay vào `prisma/migrations/`.

### Rủi ro kỹ thuật cần lưu ý
- **`README.md`** vẫn là bản mẫu mặc định của Next.js → nên viết lại mô tả thật của dự án.
- **Production không phải git checkout** → khuyến nghị chuyển `/var/www/wms-vinhgiang` thành git repo + deploy bằng `git pull` để chấm dứt drift.
- **Push notification mới (FCM):** cần cấu hình credential FCM thật + kiểm tra vòng đời `DeviceToken` (đăng ký/thu hồi token khi đăng xuất).
- **Sinh mã chứng từ (codegen):** khả năng tranh chấp (race condition) khi nhiều người tạo phiếu cùng lúc → nên bổ sung advisory lock ở DB nếu cần.
- **Nhiều nhánh trên remote** (`cuongdd_*`, `auto-fix-2026-05-29`, `wip-local-0608`, `vinhgiang1`…) → nên hợp nhất/dọn nhánh để tránh phân mảnh.

---

## 11. ✅ KẾT LUẬN

Dự án WMS Vĩnh Giang giữ vững trạng thái **gần hoàn thiện (~91%)**: toàn bộ 11 module và ~55 use case đã dựng và chạy được, mobile app phục vụ 3 vai trò hiện trường đã sẵn sàng, hệ thống đã **triển khai chạy thật trên VPS** (PM2 4-instance + PostgreSQL Docker, sau Nginx). So với 10/06, đợt vừa rồi **làm sạch QA sâu** (đính kèm, thông báo 404, hồ sơ/avatar mobile, tồn kho), đồng thời bước sang **tự động hóa** với điều phối xe nâng theo FEFO và **đặt nền móng push notification**.

**Để nghiệm thu (go-live), khối lượng còn lại chủ yếu là:** hoàn tất tên miền/SSL, re-test các luồng phức tạp + 2 tính năng mới với dữ liệu thật, đồng bộ drift production↔git, và dọn dẹp tài liệu/nhánh.

---

*Báo cáo lập dựa trên phân tích mã nguồn nhánh `main` @ `df8a29a` (pull ngày 15/06/2026). Số liệu commit/dòng-code/model/route được đếm trực tiếp từ repo tại thời điểm báo cáo. Tham chiếu báo cáo trước: [BAO_CAO_TIEN_DO_DU_AN_2026-06-10.md](BAO_CAO_TIEN_DO_DU_AN_2026-06-10.md) và audit drift [BAO_CAO_DRIFT_AUDIT_2026-06-10.md](BAO_CAO_DRIFT_AUDIT_2026-06-10.md).*

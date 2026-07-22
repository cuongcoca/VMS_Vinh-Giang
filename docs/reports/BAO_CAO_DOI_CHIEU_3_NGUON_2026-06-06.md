# BÁO CÁO ĐỐI CHIẾU 3 NGUỒN CODE — WMS Vĩnh Giang
**Ngày lập:** 2026-06-06
**3 nguồn so sánh:**
| Ký hiệu | Nguồn | Mốc |
|---|---|---|
| **github** | Nhánh GitHub `vinhgiang1` | commit `0b5191e` (HEAD origin lúc đối chiếu) |
| **188** | VPS cá nhân `188.166.210.73` | `/var/www/wms-vinhgiang` (hiện trạng đĩa) |
| **42** | VPS công ty `42.96.16.197` | `/var/www/wms-vinhgiang` (production) |

> 📎 **Phụ lục diff từng ký tự:** `PHU_LUC_DIFF_3_NGUON_2026-06-06.txt` (13.159 dòng) — chứa **toàn bộ hunk diff đã chuẩn hoá** cho mọi file khác nhau. Báo cáo này là bản tóm tắt có cấu trúc; muốn xem chính xác từng dấu chấm/dấu phẩy của 1 file thì tra phụ lục theo `FILE: <đường dẫn>`.

---

## 1. Phương pháp (vì sao kết quả đáng tin)

1. Kéo nguyên code 3 nguồn về máy (github qua `git archive`, 2 VPS qua `tar` SFTP).
2. **Chuẩn hoá xuống dòng (xoá ký tự CR `\r`) TRƯỚC khi so** → loại sạch nhiễu CRLF/LF. Đây là bài học cũ: `git diff` thô từng báo ~100 file khác nhưng 80% chỉ là khác kiểu xuống dòng. **Mọi khác biệt trong báo cáo này là KHÁC THẬT về nội dung.**
3. Lập **manifest md5** cho TẤT CẢ file ở mỗi nguồn → xác định chính xác file nào thêm/mất/đổi.
4. Với mỗi file text khác nhau → chạy `diff -u` lấy đúng từng dòng.

**Đã loại khỏi so sánh** (không phải "code người viết"): `node_modules/`, build output `.next/`, `.next-xenang/`, `.next-thukho/`, `.next-kiemke/` (~11.600 file sinh tự động), file `.env*` (bí mật, khác theo môi trường), `public/uploads/` (ảnh runtime), `backups/`.

**Số liệu thô:** github 632 file · 188 12.306 file · 42 12.446 file (chênh lệch hầu hết là build output 3 instance). Sau khi lọc còn **vùng code-app** để soi kỹ.

---

## 2. KẾT LUẬN NHANH (TL;DR)

⚠️ **Không nguồn nào là bản đầy đủ nhất.** 3 nhánh đã **phân kỳ theo 2 hướng khác nhau** — mỗi bên hơn bên kia một mảng:

| | **42 (công ty) HƠN** | **188 (cá nhân) HƠN** |
|---|---|---|
| **Mảng** | Hệ thống **Thông báo + Push (Firebase)** | **Sửa UI/UX + logic nghiệp vụ** mới + **app `mobile/`** |
| **Cụ thể** | `notifyByRoles`/push còn đủ trên ~23 API route; có `firebase-admin`, model `DeviceToken`, `push-service.ts`, `push-tokens` route | ~35 file sửa lỗi/thêm tính năng (validate, phân quyền, phân trang, gửi OTP/mail Brevo, quét mã vạch, profile…); 33 file app React Native `mobile/` |

- **github `vinhgiang1`** = bản nền ở giữa, **không đồng nhất**: một số route đã gỡ thông báo (giống 188), một số còn giữ (giống 42), có model `DeviceToken` trong schema nhưng lại thiếu code push runtime → đang ở trạng thái chuyển tiếp dở dang.
- **Tổng khác biệt vùng code-app:** **47 file chỉ có ở 188**, **6 file chỉ có ở 42**, **78 file có ở cả hai nhưng khác nội dung**.

🔴 **Cảnh báo quan trọng phát hiện được:**
1. Trên **42**, trang `inventory/alerts` (bản mới, gọi API `/api/inventory/alert-settings`) đã có, **nhưng route `/api/inventory/alert-settings` lại CHỈ tồn tại ở 188** → tính năng Cấu hình cảnh báo trên 42 nhiều khả năng **lỗi/không lưu được**.
2. File `ssh-upload.js` và `ssh-run.js` (bản 42 và github) **hardcode mật khẩu VPS production** `nSmaPGEY39` trong source — rủi ro bảo mật.
3. 42 thiếu `mobile/` hoàn toàn (nếu công ty cần app điện thoại thì phải bổ sung).

---

## 3. PHẦN A — File CHỈ CÓ ở 188 (42 KHÔNG có) — 47 file

### A1. App di động `mobile/` (33 file) — github+188 CÓ, **42 KHÔNG**
Toàn bộ app React Native/Expo (đăng nhập, home, inbound, pallets, forklift, stocktake, profile, components, theme…). 42 hoàn toàn không có thư mục `mobile/`.

```
mobile/app/_layout.tsx, mobile/app/index.tsx, mobile/app/login.tsx
mobile/app/(tabs)/_layout.tsx, home.tsx, profile.tsx
mobile/app/(tabs)/forklift/{_layout,index,movements,pick}.tsx
mobile/app/(tabs)/inbound/{_layout,index,new-temp}.tsx
mobile/app/(tabs)/pallets/{_layout,index}.tsx
mobile/app/(tabs)/stocktake/{_layout,index}.tsx
mobile/src/api/client.ts, mobile/src/auth/{auth-store,token-storage}.ts
mobile/src/components/{Badge,Button,Card,Empty,Input,ScreenContainer}.tsx
mobile/src/theme/colors.ts
mobile/{app.json,babel.config.js,package.json,tsconfig.json,README.md}
```

### A2. Code backend chỉ ở 188 (github KHÔNG, 42 KHÔNG)
| File | Ghi chú |
|---|---|
| `src/app/api/inventory/alert-settings/route.ts` | 🔴 **Route Cấu hình cảnh báo — CHỈ có ở 188.** Trang `inventory/alerts` ở cả 188 và 42 đều gọi route này, nhưng 42 thiếu route → 42 sẽ lỗi khi lưu cấu hình cảnh báo. |
| `migrate-audit-log.sh`, `migrate-batch.sh`, `migrate-stocktake-lot-expiry.sh`, `migrate-units-per-box.sh` | 4 script migration DB chỉ có ở 188 |
| `reset-data.sh` | Script reset data chỉ ở 188 |
| `scripts/seed-staging-test.js` | Script seed staging chỉ ở 188 |

### A3. Có ở github+188, 42 KHÔNG (chủ yếu hạ tầng/deploy — bình thường vì 42 không phải bản git checkout)
| File | Loại |
|---|---|
| `vps-deploy.js`, `vps-sync.js`, `ssh-run-company.js` | Script deploy/SSH |
| `nginx-kho.conf`, `nginx-khohangvinhgiang.conf`, `nginx-mobile-blocks.conf`, `nginx-vps-chioi.conf` | Cấu hình Nginx |
| `setup-khohangvinhgiang.sh` | Script setup domain |

> Các file A3 là tài nguyên hạ tầng/deploy, theo môi trường — không nhất thiết phải đồng bộ sang 42.

---

## 4. PHẦN B — File CHỈ CÓ ở 42 (188 KHÔNG có) — 6 file

| File | Có ở github? | Ý nghĩa |
|---|---|---|
| `src/app/api/push-tokens/route.ts` | ❌ chỉ 42 | **API đăng ký FCM device token** (Push notification) — chỉ 42 |
| `src/lib/push-service.ts` | ❌ chỉ 42 | **Service gửi Push qua Firebase** (`sendPushToUser`/`sendPushToRoles`) — chỉ 42 |
| `prisma/migrations/2026-05-28_audit_logs_append_only.sql` | ✅ github+42 | Migration trigger chặn UPDATE/DELETE audit_logs — 188 thiếu file (nhưng DB 188 có thể đã áp) |
| `scripts/sheet-ops.js` | ✅ github+42 | Script thao tác Google Sheet — 188 thiếu file |
| `scripts/test-fixtures.js` | ✅ github+42 | Script test fixtures — 188 thiếu file |
| `scratch_test.ts` | ❌ chỉ 42 | File nháp, bỏ qua |

> `push-tokens/route.ts` + `push-service.ts` là **lõi tính năng Push trên 42** mà 188 không có (188 đã gỡ toàn bộ mảng push).

---

## 5. PHẦN C — File có ở CẢ 188 + 42 nhưng KHÁC NỘI DUNG — 78 file

### C1. Cấu hình & Schema DB (4 file) — ⭐ đọc kỹ

| File | Bên hơn | Khác biệt chính xác |
|---|---|---|
| `prisma/schema.prisma` | **42 = github** | 42 & github **CÓ** `model DeviceToken` (bảng `device_tokens`: token FCM, platform, device_name, app_version… + quan hệ `User.deviceTokens`). **188 ĐÃ XOÁ** model này + field `deviceTokens` trong `User`. |
| `package.json` | **42** | **42** có `firebase-admin@^13.10.0` + `googleapis@^172.0.0`. **github** có `googleapis` nhưng KHÔNG có `firebase-admin`. **188** KHÔNG có cả hai. |
| `package-lock.json` | **42** | 42 còn nguyên cây phụ thuộc firebase + google (@firebase/*, @google-cloud/*, @grpc/*, gaxios, google-auth-library, protobufjs…). 188/github đã gỡ. |
| `tsconfig.json` | **42 = 188** | 42 & 188 GIỐNG HỆT, đều thêm include type cho `.next-thukho` + `.next-kiemke` (build 4 instance). github cũ hơn (chỉ `.next` + `.next-xenang`). Ảnh hưởng build, không ảnh hưởng logic. |

### C2. Nhóm "**42 GIỮ Thông báo/Push, 188 ĐÃ GỠ**" (23 file) — 42 nhiều code hơn

> Mẫu chung: 42 (thường == github) còn `import { notifyByRoles } from "@/lib/notifications"` và gọi gửi thông báo cho từng nghiệp vụ; **188 đã gỡ sạch** import + khối notify. Logic nghiệp vụ chính (đổi trạng thái) **không đổi** — chỉ mất việc gửi thông báo + push.

| File | Loại thông báo 42 còn / 188 mất | github |
|---|---|---|
| `src/lib/notifications.ts` | **Lõi:** 42/github = bản đầy đủ ~35 NotificationType + gọi push (`sendPushToUser/Roles`). 188 = rút gọn còn 5 type, không push. | = 188? (bản ngắn) — *xem ghi chú dưới* |
| `src/app/api/forklift/put-away/route.ts` | `PALLET_PUT_AWAY` → THU_KHO | github = 188 (đã gỡ) |
| `src/app/api/forklift/relocate/route.ts` | `PALLET_RELOCATED` → THU_KHO | github = 42 (còn giữ) |
| `src/app/api/forklift/return/route.ts` | `PALLET_RETURNED` → THU_KHO, KE_TOAN | github = 42 (còn giữ) |
| `src/app/api/forklift/stage-out/route.ts` | `PALLET_STAGED_OUT` / `PALLET_SPLIT_STAGED` (3 lần gọi) | github = 188 (đã gỡ) |
| `src/app/api/inbound/[id]/receive/route.ts` | `INBOUND_RECEIVING_STARTED` + `INBOUND_SENT_FOR_RECONCILIATION` | github = 42 |
| `src/app/api/inbound/[id]/finish-receiving/route.ts` | `INBOUND_SENT_FOR_RECONCILIATION` | github = 188 |
| `src/app/api/inbound/[id]/request-recheck/route.ts` | `INBOUND_RECHECK_REQUESTED` → THU_KHO | github = 42 |
| `src/app/api/inbound/[id]/complete/route.ts` | `INBOUND_COMPLETED` → THU_KHO | github = 42 |
| `src/app/api/inbound/import-excel/confirm/route.ts` | `INBOUND_EXCEL_IMPORTED` → THU_KHO | github = 42 |
| `src/app/api/inbound-temp/route.ts` | `INBOUND_TEMP_CREATED` → KE_TOAN | github = 42 |
| `src/app/api/inbound-temp/[id]/reject/route.ts` | `INBOUND_TEMP_REJECTED` → THU_KHO | github = 42 |
| `src/app/api/inbound-temp/[id]/standardize/route.ts` | `INBOUND_TEMP_STANDARDIZED` (mode link & create) | github = 188 (chưa có; 42 thêm) |
| `src/app/api/outbound/requests/route.ts` | `OUTBOUND_REQUEST_CREATED` → THU_KHO, XE_NANG | github = 188 (chưa có; 42 thêm) |
| `src/app/api/outbound/requests/[id]/route.ts` | `OUTBOUND_PICKING_STARTED`/`OUTBOUND_SHIPPED`/`OUTBOUND_CANCELLED` | github = 42 |
| `src/app/api/outbound/release/route.ts` | `PALLET_RELEASED` → THU_KHO, KE_TOAN | github = 188 (đã gỡ) |
| `src/app/api/outbound/rebalance/route.ts` | `OUTBOUND_REBALANCED` → THU_KHO | github = 42 |
| `src/app/api/stock-count/route.ts` | `STOCKTAKE_CREATED` → THU_KHO | github = 42 |
| `src/app/api/stock-count/[id]/complete/route.ts` | `STOCKTAKE_DISCREPANCY`/`STOCKTAKE_CLOSED` | github = 188 (đã gỡ) |
| `src/app/api/pallets/[id]/confirm/route.ts` | `PALLET_CONFIRMED` → XE_NANG | github = 42 |
| `src/app/api/pallets/[id]/route.ts` (DELETE) | `PALLET_CANCELLED` → XE_NANG | github = 42 |
| `src/app/api/item-codes/[id]/route.ts` | `ITEM_CODE_STANDARDIZED` → THU_KHO | github = 42 |
| `src/app/api/adjustments/route.ts` (POST) | `ADJUSTMENT_CREATED` → KE_TOAN | github = 42 |

> *Ghi chú `notifications.ts`:* bản 42 import `push-service.ts` (chỉ 42 có file này) nên 42 mới chạy push thật. github tuy có model `DeviceToken` nhưng `notifications.ts` lại là bản ngắn và thiếu `push-service.ts` → github **không nhất quán** (có schema, thiếu runtime). Đây là dấu hiệu github đang dở dang giữa chừng.

### C3. Nhóm "**188 MỚI HƠN (sửa lỗi / thêm tính năng), 42 còn cũ**" (28 file)

> Phần lớn các file này: **188 == github** (bản đã sửa), còn **42 là bản cũ** chưa nhận sửa. Đây chính là "vài điểm 188 có mà 42 không" cần cân nhắc đưa sang 42.

| File | Quan trọng | Khác biệt (188 thêm/sửa gì so với 42) |
|---|---|---|
| `src/app/api/auth/forgot-password/send-otp/route.ts` | 🔴 cao | **188 GỬI OTP THẬT qua email** (`sendMail`, template HTML có escape chống XSS, lỗi gửi → trả 502 thay vì "đã gửi" giả). **42 chỉ tạo OTP, luôn trả "đã gửi"** (không gửi mail). |
| `src/app/system/profile/page.tsx` | 🔴 cao | 188 **sửa 3 lỗi lưu hồ sơ**: gửi `full_name` (snake_case) thay vì `fullName` (42 gửi sai → không lưu được); báo "không có thay đổi"; `auth.saveUser` ghi localStorage (42 refresh mất). |
| `src/app/system/users/page.tsx` | 🔴 cao | 188 **thêm SỬA user** (PUT `/api/users/[id]`, mật khẩu để trống = giữ nguyên, bắt buộc email HOẶC SĐT). 42 chỉ có tạo mới. |
| `src/app/api/products/route.ts` | 🔴 cao | 188 **sửa bug `is_active`** (lưu đúng giá trị tick; 42==github bỏ qua → SP mới luôn "đang hoạt động"). |
| `src/app/api/pallets/route.ts` | 🔴 cao | 188 đổi `if(auto_populate_lines && existingPalletsCount===0)` — **chỉ copy dòng hàng cho pallet ĐẦU**, pallet thứ 2+ để trống để quét thực tế. 42==github copy cho mọi pallet (dễ trùng). |
| `src/app/thukho/pallet/new/page.tsx` | 🔴 cao | 188 nạp `GET /api/inbound` (mọi phiếu đang mở, hỗ trợ 1 phiếu–nhiều pallet). 42 lọc `?has_pallet=false` (chỉ phiếu chưa gắn pallet). |
| `src/app/pallets/page.tsx` | 🔴 cao | Tương tự: 188 bỏ `?has_pallet=false`, hiện mọi phiếu mở. |
| `src/app/api/locations/route.ts` | 🔴 cao | 188 thêm query `?occupied=1` (trả vị trí đang có pallet, kể cả FULL). 42 thiếu → kiểm kê theo vị trí có thể sót vị trí đầy. |
| `src/app/stock-count/new/page.tsx` | trung bình | 188 đổi fetch `?status=USING` → `?occupied=1` (lấy cả vị trí FULL). 42 còn `?status=USING` → **sót vị trí đầy**. |
| `src/app/stock-count/[id]/discrepancy/page.tsx` | 🔴 cao | 188 thêm UC-INV-08: hiển thị pallet/lô/HSD, **bắt buộc nhập lý do khi "Yêu cầu kiểm lại"**, ghi chú lúc đếm. 42 thiếu. |
| `src/app/stock-count/[id]/page.tsx` | 🔴 cao | 188 chỉ cho "Xử lý chênh lệch" khi phiên đã khoá (hoàn tất đếm); 42 cho xử lý cả khi chưa khoá. |
| `src/app/inventory/adjustments/[id]/page.tsx` | 🔴 cao | 188 thêm **phân quyền** (chỉ QUAN_LY duyệt/từ chối), modal **bắt buộc lý do từ chối**, badge mã lý do. 42 là bản cũ 1 bước, không phân quyền. |
| `src/app/api/adjustments/[id]/approve/route.ts` | 🔴 cao | 188 thêm `requireAuth(['QUAN_LY'])` + ghi `performed_by`/`audit`. **42 không phân quyền, nhưng 42 còn giữ notify** `ADJUSTMENT_APPROVED`. → **xung đột, cần gộp.** |
| `src/app/api/adjustments/[id]/reject/route.ts` | 🔴 cao | 188 thêm `requireAuth(['QUAN_LY'])` + bắt buộc `rejected_reason` + audit. **42 giữ notify** thay vì phân quyền. → **xung đột, cần gộp.** |
| `src/app/api/item-codes/route.ts` | 🔴 cao | 188 thêm `validateSpecification` (chặn lưu quy cách sai, trả 400). **42 không validate nhưng còn notify** `ITEM_CODE_CREATED`. → **xung đột, cần gộp.** |
| `src/app/thukho/item-code/new/page.tsx` | 🔴 cao | 188 thêm `validateSpecification` chặn lưu quy cách sai. 42 chưa validate. |
| `src/app/master-data/page.tsx` | 🔴 cao | 188 thêm chặn nhập ký tự không phải số (`blockNonNumericKey/Paste`), thông báo lỗi tiếng Việt, dùng chung `PRODUCT_EXCEL_COLUMNS` cho Xuất & Mẫu import (khớp cột). 42 cũ. |
| `src/app/api/system/mail/route.ts` | 🔴 cao | 188 mask thêm `brevo_api_key`. **42 thiếu → lộ `brevo_api_key`** (không che). |
| `src/lib/mailer.ts` | 🔴 cao | 188 thêm provider **Brevo** (`POST api.brevo.com/v3/smtp/email`, verify, `parseFrom`). 42/github chỉ có smtp/mailgun/sendgrid. |
| `src/app/inventory/page.tsx` | trung bình | 188 thêm **lọc theo trạng thái tồn** + **phân trang** (PAGE_SIZE=50), hiện tên nhóm. 42 chưa có. |
| `src/app/item-codes/page.tsx` | trung bình | 188 thêm dropdown **chọn số dòng/trang** (3/5/10/20/50). 42 hardcode 10. |
| `src/app/inbound/new/page.tsx` | trung bình | 188 render dropdown gợi ý mã hàng bằng `createPortal` ra body (không bị bảng cuộn cắt). 42 dùng dropdown absolute cũ bị cắt. |
| `src/app/forklift/pallet/page.tsx` | trung bình | 188 thêm toast cảnh báo "Pallet không tồn tại" khi quét mã sai, lọc đúng pallet. 42 chỉ gán thẳng search. |
| `src/app/forklift/put-away/page.tsx` | 🔴 cao | 188 thêm regex validate mã vị trí `^[A-Z]{1,3}-\d{1,3}-\d{1,2}$` trước khi tra server. 42 thiếu. |
| `src/app/thukho/inbound/[id]/page.tsx` | trung bình | 188 thêm thanh tiến độ "Đã lên pallet" (số thùng đã quét / tổng). 42 thiếu. |
| `src/app/inbound/[id]/page.tsx` | trung bình | 188 thêm card tiến độ `total_on_pallets`. **42 còn giữ notify `INBOUND_CANCELLED` khi DELETE.** → **xung đột nhẹ, cần gộp.** |
| `src/app/api/inbound/[id]/route.ts` | 🔴 cao | 188 thêm thống kê `total_on_pallets` trong `stats`. **42 còn giữ notify `INBOUND_CANCELLED` (DELETE).** → **xung đột, cần gộp.** |
| `src/app/kiemke/tasks/page.tsx` | trung bình | 188 sửa enum tab `OPEN/COUNTING/RECONCILING/CLOSED` (42 còn dùng `COMPLETED` lọc sai), thêm nhãn tiếng Việt. |
| `src/app/kiemke/tasks/[id]/page.tsx` | trung bình | 188 thêm ô tìm kiếm trong phiếu KK + chặn nhập số âm (`Math.max(0,…)`). 42 thiếu. |
| `src/app/kiemke/scan/page.tsx` | trung bình | 188 chặn nhập số lượng âm. 42 cho phép âm. |
| `src/app/scan-debug/page.tsx` | trung bình | 188 đổi khung quét vuông → khung rộng responsive (quét mã 1D trên điện thoại). 42 còn khung vuông. |
| `src/app/thukho/warehouse/staging/page.tsx` | trung bình | 188 "dàn phẳng" dữ liệu pallet→dòng hàng (hiện đúng mã/tên/SL/HSD). 42 hiện dữ liệu thô sai. |
| `src/app/inventory/adjustments/page.tsx` | trung bình | 188 thêm badge mã lý do + "Từ kiểm kê". 42 hiện reason thô. |
| `src/app/outbound/reorder/page.tsx` | trung bình | 188 sửa validate số ngày dự trữ + nút "Tạo phiếu" luôn hiện (chưa chọn thì cảnh báo). 42 cũ. |
| `src/app/api/inventory/by-item/route.ts` | trung bình | 188 thêm fallback lấy nhóm hàng qua `product.group` (42 thiếu → có thể trống tên nhóm). |
| `src/app/api/product-groups/route.ts` | (42 hơn) | **42==github giữ `code` trong select; 188 bỏ `code`.** (đây là chỗ 42 nhỉnh hơn) |
| `src/components/layout/UcHeader.tsx` | thấp | 188 dùng `<HelpGuideButton/>` (nút hướng dẫn có popup). 42 nút help tĩnh. |
| `src/app/page.tsx` | thấp | 188 đọc footer từ `useSystemConfig` (cấu hình được). 42 hardcode footer. |
| `src/app/auth/page.tsx` | thấp | 188 thêm icon máy quét mã vạch trong ô đăng nhập. 42 không. |
| `src/app/inventory/by-lot/page.tsx` | trung bình | 188 hiển thị SL theo **đơn vị tính** (chai/lon) ngoài số thùng. 42 chỉ thùng. |

> Liên quan các file C3 còn có 3 file phụ thuộc **chỉ ở 188** (Phần A2): `src/lib/spec-validate.ts`, `src/lib/help-guides.ts`, `src/components/layout/HelpGuideButton.tsx` — phải bê kèm khi đưa các tính năng validate quy cách / nút hướng dẫn sang 42.

### C4. Nhóm "**188 == 42, cả hai MỚI HƠN github**" (7 file)

> Hai VPS đã đồng bộ với nhau ở các file này, chỉ github còn cũ. Không cần đối chiếu 188↔42, nhưng cho thấy github chưa nhận các cập nhật này.

| File | 188 & 42 mới hơn github ở chỗ |
|---|---|
| `src/components/shared/BarcodeScanner.tsx` | Thêm format UPC/CODE_93/ITF/CODABAR, khung quét rộng responsive cho mã 1D, kiểm tra secure-context, fallback chọn camera sau, thông báo lỗi tiếng Việt. |
| `src/components/shared/BarcodeScannerModal.tsx` | (188==github theo agent — thực chất 188 & 42 đều cải thiện) cho phép đọc mã từ ảnh full-res, mở rộng khung nhìn. |
| `src/app/api/users/[id]/route.ts` | PUT user: thêm bcrypt đổi mật khẩu, email/phone, validate email, bắt lỗi trùng. |
| `src/app/api/inventory/by-lot/route.ts` | Thêm `qty_unit` + `units_per_box` + đơn vị tính. |
| `src/app/inventory/alerts/page.tsx` | UC-INV-05: cấu hình 5 loại cảnh báo, lưu qua API. 🔴 **Nhưng 42 thiếu route `/api/inventory/alert-settings` (Phần A2) → 42 lưu sẽ lỗi.** |
| `src/app/outbound/rebalance/page.tsx` | Tự nhận dấu phân cách CSV, phân loại dòng lỗi, gộp dòng trùng, "tạm hoãn" lưu localStorage. |
| `src/app/system/mail/page.tsx` | Thêm UI provider Brevo (form API key, gửi qua HTTPS 443). |

### C5. Script hạ tầng (khác theo môi trường — KHÔNG cần đồng bộ) (4 file)

| File | Khác biệt |
|---|---|
| `ssh-run.js` | 188 trỏ host `188.166.210.73` + SSH agent; **42/github trỏ `42.96.16.197` + hardcode mật khẩu `nSmaPGEY39`** 🔴 |
| `ssh-upload.js` | Tương tự — **42/github hardcode mật khẩu VPS production** 🔴 |
| `setup-domain.sh` | `EXPECTED_IP` + site nginx khác theo VPS (188 vs 42). |
| `watch-dns.sh` | `EXPECTED_IP` khác theo VPS. |

---

## 6. PHẦN D — Khác biệt ngoài vùng code-app (tham khảo)

| Mục | github | 188 | 42 | Ghi chú |
|---|---|---|---|---|
| `.next-xenang/`, `.next-thukho/`, `.next-kiemke/` | — | ~11.600 file | ~11.500 file | **Build output**, sinh tự động khi `npm run build` — không phải code nguồn, khác nhau là bình thường. |
| `vinh_giang_wms-main/` | 193 file | 191 file | **472 file** | Bản **NestJS cũ lồng trong repo** (theo docs monorepo). Trên 42 có thêm `backend/dist/` (281 file .js/.d.ts/.map đã build). Là **di tích/legacy**, không phải app đang chạy (app chạy là Next.js ở `src/`). |
| `vaitro/` | — | 47 file | 10 file | Thư mục tài liệu/ảnh vai trò — chỉ trên VPS. |
| `scratch/`, `secrets/` | — | — | 54 + 2 file | Chỉ trên 42 (nháp + bí mật). Không đụng. |
| `docs/` | 17 file | 15 file | 10 file | Tài liệu, lệch vài file giữa 3 nguồn. |

---

## 7. KHUYẾN NGHỊ (nếu mục tiêu là đồng bộ 42 lên ngang 188)

**Nhóm 1 — Nên đưa sang 42 ngay (sửa lỗi/bảo mật, ưu tiên cao):**
1. `system/profile/page.tsx` — sửa lỗi không lưu được hồ sơ.
2. `api/products/route.ts` — sửa bug `is_active`.
3. `api/system/mail/route.ts` — mask `brevo_api_key` (đang lộ trên 42).
4. Bổ sung route **`api/inventory/alert-settings/route.ts`** vào 42 (đang thiếu → trang cảnh báo lỗi).
5. `api/auth/forgot-password/send-otp/route.ts` + `lib/mailer.ts` — gửi OTP/mail thật (Brevo). *Cần kèm cấu hình mail.*
6. Phân quyền duyệt/từ chối điều chỉnh: `api/adjustments/[id]/approve` + `reject` + `inventory/adjustments/[id]/page.tsx`. ⚠️ Gộp với phần notify mà 42 đang giữ.

**Nhóm 2 — Tính năng/UX nên cân nhắc:**
- App `mobile/` (33 file) nếu cần app điện thoại cho công ty.
- Validate quy cách (`spec-validate.ts` + 2 file dùng nó), phân trang tồn kho/mã hàng, sửa quét mã vạch, logic 1 phiếu–nhiều pallet, kiểm kê theo vị trí `?occupied=1`.

**Nhóm 3 — Quyết định kiến trúc cần làm rõ:**
- **Có giữ Push/Firebase không?** Nếu CÓ → 42 đang đúng hướng, đừng để 188 ghi đè (188 đã gỡ sạch push + `DeviceToken` + `firebase-admin`). Nếu KHÔNG → theo 188.
- **5 file XUNG ĐỘT** (cả 2 đổi khác nhau, phải gộp tay, không ghi đè 1 chiều): `api/item-codes/route.ts`, `api/inbound/[id]/route.ts`, `api/adjustments/[id]/approve/route.ts`, `api/adjustments/[id]/reject/route.ts`, và `lib/notifications.ts`.

**Nhóm 4 — KHÔNG đồng bộ (cố ý khác theo môi trường):**
- `ssh-*.js`, `vps-*.js`, `nginx-*.conf`, `setup-*.sh`, `watch-dns.sh`, `.env*`, build output `.next-*`.
- 🔴 **Bảo mật:** gỡ mật khẩu VPS hardcode trong `ssh-upload.js`/`ssh-run.js` (bản 42 & github), chuyển sang biến môi trường.

---

## 8. Phụ lục & cách tra cứu

- **`PHU_LUC_DIFF_3_NGUON_2026-06-06.txt`** — diff đầy đủ từng dòng (đã bỏ CR). Mỗi file 1 block `FILE: <đường dẫn>`, có `DIFF 42 -> 188` (`+` = chỉ ở 188, `-` = chỉ ở 42), `DIFF github -> 188`, `DIFF github -> 42`.
- Dữ liệu so sánh thô (manifest md5, diffstat, danh sách file) nằm ở thư mục `.compare3/` trong repo local.

**Tổng kết con số:** 47 file chỉ-188 · 6 file chỉ-42 · 78 file khác nội dung (4 config/schema · 23 notify · ~38 UI/logic · 7 đồng bộ 188=42 · 4 script hạ tầng · 5 xung đột cần gộp).

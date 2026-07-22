# BÁO CÁO ĐỐI CHIẾU 3 NGUỒN — TÌNH HÌNH HIỆN TẠI
**Ngày:** 2026-06-06 (bản cập nhật, sau khi đã đồng bộ trong ngày)
**3 nguồn:** `github` = `origin/vinhgiang1 @ 91520d0` · `188` = VPS 188.166.210.73 · `42` = VPS 42.96.16.197 (production)

> ⚠️ **Khác báo cáo sáng nay:** trong ngày tôi đã (1) đưa 39 cải tiến của 188 sang 42, (2) push bản union lên GitHub. Nên `vinhgiang1` giờ = `91520d0` (không còn `0b5191e`). Báo cáo này phản ánh **đúng hiện tại**.
>
> 📎 Phụ lục diff từng ký tự: `PHU_LUC_DIFF_3_NGUON_HIENTAI_2026-06-06.txt`.

---

## 1. TL;DR — tình hình bây giờ

| Cặp | Kết luận |
|---|---|
| **github ↔ 42** | **Đã đồng bộ.** Toàn bộ `src/`, `prisma/`, `package.json` **giống hệt** nhau (github = bản union của 42). Chỉ khác 3 file ngoài code (config theo môi trường). |
| **188 ↔ 42/github** | Còn khác biệt 3 nhóm: 🔴 **8 file 188 còn hơn 42 (bỏ sót, NÊN port)** · 🟡 ~27 file notify/push (42 đúng, KHÔNG port) · 🔵 app `mobile/` + tài liệu/dev (riêng). |

**Số liệu:** github 445 file · 188 449 · 42 386.
- github vs 42: **3 file khác nội dung**, 75 chỉ-github (mobile + docs), 16 chỉ-42 (rác local).
- 188 vs 42: **42 file khác nội dung**, 36 chỉ-188, 6 chỉ-42.

---

## 2. github(union) ↔ 42 — coi như ĐỒNG NHẤT ✅

`src/`, `prisma/schema.prisma`, `package.json`, `package-lock.json`: **giống hệt từng ký tự** (đã CR-strip md5). Việc sync hôm nay thành công.

**Chỉ 3 file khác (đều NGOÀI code app, không quan trọng):**
| File | Khác gì | Xử lý |
|---|---|---|
| `tsconfig.json` | github thiếu include type `.next-thukho` + `.next-kiemke` (chỉ ảnh hưởng type-check khi build 4 instance) | nên đồng bộ cho gọn (không gấp) |
| `ssh-run.js`, `ssh-upload.js` | khác host/mật khẩu VPS (188 dùng SSH agent; 42/github hardcode `nSmaPGEY39`) | khác theo môi trường — KHÔNG sync. 🔴 nên gỡ mật khẩu hardcode |

> Các file "chỉ có ở github" (75) = `mobile/` (33) + các báo cáo `.md`, `nginx-*.conf`, `docs/`, script deploy… đã commit trong git nhưng 42 (bản deploy) không chứa — **bình thường**. "Chỉ 42" (16) = `vaitro/`, `scratch_test.ts`, `quanly.txt`, `tsconfig.tsbuildinfo`… = rác/sinh tự động.

---

## 3. 🔴 GAP THẬT: 8 file 188 CÒN HƠN 42 (bỏ sót đợt port trước — NÊN PORT)

> **Vì sao sót:** đợt đối chiếu trước phân loại nhầm các file này là "188 == 42" nên tôi không port. Đối chiếu lại bằng diff xác định (CR-strip) phát hiện **188 thực ra đang hơn**, và do tôi sync github TỪ 42 nên **github cũng thiếu** theo. Đã **kiểm tra trực tiếp trên 42 live** — xác nhận thiếu thật (grep = 0).

| File | 188 có / 42+github THIẾU | Quan trọng |
|---|---|---|
| `src/app/api/inventory/by-lot/route.ts` | trả thêm `qty_unit` + `units_per_box` + đơn vị tính (UC-INV-04-TC002) để hiện SL theo chai/lon | 🔴 cao — trang by-lot (đã port) đang gọi mà route chưa trả → hiện thiếu ĐVT |
| `src/app/api/users/[id]/route.ts` | sửa user kèm **đổi mật khẩu (bcrypt)** + email/phone + validate | 🔴 cao — bảo mật/nghiệp vụ |
| `src/components/shared/BarcodeScanner.tsx` | thêm format **UPC_A/UPC_E/CODE_93/ITF/CODABAR** + cảnh báo secure-context (IP + cert tự ký chặn camera) | 🔴 cao — quét mã vạch 1D trên điện thoại |
| `src/components/shared/BarcodeScannerModal.tsx` | mặc định cho đọc mã từ **ảnh gallery** + mở rộng khung nhìn (`max-w-2xl`) | trung bình — độ tin cậy quét |
| `src/app/system/mail/page.tsx` | thêm **UI nhập Brevo** (42 đã có backend Brevo nhưng MÀN HÌNH chưa có ô nhập!) | 🔴 cao — Brevo trên 42 chưa dùng được vì thiếu ô nhập |
| `src/app/inventory/alerts/page.tsx` | `ALERT_TYPE_DEFS` 5 loại + lưu qua API `alert-settings` (UC-INV-05) | 🔴 cao — trang cảnh báo |
| `src/app/outbound/rebalance/page.tsx` | nhận CSV linh hoạt + gộp dòng trùng + "tạm hoãn" (localStorage) + báo dòng lỗi | trung bình |
| `src/app/inbound/[id]/page.tsx` | card tiến độ "Đã lên pallet" (`total_on_pallets`) | trung bình |

**→ Đây chính là phần "188 có mà 42 không" còn sót. Nên port 8 file này sang 42 rồi cập nhật lại github.** Tất cả đều an toàn (port thẳng, không file nào dính notify nên không ảnh hưởng Push).

---

## 4. 🟡 188 vs 42: nhóm KHÔNG nên port (42 đang ĐÚNG hơn)

### 4a. ~27 route Thông báo/Push — 42+github GIỮ, 188 đã GỠ
42 (và github) giữ `notifyByRoles` + Push/Firebase cho từng nghiệp vụ; 188 đã gỡ sạch. **Giữ 42 (đừng để 188 ghi đè).** Gồm:
```
adjustments/[id]/approve, reject, adjustments/route
forklift/put-away, relocate, return, stage-out
inbound-temp/route, [id]/reject, [id]/standardize
inbound/[id]/complete, finish-receiving, receive, request-recheck, route, import-excel/confirm
item-codes/route, [id]/route
outbound/rebalance, release, requests/route, requests/[id]/route
pallets/[id]/confirm, pallets/[id]/route
stock-count/route, [id]/complete
src/lib/notifications.ts (42 = bản đầy đủ 35 loại + push; 188 = rút gọn 5 loại)
```
Cộng 2 file **chỉ 42 có** (188 không): `src/app/api/push-tokens/route.ts`, `src/lib/push-service.ts` (lõi Push FCM).

### 4b. `src/app/api/product-groups/route.ts` — 42 ĐÚNG
42 giữ `code: true` trong select; 188 đã bỏ. → giữ 42, KHÔNG port 188.

### 4c. App `mobile/` (33 file) — github+188 có, 42 không
App React Native/Expo. **Deploy kiểu khác hẳn web** (build APK/Expo + nginx riêng). github đã có sẵn code, chưa chạy ở đâu.

### 4d. Dev/junk/config — khác theo môi trường, không cần
- Chỉ 188: `migrate-*.sh`, `migrate_*.sql`, `reset-data.sh`, nhiều `BAO_CAO_*.md`, `nginx-*.conf`, `vps-deploy.js`, `vps-sync.js`, `ssh-run-company.js`, `seed-staging-test.js`, `docs/*`.
- Chỉ 42: `vaitro/`, `scratch_test.ts`, `quanly.txt`.

---

## 5. KHUYẾN NGHỊ

1. **Port 8 file ở mục 3 sang 42** (an toàn, port thẳng) → rồi **cập nhật lại github** (commit thứ 2). Đây là việc nên làm ngay để 42 thật sự đủ.
2. Đồng bộ `tsconfig.json` lên github (gỡ lệch build-config nhỏ).
3. 🔴 Bảo mật: gỡ mật khẩu VPS hardcode trong `ssh-run.js`/`ssh-upload.js` (đang nằm trên github).
4. Mobile: để khi nào cần app điện thoại thì bàn riêng.

---

## 6. Phụ lục
`PHU_LUC_DIFF_3_NGUON_HIENTAI_2026-06-06.txt` — diff từng dòng (CR-strip) mọi file code khác biệt. Mỗi block `FILE:` có `[github vs 42]` (kiểm chứng đồng bộ) + `DIFF 42 -> 188` (`+`=chỉ 188, `-`=chỉ 42).

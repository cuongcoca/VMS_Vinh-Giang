# 🔍 BÁO CÁO AUDIT DRIFT — PRODUCTION ↔ GIT

> **Ngày:** 10/06/2026
> **So sánh:** Code đang chạy thật trên VPS `/var/www/wms-vinhgiang` (42.96.16.197) ↔ git `main` @ `00a1881` (sau khi đã merge `vinhgiang1`)
> **Phương pháp:** Hash MD5 từng file nguồn, chuẩn hóa CRLF→LF (loại trừ báo lệch giả do xuống dòng). Loại trừ `node_modules`, `.next*`, `.git`, `uploads`, `backups`.

---

## 1. 📊 TỔNG QUAN

| Nhóm | Số file | Ý nghĩa |
|---|---|---|
| **Khớp 100%** | ~480 | Production = git (không lệch) |
| **Khác nội dung** | **16** | Cùng đường dẫn, nội dung khác → cần xem hướng lệch |
| **Chỉ có trên production** | 199 | File prod có, git không |
| **Chỉ có trong git** | 34 | File git có, prod chưa deploy |

> Production: **677 file nguồn** · git main: **512 file**.

**Kết luận nhanh:** Lệch chủ yếu là **git mới hơn production** (production đang chạy bản cũ hơn `vinhgiang1` hiện tại). Chỉ có **2 file** là production sửa tay mà git chưa có (rủi ro mất nếu deploy đè) — và đều là tinh chỉnh nhỏ cho máy quét mã. **Không có trường/dữ liệu DB nào bị mất.**

---

## 2. 🔴 16 FILE KHÁC NỘI DUNG — phân theo hướng lệch

### 2a. GIT MỚI HƠN (12 file) — deploy git→prod sẽ NÂNG CẤP, không mất gì

| File | Khác biệt |
|---|---|
| `prisma/schema.prisma` | git thêm enum `MovementType.SHIP` (UC-FK-06/UC-OUT-05) — prod chưa có |
| `src/lib/rbac.ts` | git thêm quyền **"Lịch sử luân chuyển" (movements)** cho mọi vai trò |
| `src/components/layout/Sidebar.tsx` | git thêm menu "Lịch sử luân chuyển" |
| `src/app/api/movements/route.ts` | git +21 dòng (logic báo cáo luân chuyển) |
| `src/app/api/forklift/history/route.ts` | git +34 dòng |
| `src/app/api/forklift/return/route.ts` | git +22 dòng |
| `src/app/api/outbound/release/route.ts` | git +29 dòng |
| `src/app/api/pallets/[id]/history/route.ts` | git +1 dòng |
| `src/app/forklift/profile/page.tsx` | git refactor sang component dùng chung `MobileAccountSettings` |
| `src/app/kiemke/profile/page.tsx` | git refactor sang `MobileAccountSettings` |
| `src/app/thukho/profile/page.tsx` | git refactor sang `MobileAccountSettings` |
| `src/components/shared/BarcodeScanner.tsx` | git hỗ trợ **nhiều định dạng mã hơn** (EAN-8, UPC-A/E, CODE-39/93, ITF, CODABAR…) |

→ Đây là các tính năng đã có trên `vinhgiang1`/`main` nhưng **chưa được deploy** ra production.

### 2b. PRODUCTION SỬA TAY (2 file) — ⚠️ RỦI RO MẤT nếu deploy đè

| File | Production có mà git thiếu |
|---|---|
| `src/components/BarcodeScanner.tsx` | `useBarCodeDetectorIfSupported: false` + giới hạn định dạng (EAN_13/CODE_128/QR) + phát hiện mobile để chọn camera |
| `src/app/scan-debug/page.tsx` | `useBarCodeDetectorIfSupported: false` + giới hạn định dạng |

→ Đây là **tinh chỉnh máy quét** (ép dùng decoder của html5-qrcode thay vì BarcodeDetector của trình duyệt — thường để fix lỗi quét trên một số máy Android). Nếu deploy git đè lên, **mất tinh chỉnh này** (git đang để `true`). **Cần port sang git trước khi deploy** nếu tinh chỉnh này thực sự fix lỗi thực tế.

### 2c. Tooling (2 file) — không phải runtime, bỏ qua
`ssh-run.js`, `ssh-upload.js` (script deploy — khác phiên bản giữa máy, không ảnh hưởng app).

---

## 3. 📁 199 FILE "CHỈ CÓ TRÊN PRODUCTION" — bóc tách

| Nhóm | Số file | Nhận định |
|---|---|---|
| `vinh_giang_wms-main/backend` + `/frontend` | **187** | **Một project khác** (NestJS backend + frontend rời) nằm lẫn trong thư mục — bản export cũ, **KHÔNG thuộc app đang chạy** (PM2 chạy Next.js ở thư mục gốc). Nên archive/xóa cho gọn. |
| `scratch/` + `scratch_test.ts` | 9 | File nháp/thử nghiệm — rác. |
| `migrate_company_phase0_sync.sql`, `migrate_uc_fk_04_split.sql` | 2 | **Script migration chạy tay trên prod** — nên đưa vào `prisma/migrations/` của git để lưu vết. |
| `next-env.d.ts` | 1 | File Next.js tự sinh — bỏ qua. |

→ **Con số 199 gây hiểu lầm**: thực chất gần như toàn bộ là project rời + file rác, **không phải drift của WMS**. Chỉ 2 file SQL migration tay là đáng đưa về git.

---

## 4. 📁 34 FILE "CHỈ CÓ TRONG GIT" — chưa deploy ra prod

| Nhóm | Số file | Nhận định |
|---|---|---|
| `mobile/**` (Expo app) | 27 | App mobile native — deploy riêng, không chạy trên VPS web. Bình thường. |
| `src/components/mobile/MobileAccountSettings.tsx` | 1 | Component refactor hồ sơ — prod chưa có (nên 3 trang profile prod còn bản cũ). |
| `prisma/migrations/2026-06-04_movement_ship.sql` | 1 | Migration enum SHIP — **chưa apply trên prod** (khớp việc prod thiếu SHIP). |
| `vps-deploy.js`, `vps-sync.js`, `ssh-run-company.js`, `migrate_phase0.sql` | 4 | Script/tooling — không cần trên prod. |

---

## 5. ✅ KẾT LUẬN

1. **Production và git hiện CƠ BẢN ĐỒNG BỘ.** ~480/512 file khớp tuyệt đối.
2. **Hướng lệch chính: git mới hơn production.** Production đang chạy bản cũ hơn `vinhgiang1` ở 12 file (thiếu: tính năng Lịch sử luân chuyển, enum SHIP, refactor hồ sơ mobile, thêm định dạng quét mã). → Một đợt **deploy git→prod** sẽ đưa production lên ngang git.
3. **Rủi ro mất code production = RẤT NHỎ:** chỉ 2 file tinh chỉnh máy quét (`useBarCodeDetectorIfSupported:false`). Cần port sang git trước khi deploy.
4. **Không mất dữ liệu/DB:** schema git là superset của prod (prod không có field nào git thiếu).
5. **"199 file prod-only" là báo động giả** — 187 là project NestJS rời nằm lẫn + 9 file nháp. Drift thật chỉ là 2 SQL migration tay.

---

## 6. 🎯 KHUYẾN NGHỊ

| Ưu tiên | Việc | Lý do |
|---|---|---|
| 🔴 Cao | Port `useBarCodeDetectorIfSupported:false` + danh sách định dạng từ prod → git (2 file scanner) | Tránh mất tinh chỉnh quét mã khi deploy |
| 🔴 Cao | Đưa 2 file `migrate_*.sql` chạy tay trên prod vào `prisma/migrations/` | Lưu vết schema, tránh lệch DB về sau |
| 🟡 TB | Deploy git→prod (build lại 4 instance PM2 + `prisma db push`) | Đưa production lên ngang git (Lịch sử luân chuyển, SHIP, refactor hồ sơ…) |
| 🟡 TB | Biến `/var/www/wms-vinhgiang` thành **git checkout thật** (hiện không phải repo) | Chấm dứt tình trạng sửa tay → drift; deploy bằng `git pull` |
| 🟢 Thấp | Archive/xóa `vinh_giang_wms-main/` (project rời) + `scratch/` | Gọn thư mục, tránh nhầm lẫn |

> **Lưu ý quy trình:** Gốc rễ của drift là production **không phải git repo** nên mọi sửa tay không được ghi vết. Khuyến nghị #4 (biến prod thành git checkout + deploy bằng pull) sẽ ngăn lặp lại tình trạng này.

---

*Báo cáo dựa trên hash 677 file prod ↔ 512 file git main @ `00a1881`, ngày 10/06/2026. Dữ liệu thô: `_drift_audit/report-*.txt`.*

# BÁO CÁO — A2 cấu trúc: Route-group `(app)` để khung desktop mount 1 lần

**Phạm vi:** LOCAL (chưa deploy) · nhánh `cuongdd_web` · **Ngày:** 2026-07-30
**Mục tiêu:** Sidebar + Header desktop **mount đúng 1 lần** (không remount mỗi lần điều hướng) — bản "chuẩn Next.js" nối tiếp A1 (đã bỏ spinner/nháy) và A2-tạm (giữ scroll qua sessionStorage).

---

## 1. Cách làm (route-group `(app)`)
- Tạo **`src/app/(app)/layout.tsx`** = layout dùng chung của nhóm: chứa **Sidebar + khung marginLeft + guard** (redirect /auth, redirect vai mobile, access-denied) + **refresh RBAC nền 1 lần/phiên**. Vì là App Router layout, nó **persist** — điều hướng giữa các trang trong nhóm chỉ đổi `{children}`, Sidebar **không remount**.
- **`git mv`** 15 folder desktop + `page.tsx` gốc vào `(app)/`:
  `dashboard, inbound, inbound-adhoc, inventory, item-codes, locations, master-data, movements, outbound, pallets, product-groups, stock-count, suppliers, system, units` + `page.tsx`. Route-group `(app)` **trong suốt** → mọi URL GIỮ NGUYÊN.
- Giữ NGOÀI nhóm (không có khung desktop): `api, auth, forklift, thukho, kiemke, scan-debug` (mobile có layout riêng; auth/scan-debug/print full-màn).
- **`AppLayout` → nhẹ**: chỉ còn `<UcHeader title> + <main>`. 52 trang **không đổi 1 dòng** (vẫn `<AppLayout title="...">`), header vẫn có tiêu đề riêng.
- **Denylist trong group layout**: pathname kết thúc `/qr-print` → render bare (trang in Ctrl+P, không sidebar).

## 2. Vì sao an toàn (đã kiểm trước khi move)
- Không import tương đối (`./`, `../`) trong các trang → move không vỡ import (dùng `@/` alias).
- Không file nào import chéo tới đường dẫn trang → move không vỡ tham chiếu.
- Không có `layout/loading/error.tsx` bên trong các folder desktop → không xung đột.
- Dùng `git mv` → giữ lịch sử.

## 3. Kiểm thử (LOCAL, đo trực tiếp + build)

| Lớp route | Kỳ vọng | Kết quả |
|---|---|---|
| Trang desktop (pallets → item-codes) | Sidebar **cùng node** persist, giữ scroll | ✅ `asidePersisted_SAME_NODE: true`, scroll 130→130 |
| `/forklift` | KHÔNG sidebar desktop (layout forklift riêng) | ✅ `hasDesktopSidebarChrome: false` |
| `/pallets/qr-print` | Bare (không sidebar) | ✅ `hasSidebar: false`, hiện nội dung in |
| `/auth` | Bare + form đăng nhập | ✅ `hasSidebar: false`, có form |
| Vai KE_TOAN → `/system/users` | Màn "Không có quyền" | ✅ header "KHÔNG CÓ QUYỀN" + panel |
| `tsc --noEmit` | Sạch | ✅ |
| `npm run build` | Thành công | ✅ **EXIT 0**, "Compiled successfully", 161 trang static, URL giữ nguyên |
| Console | Không hydration mismatch/lỗi | ✅ sạch |

**So với A1:** trước đây aside **remount** mỗi lần điều hướng (đã che bằng render đồng bộ + giữ scroll). Nay aside **giữ nguyên node** (mount 1 lần thật) — bản chuẩn.

## 4. File thay đổi
```
MỚI:   src/app/(app)/layout.tsx          (khung persist + guard + denylist qr-print)
SỬA:   src/components/layout/AppLayout.tsx (rút gọn còn header + main)
MOVE:  src/app/{15 folder desktop} + page.tsx  →  src/app/(app)/...   (git mv, URL không đổi)
```

## 5. Lưu ý vận hành
- Lần `build` đầu báo lỗi type do **file type CŨ tồn dư** ở `.next-*/dev/types/` (bản `next dev` cũ còn trỏ đường dẫn trước khi move) — **không phải lỗi code**. Đã dọn `.next*/dev` và build lại EXIT 0. Trên server deploy chạy `next build` (không có `dev/types`) nên không gặp; nếu máy nào từng chạy `next dev` thì xóa `.next*/dev` trước khi build.
- Denylist route tự-khung (đã đủ): `/qr-print` trong group; các cụm mobile/auth/scan-debug nằm ngoài group nên tự động không dính. Nếu sau này thêm trang full-màn trong nhóm → thêm vào denylist.

→ **Chưa deploy**. Chờ commit.

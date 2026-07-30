# BÁO CÁO — Đánh bóng UX: hết "giật" khi điều hướng & thao tác (desktop /wms)

**Phạm vi:** LOCAL (chưa deploy) · nhánh `cuongdd_web` · **Ngày:** 2026-07-30
**Yêu cầu:** "giao diện web và menu thao tác bị giật giật, chưa chuyên nghiệp — sửa tất cả cho chuyên nghiệp."

---

## Chẩn đoán (bằng chứng đo trực tiếp DOM)
1. **AppLayout re-mount mỗi lần điều hướng** — 49 trang tự bọc `<AppLayout>`, không có layout dùng chung → Sidebar/Header dựng lại mỗi route.
2. **Spinner toàn màn + fetch RBAC chặn render** mỗi lần điều hướng → "trắng màn → spinner → nội dung" ở mỗi click.
3. **Không skeleton** → bảng nhảy chiều cao khi load.
4. **Không `scrollbar-gutter`** → giật ngang khi thanh cuộn xuất hiện.
5. **Icon Material Symbols tải render-blocking** từ Google Fonts → nhấp nháy.
6. Sidebar remount nháy tên/logo; dropdown bật/tắt cụt; transition rời rạc.

## Đã sửa (6 nhóm)

### A1 — Diệt nháy điều hướng (`AppLayout.tsx`)
- **Bỏ spinner toàn màn** + **bỏ fetch RBAC chặn render**. Kiểm tra quyền **đồng bộ** (deny-by-default từ cache/mặc định); fetch RBAC chạy **nền, 1 lần/phiên** (cờ `rbacSyncedThisSession`).
- Đọc user **đồng bộ** khi mount (cờ `clientReady` để lần hydrate đầu vẫn khớp SSR, các lần điều hướng SPA sau đọc user ngay) → hết nháy tên/logo, **không hydration mismatch**.
- **Kết quả đo:** `fullscreenSpinnerSeen: false` khi điều hướng.

### A2 — Cảm giác "mount 1 lần" an toàn (`Sidebar.tsx`)
- Không di chuyển 49 folder (rủi ro cao, còn phá 2 trang QR-print không có sidebar). Thay vào đó **giữ vị trí cuộn sidebar** qua `sessionStorage` (khôi phục `scrollTop` tức thì khi remount).
- **Kết quả đo:** cuộn 140 → điều hướng → vẫn 140 (`restored: true`).

### B — Hết giật ngang (`globals.css`)
- `.scroll-container { scrollbar-gutter: stable; }` — giữ chỗ thanh cuộn.

### C — Icon không nhấp nháy (`layout.tsx`)
- `preconnect` tới `fonts.googleapis.com` + `fonts.gstatic.com` → icon Material Symbols hiện nhanh.

### D — Skeleton thay spinner-pop (`ui/Skeleton.tsx` + 4 trang)
- Component `Skeleton` + `TableSkeleton` (N dòng × M cột, cao đều). Áp cho **pallets, item-codes, inbound, inventory** (thay ô spinner `py-12`).
- **Kết quả đo:** `skeletonSeenDuringLoad: true`, không nhảy chiều cao.

### E — Chuẩn chuyển động (`globals.css`, `Sidebar.tsx`)
- `@media (prefers-reduced-motion: reduce)` — tôn trọng a11y.
- Keyframe `slide-up-fade` + `.animate-slide-up-fade` cho dropdown user menu (mở mượt).

## File thay đổi
```
src/components/layout/AppLayout.tsx     (A1)
src/components/layout/Sidebar.tsx       (A1 user sync, A2 scroll persist, E dropdown)
src/app/globals.css                     (B scrollbar-gutter, E reduced-motion + keyframe)
src/app/layout.tsx                      (C preconnect)
src/components/ui/Skeleton.tsx (MỚI) + ui/index.ts   (D)
src/app/{pallets,item-codes,inbound,inventory}/page.tsx  (D áp skeleton)
```

## Kiểm chứng (local, dev server)
- `tsc` sạch; console không lỗi/không hydration mismatch.
- Điều hướng: không spinner toàn màn, không nháy user/logo, sidebar giữ vị trí cuộn.
- Skeleton hiện khi tải, thay bằng data không nhảy layout.
- Áp cho **mọi vai desktop** (Admin/QUẢN LÝ + Kế toán) vì dùng chung AppLayout/Sidebar.

## Ghi chú (open point)
- **A2 triệt để** (đưa shell vào `(desktop)/layout.tsx` để Sidebar mount literal 1 lần) đã CÂN NHẮC nhưng **hoãn**: cần di chuyển ~45 folder + xử lý title 49 trang + tránh phá 2 trang QR-print → rủi ro cao mà lợi ích thêm rất nhỏ so với A1 + giữ-scroll (kết quả nhìn thấy đã liền mạch). Có thể làm ở đợt refactor cấu trúc riêng nếu cần.
- **C** có thể nâng lên **self-host** font icon (tải file .woff2 vào `public/`) nếu muốn hết phụ thuộc CDN hoàn toàn.

→ **Chưa deploy** (theo thông lệ làm local). Chờ commit.

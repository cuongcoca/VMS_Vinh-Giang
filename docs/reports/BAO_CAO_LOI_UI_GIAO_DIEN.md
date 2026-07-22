# 🎨 BÁO CÁO TÌNH TRẠNG GIAO DIỆN WMS VĨNH GIANG — Designer OCD Audit

> **Ngày audit:** 2026-05-25
> **Auditor:** Senior Product Designer (OCD mode ON)
> **Phạm vi:** Toàn bộ 80+ pages (50 desktop + 30 mobile) + components shared + design tokens
> **Phương pháp:** Đọc trực tiếp `*.tsx` và `globals.css`, đếm biến thể class, đối chiếu với best practice
>
> **2 báo cáo chi tiết kèm theo:**
> - 📄 [BAO_CAO_LOI_UI_DESKTOP.md](BAO_CAO_LOI_UI_DESKTOP.md) — **809 dòng** · 150+ issue · 38 🔴
> - 📱 [BAO_CAO_LOI_UI_MOBILE.md](BAO_CAO_LOI_UI_MOBILE.md) — **757 dòng** · 47 issue · 8 🔴

---

## 🚨 BẢN ÁN TỔNG: "Có thể chạy được nhưng KHÔNG chuyên nghiệp"

> *Một designer mới vào, nhìn 5 phút là biết đây là codebase đã qua **ít nhất 3 thế hệ developer** chồng lên nhau mà chưa có ai chốt design system.*

Trang web hiện tại **HOẠT ĐỘNG** — không có bug chặn user. Nhưng về mặt **THỊ GIÁC**, nó đang ở mức "demo prototype" chứ chưa phải "production polish". Cụ thể:

- **Tổng số issue:** ~197 vấn đề CỤ THỂ đã đếm được (file:line cụ thể)
- **🔴 Nghiêm trọng:** 46 lỗi (38 desktop + 8 mobile) — chặn cảm giác chuyên nghiệp
- **🟠 Cao:** 66 lỗi — cần sửa Sprint này
- **🟡 Trung bình:** 57 lỗi — polish trong vài Sprint
- **🔵 Thấp:** 28 lỗi — đẹp hơn nếu fix

---

## 🔥 TOP 10 LỖI NẶNG NHẤT TOÀN ỨNG DỤNG

### #1 — 🔴 KHÔNG CÓ HỆ COMPONENT NỀN TẢNG (root cause của 70% các lỗi)

`src/components/ui/` chỉ có **2 file**: `Card.tsx` (10 dòng wrapper) và `Badge.tsx` (15 dòng wrapper). Không có:

| Component | Tình trạng | Hệ quả |
|---|---|---|
| `<Button>` | ❌ KHÔNG TỒN TẠI | **18 biến thể** button inline trong codebase |
| `<Input>` | ❌ KHÔNG TỒN TẠI | **9 kiểu** input style khác nhau |
| `<Select>` | ❌ KHÔNG TỒN TẠI | Native `<select>` raw, bg khác nhau khắp nơi |
| `<Modal>` | ❌ KHÔNG TỒN TẠI | **9 implementation** modal khác nhau, không focus trap, không ESC |
| `<Toast>` | ❌ KHÔNG TỒN TẠI | Mỗi page tự `setToast()` state local hoặc dùng `alert()` |
| `<ConfirmDialog>` | ❌ KHÔNG TỒN TẠI | **80+ vị trí** dùng `window.confirm()` browser-native (UX cấp 2010) |
| `<Pagination>` | ❌ KHÔNG TỒN TẠI | Copy-paste ~20 dòng giữa các trang |
| `<EmptyState>` | ❌ KHÔNG TỒN TẠI | Mỗi page tự viết "icon + text mờ" khác nhau |
| `<LoadingSpinner>` | ❌ KHÔNG TỒN TẠI | Spinner **7 size khác nhau**: 18/20/24/28/32/40/48px |
| `<Stepper>` | ❌ KHÔNG TỒN TẠI | 4 page tự viết tay (inbound list, import, master-data, forgot-password) |
| `<Tabs>` | ❌ KHÔNG TỒN TẠI | Mỗi page tự render pill tab khác nhau |
| `<FormField>` | ❌ KHÔNG TỒN TẠI | `<label>`+`<input>`+`<error>` mỗi nơi 1 kiểu |

**Hệ quả:** Đổi `border-radius` button từ `rounded-lg` (8px) sang `rounded-md` (6px) phải sửa tay **~150 chỗ** và chắc chắn bỏ sót.

---

### #2 — 🔴 BUTTON CÓ 18 BIẾN THỂ ĐẾM ĐƯỢC

Chỉ tính riêng button "primary đen":

```
1.  px-4 py-2   bg-primary text-white rounded-lg text-sm hover:bg-primary-container
2.  px-4 py-2   text-sm bg-primary hover:bg-primary-hover text-white rounded-lg shadow-sm font-medium
3.  px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover
4.  px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95
5.  px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container
6.  px-3 py-1.5 rounded-lg text-xs font-semibold ... bg-primary text-white
7.  w-full h-[52px] bg-primary-container text-white text-headline-sm rounded-xl
```

Cùng action "Submit" nhưng padding, font-weight, hover color, border-radius hoàn toàn khác.

Cộng thêm 11 biến thể khác cho secondary, ghost, danger... → **~150+ button inline trong codebase**.

---

### #3 — 🔴 FILE `auth/forgot-password/page.tsx` LÀ "BÃI RÁC HEX CỨNG"

70+ vị trí viết HEX cứng thay vì dùng design token:
```tsx
text-[#022448]  // → nên là text-primary-container
bg-[#022448]    // → nên là bg-primary-container
border-[#c4c6cf] // → nên là border-outline-variant
text-[#43474e]  // → nên là text-on-surface-variant
```

Đây là page **tệ nhất** cả app về color discipline. Nếu Quản lý đổi brand color (UC-SYS-01 logo upload), page này KHÔNG follow theo.

---

### #4 — 🔴 80+ VỊ TRÍ DÙNG `alert()` VÀ `confirm()` BROWSER-NATIVE

Pop-up xám xịt từ browser, không thể style, không thể quốc tế hóa, văng giữa luồng làm việc, không khớp tone industrial. Xuất hiện ở:
- `inbound/*` — xác nhận hủy/gửi phiếu
- `pallets/[id]` — xác nhận xóa dòng
- `master-data/page.tsx` — xác nhận xóa sản phẩm
- `system/users/page.tsx` — xác nhận xóa user
- `locations/page.tsx`, `outbound/*`, `item-codes/*`, ...

**UX cấp độ 2010**. Mọi app production hiện đại đều thay bằng custom `<ConfirmDialog>`.

---

### #5 — 🔴 5 PAGE FORKLIFT DÙNG `<AppLayout>` DESKTOP TRONG MOBILE SHELL

5 page sau bị **NESTED LAYOUT** (mobile chứa desktop):
- `src/app/forklift/put-away/page.tsx`
- `src/app/forklift/relocate/page.tsx`
- `src/app/forklift/stage-out/page.tsx`
- `src/app/forklift/return/page.tsx`
- `src/app/forklift/history/page.tsx`

→ Padding sai (desktop 288px sidebar inset vào mobile), font sai, dùng màu indigo/amber/rose ngoài palette industrial. **Disaster cấp 1 về architecture.**

---

### #6 — 🔴 MIX EMOJI + MATERIAL-SYMBOLS 16+ VỊ TRÍ

Cùng 1 button có CẢ emoji + icon:
```tsx
<button>📦 <span className="material-symbols-outlined">inventory_2</span> Pallet</button>
<button>💾 <span className="material-symbols-outlined">save</span> Lưu</button>
<button>✅ <span className="material-symbols-outlined">check_circle</span> Hoàn tất</button>
<button>📷 <span className="material-symbols-outlined">photo_camera</span> Quét</button>
```

→ Duplicate ý nghĩa, vỡ baseline cross-platform (emoji render khác trên Win/Mac/Linux/Mobile), không match brand industrial.

---

### #7 — 🔴 DOUBLE HEADER TRÊN TRANG XE NÂNG

`ForkliftMobileDashboard.tsx:95-104` tự render topbar cam `bg-[#ea580c]` đè lên header trắng đã có sẵn từ `forklift/layout.tsx:99`:

```tsx
// forklift/layout.tsx (z-40 — đè)
<header className="h-16 bg-surface sticky top-0 z-40">...

// ForkliftMobileDashboard.tsx (z-10 — bị che)
<div className="bg-[#ea580c] sticky top-0 z-10">...
```

→ User thấy 2 header chồng nhau, header cam bị cắt mất 1 nửa.

---

### #8 — 🔴 PAGE PADDING NHẢY NGẪU NHIÊN

Cùng là page chính nhưng padding container random:
- `p-4` (4 pages)
- `p-5` (3 pages)
- `p-6` (12 pages) ← phổ biến nhất
- `p-8` (1 page — auth)
- `p-md py-md` (mobile)
- `px-margin-mobile py-md` (mobile khác)

→ Như đang chơi tung xúc xắc, không có quy tắc.

---

### #9 — 🔴 GRADIENT MÀU LẠC + 3 BẢNG MÀU CÙNG TỒN TẠI

Trong cùng codebase đồng thời tồn tại:
1. **Design token** (`text-primary`, `bg-surface-low`, `border-outline-variant`) — đúng chuẩn
2. **Tailwind slate-XX** (`text-slate-500`, `bg-slate-100`, `border-slate-300`) — lạc khỏi token
3. **HEX cứng + semantic tone** (`text-emerald-700`, `bg-rose-50`, `border-amber-200`) — lạc thêm

Đặc biệt `inventory/page.tsx:126`:
```tsx
style={{ background: "linear-gradient(135deg, #fef2f2, #fff7ed)" }}
```
→ Gradient hồng-cam lạc khỏi tone industrial (`#000e24` + `#455f87`).

---

### #10 — 🔴 8 STYLE STATUS CHIP, 4 SIZE H1, 3 KIỂU BACK LINK, 3 KIỂU TAB

Trong mobile:
- **Status chip:** Mỗi page tự `getStatusColor()` khác nhau. 8 biến thể cho cùng status `COUNTING`/`CONFIRMED`/`IN_STORAGE`.
- **H1 heading:** `text-lg` / `text-xl` / `text-2xl` / `text-headline-md-mobile` (broken — không define trong globals.css) → 4 kích thước random.
- **Back link:** Có chỗ `← Quay lại`, chỗ `<- arrow_back`, chỗ chỉ icon, chỗ chỉ text.
- **Tab:** Có chỗ pill rounded-full, chỗ underline, chỗ hybrid border-b.

---

## 📊 BẢNG TỔNG HỢP SỐ LIỆU

### Theo Severity

| Severity | Desktop | Mobile | **Tổng** |
|---|---|---|---|
| 🔴 Nghiêm trọng | 38 | 8 | **46** |
| 🟠 Cao | 52 | 14 | **66** |
| 🟡 Trung bình | 40 | 17 | **57** |
| 🔵 Thấp | 20 | 8 | **28** |
| **Tổng** | **150** | **47** | **197** |

### Theo Category (Top 10)

| Category | Số issue | % |
|---|---|---|
| Thiếu component nền tảng | 12 | 6% |
| Button inconsistency | 18 biến thể | — |
| Modal inconsistency | 9 implementation | — |
| `alert/confirm` browser-native | 80+ vị trí | — |
| HEX cứng thay vì token | 70+ vị trí | — |
| Emoji decorative + icon mix | 16 vị trí | — |
| Spinner size không đồng nhất | 7 size | — |
| Page padding random | 5 kiểu | — |
| Status chip mobile | 8 biến thể | — |
| Color slate-* lạc khỏi token | 100+ vị trí | — |

---

## 🛠 ROADMAP FIX KHẢ THI (ưu tiên cao → thấp)

### 🚀 Phase 0 — STOP THE BLEEDING (1 ngày)

Trước khi sửa các page, **chốt design system** để các fix sau không tạo thêm biến thể mới.

- [ ] Tạo `src/components/ui/Button.tsx` với 4 variant (`primary` / `secondary` / `ghost` / `danger`) × 3 size (`sm` / `md` / `lg`)
- [ ] Tạo `src/components/ui/Input.tsx` (text + textarea + select)
- [ ] Tạo `src/components/ui/Modal.tsx` (portal + focus trap + ESC + lock scroll)
- [ ] Tạo `src/components/ui/Toast.tsx` (replace `alert()` + state toast local)
- [ ] Tạo `src/components/ui/ConfirmDialog.tsx` (replace `window.confirm`)
- [ ] Tạo `src/components/ui/Spinner.tsx` (chỉ 3 size: `sm`/`md`/`lg`)
- [ ] Tạo `src/components/ui/EmptyState.tsx`
- [ ] Tạo `src/components/ui/Pagination.tsx`
- [ ] Define spacing scale rõ trong tailwind: `gap-page`, `p-page`, `gap-section`, `p-card`
- [ ] Thêm ESLint rule cấm `text-slate-*`, `bg-slate-*`, HEX cứng (warn)
- [ ] Define `text-headline-md-mobile` trong globals.css (đang broken — không tồn tại)

**Output:** ~10 component sẵn dùng, cấm thêm biến thể mới.

### 🛠 Phase 1 — FOUNDATION FIX (2-3 ngày)

- [ ] **Fix DOUBLE HEADER xe nâng** — Xóa topbar cam tự thêm trong `ForkliftMobileDashboard.tsx`, để header dùng layout.tsx chung
- [ ] **Fix NESTED LAYOUT** — Refactor 5 page forklift bỏ `<AppLayout>` (đang là page mobile)
- [ ] **Fix BROKEN TOKEN** — Define `text-headline-md-mobile` hoặc replace bằng `text-lg font-semibold`
- [ ] **Fix `/wms/api` hardcode trong mobile** — `forklift/history/page.tsx:34` đang fetch `/wms/api/movements` → instance xenang sẽ 404. Đổi sang `${basePath}/api/movements`
- [ ] **Xóa toàn bộ HEX cứng** trong `auth/forgot-password/page.tsx` (70+ vị trí) → thay bằng design token

### 🔄 Phase 2 — SWEEP REFACTOR (5-7 ngày, theo module)

Tuần tự refactor từng module, replace với component nền tảng:

| Module | Pages | Replace |
|---|---|---|
| Auth | 2 | Button + Input + Modal |
| Dashboard | 2 | KPI card unified |
| Master Data | 6 | Button + Modal + Pagination + EmptyState |
| Inbound | 5 | Button + Stepper + Modal + ConfirmDialog |
| Inbound Adhoc | 3 | Button + Stepper + Modal |
| Pallet | 2 | Button + Modal + Spinner |
| Outbound | 7 | Button + Modal + Pagination |
| Inventory | 7 | Button + Toast + EmptyState |
| Stock Count | 4 | Button + Modal |
| Forklift | 9 | Refactor toàn bộ (xóa nested layout) |
| System | 7 | Button + Modal + ConfirmDialog |

Mỗi module 1 commit, có test visual trước khi merge.

### ✨ Phase 3 — POLISH (2-3 ngày)

- [ ] Xóa emoji decorative trong button (giữ icon material-symbols)
- [ ] Đồng nhất spinner size (chỉ dùng `<Spinner size="sm|md|lg" />`)
- [ ] Đồng nhất page padding (`p-page` = 24px desktop, `px-margin-mobile py-md` mobile)
- [ ] Đồng nhất font-weight cho heading (`font-semibold` H1, `font-medium` H2, `font-normal` body)
- [ ] Add `aria-label` cho icon button
- [ ] Add focus visible ring cho tất cả interactive

### 🔍 Phase 4 — QA & RESPONSIVE (1-2 ngày)

- [ ] Test với Cốc Cốc / Chrome + Claude in Chrome tự động screenshot
- [ ] Test responsive 320px / 375px / 768px / 1024px / 1440px
- [ ] Test contrast WCAG AA cho text-on-surface-variant
- [ ] Test tap target ≥ 44px mobile

---

## 💰 ESTIMATE EFFORT

| Phase | Effort | Output |
|---|---|---|
| **Phase 0** Design system | **1 ngày** | 10 component sẵn dùng |
| **Phase 1** Foundation fix | **2-3 ngày** | 5 lỗi nghiêm trọng nhất xong |
| **Phase 2** Sweep refactor | **5-7 ngày** | 50+ page về chuẩn |
| **Phase 3** Polish | **2-3 ngày** | Đồng nhất font/spinner/padding |
| **Phase 4** QA | **1-2 ngày** | Đo lường visual |
| **TỔNG** | **11-16 ngày người** | **App "trông như production"** |

**Quy đổi:** ~2-3 tuần làm việc của 1 dev senior, hoặc 1 sprint 4 tuần với 1 dev junior.

---

## 🎯 NẾU CHỈ LÀM 3 VIỆC QUAN TRỌNG NHẤT

Nếu thời gian rất giới hạn, ưu tiên 3 việc sau (làm xong sẽ thấy app "khá" hơn 50%):

1. **Tạo `<Button>` + `<Modal>` + `<ConfirmDialog>` + `<Toast>` chuẩn** (1 ngày)
2. **Codemod xóa toàn bộ `text-slate-*`, `bg-slate-*` thay bằng design token + xóa HEX cứng trong `auth/forgot-password/page.tsx`** (0.5 ngày)
3. **Replace 80+ `alert()`/`confirm()` bằng `<ConfirmDialog>` và `<Toast>`** (0.5-1 ngày)

**Tổng: 2-3 ngày** → app sẽ trông professional hơn rõ rệt.

---

## 📁 FILES CHI TIẾT

- **[BAO_CAO_LOI_UI_DESKTOP.md](BAO_CAO_LOI_UI_DESKTOP.md)** (809 dòng)
  - Section 1: Thiếu component nền tảng
  - Section 2: Inconsistency category (Button 18 biến thể, Modal 9, Input 9...)
  - Section 3: Lỗi theo module (50+ pages)
  - Section 4: Top lỗi nặng nhất
  - Section 5: Đề xuất fix
  - Section 6: Điểm đã tốt

- **[BAO_CAO_LOI_UI_MOBILE.md](BAO_CAO_LOI_UI_MOBILE.md)** (757 dòng)
  - Section 1: Inconsistency giữa 3 role (thủ kho / xe nâng / kiểm kê)
  - Section 2: Lỗi theo module
  - Section 3: Scanner & Camera UI
  - Section 4: Top 10 lỗi nặng nhất
  - Section 5: Đề xuất fix

---

## 📝 NGUYÊN TẮC TRƯỚC KHI BẮT ĐẦU FIX

1. **Không thêm style mới** — chỉ dùng component đã có hoặc tạo mới với approval
2. **Không thêm emoji decorative** — chỉ icon material-symbols-outlined
3. **Không dùng `text-slate-*`, `bg-slate-*`, HEX cứng** — chỉ design token
4. **Không dùng `alert()` / `confirm()` / `prompt()`** — luôn `<Toast>` + `<ConfirmDialog>`
5. **Mỗi component mới cần test visual** trước khi merge
6. **Mỗi page sau khi refactor cần screenshot before/after** lưu vào `docs/visual-regression/`

---

## 🎬 KẾT LUẬN

App hiện tại có **chức năng đầy đủ** nhưng **đang ở mức prototype về thị giác**. Nguyên nhân chính: **thiếu hệ component nền tảng** dẫn đến mỗi page tự inline khác nhau → lan ra ~200 vấn đề thị giác.

Tin tốt: **80% vấn đề có thể giải quyết bằng 10 component nền tảng + 1 codemod color**. Effort 2-3 tuần là khả thi.

Tin xấu: Nếu **KHÔNG sửa hệ thống** mà chỉ patch từng page, các bug visual sẽ tái phát mỗi khi thêm tính năng mới.

> **Khuyến nghị Tech Lead:** Đặt **block** trên mọi PR mới cho đến khi 10 component nền tảng (Phase 0) hoàn thành. Sau đó mỗi PR mới **phải** dùng component nền tảng — không inline button/input/modal nữa.

---

**Auditor signature:** _OCD Designer who's not okay until this is fixed._

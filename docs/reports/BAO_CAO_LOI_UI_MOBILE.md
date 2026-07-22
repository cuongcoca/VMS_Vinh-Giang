# BÁO CÁO AUDIT GIAO DIỆN MOBILE — Designer OCD Mode

> **Tone**: Báo cáo được viết bởi một senior product designer cực kỳ khó tính. Mọi vấn đề về visual consistency, tap target, typography sẽ được liệt kê thẳng thắn — kể cả những vấn đề nhỏ thường bị bỏ qua.
>
> **Severity legend**: 🔴 Nghiêm trọng (chặn UX, cần fix ngay) | 🟠 Cao (gây bối rối, fix sớm) | 🟡 Trung bình (polish trong sprint hiện tại) | 🔵 Thấp (đẹp hơn nếu fix)
>
> **Scope**: 30 page mobile-only thuộc 3 role thủ kho / xe nâng / kiểm kê + 3 component shared (BarcodeScanner, BarcodeScannerModal, ImageUpload).
>
> **Verdict tổng**: Hệ thống mobile đang ở trạng thái **"có thể chạy được nhưng nhìn không chuyên nghiệp"**. Có 47 vấn đề được phát hiện, trong đó 8 lỗi nghiêm trọng cần fix ngay (đặc biệt là 5 page xe nâng đang nhúng `<AppLayout>` desktop vào trong mobile shell — đó là sự cố disaster cấp 1).

---

## 0. TÓM TẮT EXECUTIVE

| Severity | Số lượng | Ví dụ điển hình |
|---|---|---|
| 🔴 Nghiêm trọng | **8** | 5 page forklift dùng `<AppLayout>` desktop trong mobile shell → bị nested layout, sai padding, sai font |
| 🟠 Cao | **14** | Topbar style không đồng nhất, emoji vs material-symbols mixed loạn, 3 phong cách khác nhau của "back button" |
| 🟡 Trung bình | **17** | Chip status có 8 style khác nhau cho cùng 1 trạng thái, padding card biến thiên `p-sm` / `p-md` / `p-3` / `p-4` random |
| 🔵 Thấp | **8** | Emoji size không match font, `transition-colors duration-200` vs `transition-all` random |

**Bottom line**: cần Phase 1 Foundation gồm 5 component shared (MobileTopbar, MobileSubHeader, StatusChip, BackLink, EmptyState) và 1 token system unified mới có thể dọn dẹp được. Estimate ~3 ngày để fix toàn bộ critical + cao + trung bình.

---

## 1. INCONSISTENCY GIỮA 3 ROLE

### 1.1 Topbar/Header layout — 🟠 Cao

**Tin tốt**: 3 file `layout.tsx` (thukho / forklift / kiemke) đã có **header chuẩn giống nhau**:
- `src/app/thukho/layout.tsx` L100–127
- `src/app/forklift/layout.tsx` L99–126
- `src/app/kiemke/layout.tsx` L39–45

Cả 3 đều: `h-16`, `px-margin-mobile`, `bg-surface`, border-b-outline-variant, có avatar role + tên user + dot notification + nút QR scanner.

**Tin xấu**:

1. 🟠 **Header xe nâng không có nút QR scanner.** So sánh:
   - `thukho/layout.tsx` L119–125: có `<Link>` to `/thukho/pallet?scan=true`
   - `forklift/layout.tsx` L118–125: có nhưng dùng `<Link href="/forklift/pallet?scan=true">` — KO dùng `mobileHref` (xe nâng chạy ở base path `/xenang` nên href thiếu prefix). **Link sẽ broken trên VPS.**
   - `kiemke/layout.tsx` L44: **KHÔNG có nút QR** (chỉ có notification bell). Vô lý vì kiểm kê là role quét QR nhiều nhất.

2. 🟠 **Kiểm kê header thiếu badge đỏ notification.** Trong thukho/forklift có `<span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full">` nhưng kiemke layout L44 không có. → 3 role 3 phong cách notification khác nhau.

3. 🟡 **Avatar icon role có 3 màu vô hồn.** Cả 3 đều dùng `bg-primary-container` cho avatar background — KHÔNG phân biệt được role bằng visual. Trong khi mockup nói **xe nâng = cam (#ea580c), kiểm kê = tím (#7c3aed)**. Nên header xe nâng/kiểm kê đang **mất identity màu** ở layout chính, chỉ có ForkliftMobileDashboard tự render thêm một thanh cam ở dưới.

4. 🔴 **DOUBLE HEADER trong forklift.** `ForkliftMobileDashboard.tsx` L95–104 tự render thêm một topbar cam:
   ```tsx
   <div className="-mx-margin-mobile -mt-md px-margin-mobile py-3 bg-[#ea580c] text-white flex items-center justify-between sticky top-0 z-10 shadow-sm">
     <span>...Xe nâng — Việc của tôi</span>
   </div>
   ```
   Trong khi `forklift/layout.tsx` L99 đã có `<header>` h-16 sticky top-0 z-40. Hai sticky top-0 chồng nhau với z khác nhau — header layout `z-40` (đè), header cam `z-10` (dưới). **Người dùng thấy 2 layer header chồng**, header cam bị cắt mất 1 nửa sau header trắng. **Bug visual cực rõ**.

### 1.2 Bottom tab bar — 🟡 Trung bình

Cả 3 layout đều có nav bar 5 tab giống nhau về layout (`h-[72px]`, `text-[10px]`, icon `text-[22px]`).

**Lỗi**:

1. 🟠 **Active state chỉ dùng màu primary cho 3 role.** Thì xe nâng và kiểm kê nhìn không khác biệt với thủ kho — đáng lẽ active state nên dùng màu role: cam cho xe nâng, tím cho kiểm kê.
   - `forklift/layout.tsx` L147: `isActive ? "text-primary font-bold scale-105"` — primary là xanh navy, không phải cam.
   - `kiemke/layout.tsx` L49: cũng `text-primary`.
   - **3 role visually identical** ở bottom tab — đánh mất identity màu.

2. 🟡 **Khác nhau ở danh sách tab:**
   - Thủ kho 5 tab: Trang chủ / Nhập kho / Pallet / Kho hàng / Tài khoản
   - Xe nâng 5 tab: Trang chủ / Pallet / Luân chuyển / FEFO / Tài khoản
   - Kiểm kê 5 tab: Trang chủ / Kiểm kê / Tra cứu / Quét & Đếm / Tài khoản
   
   → OK về nội dung nhưng **vị trí tab "Tài khoản" cuối cùng** thì OK chung. Nhưng **kiểm kê thay tab "Pallet" bằng "Quét & Đếm" ở vị trí thứ 4** trong khi 2 role kia tab thứ 4 là task riêng. Có thể chấp nhận nhưng cần ghi vào style guide.

3. 🔵 **`isActive` logic 2 cách khác nhau:**
   - `forklift/layout.tsx` L136–139 dùng inline ternary
   - `thukho/layout.tsx` L137 dùng `isMobileActive(...)` helper
   - `kiemke/layout.tsx` L48 dùng `isMobileActive(...)` helper
   
   Forklift là role duy nhất NOT dùng helper → khi rule thay đổi sẽ quên fix forklift. Nên unified.

### 1.3 Card style với border-left status — 🟠 Cao

**Lỗi nặng**: Mỗi page tự định nghĩa `getStatusColor` riêng. Đếm được **8 phiên bản** khác nhau cho cùng concept "chip status badge":

| File | Style chip |
|---|---|
| `thukho/page.tsx` L70–76 (ThukhoMobileDashboard) | `bg-amber-100 text-amber-700` / `bg-blue-100 text-blue-700` / `bg-green-100 text-green-700` |
| `thukho/pallet/page.tsx` L28–36 | `STATUS_META` object với 7 status + `borderLeft` color |
| `thukho/pallet/[id]/page.tsx` L199–206 | inline ternary, **chỉ 3 status** (COUNTING / CONFIRMED / IN_STORAGE) — thiếu IN_STAGING, RELEASED, CANCELLED |
| `thukho/inbound/page.tsx` L27–28 | inline switch riêng |
| `thukho/warehouse/stocktake/page.tsx` L10 | inline switch OPEN/COUNTING/COMPLETED |
| `thukho/warehouse/movements/page.tsx` L21 | type color riêng PUT_AWAY/RELOCATE/STAGE_OUT/RETURN |
| `forklift/pallet/page.tsx` L86–97 | inline switch CONFIRMED/IN_STORAGE/IN_STAGING |
| `kiemke/tasks/page.tsx` L15 | inline switch OPEN/COUNTING/COMPLETED |

**Hệ quả**: cùng status `COUNTING` đã có **2 màu khác nhau** (amber-100 ở ThukhoMobileDashboard, amber-100 ở pallet, amber-100 ở stocktake) — may là cùng amber nhưng tuple `bg/text` đôi khi không match. Đáng lo nhất là `bg-gray-100 text-gray-600` (default case) **không phải token Tailwind 4 v.4** — đáng lẽ nên là `bg-surface-variant text-on-surface-variant`.

🟠 **Đề xuất gấp**: tạo file `src/lib/status-meta.ts` export `PALLET_STATUS_META`, `INBOUND_STATUS_META`, `STOCKCOUNT_STATUS_META`, `MOVEMENT_TYPE_META` — single source of truth.

### 1.4 Card padding — 🟡 Trung bình

Đếm trong các file mobile:
- `p-md` (16px) — phổ biến nhất, dùng cho card lớn
- `p-sm` (8px) — dùng cho line nhỏ
- `p-lg` (24px) — dùng cho hero card / form
- `p-3` (12px) — random ở `thukho/inbound/[id]/page.tsx` L52 `<div className="bg-amber-50 border border-amber-200 rounded-xl p-3">` (sai token)
- `p-4` (16px) — random ở `forklift/stage-out/page.tsx` L154 `<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">` (đáng lẽ là `p-md`)
- `p-6` (24px) — phổ biến trong các page forklift dùng `<AppLayout>` (sai vì là page mobile)
- `p-5` (20px) — `forklift/return/page.tsx` L137 `<form ... className="bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-5">` — `space-y-5` không tồn tại trong theme `--spacing-*`.

**Tệ**: padding card biến thiên ngẫu nhiên giữa các file. Đáng lẽ phải có:
- Card line: `p-sm`
- Card thông tin: `p-md`
- Card hero / form: `p-lg`

### 1.5 Page wrapper / container — 🟠 Cao

3 phong cách bao ngoài page mobile:
1. **Mobile chuẩn**: `<div className="px-margin-mobile py-md flex flex-col gap-md">` — đa số page thủ kho/kiểm kê.
2. **Desktop trong mobile**: `<div className="p-6 max-w-xl space-y-5">` — `forklift/put-away/page.tsx` L56, `forklift/relocate/page.tsx` L49, `forklift/return/page.tsx` L109. **Lý do là vì các page này nhúng `<AppLayout>` desktop** (xem 2.2).
3. **Hybrid**: `<div className="px-margin-mobile py-md w-full flex flex-col gap-sm">` — `forklift/pallet/page.tsx` L139, `forklift/profile/page.tsx` L55, `thukho/profile/page.tsx` L21, `kiemke/profile/page.tsx` L22. **Khác nhau ở `gap-sm` thay vì `gap-md`** → các page profile nhìn chật hơn so với các page khác.

🟠 **Đề xuất**: enforce 1 wrapper pattern duy nhất `<div className="px-margin-mobile py-md flex flex-col gap-md">` cho TẤT CẢ page mobile. Page profile cần thiết "compact" thì dùng `gap-sm` ở section, KHÔNG ở wrapper.

### 1.6 Back link style — 🟠 Cao

Đếm được **3 phong cách back link** trên 30 page:

| Style | Ví dụ | Files |
|---|---|---|
| A: secondary + arrow_back nhỏ | `<Link className="text-xs text-secondary hover:underline flex items-center gap-1 font-semibold"><span className="material-symbols-outlined text-[14px]">arrow_back</span> Quay lại</Link>` | đa số thukho/* và kiemke/* |
| B: primary + arrow_back lớn | `<Link className="text-sm text-primary hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">arrow_back</span> Quay lại</Link>` | forklift/put-away L62, forklift/relocate L55, forklift/return L121, forklift/history L47, forklift/stage-out L116, forklift/pallet L143 (nhưng pallet dùng text-secondary), forklift/profile L59 |
| C: primary + bigger + bold | `<Link className="text-sm text-primary hover:underline flex items-center gap-1 font-semibold"><span className="material-symbols-outlined text-[16px]">arrow_back</span> Quay lại trang Xe nâng</Link>` | chỉ `forklift/return/page.tsx` L121 |

**Tệ**: cùng action "back" có **3 cách hiển thị**, và 1 page (forklift/pallet) **tự đổi giữa Style A và B**:
- L143 `text-xs text-secondary` (Style A) cho "Quay lại" về `/forklift`.

🟠 **Đề xuất**: tạo `<BackLink href="...">Quay lại</BackLink>` với 1 style duy nhất (Style A).

### 1.7 Bộ chữ tiêu đề H1 mobile — 🟡 Trung bình

Đếm được **4 size H1** khác nhau:
- `text-lg font-bold text-primary` (18px) — ThukhoPalletListPage L87, ThukhoInboundPage L37, ThukhoStockTakePage L15
- `text-xl font-bold text-primary` (20px) — ThukhoNewPalletPage L79, ThukhoNewAdhocPage L28, ThukhoNewItemCodePage L24, ThukhoProfilePage L23, ForkliftProfilePage L62
- `text-2xl font-bold text-primary` (24px) — ForkliftPutAwayPage L65, ForkliftRelocatePage L58, ForkliftReturnPage L127, ForkliftStageOutPage L119, ForkliftHistoryPage L50 — **toàn bộ desktop-style trong mobile**
- `text-headline-md-mobile text-primary font-bold leading-tight` — layout headers L106 (token này KHÔNG được định nghĩa trong globals.css → fallback về font-size default)

🟠 **Token broken**: `text-headline-md-mobile` không có trong `@theme` của globals.css. Browser fallback xuống `font-size: 16px` mặc định. Header của 3 layout đang hiển thị **fontSize sai** mà không ai phát hiện.

🟡 **Đề xuất**: chuẩn hoá H1 mobile = `text-lg` (18px) cho list/dashboard, `text-xl` (20px) cho form/detail. Bỏ `text-2xl` (đó là desktop).

### 1.8 Section heading "label-caps" — 🔵 Thấp

Trong globals.css có util `.label-caps` (11px mono uppercase 0.08em). Nhưng các page **ÍT page dùng `.label-caps`**, đa số chế lại bằng tay:
```tsx
className="font-mono text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider"
```
Đếm được pattern này **>30 lần** rải rác. Tốn ~80 ký tự mỗi lần. Nên thay bằng `className="label-caps text-on-surface-variant"`.

---

## 2. LỖI THEO MODULE

### 2.1 Thủ kho — 16 page

#### `src/app/thukho/page.tsx`
- Wrapper chỉ là 1 dòng — render `<ThukhoMobileDashboard />`. OK.

#### `src/components/thukho/ThukhoMobileDashboard.tsx`
- 🟡 L88 `gap-lg` (24px) hơi quá rộng. Page khác dùng `gap-md` (16px). Hơi lệch.
- 🟡 L100–155 KPI strip dùng `flex overflow-x-auto gap-gutter` với `-mx-margin-mobile px-margin-mobile`. **Pattern này CHỈ ở dashboard, các page khác không có** → người dùng phải học lại layout KPI ở mỗi page. Đáng lẽ component `<KPIStrip kpis={...} />`.
- 🟡 L161–176 4 quick action card đều `py-lg gap-sm rounded-xl` → đẹp, nhưng icon `text-secondary text-[32px]` lặp giống hệt ForkliftMobileDashboard L152–166. Nên trừu tượng `<QuickAction icon="..." label="..." href="...">`.
- 🔵 L188 `bg-amber-50` cho tempCount alert — màu raw thay vì `bg-warning-container` (chưa có nhưng nên định nghĩa).
- 🟡 L218 `inventory_2` chip có `truncate max-w-[180px]` — magic number, cần thoát ra responsive.

#### `src/app/thukho/profile/page.tsx`
- 🟡 L21 wrapper `gap-sm` thay vì `gap-md` (lệch với các page khác).
- 🟡 L36–37 KPI "Pallet tạo hôm nay" và "Phiếu tiếp nhận" hiện text `—` (dấu gạch ngang) → KPI có format khác giữa lúc loading và lúc không có số. Đáng lẽ:
  - Khi loading: `text-2xl text-on-surface-variant/40` + spinner
  - Khi không có data: `text-2xl text-on-surface-variant/40 font-bold` + "—"
  - Khi có data: `text-2xl font-bold text-primary`
- 🟡 L40 padding `px-md py-sm` cho section header — ok nhưng `bg-surface-low/30` mức opacity 30% nhìn lờ mờ, đáng lẽ `bg-surface-low` hoặc `bg-transparent`.
- 🔵 L44/L48/L73/L81 toggle switch `w-10 h-6 rounded-full p-0.5` chuẩn iOS style — OK nhưng KHÔNG có aria-checked / aria-label. Accessibility 0/10.
- 🔴 L57 nút logout text "**ĐĂNG XUẤT TÀI KHOẢN**" toàn chữ hoa. Trong giao diện không có button nào khác toàn chữ hoa → outlier. Nên `font-semibold` thường, không uppercase.

#### `src/app/thukho/adhoc/page.tsx`
- 🟡 L8 `any[]` type — bad practice, sửa thành `AdhocItem[]`.
- 🟡 L18 wrapper OK.
- 🟡 L22 H1 dùng `text-lg`. ✓
- 🟡 L25–28 2 KPI card chỉ có số và label, KHÔNG có `<Link>` để drill-down → 0 affordance click. Nên wrap thành `<Link href="/thukho/adhoc?status=PENDING">`.
- 🟡 L35 chip dùng `bg-amber-100 text-amber-700` cứng cho mọi status — phiếu tạm chỉ có 1 status hay nhiều status? Code hardcode duy nhất 1 màu — không ổn.

#### `src/app/thukho/adhoc/new/page.tsx`
- 🟡 L26 wrapper OK.
- 🟠 L27 back link "Quay lại" về `/thukho/adhoc` (Style A) — OK.
- 🟡 L28 H1 `text-xl` không có icon → khác với các page khác (đa số có `<span className="material-symbols-outlined">...</span>`). Lệch style.
- 🟡 L31 select không có placeholder rõ, chỉ có "— Chọn NCC (tùy chọn) —" → ngắn, OK.
- 🟡 L35 nút submit `bg-primary` đầy đủ — OK. Nhưng text "Đang tạo..." vs "Tạo phiếu tạm" với cùng icon `note_add` → khi loading icon nên đổi sang `progress_activity` (đã làm ✓).

#### `src/app/thukho/adhoc/[id]/page.tsx`
- 🟠 L11, L14, L15 dùng `any` — bad type.
- 🟡 L38 wrapper OK.
- 🟡 L40 header dùng gradient `from-secondary to-amber-700` — **tone amber** chỉ xuất hiện ở phiếu tạm này. Các page khác dùng `from-primary to-primary-hover`. Inconsistent.
- 🔴 L45 card line hàng KHÔNG có button xóa / edit → dòng đã thêm không sửa được. UX bí.
- 🟡 L56 input số lượng `px-2 py-2` → height ~36px, tap target nhỏ hơn 44px Apple guideline.
- 🟡 L60 button "Thêm vào phiếu" prefix bằng emoji ➕ → trong khi các button khác dùng `<span className="material-symbols-outlined">add</span>`. Mix emoji + material-symbols.

#### `src/app/thukho/inbound/page.tsx`
- 🟡 L35 wrapper OK.
- 🔴 L38 nút "Phiếu tạm" gắn ở góc phải header `bg-secondary` — KHÔNG hợp lý vì page này là "Phiếu nhập kho", phiếu tạm là 1 entity khác → đáng lẽ tách thành 2 menu items ở `/thukho/warehouse/page.tsx`, KHÔNG nhồi vào header.
- 🟡 L41 tab pill dùng `bg-surface-low text-on-surface-variant` cho inactive vs `bg-primary text-white` cho active. **Khác với `forklift/pallet/page.tsx` L207–229 dùng underline border-b-2** → 2 cách pill tab khác nhau trong cùng app.
- 🟡 L47 card pallet dùng `bg-primary` border-left cứng → mọi status đều xanh. Đáng lẽ theo status.

#### `src/app/thukho/inbound/[id]/page.tsx`
- 🟡 L7, L8 dùng `any` ngầm trong destructure.
- 🟡 L44 wrapper OK.
- 🟡 L48 header gradient + chip "PENDING" raw text — đáng lẽ map sang "Chờ nhận" tiếng Việt (helper `getStatusText` có sẵn ở các file khác mà đây không dùng).
- 🟡 L52–60 cảnh báo "Khu vực dỡ hàng đã chuẩn bị" dùng `bg-amber-50 border border-amber-200 rounded-xl p-3` — `p-3` lệch token (đáng lẽ `p-md`).
- 🟠 L58 thông báo "⚠ Chưa check vẫn có thể bấm..." có emoji ⚠ riêng — trong khi nội dung khác dùng material-symbols `<span ...>warning</span>` → mix.
- 🟡 L74 input số `text-center text-sm font-bold border-outline-variant rounded px-1 py-0.5` — height ~24px, tap target QUÁ nhỏ. Trên mobile gần như không bấm được. **Nên min h-10**.
- 🟡 L84 KPI "CL" (Chênh lệch) dùng `text-lg`. Nhưng `text-error` cho CL khác 0 — đúng. Tuy nhiên màu CL>0 đáng lẽ amber (thừa), CL<0 đáng lẽ error (thiếu). Hiện code chỉ check `===0`.

#### `src/app/thukho/pallet/page.tsx`
- ✓ L82 wrapper OK với `gap-md`.
- 🟡 L85 topbar sticky dùng `bg-surface-low/95 backdrop-blur-sm` → 95% opacity khá tốt, nhưng `backdrop-blur-sm` cần browser support. Chấp nhận.
- 🔴 L89 H1 `text-lg font-bold` với 2 thứ: `<span className="material-symbols-outlined">inventory_2</span>` VÀ `📦` emoji. **Mix material-symbols + emoji ngay cạnh nhau!** Một là `inventory_2` icon, hai là `📦` emoji — visually không match (size khác, baseline khác).
- 🟡 L91 sub-line `text-[10px]` — quá nhỏ. Apple HIG: min 12px cho info phụ. Android: min 14px. **10px là dưới mức readable.**
- 🟡 L96 button "Tạo" `px-3 py-2` → ~32x32 + label → ~70x32, **height 32 < 44px**.
- 🟡 L139 pill tab có `(${count})` ở cuối label → format `Tab name (10)`, vs các page khác để count NGOÀI pill (badge). Inconsistent.
- 🟡 L170 STATUS_META.borderLeft fix `bg-amber-500` — magic color không trong token. Nên `bg-warning`.

#### `src/app/thukho/pallet/new/page.tsx`
- 🟡 L74 wrapper OK.
- 🔴 L86 hero block là **1 emoji 🆕 size 48px** — designer đùa hay sao? Nên là `<span className="material-symbols-outlined text-[48px] text-primary">add_box</span>`.
- 🟡 L94 input `disabled` cho mã pallet preview dùng `bg-slate-100 text-slate-700` — màu slate KHÔNG trong palette WMS. Đáng lẽ `bg-surface-low text-on-surface`.
- 🟡 L101 description `Định dạng PLYYMMDD.STT` text mono ngắn — OK.
- 🟡 L174 nút submit có emoji 📦 cạnh material-symbols `inventory_2` → DUPLICATE icon.
- 🟡 L178 footer "Pallet sẽ ở trạng thái..." text-center — OK nhưng `&ldquo;` `&rdquo;` HTML entity của dấu nháy nhìn ổn nhưng quote thường ưu tiên `“ ”` Unicode tự nhiên hơn.

#### `src/app/thukho/pallet/[id]/page.tsx`
- 🟡 L217 wrapper OK.
- 🔴 L226 hero card gradient `from-primary to-primary-hover` — OK cho pallet, nhưng **adhoc/[id] L40 dùng gradient `from-secondary to-amber-700`** → 2 hero card 2 màu khác nhau cho cùng concept "phiếu detail header".
- 🟡 L233 chip status có 4 case (`getStatusBadge` L199–206), thiếu IN_STAGING, RELEASED, CANCELLED — KHÔNG match với `STATUS_META` ở L28–36 của thukho/pallet/page.tsx → 2 file cùng concept khác status set.
- 🟡 L244 tab dùng `border-b-2 transition-all` style — khác với pill tab ở thukho/pallet/page.tsx L130. **Cùng app, 2 style tab khác nhau.**
- 🟡 L260 card line `p-sm rounded-xl` — OK nhưng nút xóa `w-8 h-8` ~32x32 < 44px tap target.
- 🟡 L289 input ô tìm có icon search trái → tốt. Nhưng `pl-10 pr-4 py-2.5` → height ~40px. OK.
- 🟡 L315 nút quét QR cạnh search box `px-3 py-2.5 bg-primary` → đúng height ~40px nhưng KHÔNG có label visual, chỉ icon. Lần đầu sẽ confusing.
- 🟡 L323 status scan dùng emoji `✓` và `⚠` text-character → khác `<span className="material-symbols-outlined">check</span>`. Mix.
- 🟡 L342 nút "Đổi" `text-error text-xs font-semibold` — thiếu `hover:underline`. Bấm thấy không có affordance.
- 🟡 L347 label `text-[10px]` — quá nhỏ.
- 🟡 L370 nút "Thêm vào pallet" `py-2.5` → height ~40px. Khác với nút "Xác nhận pallet" L377 dùng `py-3` → height ~46px. **Cùng card 2 button height khác nhau.**
- 🔴 L389/L414 modal overlay dùng `bg-black/50 z-50 flex items-end sm:items-center justify-center p-4` — bottom sheet style ở mobile, centered ở desktop. OK responsive nhưng **`p-4` thay vì `p-md`** → lệch token.
- 🟡 L391 dialog title `text-lg font-bold text-primary` — OK. Nhưng `text-amber-600` ở Unlock Dialog L416 khác màu → confusing visual hierarchy.
- 🟡 L395/L399 input/textarea trong modal KHÔNG có icon search → khác với form add line. Inconsistent.
- 🟡 L443 "Lịch sử" timeline dot `w-2 h-2 rounded-full bg-primary` → tất cả dot màu primary. Đáng lẽ theo action type (xác nhận = success, thêm hàng = info, xóa = error).

#### `src/app/thukho/item-code/new/page.tsx`
- 🟡 L22 wrapper OK.
- 🟡 L25 thông báo success dùng `bg-green-50 border border-green-200` — `green-*` không trong palette WMS. Đáng lẽ `bg-success-container/40`.
- 🟡 L36 footer info box `bg-blue-50` — `blue-*` không trong palette. Đáng lẽ `bg-secondary-container/40`.
- 🟡 L27, L28... 6 input liên tiếp giống y chang nhau về style → đáng lẽ component `<FormField label="..." required>`.
- 🟡 L29 select **`bg-white` cứng** trong khi page đang trên `bg-bg` (faf9f6) → màu trắng tinh trên nền hơi vàng → contrast kém.

#### `src/app/thukho/warehouse/page.tsx`
- 🟡 L15 wrapper OK.
- 🟡 L19 card grid 2 column → mỗi card có icon 12x12 + label + desc. OK ergonomic.
- 🟠 L5 menuItems href dùng `/thukho/warehouse/queue` etc **WITHOUT `mobileHref()` helper** → khi chạy ở instance `xenang` (cross-instance) href sẽ broken. **Inconsistent với các page khác đều dùng `mobileHref()`**.
- 🔵 L10 icon color random: `text-blue-600`, `text-amber-600`, `text-green-600`, `text-purple-600`, `text-rose-600`, `text-cyan-600` → mỗi card 1 màu khác nhau. Đẹp, nhưng KHÔNG có hệ thống nghĩa (rose = warning? cyan = info?). Designer cần map ý nghĩa.

#### `src/app/thukho/warehouse/inventory/page.tsx`
- 🟡 L8 dùng `any[]` type.
- 🟡 L13 wrapper OK.
- 🟡 L14 back link Style A ✓.
- 🟡 L15 H1 `text-lg` OK.
- 🟡 L21 card empty state KHÔNG có CTA — chỉ text "Không có dữ liệu". Empty state phải có hành động (vd "Tạo mã hàng mới") hoặc explanation tại sao trống.
- 🟡 L22 cột "Tổng / Khả dụng / Chờ xuất" font 14px (`text-sm`) → trên mobile hơi nhỏ nhưng tạm chấp nhận.

#### `src/app/thukho/warehouse/movements/page.tsx`
- 🟡 L25 wrapper OK.
- 🟡 L31 KHÔNG có nút "Xóa lọc" mặc dù có tab filter → user phải bấm tab "Tất cả" để reset.
- 🟡 L34 timeline dot `w-2 h-2 rounded-full bg-primary` cứng — đáng lẽ theo `getTypeColor`. Visual flat.
- 🟡 L35 metadata `text-[10px] text-on-surface-variant/60` — `/60` opacity quá thấp, gần mờ nền.

#### `src/app/thukho/warehouse/queue/page.tsx`
- 🟡 L13 wrapper OK.
- 🟡 L15 H1 có `({queue.length})` ngay sau label — chấp nhận được nhưng các page khác đặt count làm sub-heading hoặc badge → inconsistent.
- 🟡 L17 empty state có icon `check_circle` size 48px opacity 30% — đẹp! Đây là page DUY NHẤT làm đúng empty state.
- 🟡 L18 card pallet KHÔNG có `border-left` color → khác với các page list pallet khác.

#### `src/app/thukho/warehouse/staging/page.tsx`
- 🟡 L13 wrapper OK.
- 🟡 L20 chip HSD `${days}d` — chỉ hiện ngày, không có label "Còn X ngày". User mới sẽ không hiểu "5d" nghĩa là gì.
- 🟡 L21 logic màu chip theo days: `<=7 đỏ`, `<=30 amber`, `>30 green`. OK nhưng hardcode. Nên const config.

#### `src/app/thukho/warehouse/stocktake/page.tsx`
- 🟡 L13 wrapper OK.
- 🟡 L18 emoji `📍` / `🏷️` ngay trong text → mix với material-symbols ở page khác.
- 🟡 L18 status badge dùng raw status name `OPEN / COUNTING / COMPLETED` → KHÔNG localize tiếng Việt → user thấy English.

### 2.2 Xe nâng — 8 page

#### `src/components/forklift/ForkliftMobileDashboard.tsx`
- 🔴 L96 DOUBLE HEADER (đã đề cập ở 1.1). Cần xoá thanh `<div className="bg-[#ea580c] sticky top-0 z-10">` này. Thay vào đó nên áp dụng `bg-[#ea580c]` lên header trong `forklift/layout.tsx`.
- 🟡 L107 KPI box dùng `text-3xl font-bold font-jetbrains` — OK.
- 🟡 L111 màu KPI `text-[#ea580c]` raw hex thay vì token `text-warning` hoặc tạo `text-forklift`.
- 🟡 L137 pill tab khác với pill tab ở `thukho/pallet/page.tsx` (style A) → forklift dùng `bg-[#ea580c] text-white shadow` cho active, thukho dùng `bg-primary text-white shadow`. **OK** vì màu role khác. Nhưng inactive cả 2 đều `bg-white text-on-surface-variant border` → giống.
- 🟡 L171 alert FEFO `bg-error-container/40 p-md` — `/40` opacity nhìn nhạt. Đề xuất `/30` background, `border-l-4 border-error`.
- 🟡 L175 chip label `font-mono text-[9px]` — **9px là KHÔNG đọc được trên mobile**. Apple HIG min 11px, Android Material Design min 12px. Nên `text-[10px]` minimum.
- 🟡 L222 chip "Chờ đưa vào" `bg-amber-100 text-amber-700` — duplicate STATUS chip nhưng KHÔNG dùng common map.
- 🟡 L237 metadata icon emoji 📥, ⏱ — mix với material-symbols.
- 🟡 L261–276 sơ đồ kho mini map — đẹp nhưng `text-[8px]` cho "Zone A" labels là QUÁ NHỎ. Bỏ hoặc dùng tooltip.

#### `src/app/forklift/page.tsx`
- ✓ Đơn giản, render dashboard. OK.

#### `src/app/forklift/put-away/page.tsx`
- 🔴 **L130 nhúng `<AppLayout title="XẾP VỊ TRÍ">`** — đây là LAYOUT DESKTOP (`@/components/layout/AppLayout`). Trong khi page này được render trong `<main>` của `ForkliftLayout` (mobile shell) → DOUBLE LAYOUT, kết quả:
  - Header desktop của AppLayout xuất hiện BÊN TRONG mobile shell
  - Sidebar desktop có thể bị cắt
  - Padding desktop `p-6` thay vì `px-margin-mobile py-md`
  - Container `max-w-xl` hạn chế chiều rộng, nhưng mobile shell đã có `max-w-md`
- 🔴 L5 import `BarcodeScanner` từ `@/components/BarcodeScanner` (KHÔNG có prefix `shared/`) — đây là path **CŨ**, scanner desktop. Path đúng là `@/components/shared/BarcodeScanner`. **2 component khác nhau cùng tên** trong codebase.
- 🔴 L56 wrapper `p-6 max-w-xl space-y-5` → desktop pattern, KHÔNG mobile.
- 🟠 L62 back link Style B (text-sm text-primary) — khác với Style A của thukho/kiemke.
- 🟠 L65 H1 `text-2xl` — desktop size.
- 🟠 L69 form `bg-white rounded-xl border border-outline-variant p-6 shadow-sm space-y-5` — `space-y-5` không phải spacing token, `p-6` desktop.
- 🟡 L71 label `text-xs font-bold text-slate-500 uppercase tracking-wider` — `text-slate-500` không phải token WMS.
- 🟠 L92 button "Quét QR" `bg-indigo-600` — **indigo** không thuộc palette WMS. Đáng lẽ `bg-primary` hoặc `bg-secondary`.

#### `src/app/forklift/relocate/page.tsx`
- 🔴 L48 `<AppLayout title="CHUYỂN VỊ TRÍ">` — same issue.
- 🔴 L49 `p-6 max-w-xl space-y-5` — desktop.
- 🔴 L4 import `BarcodeScanner` từ path cũ.
- 🟡 L86 nút Quét QR `bg-indigo-600` — outlier.
- 🟡 L92 nút submit `bg-indigo-600 text-white` — KHÔNG match brand color.

#### `src/app/forklift/stage-out/page.tsx`
- 🔴 L109 `<AppLayout title="CHỜ XUẤT (FEFO)">` — same issue.
- 🔴 L110 `p-6 space-y-5` — desktop.
- 🟡 L119 H1 `text-2xl` — desktop size.
- 🔴 L240 `<table className="w-full text-sm" style={{ minWidth: 600 }}>` — **TABLE WIDTH 600px TRONG MOBILE** → bắt buộc horizontal scroll. Trên màn 360px, user phải swipe ngang để xem hết. **Disaster pattern.** Đáng lẽ chuyển từ table → card list.
- 🟡 L266 button "Xuất" `px-3 py-1.5 bg-amber-500` → height ~28px < 44px tap target.
- 🟡 L155 modal dialog dùng `rounded-2xl shadow-xl w-full max-w-lg` — `max-w-lg` (32rem = 512px) > màn mobile 360px → modal **TRÀN OUT** ngang. Cần `max-w-md sm:max-w-lg`.
- 🟡 L188 increment/decrement button `w-10 h-10` ~40x40 < 44px tap target nhưng gần đạt — chấp nhận.

#### `src/app/forklift/return/page.tsx`
- 🔴 L250 `<AppLayout title="HOÀN TRẢ PALLET">` — same issue.
- 🔴 L109 `p-6 max-w-xl space-y-5` — desktop.
- 🔴 L4 import scanner path cũ.
- 🟠 L121 back link Style C — outlier "Quay lại trang Xe nâng" dài hơn các page khác.
- 🟡 L155 alert pallet selection `bg-rose-50/50 border border-rose-100` — rose chỉ dùng ở đây. Nên `bg-error-container/40`.
- 🟡 L189 alert location `bg-emerald-50 border border-emerald-100` — emerald không phải token (đáng lẽ `bg-success-container/40`).
- 🟡 L221 button submit `bg-primary text-white` → đúng brand nhưng nhiều page xe nâng dùng amber/indigo — inconsistent.

#### `src/app/forklift/history/page.tsx`
- 🔴 L45 `<AppLayout title="LỊCH SỬ LUÂN CHUYỂN">` — same issue.
- 🔴 L34 fetch `/wms/api/movements?...` — **HARDCODE basePath `/wms`!** Khi chạy instance xenang (base `/xenang`), fetch sẽ về `/wms/api/...` → 404 hoặc CORS. **Bug runtime critical**.
- 🔴 L46 `p-6 space-y-5` — desktop.
- 🟡 L99 Link `/pallets/${m.pallet.id}` — link sang `/pallets/...` (admin route) mà người dùng xe nâng KHÔNG có quyền truy cập. Sẽ 403.

#### `src/app/forklift/pallet/page.tsx`
- ✓ L139 wrapper `px-margin-mobile py-md w-full flex flex-col gap-sm` — đây là page xe nâng đúng layout mobile.
- 🟡 L5 import `@/components/BarcodeScanner` path cũ — same issue.
- 🟡 L143 back link Style A ✓.
- 🟡 L152 KPI strip 3 column nhỏ — text `text-xs font-bold` cho số, `text-[9px]` cho label → label QUÁ NHỎ.
- 🟡 L196 button "Quét" `px-3 py-2` → ~32x32, < 44px tap target.
- 🟡 L207 tab style border-b-2 — khác với pill tab thukho. Inconsistent.
- 🟡 L259 card pallet `<div>` thay vì `<Link>` → KHÔNG navigate được khi tap card → user phải tap đúng action button cuối card. Khác với thukho/pallet/page.tsx L177 dùng `<Link>` cho cả card.

#### `src/app/forklift/profile/page.tsx`
- ✓ L55 wrapper OK (mobile style).
- 🟡 L80 user info `text-body-lg font-bold` — `text-body-lg` không có trong token. Fallback.
- 🟠 L100 mock data `licenseInfo` hard-code → **trên production sẽ hiển thị data giả** "FL-2026.0592-VG" → fake data trong UI thật. Nên ẩn block này hoặc đánh dấu rõ.
- 🟠 L113 mock KPI "movesToday: 14" → fake data. Same issue.
- 🔴 L188 button logout text uppercase → outlier như profile thủ kho.

### 2.3 Kiểm kê — 6 page

#### `src/app/kiemke/page.tsx`
- 🟡 L8 `any[]` type.
- 🟡 L17 wrapper OK.
- 🟡 L21–24 4 KPI box `flex flex-col items-center` → label trên, số dưới. Hơi khác với pattern ThukhoMobileDashboard L102 (label trên, số dưới, progress bar dưới cùng). Kiemke không có progress bar → đỡ trống nhưng kém info.
- 🟡 L29 menu items `Link` style `flex items-center gap-md p-md rounded-xl` → OK ergonomic.
- 🟡 L30 icon size `text-[28px]` → OK nhưng `text-blue-600`, `text-green-600`, `text-purple-600` cứng — không trong token.
- 🟡 L37 chip status raw text `s.status` (OPEN / COMPLETED) — KHÔNG localize.

#### `src/app/kiemke/tasks/page.tsx`
- 🟡 L17 wrapper OK.
- 🟡 L18 H1 `text-lg` OK.
- 🟡 L19 tab pill style giống thukho/inbound — OK consistent.
- 🟡 L28 emoji `📍` `🏷️` trong text → mix.
- 🟡 L30 progress bar `h-1.5 bg-surface-variant` — OK nhưng KHÔNG có label numeric khi không hover.

#### `src/app/kiemke/tasks/[id]/page.tsx`
- 🟡 L70 wrapper OK.
- 🟠 L76 hero card gradient `from-primary to-primary-hover` → KHÔNG đổi sang **tím** cho role kiểm kê. Inconsistent với forklift dashboard có hero cam, thukho có hero xanh. Đáng lẽ hero kiểm kê tím.
- 🟡 L81 emoji `📍` `🏷️` → mix.
- 🟡 L102 card có ô input `actual_qty` `w-full text-center text-sm font-bold border rounded px-1 py-0.5` → height ~24px, tap target QUÁ NHỎ. **Đây là page chính dùng để đếm hàng, ô số phải LỚN.**
- 🟡 L117 chip diff `px-1.5 py-0.5 rounded text-[9px]` → 9px label.
- 🟡 L143 input "Ghi chú" `text-[11px] bg-surface-low` → đẹp cho note phụ.
- 🔴 L157 nút "Lưu tất cả" có emoji 💾 cạnh material-symbols `save` → DUPLICATE icon.
- 🟡 L161 progress >= 80 mới hiện button "Hoàn tất" → magic number 80%. Nên có rule rõ.
- 🔴 L163 button "Hoàn tất kiểm kê" có emoji ✅ cạnh `check_circle` → DUPLICATE icon.

#### `src/app/kiemke/scan/page.tsx`
- 🟡 L57 wrapper OK.
- 🟡 L58 H1 `text-lg` OK.
- 🔴 L64 step 1 hero là `w-24 h-24 rounded-2xl bg-primary-container` chứa 1 icon `qr_code_scanner` size 48px → ĐẸP. Nhưng nút mở camera ngay bên dưới là `bg-violet-600` → **violet** không phải token kiểm kê (đáng lẽ tím = `#7c3aed`). Mock-up nói role kiểm kê tím nhưng dùng `violet-600` (#7c3aed) là OK về hex. **Vấn đề: hex hardcode thay vì token.**
- 🟡 L74 button "📷 Mở camera quét QR vị trí" có emoji + material-symbols → DUPLICATE.
- 🟡 L80 divider "hoặc nhập tay" `text-[10px]` → 10px nhỏ.
- 🟡 L93 button "Tìm" `text-sm` — OK nhưng width nhỏ (`px-4 py-2.5`) → đủ tap.
- 🟡 L105 checkbox label `text-[11px]` → ổn.
- 🟡 L119 location info card `bg-primary-container/20 border-primary/30` → khác background với các card khác (`bg-surface`).
- 🟡 L143 grid 3 col HT/Thực/CL — input `actual_qty` `w-full text-center text-sm font-bold border rounded px-1 py-0.5` — **tap target NHỎ** như trang task detail.

#### `src/app/kiemke/history/page.tsx`
- 🟡 L8 `any[]` type.
- 🟡 L50 wrapper OK.
- 🟡 L52 H1 OK.
- 🟡 L54 tab style `border-b-2` — khác với pill tab kiemke/tasks/page.tsx L20. **Cùng role 2 style tab.**
- 🟡 L60 search input `pl-10 pr-4 py-2.5` → OK.
- 🟡 L66 logic 2 mode `selectedPallet` (drill-in) — OK pattern.
- 🟡 L84 timeline node `w-2 h-2 rounded-full bg-primary` — cứng primary, không theo action type.

#### `src/app/kiemke/profile/page.tsx`
- 🟡 L22 wrapper `gap-sm` lệch token (đáng lẽ `gap-md`).
- 🟠 L29 hero gradient `from-primary to-primary-hover` → KHÔNG tím cho kiểm kê. Same inconsistency.
- 🟠 L97 button logout uppercase.
- 🔵 L67/L77 toggle switch chuẩn iOS style, KHÔNG có aria.

---

## 3. SCANNER & CAMERA UI

### `src/components/shared/BarcodeScanner.tsx`
- 🟡 L133 wrapper `relative` OK.
- 🟡 L134 `aspect-square bg-black rounded-lg overflow-hidden` → OK nhưng KHÔNG có corner brackets (4 góc) hoặc scan line animation. Đa số scanner mobile có:
  - 4 corner brackets cam/trắng
  - Đường scan line ngang chạy lên/xuống
  - Vùng tối overlay xung quanh focus area
- 🟡 L138 loading text "Đang khởi động camera..." — chỉ icon spin + text, KHÔNG có placeholder visual (đáng lẽ frame outline).
- 🟡 L143 nút torch `w-11 h-11` → 44x44, đúng tap target ✓. Nhưng chỉ hiện khi `ready && showTorch` → 1 giây đầu user thấy bị flicker (frame xám → đen → torch button xuất hiện).

### `src/components/shared/BarcodeScannerModal.tsx`
- 🟡 L70 wrapper `fixed inset-0 z-50 bg-black/95` → black opacity 95%, không full black → có thể nhìn thoáng qua page bên dưới. Nên `bg-black`.
- 🟡 L72 top bar `bg-zinc-900 text-white px-4 py-3` — **zinc-900 NOT trong palette WMS.** Nên dùng `bg-primary` (#000e24) hoặc `bg-black/80`.
- 🟡 L76 back button "←" là **kí tự Unicode**, KHÔNG phải icon. Mobile nên dùng `<span className="material-symbols-outlined">arrow_back</span>` để consistent.
- 🟡 L89 hint text "Đặt mã vạch / QR vào khung" `text-white/70 text-xs` — OK.
- 🟡 L97 footer hint "📦 Đang chờ quét mã..." emoji.
- 🟡 L100 form thủ công có input + button — OK responsive.
- 🟡 L118 button "✓ Xác nhận" emoji ✓ — đáng lẽ icon.
- 🟡 L125 bottom action bar `bg-zinc-900` — same color issue.
- 🟡 L131 buttons "Ảnh / Nhập tay / Đóng" có icon material-symbols ✓ + label tiếng Việt. OK nhưng size 22px khá nhỏ → nâng 24px.

### `src/components/shared/ImageUpload.tsx`
- 🟡 L150 add tile `aspect-square bg-slate-50 border-2 border-dashed border-slate-300` → slate KHÔNG token.
- 🟡 L165 icon size 28px OK.
- 🟡 L167 label `text-[10px]` — KÉO 10px.
- 🟡 L185 ảnh thumb `aspect-square bg-slate-100` → cùng slate.
- 🟡 L196 nút xóa `w-6 h-6 rounded-full bg-rose-500` → 24x24, **THẤP HƠN NHIỀU SO 44px** tap target. Khó tap ngón cái trên mobile.
- 🟡 L201 dấu × Unicode thay vì `<span className="material-symbols-outlined">close</span>`.
- 🟡 L204 caption `text-[9px]` cho filename → 9px, không đọc được.

---

## 4. TYPOGRAPHY MOBILE TỔNG QUAN

### Font size dưới min readable

Đếm các vị trí dùng font dưới 12px:
- `text-[9px]` — đếm được **>20 lần**. Vị trí điển hình:
  - Chip status (status badge): `text-[9px] font-bold` — không đọc được trên màn nhỏ.
  - Caption filename trong ImageUpload.
  - Label gauge nhỏ (HT/CL).
  - Mockup zone label trong dashboard mini map.
- `text-[10px]` — đếm được **>50 lần**:
  - Subtitle dưới H1.
  - Meta data dưới card.
  - Tab label.
- `text-[11px]` — đếm được **>30 lần**, đa số là `font-mono uppercase tracking-wider` — chấp nhận được vì mono dễ đọc hơn sans ở size nhỏ.

🟠 **Đề xuất**:
- Tối thiểu **11px** cho mono / 12px cho sans.
- Chip status: nâng 11px.
- Caption filename: thay bằng tooltip / ellipsis.
- Mini map: bỏ label, dùng legend ngoài.

### Truncate

- `truncate max-w-[180px]` — pattern phổ biến nhưng magic number. Đáng lẽ responsive (vd `truncate max-w-[40vw]`).
- Nhiều card list có `truncate` mà KHÔNG có `title={...}` attribute → user mất thông tin khi tên dài.

### Line height

Nhìn chung OK. Nhưng các block label/value có `leading-tight` (1.0) dùng cho headline tốt, nhưng list dài text dày → khó đọc.

---

## 5. EMOJI vs ICON — Tổng hợp

Đếm các vị trí mix emoji + material-symbols-outlined trong cùng button/title:

| File | Emoji | Material-symbols |
|---|---|---|
| `thukho/pallet/page.tsx` L89 | 📦 Pallet của tôi | `inventory_2` |
| `thukho/pallet/new/page.tsx` L86 | 🆕 (hero) | — |
| `thukho/pallet/new/page.tsx` L174 | 📦 Tạo pallet | `inventory_2` |
| `thukho/pallet/[id]/page.tsx` L330 | ✓ / ⚠ | — |
| `thukho/inbound/[id]/page.tsx` L58 | ⚠ | — |
| `thukho/warehouse/stocktake/page.tsx` L18 | 📍 / 🏷️ | — |
| `kiemke/page.tsx` L31 | — | `qr_code_scanner` |
| `kiemke/tasks/[id]/page.tsx` L81 | 📍 / 🏷️ | — |
| `kiemke/tasks/[id]/page.tsx` L159 | 💾 Lưu tất cả | `save` ngay cạnh |
| `kiemke/tasks/[id]/page.tsx` L163 | ✅ Hoàn tất kiểm kê | `check_circle` ngay cạnh |
| `kiemke/scan/page.tsx` L75 | 📷 Mở camera... | `photo_camera` |
| `forklift/page.tsx` (dashboard) L237 | 📥 / ⏱ | — |
| `forklift/pallet/page.tsx` L308 | (icon thuần) | — |
| `forklift/stage-out/page.tsx` L16 URGENCY_MAP | 🔴 / 🟡 / 🟢 | — |
| `BarcodeScannerModal.tsx` L97 | 📦 | — |
| `BarcodeScannerModal.tsx` L118 | ✓ | — |

🟠 **Designer's verdict**: 16 vị trí mix emoji + icon. Cần dứt khoát chọn 1:
- Khuyến nghị: **material-symbols-outlined cho mọi action icon**. Emoji chỉ dùng cho status flag tinh thần (vd 🎉 khi hoàn tất task, 🆕 cho hero new) — KHÔNG dùng trong button label.

---

## 6. LOADING / EMPTY / ERROR STATES

### 6.1 Loading state — 🟡 Trung bình

Pattern lặp lại:
```tsx
{loading ? <div className="py-16 text-center"><span className="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span></div> : ...}
```
- Đếm **>15 lần** identical. Nên `<LoadingSpinner size="lg" />`.
- Loading text "Đang tải..." KHÔNG xuất hiện ở các page → user chỉ thấy icon xoay không hiểu đang chờ gì.

### 6.2 Empty state — 🟠 Cao

3 phong cách empty state:

**A. Icon + label + CTA** (✓ tốt nhất):
- `thukho/pallet/page.tsx` L157–167: icon + label + Link "Tạo pallet đầu tiên".

**B. Icon + label thôi** (thiếu CTA):
- `forklift/page.tsx` ForkliftMobileDashboard L199: icon `check_circle` + text "Không có pallet nào chờ xếp vị trí."
- `thukho/warehouse/queue/page.tsx` L17: icon + text "Không có pallet chờ".

**C. Chỉ text** (tệ nhất):
- `thukho/adhoc/page.tsx` L31: `<div className="py-16 text-center text-sm text-on-surface-variant">Chưa có phiếu tạm nào</div>` — KHÔNG icon, KHÔNG CTA.
- `thukho/inbound/page.tsx` L45: same.
- `thukho/warehouse/inventory/page.tsx` L19: same.
- `thukho/warehouse/movements/page.tsx` L32: same.
- `thukho/warehouse/staging/page.tsx` L17: same.
- `thukho/warehouse/stocktake/page.tsx` L17: same.
- `kiemke/tasks/page.tsx` L24: same.

🟠 **Đề xuất**: tạo `<EmptyState icon="..." title="..." description="..." action={<Link>...</Link>} />`.

### 6.3 Error state — 🔴 Nghiêm trọng

**Hầu hết page KHÔNG có error UI.** Pattern phổ biến:
```tsx
.catch(console.error)
```
- Khi API fail, user thấy spinner ngừng và list rỗng → tưởng là "không có data" thay vì error.
- Một vài page có error: thukho/pallet/new (L162–166), thukho/item-code/new (L33), thukho/adhoc/new (L34) — chỉ ở form submit, KHÔNG ở fetch list.

🔴 **Hệ quả**: khi network fail / backend 500, user nhận **misleading empty state** thay vì error → không retry.

🔴 **Đề xuất**: tạo `<ErrorState message="..." onRetry={fetchData}>` và wrap mọi list page.

---

## 7. NAVIGATION & ROUTING

### 7.1 Back button vị trí

- Đa số page có back link ở **đầu page, trên H1**. ✓
- 1 số page có back link **trong header sticky** (vd ForkliftMobileDashboard không, vì là dashboard không có back).

### 7.2 Breadcrumb

KHÔNG page nào có breadcrumb. Phù hợp cho mobile (depth thường < 3).

### 7.3 Cross-instance navigation

🔴 **Vấn đề lớn**: 4 instance Next.js cùng codebase nhưng base path khác. `mobileHref()` helper sinh ra path cross-instance. Tuy nhiên đếm được:
- `src/app/forklift/*` ÍT dùng `mobileHref()` — đặc biệt page `put-away`, `relocate`, `stage-out`, `return`, `history`, `pallet` đều `<Link href="/forklift/...">` raw → khi user kiểm kê (instance `kiemke`) click link sang `/forklift/pallet`, sẽ KHÔNG navigate đúng instance.
- `src/app/forklift/history/page.tsx` L34: fetch hardcode `/wms/api/...` → **chỉ chạy trên instance wms, các instance khác sẽ 404**.

---

## 8. RESPONSIVE WIDTH & OVERFLOW

### 8.1 Bị overflow ngang

- `src/app/forklift/stage-out/page.tsx` L240: `<table style={{ minWidth: 600 }}>` — TABLE 600px buộc overflow. Mobile shell `max-w-md` = 448px → table dài 600px → swipe ngang.
- `src/app/forklift/stage-out/page.tsx` L155: modal `max-w-lg` = 512px > viewport 360px → modal tràn.

### 8.2 KPI strip horizontal scroll

- `src/components/thukho/ThukhoMobileDashboard.tsx` L100 KPI strip dùng `overflow-x-auto` → OK pattern.
- ForkliftMobileDashboard L107 thì dùng `grid grid-cols-2 gap-gutter` → 2x2 grid, không scroll. **2 dashboard 2 cách bố cục KPI khác nhau.**

### 8.3 Form input

- Hầu hết select/input dùng `w-full` ✓.
- Một vài input `text-center` size nhỏ `w-full text-center text-sm font-bold border rounded px-1 py-0.5` (vd ô đếm thực số) → height ~24px → tap nhỏ.

---

## 9. ACCESSIBILITY (BONUS)

- Toggle switch các profile page (thukho/forklift/kiemke) — **KHÔNG có `role="switch"` / `aria-checked`** → screen reader đọc không hiểu.
- Icon-only button (vd nút Quét QR `<span className="material-symbols-outlined">qr_code_scanner</span>`) — **KHÔNG có `aria-label`** → screen reader đọc icon ligature "qr_code_scanner" raw.
- Hầu hết Link không có `aria-current="page"` khi active.
- Modal scanner KHÔNG có `aria-modal` (đã có 1 vị trí L70).

🔵 Severity: thấp với consumer enterprise, nhưng vẫn nên fix.

---

## 10. TOP 10 LỖI NẶNG NHẤT

1. 🔴 **5 page xe nâng nhúng `<AppLayout>` desktop** (`put-away`, `relocate`, `stage-out`, `return`, `history`) → bị double layout, padding sai, font sai, button màu lạ (indigo, amber, rose).
2. 🔴 **`forklift/history/page.tsx` L34 fetch hardcode `/wms/api/movements`** → instance xenang/thukho/kiemke không gọi được API → 404.
3. 🔴 **ForkliftMobileDashboard.tsx có DOUBLE HEADER** — header cam tự render đè lên header trắng của layout.
4. 🔴 **Token `text-headline-md-mobile` KHÔNG được định nghĩa** trong globals.css → 3 layout header dùng size sai mặc định.
5. 🔴 **Table 600px width trong `forklift/stage-out`** + modal `max-w-lg` tràn viewport mobile.
6. 🔴 **5 page profile có button logout uppercase** outlier không match design system còn lại.
7. 🔴 **Hero card adhoc dùng gradient `from-secondary to-amber-700` outlier** so với pattern thường.
8. 🔴 **Mock data hard-code trong `forklift/profile`** (license, KPIs) → user prod sẽ thấy data giả.
9. 🟠 **8 phiên bản status chip** rải rác, không có single source of truth.
10. 🟠 **3 phong cách back link** + 3 phong cách tab + 2 phong cách card style + 4 size H1.

---

## 11. ĐỀ XUẤT FIX — ROADMAP

### Phase 1 — Foundation mobile (1.5 ngày)

#### Components shared mới
- [ ] `src/components/mobile/MobileTopbar.tsx` — topbar role-aware (prop color: primary/orange/violet), tự render avatar + name + role caption + slot right actions
- [ ] `src/components/mobile/MobileTabbar.tsx` — bottom nav 5 tab, color theo role
- [ ] `src/components/mobile/BackLink.tsx` — back link Style A unified
- [ ] `src/components/mobile/StatusChip.tsx` — chip status với map color theo enum (PALLET / INBOUND / STOCKCOUNT / MOVEMENT)
- [ ] `src/components/mobile/EmptyState.tsx` — icon + title + desc + action
- [ ] `src/components/mobile/ErrorState.tsx` — error + retry button
- [ ] `src/components/mobile/LoadingSpinner.tsx` — spinner size sm/md/lg
- [ ] `src/components/mobile/QuickAction.tsx` — card icon + label + link
- [ ] `src/components/mobile/HeroHeader.tsx` — gradient hero với title + sub + status, color theo role
- [ ] `src/components/mobile/KPIStrip.tsx` — strip/grid KPI 2/3/4 col

#### Token system
- [ ] Thêm token vào `globals.css`:
  - `--color-warning-container: #fff0d6;`
  - `--color-forklift: #ea580c;`
  - `--color-kiemke: #7c3aed;`
  - `--text-headline-md-mobile: 18px;`
  - `--text-body-lg: 16px;`
- [ ] Tạo `src/lib/status-meta.ts` export 4 status map.
- [ ] Tạo `src/lib/role-theme.ts` export config color cho 3 role.

### Phase 2 — Critical fixes (1 ngày)

- [ ] Rewrite 5 page xe nâng (`put-away`, `relocate`, `stage-out`, `return`, `history`) bỏ `<AppLayout>` → dùng mobile wrapper.
- [ ] Fix import path `BarcodeScanner` → từ `@/components/BarcodeScanner` (old) sang `@/components/shared/BarcodeScanner` (new) cho 6 file forklift.
- [ ] Fix hardcoded `/wms/api/...` trong `forklift/history/page.tsx` thành `${basePath}/api/...`.
- [ ] Xoá DOUBLE HEADER trong ForkliftMobileDashboard, đẩy màu cam lên layout.
- [ ] Rewrite table `forklift/stage-out` → card list mobile.
- [ ] Remove `max-w-lg` modal → `max-w-md sm:max-w-lg`.

### Phase 3 — Replace với shared components (1 ngày)

- [ ] Thay tất cả back link bằng `<BackLink />`.
- [ ] Thay tất cả status badge bằng `<StatusChip status={...} type={...} />`.
- [ ] Thay tất cả empty state bằng `<EmptyState />` với CTA.
- [ ] Thay tất cả loading bằng `<LoadingSpinner />`.
- [ ] Thay tất cả KPI strip bằng `<KPIStrip />`.
- [ ] Thay 3 hero card bằng `<HeroHeader />` color theo role.
- [ ] Update mobileHref trong tất cả forklift page.

### Phase 4 — Polish (0.5 ngày)

- [ ] Loại bỏ tất cả emoji trong button label (giữ lại trong toast / system messages).
- [ ] Nâng tap target ≥ 44px cho: search clear button, delete line button, increment/decrement, status badge clickable, KPI number tile.
- [ ] Nâng font: `text-[9px]` → `text-[11px]`, `text-[10px]` cho info → `text-[11px]`.
- [ ] Localize tất cả status text từ English sang Vietnamese.
- [ ] Add `aria-label` cho 100% icon-only button.
- [ ] Add `role="switch"` + `aria-checked` cho 6 toggle switch trong profile.

### Phase 5 — Profile cleanup (0.25 ngày)

- [ ] Bỏ mock data hard-code trong `forklift/profile` (license, KPIs) — chuyển sang API hoặc ẩn block khi chưa có data.
- [ ] Bỏ uppercase button logout.
- [ ] Unified profile page template (3 role chỉ khác hero color).

---

## 12. PHỤ LỤC — MAGIC NUMBER / CLASS GỐC

Các class/number xuất hiện 1 vị trí, đáng lý phải dùng token:

| Magic | Vị trí xuất hiện | Đáng lẽ |
|---|---|---|
| `bg-zinc-900` | BarcodeScannerModal L72, L125 | `bg-primary` hoặc `bg-black/90` |
| `bg-slate-50` | ImageUpload L150, ThukhoNewPalletPage L98 | `bg-surface-low` |
| `bg-slate-100` | ImageUpload L185 | `bg-surface-low` |
| `bg-slate-300` | ImageUpload L150 | `border-outline-variant` |
| `bg-violet-600` | KiemkeScanPage L72 | `--color-kiemke` token |
| `bg-indigo-600` | forklift/{put-away,relocate} | `bg-primary` |
| `bg-amber-500` (button) | forklift/stage-out, thukho/inbound | `bg-warning` |
| `bg-amber-700` (gradient end) | adhoc/[id] L40 | bỏ → dùng primary |
| `bg-green-50/200/600/700` | thukho/inbound/[id] L60, item-code success | `--color-success-container` |
| `bg-blue-50/100/600/700` | warehouse/page menu, history | `--color-secondary-container` |
| `bg-purple-50/100/600/700` | kiemke/page menu | `--color-kiemke-container` (chưa có) |
| `bg-rose-100/500/600` | ImageUpload, forklift/return | `bg-error-container` / `bg-error` |
| `bg-cyan-50/600` | warehouse/page menu | (cần thêm token) |
| `bg-emerald-50/100/500/600` | forklift, ImageUpload | `--color-success-container` |
| `bg-amber-50/100/200/300/400/500/600/700` | rải rác | `--color-warning-container` etc. |
| `text-[8px]` | ForkliftMobileDashboard mini map | bỏ |
| `text-[9px]` | >20 vị trí | `text-[11px]` |
| `text-[10px]` | >50 vị trí | `text-[11px]` |
| `min-w-[600px]` | forklift/stage-out table | bỏ table → card |
| `max-w-[180px]` | rải rác truncate | responsive `max-w-[40vw]` |
| `min-w-[140px]` | ThukhoMobileDashboard KPI | OK |
| `min-w-[30px]` | timeline gap | OK |
| `px-1 py-0.5` | input đếm SL | nâng `px-3 py-2` |
| `w-2 h-2` | timeline dot | OK |
| `w-6 h-6` | ImageUpload delete button | nâng `w-8 h-8` min |
| `w-8 h-8` | pallet delete line | nâng `w-10 h-10` min |
| `space-y-5` | forklift/* desktop pages | `gap-md` flex/grid |

---

## 13. KẾT LUẬN

Hệ thống mobile WMS Vĩnh Giang đã có **bộ xương đúng** (3 layout chuẩn, design tokens cơ bản, component scanner) — nhưng **lớp da và quần áo lộn xộn**:

**Điểm mạnh**:
- Layout shell mobile (max-w-md, bottom tab bar, sticky header) consistent ở 3 role.
- ThukhoMobileDashboard và ThukhoPalletListPage có pattern KPI / list / chip tương đối nhất quán.
- BarcodeScanner / Modal đã shared, dùng được.
- ImageUpload là shared component sạch.

**Điểm yếu (cần ưu tiên fix)**:
1. **Identity màu role không nhất quán** (layout chung primary, dashboard tự render màu role → ra DOUBLE HEADER).
2. **5 page xe nâng dùng AppLayout desktop** — disaster cấp 1.
3. **8 phiên bản status chip / 3 phiên bản back link / 4 size H1 / 3 phong cách tab** rải rác.
4. **Emoji + material-symbols mix loạn**, đặc biệt cùng button.
5. **Tap target nhiều chỗ < 44px**, font < 11px.
6. **Empty/Error state thiếu CTA / không có**.

**Estimate fix toàn bộ**: ~4 ngày người làm + 1 ngày QA mobile = 5 ngày. Sau fix sẽ có hệ thống mobile thật sự **professional, role-aware, accessible**.

— Senior Product Designer

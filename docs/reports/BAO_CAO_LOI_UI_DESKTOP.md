# BÁO CÁO AUDIT GIAO DIỆN DESKTOP — Designer OCD Mode

> **Severity legend:** 🔴 Nghiêm trọng (chặn ship) | 🟠 Cao (sửa Sprint này) | 🟡 Trung bình | 🔵 Thấp (polish khi rảnh)
>
> **Auditor:** Senior Product Designer (OCD mode ON)
> **Scope:** 50+ pages desktop của WMS Vĩnh Giang (không bao gồm `/xenang`, `/thukho`, `/kiemke` mobile)
> **Audit date:** 2026-05-25
> **TL;DR:** Codebase này chưa có **bất kỳ** component UI nguyên tử (Button/Input/Modal/Select/Toast/Form) nào. Mọi page tự inline CSS Tailwind theo cảm hứng. Hệ quả là **3 bảng màu cùng tồn tại** (design-token, slate-XX, semantic-tone), **15+ biến thể button**, **9 implementation modal khác nhau**, và **page padding nhảy ngẫu nhiên `p-4 / p-5 / p-6 / p-8`**. Một designer mới vào nhìn vào 5 phút là biết đã có ít nhất 3 thế hệ developer chồng lên nhau mà không ai chốt design system.

---

## 1. THIẾU COMPONENT NỀN TẢNG (root cause của 70% các lỗi bên dưới)

`src/components/ui/` hiện CHỈ có 2 component:
- 🟢 `Card.tsx` — wrapper 1 dòng `<div className="industrial-card">` (chấp nhận được)
- 🟢 `Badge.tsx` — wrapper 1 dòng `<span className="chip chip-${variant}">` (chấp nhận được)

Còn lại **KHÔNG CÓ** bất kỳ thứ gì trong số sau:
- 🔴 **`<Button>`** — không tồn tại → 50+ page mỗi page tự viết button inline → ~150+ biến thể CSS button
- 🔴 **`<Input>` / `<TextField>`** — không tồn tại → mỗi form viết `<input className="...">` khác nhau
- 🔴 **`<Select>`** — native `<select>` raw, mỗi nơi style 1 kiểu, một số nơi đè bg-white, một số `bg-surface-low`, một số `bg-slate-50`
- 🔴 **`<Modal>` / `<Dialog>`** — không có portal, không focus trap, không ESC handler, không lock-scroll. Mỗi page tự dựng `<div className="fixed inset-0 z-50...">` → đếm được **ít nhất 9 implementation khác nhau**
- 🔴 **`<Toast>` / `<Notification>`** — không có. Một số chỗ dùng `alert()` thô (rất tệ với UX), chỗ khác `setToast()` state local, chỗ khác dùng inline message
- 🔴 **`<ConfirmDialog>`** — không có → đại đa số dùng `window.confirm()` (xấu xí, không styling, không thể quốc tế hóa)
- 🔴 **`<Pagination>`** — không có → master-data + item-codes copy-paste y hệt 1 khối ~20 dòng
- 🔴 **`<EmptyState>`** — không có → mỗi page tự viết kiểu "icon + text mờ" khác nhau
- 🔴 **`<LoadingSpinner>` / `<PageLoader>`** — không có → spinner kích thước 18px/20px/24px/28px/32px/40px/48px **đều** xuất hiện ngẫu nhiên trong app
- 🔴 **`<Tabs>`** — không có
- 🔴 **`<Stepper>`** — không có (mặc dù 3 page khác nhau cần: `inbound/page.tsx` UC-IN-05, `inbound/import/page.tsx`, `master-data/page.tsx` import, `auth/forgot-password` — mỗi chỗ tự viết tay)
- 🔴 **`<DropdownSearch>` / `<Combobox>`** — chuẩn hóa mã hàng + product picker đều tự viết, copy-paste khắp nơi
- 🔴 **`<DataTable>` / `<Table>`** wrapper — mỗi page tự dựng `<table><thead><tbody>` với header bg khác nhau
- 🔴 **`<FormField>`** — `<label>` + `<input>` + `<error message>` mỗi nơi 1 kiểu

**Hệ quả trực tiếp:** Nếu một designer mới yêu cầu đổi border-radius button từ `rounded-lg` (8px) sang `rounded-md` (6px), phải sửa tay ~150 chỗ và chắc chắn sẽ bỏ sót.

---

## 2. INCONSISTENCY THEO CATEGORY

### 2.1 Button — đếm được **ít nhất 18 biến thể** trong codebase

Sau khi quét hơn 30 page chính, các biến thể "primary button" sau đây cùng tồn tại:

| # | Class string | Xuất hiện ở |
|---|---|---|
| 1 | `px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container` | `master-data/page.tsx:421-424`, `item-codes/page.tsx:319-322` |
| 2 | `px-4 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-lg ... shadow-sm font-medium` | `inbound/page.tsx:225-231` |
| 3 | `px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-hover` | `system/users/page.tsx:63`, `stock-count/page.tsx:34` |
| 4 | `px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/95` | `outbound/requests/page.tsx:57` |
| 5 | `px-5 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-container` | `master-data/page.tsx:714`, `item-codes/page.tsx:539` |
| 6 | `px-3 py-2 text-sm bg-primary text-white` (chip filter) | `inbound/page.tsx:267-270` |
| 7 | `px-3 py-1.5 rounded-lg text-xs font-semibold ... bg-primary text-white` | `dashboard/page.tsx:145` |
| 8 | `px-3.5 py-1.5 bg-white border border-primary text-primary text-xs font-semibold rounded-lg` (outline) | `master-data/page.tsx:828` |
| 9 | `w-full h-[52px] bg-primary-container text-white text-headline-sm rounded-xl` (LOGIN-only) | `auth/page.tsx:243` |
| 10 | `inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold` | `AppLayout.tsx:91` (access denied) |
| 11 | `px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700` (Excel xanh lá riêng) | `outbound/report/page.tsx:66` |
| 12 | `flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700` (RBAC export) | `system/rbac/page.tsx:110` |
| 13 | `flex items-center gap-1.5 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700` (RBAC reset) | `system/rbac/page.tsx:123` |
| 14 | `px-3.5 py-2 border border-outline-variant rounded-lg text-xs font-semibold` (refresh) | `ForkliftWebDashboard.tsx:200` |
| 15 | `inline-block mt-3 px-4 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/95` | `outbound/requests/page.tsx:108` |
| 16 | `px-6 py-3 bg-[#022448] text-white text-sm font-semibold rounded-lg hover:bg-[#000e24]` (hardcoded HEX!) | `auth/forgot-password/page.tsx:302, 338, 383, 400` |
| 17 | `px-8 py-3 bg-[#022448] text-white text-sm font-semibold rounded-lg` (step-4 confirm) | `auth/forgot-password/page.tsx:400` |
| 18 | `w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-[#c4c6cf] text-sm font-medium rounded-lg text-[#43474e] hover:bg-[#f4f3f1]` (back button) | `auth/forgot-password/page.tsx:470` |

🔴 **KẾT LUẬN:** Padding-X nhảy `3 / 3.5 / 4 / 5 / 6 / 8`. Padding-Y nhảy `1.5 / 2 / 2.5 / 3`. Font-weight `medium / semibold / bold` random. Hover dùng cả `bg-primary-hover`, `bg-primary-container`, `bg-primary/95`, `bg-primary/90`. Border-radius có cả `rounded-lg` lẫn `rounded-xl` lẫn — riêng login button — `rounded-xl 52px`. **Không thể chấp nhận được trong cùng 1 sản phẩm.**

#### Before/After đề xuất

```tsx
// ❌ HIỆN TẠI (ở mỗi page)
<button className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-container flex items-center gap-2">
  <span className="material-symbols-outlined text-[18px]">add</span>
  Thêm sản phẩm
</button>

// ✅ SAU KHI CÓ COMPONENT
<Button variant="primary" size="md" icon="add">
  Thêm sản phẩm
</Button>
```

---

### 2.2 Input — đếm được **ít nhất 9 biến thể**

| # | Style | File |
|---|---|---|
| 1 | `w-full px-3 py-2 border border-outline-variant rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary` (chuẩn nhất) | `master-data/page.tsx` (toàn bộ form), `item-codes/page.tsx` |
| 2 | `w-full pl-10 pr-3 py-2 bg-surface-low rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20` (filter — KHÔNG border, dùng bg) | `master-data/page.tsx:435`, `item-codes/page.tsx:348`, `inbound/page.tsx` search |
| 3 | `w-full pl-10 pr-16 py-2 bg-surface-low rounded-lg text-sm border-0 focus:ring-2 focus:ring-primary/20` (global search trong header) | `UcHeader.tsx:186` |
| 4 | `w-full pl-11 pr-4 py-3 border border-[#c4c6cf] rounded-lg text-sm focus:ring-2 focus:ring-[#022448]/20 focus:border-[#022448]` (HARDCODED HEX!) | `auth/forgot-password/page.tsx:299` |
| 5 | `block w-full pl-[44px] pr-xl py-[14px] bg-transparent border-none focus:ring-0` (login — pixel cứng) | `auth/page.tsx:156` |
| 6 | `w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary` (border-slate-300!) | `system/users/page.tsx:145` |
| 7 | `px-3 py-2 text-sm border border-outline-variant rounded-lg bg-white font-semibold` (select) | `dashboard/manager/page.tsx:61` |
| 8 | `w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20` (search outbound/requests) | `outbound/requests/page.tsx:83` |
| 9 | `px-2 py-1 text-xs rounded border border-slate-300 bg-white font-semibold` (inline cận-date filter) | `inventory/page.tsx:141` |

🔴 **Bốn border color** cùng tồn tại cho input: `border-outline-variant` (đúng token), `border-slate-300`, `border-[#c4c6cf]` (hex cứng), và không-border (đè bằng `bg-surface-low`). Padding `py-1`, `py-1.5`, `py-2`, `py-2.5`, `py-3`, `py-[14px]` cùng tồn tại. Focus ring cũng nhảy `focus:ring-primary/20` vs `focus:ring-[#022448]/20`.

🟠 **`system/users/page.tsx:145` dùng `border-slate-300`** trong khi standard là `border-outline-variant` (#c4c6cf). Một sai lệch nhỏ nhưng không thể tha thứ.

---

### 2.3 Modal/Dialog — đếm được **ít nhất 9 implementation khác nhau**

| # | Pattern | File | Đặc điểm |
|---|---|---|---|
| 1 | `<div className="fixed inset-0 z-50 flex items-center justify-center" style={animation: fadeIn}>...<div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close}/><div className="relative bg-white rounded-xl shadow-2xl w-[680px] max-w-[95vw] max-h-[90vh] overflow-y-auto" style={animation: scaleIn}>` | `master-data/page.tsx:589` (form sản phẩm — chuẩn nhất) | rounded-xl 680px, scaleIn anim inline `<style>` |
| 2 | Same nhưng `rounded-xl shadow-2xl p-6 w-[420px]` (confirm delete) | `master-data/page.tsx:731` | size khác |
| 3 | Same nhưng `w-[800px]` (import excel) | `master-data/page.tsx:758` | size khác |
| 4 | Same nhưng `w-[560px]` (tạo mã hàng) | `item-codes/page.tsx:478` | size khác |
| 5 | Same nhưng `w-[720px]` (chuẩn hóa mã hàng) | `item-codes/page.tsx:552` | size khác |
| 6 | `<div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={close}><div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-scale-up">` | `system/users/page.tsx:124` | `rounded-2xl` thay vì `rounded-xl`!! Backdrop `bg-slate-900/40` thay vì `bg-black/40`!! |
| 7 | `<div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={close}><div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">` | `inventory/by-location/page.tsx:62` | Backdrop opacity 30% thay vì 40%!! `rounded-2xl` shadow-xl thay vì shadow-2xl!! |
| 8 | `<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close}/><div className="relative bg-[#022448] text-white rounded-2xl shadow-2xl p-8 w-[480px] max-w-[90vw] border border-[#455f87]/30">` | `auth/forgot-password/page.tsx:178` (mock OTP popup) | Nền primary đen + text trắng + border màu lạ! |
| 9 | `BarcodeScannerModal.tsx` (component riêng) | `shared/BarcodeScannerModal.tsx` | Có riêng — tốt nhưng không dùng portal |

🔴 **9 modal khác nhau cho 1 design pattern duy nhất.** Border-radius `rounded-xl` vs `rounded-2xl`, shadow `shadow-2xl` vs `shadow-xl`, backdrop `bg-black/40` vs `bg-black/30` vs `bg-slate-900/40`, width đủ loại `420/480/560/680/720/800px`. Animation `fadeIn`/`scaleIn` keyframes được copy-paste inline `<style>` trong cả `auth/forgot-password/page.tsx:213-216` lẫn `master-data/page.tsx` (animation định nghĩa nhiều lần).

🔴 **KHÔNG MODAL NÀO** có focus trap, ESC close, hoặc lock body scroll. Khi mở modal trên trang dài, scroll vẫn nhảy. Đây là vấn đề a11y cấp độ AA fail.

---

### 2.4 Card padding & rounded — random

| Style | Xuất hiện ở |
|---|---|
| `<Card className="p-4 rounded-lg">` | `dashboard/page.tsx:162-212` (KPI) |
| `<Card className="p-5 rounded-lg">` | `dashboard/page.tsx:218, 322, 345`, `master-data/page.tsx:570-580` (KPI footer) |
| `<Card className="p-4 rounded-lg">` (filter) | `master-data/page.tsx:429`, `item-codes/page.tsx:342` |
| `bg-white p-4 rounded-xl border border-outline-variant shadow-sm` (custom card) | `dashboard/page.tsx:164`, `dashboard/manager/page.tsx:85` |
| `bg-white p-3.5 rounded-xl border shadow-sm` | `inbound/page.tsx:249`, `outbound/page.tsx:70-83` |
| `bg-white p-4 rounded-xl border shadow-sm` | `outbound/requests/page.tsx:72` |
| `bg-white rounded-xl border border-outline-variant shadow-sm overflow-hidden` (table wrapper) | `outbound/page.tsx:89`, `outbound/requests/page.tsx:87`, `system/users/page.tsx:65`, `inventory/by-location/page.tsx:44` |
| `bg-surface rounded-lg border border-surface-variant p-4` | `item-codes/page.tsx:327` |
| `rounded-xl border border-rose-300 p-4 shadow-sm` (cận date panel — gradient pink-orange) | `inventory/page.tsx:126` |

🔴 **Hai class `<Card>` và `bg-white rounded-xl border` cùng tồn tại** — cùng việc nhưng 1 chỗ dùng wrapper, 1 chỗ inline. `<Card>` mặc định là `industrial-card` (border `#e7e5e0`) nhưng nhiều custom card dùng `border-outline-variant` (#c4c6cf) hoặc `border-slate-200` (#e2e8f0) → 3 màu border khác nhau cho cùng 1 thiết kế card.

🟠 **`rounded-lg` (8px) vs `rounded-xl` (12px) vs `rounded-2xl` (16px)** xuất hiện ngẫu nhiên cho cùng level component:
- Card hệ thống dùng `<Card>` → `rounded-lg` (8px)
- Card dashboard/inbound/outbound → `rounded-xl` (12px)
- Modal user → `rounded-2xl` (16px)
- Modal khác → `rounded-xl`

---

### 2.5 Color palette — **3 bảng màu cùng tồn tại**

Đếm khắp codebase, tôi tìm thấy **đồng thời** 3 hệ thống màu này:

#### A. Design tokens chuẩn (đúng) — `globals.css` định nghĩa
- `text-primary`, `text-on-surface-variant`, `text-on-surface`, `text-secondary`, `text-error`, `text-success`, `text-warning`
- `bg-primary`, `bg-surface`, `bg-surface-low`, `bg-error-container`
- `border-outline`, `border-outline-variant`, `border-surface-variant`

#### B. Tailwind slate-XX (sai — không match brand)
- `text-slate-300`, `text-slate-400`, `text-slate-500`, `text-slate-600`, `text-slate-700`, `text-slate-800`, `text-slate-900`
- `bg-slate-50`, `bg-slate-100`, `bg-slate-200`, `bg-slate-300`
- `border-slate-100`, `border-slate-200`, `border-slate-300`
- **VD:** `dashboard/page.tsx:133` dùng `text-2xl font-bold tracking-tight text-primary` nhưng cùng file `text-slate-500 mt-0.5`. Hỏi: tại sao 1 chỗ on-surface-variant 1 chỗ slate-500? Câu trả lời: developer không biết design token. `system/users/page.tsx:127` viết hẳn `text-slate-900` (đáng lẽ phải là `text-on-surface`). Nhân nhiều file ra → app trông như xếp lego từ 2 set khác nhau.

#### C. Semantic-tone Tailwind cho status (loạn — mỗi page tự chọn)
- amber-50/600/700, emerald-50/600/700, blue-50/600/700, indigo-50/600/700, purple-50/600/700, rose-50/500/600/700, orange-50/700, cyan-50/700, pink-50, yellow-50

Ví dụ inconsistency rõ rệt:
- 🔴 **Status `PENDING`** ở `dashboard/page.tsx:96` dùng `bg-amber-50 text-amber-700`, nhưng ở `inbound/page.tsx:25` cũng dùng `bg-amber-50 text-amber-700` (OK), trong khi `pallets/page.tsx:32` dùng `bg-amber-50 text-amber-700` cho `IN_STAGING` (chứ không phải PENDING). Còn `dashboard/page.tsx` đã có `<Badge variant="warning">` rồi — vẫn không dùng.
- 🔴 **Status `COMPLETED`** ở `dashboard/page.tsx:98` dùng `bg-emerald-50 text-emerald-700`, ở `inbound/page.tsx:28` cũng vậy. Nhưng `<Badge variant="success">` đã có sẵn trong codebase. Tại sao không dùng?

#### D. Hardcoded HEX — **không thể chấp nhận**
`auth/forgot-password/page.tsx` là page tệ nhất về mặt color discipline. Toàn page là HEX cứng:
- L171: `bg-[#faf9f6]`
- L220: `bg-[#022448]`
- L224: `text-[#000e24]`
- L225: `text-[#455f87]`
- L240: `border-[#e7e5e0]`
- L246: `bg-[#3b9d56]`
- L247: `bg-[#000e24]`
- L249: `bg-[#f4f3f1] text-[#74777f]`
- L256: `text-[#000e24]`
- L262: `bg-[#3b9d56]`
- L262: `bg-[#e3e2e0]`
- L275: `text-[#ba1a1a]`, `bg-[#ffdad6]/30`
- L281: `text-[#3b9d56]`, `bg-[#95f8a7]/20`
- L290, 297, 299, 302, 312, 316, 319, 321, 326, 328, 330... — tổng cộng **trên 70 HEX cứng** trong 1 page

🔴 **Đây là vi phạm nguyên tắc design tokens cấp độ cao nhất.** Nếu brand thay đổi primary từ #000e24 sang xanh navy đậm hơn, page này phải sửa bằng tay từng dòng. Trong khi cùng dự án các page khác chỉ cần đổi `--color-primary` trong globals.css là xong.

🔴 **`inventory/page.tsx:126` dùng `style={{ background: "linear-gradient(135deg, #fef2f2, #fff7ed)" }}`** — gradient inline pink → orange tuyệt đối **lạc khỏi tone** của app industrial đen-trắng-xám. Khi mở trang tồn kho, mắt designer lập tức bị giật vì 1 panel "Cận date" lòe loẹt kiểu pastel sticker chen vào giữa table grayscale.

---

### 2.6 Font / Typography hierarchy

#### H1 heading nhảy 3 size khác nhau:

| Class | Size | Page |
|---|---|---|
| `headline-lg` (32px/40px font-weight 600) | 32px | `dashboard/page.tsx:139` |
| `headline-md` (24px/32px font-weight 500) | 24px | `master-data/page.tsx:389`, `item-codes/page.tsx:314` |
| `text-2xl font-bold tracking-tight text-primary` | 24px font-bold | `inbound/page.tsx:199`, `outbound/page.tsx:42`, `outbound/requests/page.tsx:52`, `outbound/report/page.tsx:49`, `outbound/turnover/page.tsx`, `pallets/page.tsx:136`, `system/users/page.tsx:62`, `system/audit-log/page.tsx:28`, `stock-count/page.tsx:20`, `dashboard/page.tsx:133`, `dashboard/manager/page.tsx:49`, `inbound-adhoc/page.tsx:70`, `inventory/page.tsx:103`, `inventory/by-location/page.tsx:33`, `inventory/alerts/page.tsx:47` |
| `text-xl font-bold text-slate-800` | 20px slate-800 thay vì primary! | `ForkliftWebDashboard.tsx:192` |
| `text-base font-semibold` | 16px semibold | `Sidebar.tsx:101` (đây OK vì là subnav header) |
| `text-lg font-semibold` | 18px | `auth/forgot-password/page.tsx:290, 312, 348` |

🔴 **Cùng là H1 page title nhưng dùng 3 utility khác nhau:** `headline-lg` (32px), `headline-md` (24px), và `text-2xl font-bold tracking-tight text-primary` (24px font-bold — không match `headline-md` font-weight 500). Cụ thể:
- `headline-md` định nghĩa là 24px / 32px / font-weight **500**
- Hầu hết H1 viết tay `text-2xl font-bold` = 24px / font-weight **700**
- → Cùng kích thước nhưng **độ đậm khác nhau** → nhìn cạnh nhau dashboard và master-data sẽ thấy weight chênh nhau

🟠 **Page title icon prefix không nhất quán:**
- `outbound/requests/page.tsx:52`: `<h1>... <span material-symbols 28px>description</span> Phiếu yêu cầu xuất (PYX)</h1>`
- `outbound/report/page.tsx:49`: `<h1>... bar_chart 28px ...</h1>`
- `dashboard/manager/page.tsx:49`: `<h1>... analytics 28px 📊 Dashboard Quản lý ...</h1>` ← **vừa icon material 28px vừa emoji 📊!**
- `master-data/page.tsx:389`: KHÔNG có icon, chỉ có chữ
- `inbound/page.tsx:199`: KHÔNG có icon

🔴 **Emoji trong H1:**
- `dashboard/page.tsx:134`: `<h1>👋 Chào, {userName}</h1>` ← emoji 👋 trong tiêu đề
- `dashboard/manager/page.tsx:51`: `<h1>... <icon> 📊 Dashboard Quản lý</h1>` ← icon Material + emoji 📊 cùng lúc
- `inbound/page.tsx:223, 230`: `📥 Import Excel`, `📝 Lập phiếu mới` — emoji **nội trong text** của link button, trong khi icon Material `upload_file` và `add` đã có ở `<span class>` ngay trước → **2 lần icon cho 1 button**

#### Subheading & paragraph cũng nhảy:

- Description dưới H1: chỗ `text-sm text-on-surface-variant mt-0.5`, chỗ `text-xs text-on-surface-variant mt-1`, chỗ `text-sm text-slate-500`. Cả 3 đều cùng 1 vai trò "page description".
- Label form: chỗ `label-caps text-on-surface-variant` (đúng), chỗ `text-xs font-bold text-slate-500 uppercase tracking-wider` (sai — slate-500), chỗ `text-sm font-medium text-[#1a1c1a]` (HEX cứng + sai weight)
- Section header trong card: chỗ `label-caps text-primary mb-3`, chỗ `text-sm font-bold text-slate-700 mb-2`, chỗ `text-sm font-bold text-slate-700 uppercase tracking-wider` — 3 kiểu khác nhau

#### Data display:

- Mã pallet/PHN/PYX:
  - `dashboard/page.tsx:245`: `data-mono` (token, đúng — utility class)
  - `inventory/page.tsx:186`: `font-mono font-semibold text-primary`
  - `inbound/page.tsx:25 STATUS_MAP icon "edit_note"` — không vấn đề
  - `outbound/requests/page.tsx:115`: `font-mono font-bold text-primary`
  - `pallets/[id]/page.tsx:76`: `font-mono font-bold text-primary`
  - `system/audit-log/page.tsx:61`: `font-mono` (thiếu font-weight)

→ `data-mono` utility tồn tại nhưng đa số page không biết hoặc không dùng, viết tay `font-mono font-bold` thay thế. Trên màn hình kết quả như nhau, nhưng nếu cần thay đổi font-mono sau này thì nightmare.

---

### 2.7 Spacing

#### Page padding nhảy không có lý do:

| `p-X` | Pages dùng |
|---|---|
| `p-4` | `inventory/by-location/page.tsx:62` (modal), `pallets/[id]/page.tsx` modal, `master-data/page.tsx:807` (drop zone) |
| `p-5` | `dashboard/page.tsx` (Card p-5), `master-data/page.tsx:570-580` (KPI footer p-5) |
| `p-6` | **Đa số page** — `dashboard/page.tsx:135`, `master-data/page.tsx:385`, `item-codes/page.tsx:310`, `inbound/page.tsx:195`, `inbound/new/page.tsx`, `inbound-adhoc/page.tsx:67`, `outbound/page.tsx:39`, `outbound/requests/page.tsx:45`, `outbound/report/page.tsx:44`, `inventory/page.tsx:100`, `system/users/page.tsx:59`, `system/audit-log/page.tsx:27`, `system/config/page.tsx`, `system/mail/page.tsx`, `pallets/page.tsx:132`, `forklift/page.tsx`, `stock-count/page.tsx:18`, `forgot-password/page.tsx:236` ... |
| `p-8` | `auth/page.tsx:138` (px-xl pt-xl pb-lg = padding lớn nhất, ~32px), `auth/forgot-password/page.tsx:178` (mock OTP) |

🟢 **p-6 là consensus** cho page-level. Nhưng vẫn còn:
- 🟠 `inventory/by-location/page.tsx:32`: `<div className="p-6 space-y-5">` đúng → OK
- 🟠 `forgot-password/page.tsx:236`: `<main className="flex-1 overflow-y-auto p-6">` OK

#### Section spacing (`space-y-X`) nhảy:

| `space-y-X` | Pages |
|---|---|
| `space-y-4` | `auth/forgot-password/page.tsx:237`, `system/users/page.tsx modal:136`, `outbound/page.tsx` không dùng |
| `space-y-5` | **Đa số** — `master-data/page.tsx:385`, `item-codes/page.tsx:310`, `inbound/page.tsx:195`, `pallets/page.tsx:132`, `system/audit-log/page.tsx:27`, `outbound/page.tsx:39`, `outbound/requests/page.tsx:45`, `inventory/page.tsx:100`, `inventory/alerts/page.tsx:45`, `stock-count/page.tsx:18`, `dashboard/manager/page.tsx:45` |
| `space-y-6` | `dashboard/page.tsx:135`, `auth/forgot-password/page.tsx:237` |

🟢 `space-y-5` là consensus tốt. Dashboard lạc tone với `space-y-6`.

#### Grid gap:

- `gap-3` cho KPI cards: `dashboard/page.tsx:161`, `inbound/page.tsx:236`, `outbound/page.tsx:48`, `outbound/requests/page.tsx:63`, `inbound-adhoc/page.tsx:80`
- `gap-4` cho cards: `dashboard/page.tsx:177`, `master-data/page.tsx:569`, `dashboard/manager/page.tsx:118`
- `gap-6` cho 12-col layouts: `dashboard/page.tsx:216`, `auth/forgot-password/page.tsx:270`
- `gap-2` cho button rows: nhiều chỗ

🟡 Mức độ nhảy này còn chấp nhận được, nhưng không có rule rõ ràng.

---

### 2.8 Status badge — **5 implementation cho cùng 1 việc**

| File | Implementation |
|---|---|
| 1. `<Badge variant="success">` | `master-data/page.tsx:512`, `item-codes/page.tsx:420-422` (chuẩn nhất, dùng Badge component) |
| 2. `<span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.color}">` với `st.color = "bg-amber-50 text-amber-700"` | `dashboard/page.tsx:222`, `outbound/requests/page.tsx:121`, `pallets/page.tsx`, `stock-count/page.tsx:55`, `system/users/page.tsx:97`, `system/audit-log/page.tsx:60`, `inbound-adhoc/page.tsx` |
| 3. `<span className="px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[u.role]}">` | `system/users/page.tsx:93` |
| 4. `<span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold border ${st.color}">` (thêm border!) | `outbound/requests/page.tsx:121` |
| 5. `<span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded font-medium">` (rounded thay vì rounded-full) | `item-codes/page.tsx:415` |

🔴 **Đặc biệt:** Page `system/users/page.tsx:98` viết `{u.is_locked ? "🔒 Khóa" : "✅ Hoạt động"}` — emoji 🔒 và ✅ **trong text của badge**, trong khi Badge component đã hỗ trợ variant `success` và `error` ngon lành. Designer nhìn vào thấy: padding `px-2 py-0.5` lúc thì `rounded-full` lúc thì `rounded`, font-weight `semibold` lúc `bold` lúc `medium`, font-size `text-[10px]` lúc `text-xs` (12px) → không thể đoán được "đây có phải cùng 1 component badge không?"

🟠 **`<Badge>` component đã tồn tại** trong `src/components/ui/Badge.tsx` nhưng chỉ master-data và item-codes dùng. Còn 30+ page khác **hoàn toàn không biết** đến nó hoặc đã quên rồi đẻ ra inline.

---

### 2.9 Table — header bg và border khác nhau

#### Header bg:

| Style | Pages |
|---|---|
| `bg-surface-low` | `master-data/page.tsx:467`, `item-codes/page.tsx:378` |
| `bg-surface-low/50` | `outbound/page.tsx:100`, `outbound/requests/page.tsx:90`, `outbound/report/page.tsx:105`, `pallets/page.tsx`, `system/users/page.tsx:69`, `system/audit-log/page.tsx:46`, `stock-count/page.tsx:38`, `inventory/alerts/page.tsx` (vài chỗ) |
| `bg-slate-50` (raw slate) | `inventory/page.tsx:159` (panel cận date), `inventory/alerts/page.tsx:93` |

🟠 `bg-surface-low` (#f4f3f1) là token, `bg-surface-low/50` (50% alpha) cũng OK, nhưng `bg-slate-50` (#f8fafc) là HOÀN TOÀN khác màu. Trên 1 page tồn kho có 2 table thì 2 header màu khác nhau.

#### Header text:

- `font-semibold text-xs uppercase tracking-wider text-on-surface-variant` (đa số)
- `label-caps text-on-surface-variant` (chuẩn — master-data, item-codes)
- `font-semibold text-on-surface-variant` (panel cận date — thiếu uppercase)

#### Row border:

- `border-b border-outline-variant/40` (đa số) — 40% alpha
- `border-t border-surface-low` (master-data, item-codes)
- `border-b border-slate-100` (panel cận date)
- `border-b border-slate-200` (vài chỗ)

🔴 **Cùng 1 hàng table, border nhảy giữa `outline-variant/40` và `slate-100` và `surface-low`**. Tệp lego có 3 set màu border.

#### Row hover:

- `hover:bg-surface-low/50` (đa số)
- `hover:bg-rose-50/50` (alerts urgent)
- `hover:bg-amber-50/50` (alerts warning)
- `hover:bg-slate-50/50` (alerts low stock)

🟢 Variant theo tone (rose/amber/slate cho row có ngữ nghĩa) chấp nhận được, nhưng vẫn nên thông qua 1 prop component.

---

### 2.10 Loading spinner — đếm được **5 size khác nhau**

| Class | Kích thước | Pages |
|---|---|---|
| `w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin` | 16px (trong button) | `forgot-password/page.tsx:303`, `master-data/page.tsx:707`, `item-codes/page.tsx`, `system/rbac/page.tsx:134` |
| `w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin` | 20px | `master-data/page.tsx:484` (table loading), `item-codes/page.tsx:394` |
| `w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin` | 24px (login) | `auth/page.tsx:269` |
| `w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin` | 32px border-4 | `AppLayout.tsx:74`, `page.tsx:77` (root spinner) |
| `<span className="material-symbols-outlined animate-spin text-[18px] text-primary">progress_activity</span>` | 18px Material icon | `inventory/page.tsx:173` |
| `<span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>` | 24px | `outbound/page.tsx:111`, `outbound/requests/page.tsx:103`, `pallets/page.tsx`, `system/users/page.tsx:82`, `inventory/by-location/page.tsx:43`, `inventory/alerts/page.tsx:56`, `stock-count/page.tsx:47`, `system/audit-log/page.tsx:54`, `inventory/page.tsx` |
| `<span className="material-symbols-outlined animate-spin text-[32px] text-primary">progress_activity</span>` | 32px | `dashboard/page.tsx:127`, `dashboard/manager/page.tsx:79` |
| `<span className="material-symbols-outlined animate-spin text-[40px] text-primary">progress_activity</span>` | 40px | `dashboard/page.tsx:127` (cũ) |
| `<span className="material-symbols-outlined animate-spin text-[24px] text-primary">progress_activity</span>` (system page) | 24px | `system/page.tsx:13` |

🔴 **2 paradigm song song:** Border-circle CSS spinner VÀ Material Symbol `progress_activity` rotating. **Không có lý do nào** để cùng 1 dự án dùng cả 2. Material icon trông như Google Material 3 còn border-CSS trông như Bootstrap 5. Hai phong cách trộn lẫn.

---

### 2.11 Empty state — không component, **đếm 4 kiểu**

| Style | Pages |
|---|---|
| `<td colSpan...><span class="material-symbols-outlined text-[32px] mb-2 block opacity-40">inventory_2</span>Không có dữ liệu</td>` | `master-data/page.tsx:489`, `item-codes/page.tsx:399` |
| `<td><span class="material-symbols-outlined text-[40px] opacity-30">check_circle</span><p class="mt-2 text-sm">Khu chờ xuất trống.</p></td>` | `outbound/page.tsx:113` |
| `<td><span class="material-symbols-outlined text-[40px] opacity-30">description</span><p class="mt-2 text-sm">Chưa có phiếu PYX nào.</p><Link...>Tạo phiếu đầu tiên</Link></td>` | `outbound/requests/page.tsx:106` |
| `<p class="text-xs text-slate-400 py-4 text-center">Chưa có phiếu nào</p>` (1 dòng text thôi, không icon) | `dashboard/page.tsx:210`, `dashboard/manager/page.tsx:125` |
| `<div className="text-center py-12 text-on-surface-variant"><span class="material-symbols-outlined text-[40px] text-emerald-400">check_circle</span><p class="mt-2 text-sm font-semibold text-emerald-600">Không có cảnh báo nào! 🎉</p></div>` | `inventory/alerts/page.tsx:109` |

🟠 **Cùng 1 thông điệp "không có data"** mà icon size 32 vs 40, opacity 30% vs 40%, dùng (hoặc không) CTA, padding `py-4` vs `py-8` vs `py-12`. Một số empty state lại còn dùng emoji 🎉.

---

### 2.12 Icon vs Emoji — **cuộc khủng hoảng**

Mặc dù globals.css đã chuẩn hóa `.material-symbols-outlined`, và đa số page dùng Material Symbols, **emoji vẫn xuất hiện ngẫu nhiên ở 12+ chỗ**:

| Emoji | Vị trí | Loại lỗi |
|---|---|---|
| `👋` | `dashboard/page.tsx:134` H1 | Emoji trong title |
| `📊` | `dashboard/manager/page.tsx:51`, `:122` | Đè lên Material icon `analytics` |
| `📋` | `dashboard/manager/page.tsx:208`, `dashboard/page.tsx:207` | Section header |
| `📅` | `dashboard/manager/page.tsx:173` | Card header |
| `🏆` | `dashboard/manager/page.tsx:148` | Card header |
| `🔴 🟡 🟢` | `dashboard/manager/page.tsx:179, 186, 193`, `dashboard/page.tsx:186-194`, `inventory/page.tsx:93-95`, `inventory/alerts/page.tsx:50, 51, 59, 76` | Color dot — đáng lẽ phải dùng `<span class="w-2 h-2 bg-rose-500 rounded-full">` |
| `🚨` | `dashboard/page.tsx:181` | Card header |
| `📥 📝` | `inbound/page.tsx:223, 230` | Trong button text mặc dù đã có icon Material `upload_file` và `add` ở ngay trước! |
| `⏳ ✅` | `item-codes/page.tsx:355-356` | Option label trong `<select>` |
| `🔒 ✅` | `system/users/page.tsx:98` | Status badge text |
| `🎉` | `inventory/alerts/page.tsx:109` | Empty state |
| `✓` | `master-data/page.tsx:775, 782` (stepper), `system/rbac/page.tsx:105` (CSV export) | Đánh dấu |
| `→` | `dashboard/page.tsx:226`, `dashboard/manager/page.tsx:201`, `dashboard/manager/page.tsx:231`, `dashboard/page.tsx:198`, `dashboard/page.tsx:230`, `inventory/alerts/page.tsx:122` | "Xem tất cả →" — chữ Unicode arrow trong khi `arrow_forward` Material có sẵn |
| `🟠 🟢` | `inventory/alerts/page.tsx:53` | Alert summary |

🔴 **Mix icon Material + emoji là tội ác nghiêm trọng.** Lý do:
1. Emoji render khác nhau trên Windows / Mac / Linux / mobile → baseline lệch, vỡ alignment
2. Color của 🔴 trên macOS (Apple Color Emoji) khác trên Windows (Segoe UI Emoji) → đôi khi pink hơn, không match màu rose-500 trên CSS
3. Emoji size không scale theo `text-sm` linh hoạt như icon font
4. Đọc bằng screen reader rất kỳ cục: "thinking face" / "package emoji"
5. Designer mới nhìn vào thấy bừa bộn nhất là khi cả Material `warning` và emoji `🚨` cùng xuất hiện trên 1 page

---

### 2.13 Error/Confirmation pattern — **3 paradigm cùng tồn tại**

| Pattern | Pages |
|---|---|
| `alert("Lỗi...")` thô của browser | `inbound/page.tsx:154`, `pallets/page.tsx:101`, `master-data/page.tsx:282`, `system/users/page.tsx:26`, `inventory/by-location/page.tsx:81`, `outbound/requests/page.tsx`, `forklift/...`, `stock-count/...`, `outbound/...` — đếm khoảng **50+ chỗ** dùng `alert()` |
| `confirm("...")` thô của browser | `inbound/page.tsx:152, 167`, `pallets/page.tsx:114`, `locations/page.tsx:249`, `master-data/page.tsx`, `inventory/by-location/page.tsx`, `outbound/requests/...` — đếm khoảng **30+ chỗ** dùng `confirm()` |
| `setToast({message, type})` state local + auto-hide 3-5s | `inbound/[id]/page.tsx:83`, `system/users/page.tsx:23`, `product-groups/page.tsx:46`, `units/page.tsx:46`, `system/config/page.tsx:49`, `system/mail/page.tsx:54` |
| Inline error message `<div className="text-error text-sm font-medium bg-error/5 p-3 rounded-lg flex items-center gap-2">` | `master-data/page.tsx:600`, `item-codes/page.tsx:489`, `system/rbac/page.tsx:148` |
| Inline error custom (HEX!) `<div className="text-[#ba1a1a] text-sm font-medium bg-[#ffdad6]/30 p-3 rounded-lg flex items-center gap-2">` | `auth/forgot-password/page.tsx:275` |

🔴 **`alert()` và `confirm()` của browser** là dấu hiệu UI đầu hàng. UX 2010. Phải tuyệt đối bỏ.

---

### 2.14 Form layout & label

| Pattern | Pages |
|---|---|
| `<label className="label-caps text-on-surface-variant block mb-1">...</label>` (đúng tone) | `master-data/page.tsx`, `item-codes/page.tsx` |
| `<label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">...</label>` | `outbound/report/page.tsx:75, 83, 88`, `system/audit-log/page.tsx:30, 31` |
| `<label className="text-xs font-bold text-slate-500 block mb-1.5">...</label>` (không uppercase!) | `system/users/page.tsx:138, 150, 161, 174, 188` |
| `<label className="block text-sm font-medium text-[#1a1c1a] mb-1.5">...</label>` (HEX cứng, text-sm thay vì label-caps) | `auth/forgot-password/page.tsx:294, 316, 352, 372` |
| `<label className="text-body-sm text-on-surface-variant">...</label>` (custom utility — chỉ trong auth) | `auth/page.tsx:229` |

🔴 **4 typography riêng cho cùng 1 thứ "form label"**. Trong khi globals.css đã có sẵn `.label-caps` (font-mono 11px uppercase tracking-wider weight 600) — không page nào ngoại trừ master-data/item-codes biết dùng.

Margin-bottom của label cũng nhảy: `mb-1`, `mb-1.5`, `mb-2`, `mb-3`.

---

### 2.15 Backdrop opacity & blur

| Pattern | Pages |
|---|---|
| `bg-black/40 backdrop-blur-sm` | `master-data/page.tsx:591, 730, 757`, `item-codes/page.tsx:477, 551`, `auth/forgot-password/page.tsx:176` |
| `bg-black/30` (không blur) | `inventory/by-location/page.tsx:62`, `pallets/[id]/page.tsx` |
| `bg-slate-900/40 backdrop-blur-sm` (slate đậm) | `system/users/page.tsx:124` |
| Backdrop blur `backdrop-blur-md` | `auth/forgot-password/page.tsx` (vài chỗ) |

🟠 3 độ tối khác nhau cho cùng modal overlay.

---

## 3. LỖI THEO MODULE (đi sâu từng page)

### 3.1 Module Auth (`src/app/auth/`)

#### `src/app/auth/page.tsx` — Login (290 dòng)
- 🔴 [Color] L120-L289: **Toàn bộ page dùng class custom `pl-md`, `pt-xl`, `space-y-md`, `space-y-xs`** — đây là spacing tokens custom được khai báo trong globals.css. Nhưng **không page nào khác** trong codebase dùng pattern `pl-md`. Cô đơn → bị bỏ rơi → sẽ bị developer mới refactor sang `pl-4` random.
- 🟠 [Typography] L142, L173: `<label className="label-caps text-on-surface-variant flex justify-between">` — chuẩn ✓
- 🟠 [Button] L243: `<button className="w-full h-[52px] bg-primary-container text-white text-headline-sm rounded-xl flex items-center justify-center gap-sm hover:bg-primary transition-all active:scale-[0.98] shadow-sm">` — height pixel cứng `h-[52px]`, `text-headline-sm` không tồn tại trong globals.css (đã định nghĩa `headline-lg`, `headline-md` thôi → utility không tồn tại → fallback default)
- 🟡 [Color] L132: `color: "rgb(0, 30, 113)"` inline style — vì sao không dùng `text-primary` token?
- 🟡 [Color] L163: `text-primary-container` — primary-container tồn tại trong globals (#022448) nhưng tên rất confusing với "primary"
- 🟡 [Accessibility] L155-L168, L186-L209: Icon button toggle password không có `aria-label`. Trợ năng fail.

#### `src/app/auth/forgot-password/page.tsx` — Forgot password (487 dòng)
- 🔴 [Color] **Toàn file dùng HEX cứng** — đã liệt kê ở mục 2.5.D. Đây là page tệ nhất cả app về color discipline.
- 🔴 [Typography] L186: `style={{ fontFamily: "'IBM Plex Mono', monospace" }}` inline — repeat **8 lần** trong file thay vì class `font-mono` (đã có sẵn).
- 🔴 [Layout] L218 header bar có border hardcoded `border-[#e3e2e0]` thay vì `border-surface-variant`.
- 🟠 [Modal] L173-L211 OTP popup: rounded-2xl, primary đen `bg-[#022448]`, border `#455f87/30` — **không khớp** với bất kỳ modal nào khác trong app.
- 🟠 [Inline `<style>`] L213-L216: định nghĩa `@keyframes fadeIn` và `scaleIn` inline — duplicate với master-data và inbound/import.
- 🟠 [Component] L240-L268 stepper visual hand-rolled — không tận dụng được với inbound/import stepper.

### 3.2 Module Dashboard (`src/app/dashboard/`)

#### `src/app/dashboard/page.tsx` (399 dòng — kế toán dashboard)
- 🔴 [Mixed paradigm] L134-L153: Dùng `text-2xl font-bold tracking-tight text-primary` cho H1, NHƯNG L139 lại có file root (`page.tsx`) dùng `headline-lg`. Cùng dashboard — 2 hệ heading khác nhau.
- 🔴 [Color] L99 STATUS_LABEL: dùng `bg-amber-50 text-amber-700`, `bg-blue-50 text-blue-700`, `bg-purple-50 text-purple-700`, `bg-emerald-50 text-emerald-700`, `bg-rose-50 text-rose-600` — **trong khi có sẵn `<Badge variant>` với chip-success/warning/error/info/neutral**. Không dùng.
- 🔴 [Emoji] L134: `<h1>👋 Chào, {userName}...` — emoji 👋 trong title.
- 🔴 [Emoji] L181: `🚨 Cảnh báo HSD / Tồn thấp` — emoji 🚨.
- 🔴 [Emoji] L186, L190, L194: `🔴 ≤ 7 ngày`, `🟡 ≤ 30 ngày`, `🔻 Dưới min` — emoji color dot.
- 🔴 [Emoji] L207: `📋 Phiếu nhập vừa cập nhật`.
- 🔴 [Color rainbow] L115-L121 `quickLinks`: `bg-primary/5 border-primary/20`, `bg-rose-50 border-rose-200`, `bg-emerald-50 border-emerald-200`, `bg-blue-50 border-blue-200`, `bg-amber-50 border-amber-200`, `bg-indigo-50 border-indigo-200` — **6 màu pastel chế ngẫu nhiên** cho 6 quick link. Không có gì chống lưng cho việc tại sao "Tồn kho" là primary, "Cảnh báo" là rose, "Phiếu nhập" là emerald.
- 🟠 [Color] L105-L111 `genericCards` colors `text-primary bg-primary/10`, `text-blue-600 bg-blue-50`, `text-emerald-600 bg-emerald-50`, `text-amber-600 bg-amber-50`, `text-indigo-600 bg-indigo-50`, `text-rose-600 bg-rose-50`, `text-amber-600 bg-amber-50`, `text-slate-600 bg-slate-100` — 8 màu pastel.
- 🟠 [Inconsistency] L164: `rounded-xl` với border-l-4 nhưng cũng `<Card className="p-4 rounded-lg">` ở dòng 162 — cùng dashboard 2 border-radius.

#### `src/app/page.tsx` (399 dòng — landing/operations dashboard)
- 🟢 Đây là page có disciplin TỐT NHẤT về use design token. `headline-lg`, `label-caps`, `data-mono`, `<Card>`, `<Badge>`. Có lẽ là page được làm sau nhất bởi designer thực sự.
- 🟠 [Spacing] L161 KPI grid `gap-4`, trong khi đa số `gap-3`.
- 🟡 [Visual] L371-L390 hard-coded grid layout với `bin-cell bin-occupied`, `bin-fefo` — class chưa định nghĩa trong globals.css (đoán là legacy CSS không còn).

#### `src/app/dashboard/manager/page.tsx` (262 dòng)
- 🔴 [Mix icon + emoji] L49-L52: `<h1>... <span material-symbols 28px>analytics</span> 📊 Dashboard Quản lý ...</h1>` — **icon material analytics + emoji 📊 cùng dòng**.
- 🔴 [Color] L106: `style={{ borderLeftWidth: 4, borderLeftColor: "rgb(244 63 94)" }}` inline RGB — vì sao không `border-l-4 border-l-rose-500`?
- 🔴 [Color rainbow] Card 1-4 dùng hardcoded `text-rose-600`, `text-amber-600`, `text-emerald-600`, `text-slate-500` cho expiry table. Không có dùng design token cho urgency.

### 3.3 Module Master Data (`src/app/master-data/`, `item-codes/`, `product-groups/`, `units/`, `locations/`, `suppliers/`)

#### `src/app/master-data/page.tsx` (945 dòng)
- 🟢 [Tổng thể] Discipline tốt: dùng `<Card>`, `<Badge>`, `label-caps`, `data-mono`, design tokens.
- 🟠 [Modal] L589-L725: Modal sản phẩm — dài 136 dòng JSX, hoàn toàn có thể trừu tượng thành `<Modal>` + `<FormField>` reusable.
- 🟠 [Inline `<style>`] L590 dùng `style={{ animation: "fadeIn 0.2s ease-out" }}` — keyframe `fadeIn` chưa thấy define ở đâu trong file này hay globals.css. Chỉ có ở `forgot-password/page.tsx:213-216`. **Có thể animation không chạy.**
- 🔴 [Pagination] L537-L565: Pagination hand-rolled — copy-paste y hệt sang item-codes (L450-L470). 30 dòng × 2 lần. Phải có `<Pagination>` component.
- 🟡 [Inline KPI cards] L569-L585: 3 KPI card dùng `<Card>` p-5 — kích thước padding khác với 4 KPI Card ở dashboard `p-4`.
- 🟡 [Status badge] L517-L518: `<span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">LÔ</span>` — mini badge inline custom thay vì `<Badge variant="info" size="xs">`.
- 🟡 [Toggle] L691-L697: Checkbox `manage_lot`, `manage_expiry` viết tay, custom focus styling. Trong dự án còn có toggle switch ở `inventory/alerts/page.tsx:152` viết kiểu khác hoàn toàn.

#### `src/app/item-codes/page.tsx` (722 dòng)
- 🟢 [Discipline] Tương đương master-data.
- 🔴 [Emoji] L355-L356: `<option value="pending">⏳ Chờ xử lý</option>`, `<option value="standardized">✅ Đã chuẩn hóa</option>` — emoji trong select option. Trên Windows hiển thị khác Mac. Vỡ select height vì emoji size.
- 🟠 [Pagination duplicate] L450-L470 — copy y hệt master-data.

#### `src/app/locations/page.tsx` (1024 dòng — UC-MD-05)
- 🔴 [Color rainbow extreme] L32-L75: `STATUS_DETAILS` map **6 status × 5 thuộc tính** cho cell màu:
  - EMPTY: bg-slate-50 / border-slate-300-dashed / text-slate-500
  - USING: bg-blue-50 / border-blue-300 / text-blue-700
  - FULL: bg-rose-50 / border-rose-300 / text-rose-700
  - MAINTENANCE: bg-amber-50 stripes-warning / border-amber-400 / text-amber-800
  - RESERVED: bg-orange-50 / border-orange-300 / text-orange-700
  - WAITING_OUTBOUND: bg-purple-50 / border-purple-300 / text-purple-700
  
  → **6 màu pastel khác nhau** cho 6 status cell. Trên một sơ đồ kho lưới 50 ô, mắt thấy 6 màu nhảy múa. Cộng thêm border solid/dashed nhảy lung tung → không thể tập trung được.
- 🔴 [Custom class] L57: `stripes-warning` — utility chưa định nghĩa trong globals.css mà tôi tìm thấy. Đoán là legacy → cell maintenance không có striped pattern dù tên hô vậy.
- 🟠 [Modal inline] Single + Bulk + Edit panel — 3 modal inline trong file dài 1024 dòng. Nightmare để maintain.

#### `src/app/suppliers/page.tsx`, `product-groups/page.tsx`, `units/page.tsx`
- 🟢 Phong cách tương tự master-data — chấp nhận được.
- 🟡 `units/page.tsx` và `product-groups/page.tsx` có comment `// ── Toast helper ──` với box-drawing character `─` — phong cách comment lạ, không thấy ở các page khác.

### 3.4 Module Inbound (`src/app/inbound/`, `inbound-adhoc/`)

#### `src/app/inbound/page.tsx` (300+ dòng đã xem)
- 🔴 [Emoji] L223, L230: `📥 Import Excel`, `📝 Lập phiếu mới` — emoji trong Link button đã có Material icon.
- 🔴 [Color] L236-L257: 7 KPI card dùng 7 màu border khác nhau (slate-200, amber-200, blue-200, purple-200, emerald-200, rose-200) + text color theo. Trong khi dashboard dùng <Badge> được rồi.
- 🔴 [Status Stepper] L42-L77 `InboundStepper`: dùng `bg-emerald-500` (xanh), `bg-amber-500 animate-pulse` (đang chạy), `bg-slate-200` (chưa), `bg-rose-200` (cancelled). 4 màu — nhưng STATUS_MAP ở L23 dùng emerald-700, amber-700, blue-700, purple-700, rose-600. Logic giữa stepper và status badge bị tách rời.
- 🟠 [Status chip] L262-L300: chip filter render thủ công với inline JSX `bg-primary text-white shadow-sm` vs `bg-white text-on-surface-variant border border-outline-variant`. Không sử dụng `<Badge>` component.

#### `src/app/inbound/[id]/page.tsx` (UC-IN-04 chốt phiếu — chỉ xem 200 dòng đầu)
- 🟠 [Color] L40-L47: STATUS_MAP nội bộ riêng — DUPLICATE với `inbound/page.tsx:23-30`. Hai map cùng define cùng việc.
- 🟠 [Toast] L81 useState toast — pattern khác `inbound/page.tsx` (dùng `alert`).

#### `src/app/inbound/new/page.tsx` (UC-IN-01 — chỉ xem 250 dòng đầu)
- 🟠 [Tab pattern] L39: state `activeTab` 3 string union — không có `<Tabs>` component, tự render.

#### `src/app/inbound/import/page.tsx` (UC-IN-06 — chỉ xem 200 dòng)
- 🟠 [Stepper] Step 1-2-3 hand-rolled lần thứ N — copy ý từ master-data và forgot-password.

#### `src/app/inbound-adhoc/page.tsx`
- 🟢 Phong cách giống inbound/page.tsx. Có pattern lặp lại tốt nhưng cũng nghĩa là **copy-paste**.

### 3.5 Module Outbound (`src/app/outbound/`)

#### `src/app/outbound/page.tsx` (146 dòng)
- 🟠 [Nav cards 4-col] L48-L66: 4 nav card với 4 màu pastel: amber, blue, emerald, indigo. Mỗi card 1 màu icon. Pattern này lặp lại ở dashboard quick links.
- 🟠 [Card pattern] L70-L86 4 summary cards — dùng `bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm`. Border color `slate-200` thay vì `outline-variant`.
- 🟡 [Text color] L72: `text-slate-900` thay vì `text-on-surface`.

#### `src/app/outbound/requests/page.tsx` (138 dòng)
- 🟠 [Status border on badge] L121: `<span className="inline-flex px-2 py-1 rounded-full text-[10px] font-bold border ${st.color}">` — thêm `border` trên badge khiến nó dày hơn các badge khác trong app.
- 🟠 [Text style] L125: `<Link... className="text-xs text-secondary hover:underline">Xem →</Link>` — chữ "→" ASCII arrow.

#### `src/app/outbound/report/page.tsx` (159 dòng)
- 🔴 [Button] L66: Excel export button dùng `bg-emerald-600 hover:bg-emerald-700` — màu xanh lá tươi, **không match** brand (primary navy). Cùng việc xuất Excel mà:
  - `master-data/page.tsx` dùng `<ExcelExport>` component (đẹp)
  - `outbound/report/page.tsx` dùng button xanh lá hand-rolled
  - `system/rbac/page.tsx:110` cũng dùng `bg-emerald-50 border-emerald-200 text-emerald-700` (variant outline xanh lá)
  → 3 cách render "xuất Excel" khác nhau trong cùng dự án.

### 3.6 Module Inventory (`src/app/inventory/`)

#### `src/app/inventory/page.tsx` (200+ dòng đã xem)
- 🔴 [Gradient lạc tone] L126: `style={{ background: "linear-gradient(135deg, #fef2f2, #fff7ed)" }}` — gradient pink-orange-yellow trong app industrial grayscale + navy. Khi cuộn xuống panel "Cận date", mắt người dùng lập tức "Wat?".
- 🔴 [Emoji color dot] L93-L95 `urgencyText`:
  ```js
  if (days <= 7) return `${days} ngày 🔴`;
  if (days <= 30) return `${days} ngày 🟡`;
  return `${days} ngày`;
  ```
  → Emoji 🔴🟡 trong cell text. Trên Windows render nhỏ hơn macOS → vỡ baseline.
- 🟠 [Border color] L126: `border-rose-300` thay vì `border-error-container` hoặc `border-error`. Token `error` đã có nhưng không dùng.
- 🟠 [Animation] L173: `<span class="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>` — spinner Material 18px, cùng page xa hơn lại có 32px.

#### `src/app/inventory/by-location/page.tsx` (88 dòng)
- 🟠 [Color] L27 `getColor`: cell `MAINTENANCE` → `bg-slate-300` (xám đậm), `has_pallet` → `bg-primary/70 text-white`, trống → `bg-emerald-100 text-emerald-700`. Trong khi `locations/page.tsx` cùng dữ liệu render với 6 màu pastel khác. **Hai page render cùng concept "vị trí kho" với 2 schema màu khác.**
- 🟠 [Modal] L62 modal `bg-black/30` (đậm 30% thay vì 40% chuẩn).

#### `src/app/inventory/alerts/page.tsx`
- 🔴 [Color rainbow] L49-L54: 4 KPI cards với 4 màu pastel `bg-rose-50 border-rose-200`, `bg-amber-50 border-amber-200`, `bg-slate-50 border-slate-200`, `bg-orange-50 border-orange-200`. Mỗi card label có emoji 🔴🟡⚠️🟠.
- 🔴 [Card section] L58, L75, L92: 3 card section với 3 màu khác cho 3 loại cảnh báo (rose / amber / slate). Border-color theo. Bố cục giống nhau nhưng visual khác hẳn.
- 🟠 [Toggle switch] L152-L154: peer-checked custom toggle viết bằng tay với CSS magic. Phong cách rất khác toggle ở khác.

### 3.7 Module Forklift Desktop (`src/app/forklift/`)

#### `src/components/forklift/ForkliftWebDashboard.tsx` (200 dòng đã xem)
- 🔴 [Color] L192: `<h1 className="text-xl font-bold text-slate-800">` — H1 dùng `text-slate-800` thay vì `text-primary` (#000e24). **Sai brand color cho heading**.
- 🟠 [Button] L200: refresh button `bg-surface-low active:scale-95` — interaction `active:scale-95` chỉ xuất hiện ở vài chỗ (đa số dùng `hover:bg-...` thường).

### 3.8 Module System (`src/app/system/`)

#### `src/app/system/users/page.tsx` (150 dòng đã xem)
- 🔴 [Modal] L124: backdrop `bg-slate-900/40` thay vì `bg-black/40` chuẩn. Modal `rounded-2xl shadow-2xl` thay vì `rounded-xl shadow-2xl` chuẩn của master-data.
- 🔴 [Border] L145: input dùng `border-slate-300` thay vì `border-outline-variant`.
- 🔴 [Label] L138, L150, ...: `text-xs font-bold text-slate-500 block mb-1.5` — không uppercase, không tracking. Khác hoàn toàn `label-caps`.
- 🔴 [Text color] L127: `text-slate-900` thay vì `text-on-surface`.
- 🔴 [Emoji] L98: `🔒 Khóa` `✅ Hoạt động` — emoji trong status badge.
- 🟠 [Toast] L60 inline toast → ít nhất tách `<Toast>` component reusable.
- 🟠 [Role color rainbow] L8 `ROLE_COLORS`: 8 role × 8 màu pastel. Một dashboard nếu hiển thị 8 user role là 8 màu sticker. Không có brand color cho role hierarchy.

#### `src/app/system/page.tsx` (17 dòng)
- 🟢 Đơn giản — chỉ redirect. OK.

#### `src/app/system/config/page.tsx`
- 🟢 Discipline tương đối tốt. Toast pattern, save/cancel inline edit OK.

#### `src/app/system/rbac/page.tsx`
- 🔴 [Button colors] L110-L126: 3 button "Tạo vai trò" (primary outline) / "Xuất Excel" (emerald-50 + emerald-200) / "Khôi phục" (amber-50 + amber-200). 3 màu khác nhau theo ngữ nghĩa nhưng **không matching** với màu của các button cùng nghĩa ở các page khác.
- 🟠 [CSV export] L106: emoji `"✓"` trong CSV cell. Excel có thể render unicode nhưng nhìn xấu.

#### `src/app/system/audit-log/page.tsx`
- 🟠 [Status badge] L7: ACTION_COLORS bg-emerald-50/700, bg-blue-50/700, bg-rose-50/700, bg-amber-50/700, bg-slate-100/600 — 5 màu raw, không xài Badge.
- 🟡 [JSON preview] L68-L69: `<pre className="bg-white p-2 rounded border text-[10px] overflow-auto max-h-32">{JSON.stringify(...)}</pre>` — preview JSON inline, không syntax highlight, font ko biết là gì.

### 3.9 Module Stock Count (`src/app/stock-count/`)

#### `src/app/stock-count/page.tsx`
- 🟠 [Status colors] L8: STATUS_MAP 4 status với 4 màu pastel. Cùng pattern lặp ở khắp nơi.
- 🟢 Đơn giản, không có lỗi nặng.

### 3.10 Module Pallets (`src/app/pallets/`)

#### `src/app/pallets/page.tsx`
- 🟠 [Status map] L25-L33: 7 status × 1 màu pastel + 1 icon material. Repeat pattern.

#### `src/app/pallets/[id]/page.tsx`
- 🟠 [Pattern] STATUS_MAP local + ACTION_MAP local duplicate. Nên tạo `src/lib/status-meta.ts` central.

---

## 4. TOP 10 LỖI THIẾT KẾ NGHIÊM TRỌNG NHẤT

| # | Lỗi | Severity | Impact |
|---|---|---|---|
| 1 | **Không có Button/Input/Modal/Toast/Form base component** → 18 biến thể button, 9 biến thể input, 9 implementation modal | 🔴 | Toàn app |
| 2 | **Hardcoded HEX khắp page `auth/forgot-password/page.tsx` (70+ vị trí)** thay vì design tokens | 🔴 | 1 page nhưng là portal vào hệ thống |
| 3 | **Mix Material Icon + Emoji ở 12+ vị trí** (`👋`, `📊`, `🚨`, `📥`, `📝`, `🔒`, `✅`, `🔴`, `🟡`, `🎉`...) | 🔴 | Hỏng baseline + cross-platform render khác nhau |
| 4 | **Gradient pink-orange `linear-gradient(135deg, #fef2f2, #fff7ed)`** ở `inventory/page.tsx:126` lạc khỏi tone industrial | 🔴 | Trang tồn kho — page hiển thị mỗi ngày |
| 5 | **`alert()` và `confirm()` browser-native** ở 80+ vị trí (file inbound, pallets, master-data, system/users, locations, outbound...) | 🔴 | Mọi action critical bị UX 2010 |
| 6 | **Page padding không thống nhất** — `p-4`/`p-5`/`p-6`/`p-8` random | 🟠 | Visual rhythm |
| 7 | **3 bảng màu cùng tồn tại** (design-token, slate-XX, semantic-tone) — slate-300/500/700/800/900 xuất hiện khắp nơi mặc dù có sẵn `on-surface-variant` | 🔴 | Brand không nhất quán |
| 8 | **9 implementation modal** với rounded-xl vs rounded-2xl, shadow-xl vs shadow-2xl, bg-black/30 vs /40 vs slate-900/40 | 🔴 | Mỗi lần mở modal là 1 cảm xúc khác nhau |
| 9 | **H1 page title 3 style**: `headline-lg` (32px w600), `headline-md` (24px w500), `text-2xl font-bold tracking-tight text-primary` (24px w700) | 🟠 | Page transitions cảm thấy thay đổi cấu trúc |
| 10 | **Không có focus trap / ESC / scroll lock trong modal** — fail a11y AA | 🔴 | Trợ năng |

### Bonus 11-15 (highly annoying):

| # | Lỗi | Severity |
|---|---|---|
| 11 | Pagination 30 dòng JSX copy-paste y hệt giữa master-data và item-codes | 🟠 |
| 12 | Spinner 5 size khác nhau (16/18/20/24/28/32/40/48px) | 🟡 |
| 13 | `<Badge>` component có sẵn nhưng 30+ page tự inline `<span class="bg-amber-50 text-amber-700...">` | 🟠 |
| 14 | Status MAP duplicate giữa list page và detail page (inbound/page.tsx vs inbound/[id]/page.tsx — 2 STATUS_MAP riêng) | 🟠 |
| 15 | Animation `fadeIn` / `scaleIn` keyframe inline `<style>` duplicate 3-4 chỗ thay vì gom vào globals.css | 🟡 |

---

## 5. ĐỀ XUẤT FIX (theo thứ tự ưu tiên)

### Phase 1 — Foundation (cấp bách, 1-2 sprint)

- [ ] **Tạo `src/components/ui/Button.tsx`** với:
  - `variant`: `primary | secondary | ghost | danger | outline-primary | outline-danger`
  - `size`: `sm (32px) | md (40px) | lg (48px)`
  - `icon` prop (material symbol name)
  - `loading` prop (replace text với spinner, disable)
  - `fullWidth` prop
  - Hover/active states chuẩn hóa
  
- [ ] **Tạo `src/components/ui/Input.tsx`** + `Select.tsx` + `Textarea.tsx`:
  - Variant `default` (bg-surface với border-outline-variant) + `filled` (bg-surface-low border-0)
  - Built-in icon prop (left/right slot)
  - Built-in error state
  - Built-in `<FormField>` wrapper với `<label>` + helper text + error message

- [ ] **Tạo `src/components/ui/Modal.tsx`** với:
  - Portal vào `document.body`
  - Focus trap (autofocus first input, return focus khi đóng)
  - ESC để đóng
  - Click backdrop để đóng (configurable)
  - Lock body scroll
  - Size: `sm (420)` / `md (560)` / `lg (680)` / `xl (800)`
  - `<Modal.Header>` / `<Modal.Body>` / `<Modal.Footer>` slots
  - Animation fadeIn + scaleIn (gom vào globals.css)

- [ ] **Tạo `src/components/ui/Toast.tsx`** với Provider + `useToast()`:
  - Replace **toàn bộ** `alert()` calls
  - Replace **toàn bộ** `setToast()` state local pattern
  - Variant `success | error | warning | info`
  - Auto-dismiss configurable

- [ ] **Tạo `src/components/ui/ConfirmDialog.tsx`** + `useConfirm()` hook:
  - Replace **toàn bộ** `confirm()` calls
  - Variant `default | danger` (danger = nút "Xóa" đỏ)

- [ ] **Tạo `src/components/ui/Pagination.tsx`**:
  - Single source of truth — xóa copy-paste master-data vs item-codes

- [ ] **Tạo `src/components/ui/Spinner.tsx`** + `<PageLoader>`:
  - Size token `xs (16) | sm (20) | md (24) | lg (32)`
  - Chỉ 1 implementation — chọn Material `progress_activity` HOẶC CSS border-spin, KHÔNG cả hai

- [ ] **Tạo `src/components/ui/EmptyState.tsx`**:
  - `icon`, `title`, `description`, `action` props

- [ ] **Tạo `src/components/ui/Stepper.tsx`**:
  - Numbered steps với label, current, completed states
  - Replace inbound/import + master-data import + forgot-password steppers

- [ ] **Tạo `src/components/ui/Tabs.tsx`**:
  - Replace inbound/new tabs + pallets/[id] lines/history tabs

- [ ] **Tạo `src/components/ui/Combobox.tsx`** / `ProductPicker.tsx` chính thức (đã có dạng ad-hoc trong inbound/new)

- [ ] **Tạo `src/lib/status-meta.ts`** central — bỏ STATUS_MAP duplicate ở khắp nơi

### Phase 2 — Token enforcement

- [ ] **ESLint custom rule** chặn:
  - `text-slate-*`, `bg-slate-*`, `border-slate-*` (force dùng `on-surface-variant`, `surface-low`, `outline-variant`)
  - Hardcoded HEX `text-[#...]`, `bg-[#...]`, `border-[#...]`
  - Emoji trong file JSX (regex match codepoint range)
  - `alert(`, `confirm(` (force dùng `useToast`, `useConfirm`)

- [ ] **Define spacing tokens cụ thể** trong tailwind config:
  - `p-page` = `p-6` (24px)
  - `space-section` = `space-y-5` (20px)
  - `gap-grid` = `gap-3` (12px) cho KPI grid, `gap-4` cho card grid
  - Force consensus

- [ ] **Codemod chạy 1 lượt** sweep replace:
  - `text-slate-500` → `text-on-surface-variant`
  - `text-slate-700` → `text-on-surface`
  - `border-slate-200` / `border-slate-300` → `border-outline-variant`
  - `bg-slate-50` → `bg-surface-low`
  - `bg-slate-900/40` → `bg-black/40`
  - Tất cả `<h1 className="text-2xl font-bold tracking-tight text-primary">` → `<PageTitle>` component

### Phase 3 — Sweep refactor (sprint sau)

- [ ] Refactor lần lượt từng page về dùng components mới:
  - Tuần 1: Master Data module (master-data, item-codes, product-groups, units, suppliers, locations)
  - Tuần 2: Inbound module (3 page chính + adhoc + import)
  - Tuần 3: Outbound module
  - Tuần 4: Inventory module (alerts + by-X pages)
  - Tuần 5: System module (users, rbac, config, mail, audit-log)
  - Tuần 6: Dashboard + landing + forklift-desktop
  - Tuần 7: Auth (login + forgot-password — đặc biệt forgot-password cần viết lại từ đầu)

### Phase 4 — Polish

- [ ] Bỏ tất cả emoji decorative — dùng Material Symbols hoặc inline SVG icons với màu được kiểm soát
- [ ] Unify status badges: tất cả qua `<Badge variant>` từ `src/components/ui/Badge.tsx`
- [ ] Single CSV/Excel export pattern: chỉ qua `<ExcelExport>` component
- [ ] A11y sweep: aria-label cho icon-only button, focus visible state, tab order, alt text
- [ ] Responsive sweep: kiểm tra table overflow scroll, modal mobile size
- [ ] Animation tokens: define transition duration/easing trong globals.css; bỏ inline `style={animation: ...}`

---

## 6. NHỮNG ĐIỂM ĐÃ TỐT (đừng đụng vào nếu chưa cần)

- 🟢 `src/app/globals.css` đã định nghĩa **đầy đủ** color tokens, spacing tokens, utility classes (`label-caps`, `data-mono`, `headline-lg`, `headline-md`). Foundation đã có — chỉ thiếu kỷ luật áp dụng.
- 🟢 `src/components/ui/Card.tsx` và `Badge.tsx` đã wrap cleanly `industrial-card` và `chip-X`. Pattern tốt — nhân rộng theo cách này.
- 🟢 `src/components/layout/AppLayout.tsx` + `Sidebar.tsx` + `UcHeader.tsx` cấu trúc nhất quán: 64px primary sidebar + 224px secondary sidebar + 64px header. Page nội dung tự lo.
- 🟢 `src/app/page.tsx` (landing) là **page tốt nhất** về discipline — dùng đúng `<Card>`, `<Badge>`, `label-caps`, `data-mono`, `headline-lg`. Lấy làm REFERENCE cho phần còn lại.
- 🟢 `src/app/master-data/page.tsx` và `src/app/item-codes/page.tsx` discipline tương đối — chỉ thiếu trừu tượng modal và pagination.
- 🟢 BarcodeScanner + AttachmentPanel + ExcelExport là **3 component shared tốt** đã tồn tại — chứng tỏ team có thể làm component reusable. Nhân thêm style này cho Button/Input/Modal.
- 🟢 Sidebar navigation luôn nhất quán: subnav grouping bằng `label-caps` section header, item dạng icon + text.

---

## 7. PHỤ LỤC — DANH SÁCH FILE CẦN PRIORITY REFACTOR

Theo thứ tự **mức độ tệ về UI**:

1. 🔴🔴🔴 `src/app/auth/forgot-password/page.tsx` (487 dòng) — viết lại từ đầu sau khi có Modal/Input/Stepper component
2. 🔴🔴 `src/app/inventory/page.tsx` — bỏ gradient pink-orange, bỏ emoji color dot, dùng Badge
3. 🔴🔴 `src/app/dashboard/page.tsx` — bỏ emoji decorative, unify card pattern, dùng Badge
4. 🔴🔴 `src/app/system/users/page.tsx` — fix modal pattern, fix input border, bỏ emoji
5. 🔴 `src/app/dashboard/manager/page.tsx` — bỏ mix icon+emoji ở H1, bỏ rainbow card colors
6. 🔴 `src/app/inbound/page.tsx` — bỏ emoji button text, unify status badge
7. 🔴 `src/app/locations/page.tsx` — refactor 6-color status pastel system
8. 🟠 `src/app/inventory/alerts/page.tsx` — replace emoji color dot, unify card section
9. 🟠 `src/app/outbound/report/page.tsx` — fix Excel button color khỏi xanh lá tươi
10. 🟠 `src/app/master-data/page.tsx` — trừu tượng modal + pagination
11. 🟠 `src/app/item-codes/page.tsx` — bỏ emoji trong select option, trừu tượng pagination
12. 🟠 Tất cả page dùng `alert()` và `confirm()` — quá nhiều để liệt kê (xem mục 2.13)

---

## TỔNG KẾT

**Tổng số issue đếm được:** ~150+ inconsistency cụ thể (đếm rõ trong báo cáo)

**Severity breakdown:**
- 🔴 Nghiêm trọng: ~38 issue
- 🟠 Cao: ~52 issue
- 🟡 Trung bình: ~40 issue
- 🔵 Thấp/polish: ~20 issue

**Hiện trạng:** App có **foundation tokens TỐT** (globals.css), nhưng **70%+ page không sử dụng** chúng đúng cách. Mỗi developer/copilot thế hệ sau đã viết theo cảm hứng riêng → 3 thế hệ design language chồng lên nhau.

**Effort estimate:**
- **Phase 1 (build component system):** 2-3 sprint (1 senior frontend + 1 designer)
- **Phase 2 (token enforcement + ESLint + codemod):** 1 sprint
- **Phase 3 (sweep refactor 50 pages):** 6-7 sprint (chia đội module)
- **Phase 4 (polish + a11y):** 1-2 sprint

**Tổng ước tính:** 10-13 sprint (~5-6 tháng) để đạt được mức "designer OCD không còn khó chịu nữa".

**Nếu chỉ làm được 3 việc cấp bách nhất:**
1. Tạo `<Button>`, `<Modal>`, `<Toast>`, `<ConfirmDialog>` (loại bỏ alert/confirm/inline button)
2. Codemod thay `text-slate-*` → token + bỏ HEX cứng trong `forgot-password`
3. Loại bỏ tất cả emoji decorative

→ Sau 3 việc này, app sẽ trông professional hơn rõ rệt.

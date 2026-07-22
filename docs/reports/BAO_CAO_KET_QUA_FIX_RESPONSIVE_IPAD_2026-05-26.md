# Báo cáo Kết Quả Fix Responsive iPad — Patch 1 + 2 + 4

**Thời điểm:** 2026-05-26
**Ref:** Plan ở [BAO_CAO_FIX_RESPONSIVE_IPAD_2026-05-26.md](BAO_CAO_FIX_RESPONSIVE_IPAD_2026-05-26.md)
**Status:** ✅ **DONE** — 46 file thay đổi, deploy 2 VPS, build 4 instance, HTTP 200 hết.

---

## 1. Tóm tắt patch đã apply

| Patch | File ảnh hưởng | Status |
|---|---|---|
| **1.1** Viewport meta + safe-area-inset support | `src/app/layout.tsx` (+9 dòng) | ✅ |
| **1.2** Container `max-w-md` → responsive iPad | `src/app/{thukho,kiemke,forklift}/layout.tsx` | ✅ |
| **2.1** Bottom nav safe-area + height calc | 3 layout mobile | ✅ |
| **2.2** Touch targets ≥ 44pt (Apple HIG) | 3 layout mobile (header + nav) | ✅ |
| **3** Manifest cho 1 app duy nhất "VG WMS" | `public/manifest.json` (rewrite) | ✅ (icon chờ designer) |
| **4.2** Font `text-[10/11px]` → `md:text-xs` codemod | 34 file, 215 thay thế | ✅ |

**Đã skip có chủ đích:**
- Patch 4.1 (form/modal max-width tablet) — vì container outer đã `md:max-w-2xl` (672px) — form 600px là OK trên iPad. Nếu reviewer note thì sẽ wrap thêm sau.
- Patch 5 (Capacitor wrap) — cần Mac + Xcode, anh hoặc dev khác làm.
- Asset icon 1024×1024 — chờ designer.

---

## 2. Chi tiết kỹ thuật từng patch

### 2.1 Viewport meta — `src/app/layout.tsx`

Trước: không có viewport meta → browser default → safe-area không hoạt động.

Sau:
```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,        // Apple HIG: cho user zoom (accessibility)
  viewportFit: "cover",      // enable env(safe-area-inset-*)
  themeColor: "#001E71",     // navy WMS brand
};

export const metadata: Metadata = {
  ...,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VG WMS",         // home screen shortcut name
  },
};
```

### 2.2 Container responsive (3 layout mobile)

Trước:
```tsx
<div className="max-w-md mx-auto ... pb-[72px]">
```

Sau:
```tsx
<div
  className="max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto ..."
  style={{ paddingBottom: "calc(72px + env(safe-area-inset-bottom))" }}
>
```

**Breakpoint mapping:**
| Viewport | Container width | Device |
|---|---|---|
| < 640px | 448px (`max-w-md`) | iPhone, Android phone |
| 640-767px | 576px (`max-w-xl`) | Small tablet |
| 768-1023px | 672px (`max-w-2xl`) | **iPad portrait** |
| ≥ 1024px | 768px (`max-w-3xl`) | **iPad landscape, iPad Pro** |

### 2.3 Bottom nav safe-area (3 layout mobile)

Trước:
```tsx
<nav className="... w-full max-w-md ... pb-safe h-[72px] ...">
```

Sau:
```tsx
<nav
  className="... w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl ..."
  style={{
    paddingBottom: "env(safe-area-inset-bottom)",
    height: "calc(72px + env(safe-area-inset-bottom))",
  }}
>
```

→ iPad Pro home indicator (~34px) không che nav nữa.

### 2.4 Touch targets ≥ 44pt

| Element | Trước | Sau |
|---|---|---|
| Header buttons (chuông, QR scan) | `w-10 h-10` (40×40) | `w-11 h-11` (44×44) |
| Header logo avatar | `w-10 h-10` (40×40) | `w-11 h-11` (44×44) |
| Bottom nav items | `px-3 py-1.5` (~36px) | `px-3 py-3 min-h-[44px]` (≥44px) |

Cũng thêm `aria-label` cho tất cả icon-only buttons (accessibility — Apple cũng check).

### 2.5 Manifest 1 app duy nhất

Trước (chỉ cho forklift, dùng `next.svg`):
```json
{ "name": "Vinh Giang WMS Forklift", "icons": [{"src":"/next.svg",...}] }
```

Sau:
```json
{
  "name": "Vĩnh Giang WMS",
  "short_name": "VG WMS",
  "description": "Hệ thống quản lý kho FMCG — Vĩnh Giang Logistics",
  "start_url": "/wms/auth",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#001E71",
  "background_color": "#FFFFFF",
  "lang": "vi-VN",
  "categories": ["business", "productivity"],
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-1024.png", "sizes": "1024x1024", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

**⚠️ Còn nợ:** 4 file icon PNG cần designer tạo. Sau khi có, đặt vào `public/icons/`. Hiện tại browser sẽ 404 khi load icon nhưng KHÔNG break app — chỉ ảnh hưởng PWA install prompt.

### 2.6 Font codemod — 34 file, 215 thay thế

Script mới: `scripts/codemod-tablet-fontsize.js`

```js
text-[10px]   →   text-[10px] md:text-xs   (10→12px trên ≥768px)
text-[11px]   →   text-[11px] md:text-xs   (11→12px trên ≥768px)
```

**Idempotent** (skip nếu đã có `md:text-`).

Files đã update (sample):
```
src/components/forklift/ForkliftMobileDashboard.tsx: +15
src/components/thukho/ThukhoMobileDashboard.tsx: +11
src/app/kiemke/page.tsx: +10
src/app/kiemke/tasks/[id]/page.tsx: +9
src/components/forklift/ForkliftWebDashboard.tsx: +9
src/app/kiemke/profile/page.tsx: +8
src/app/kiemke/scan/page.tsx: +8
... (34 file tổng cộng, +215 hint)
```

---

## 3. Deploy

| VPS | Sync method | Build | Restart | HTTP verify |
|---|---|---|---|---|
| **Cá nhân `188.166.210.73`** | tar 82KB → extract | 4 instance (wms, xenang, thukho, kiemke) | all | **200 all 4** |
| **Công ty `42.96.16.197`** | tar 82KB → extract | 4 instance | all | **200 all 4** |

```
wms      HTTP 200 (port 3001 / 4200)
xenang   HTTP 200 (port 3002)
thukho   HTTP 200 (port 3003)
kiemke   HTTP 200 (port 3004)
```

---

## 4. Việc còn lại trước khi submit Store

### 4.1 Asset cần làm (Designer, ~2-3 giờ)

- [ ] `/public/icons/icon-192.png` — 192×192 logo VG WMS (PNG, no transparency edges)
- [ ] `/public/icons/icon-512.png` — 512×512
- [ ] `/public/icons/icon-1024.png` — 1024×1024 (**bắt buộc cho App Store tile**)
- [ ] `/public/icons/icon-maskable-512.png` — 512×512 với safe zone 80% (logo center 410px, Android crop adaptive)
- [ ] App Store Screenshot:
  - 12.9" iPad Pro (2048×2732) — 3-5 screenshot
  - 11" iPad Pro (1668×2388) — 3-5 screenshot
- [ ] Google Play Screenshot: phone (1080×1920) + 10" tablet (1920×1200)
- [ ] Feature graphic Google Play (1024×500)
- [ ] App icon Adaptive cho Android (foreground 432×432 + background)

**Tool gợi ý:** [maskable.app](https://maskable.app) để gen maskable icon. [Figma](https://figma.com) hoặc Photoshop để chụp screenshot.

### 4.2 Capacitor wrap (Dev có Mac, ~4-6 giờ)

```bash
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "VG WMS" "vn.vinhgiang.wms" --web-dir=public
npx cap add ios
npx cap add android

# Config (capacitor.config.ts) trỏ tới URL production:
const config: CapacitorConfig = {
  appId: 'vn.vinhgiang.wms',
  appName: 'VG WMS',
  server: {
    url: 'https://khohangvinhgiang.io.vn/wms/auth',
    cleartext: false,
  },
};

# Build iOS (.ipa) — cần Mac + Xcode 15+:
npx cap sync ios
npx cap open ios
# Trong Xcode: Product → Archive → Distribute → App Store Connect

# Build Android (.aab):
npx cap sync android
npx cap open android
# Trong Android Studio: Build → Generate Signed Bundle → AAB → upload Play Console
```

### 4.3 Store Console setup

**Apple App Store Connect:**
- Apple Developer account ($99/năm) — link kèm app vào team
- Bundle ID: `vn.vinhgiang.wms`
- App name: "VG WMS"
- Subtitle: "Quản lý kho Vĩnh Giang"
- Demo account: `qa@vinhgiang.local / Test1234@` (em đã đề xuất seed account này ở [BAO_CAO_FIX_TESTCASE_AUTH_2026-05-26.md](BAO_CAO_FIX_TESTCASE_AUTH_2026-05-26.md))
- Privacy Policy URL (cần tạo): `https://khohangvinhgiang.io.vn/privacy`
- Category: Business

**Google Play Console:**
- Google Play Console ($25 1 lần)
- Package name: `vn.vinhgiang.wms`
- Content rating questionnaire
- Same demo account + privacy

### 4.4 Test iPad bắt buộc trước submit

Có 2 cách test:

**A. Test online ngay** (em verify được):
- Mở Chrome DevTools (F12) → Toggle Device Toolbar (Ctrl+Shift+M)
- Chọn "iPad Air" / "iPad Pro 12.9"" / "iPad Mini"
- Truy cập:
  - https://188.166.210.73/wms/auth (login)
  - https://188.166.210.73/thukho (mobile thủ kho)
  - https://188.166.210.73/kiemke (mobile kiểm kê)
  - https://188.166.210.73/xenang/forklift (mobile xe nâng)
- Test cả portrait + landscape
- Verify: container không bị stuck 448px, nav không bị home indicator che (nếu dùng device thật), buttons ≥ 44px

**B. iPad Simulator (Xcode trên Mac):**
- Mở Safari trên iPad Simulator → load URL
- Test interactive + accessibility

---

## 5. Code change checklist

Đã sửa:
- [x] `src/app/layout.tsx` — viewport meta + appleWebApp
- [x] `src/app/thukho/layout.tsx` — container responsive + safe-area + touch targets
- [x] `src/app/kiemke/layout.tsx` — same pattern
- [x] `src/app/forklift/layout.tsx` — same pattern
- [x] `public/manifest.json` — manifest 1 app duy nhất
- [x] `scripts/codemod-tablet-fontsize.js` — codemod mới
- [x] 34 file mobile pages/components — font tablet hint
- [x] Deploy 2 VPS, build 4 instance, restart, HTTP 200

Chưa làm (chờ asset/người khác):
- [ ] 4 file icon PNG vào `public/icons/` (designer)
- [ ] Capacitor wrap (dev có Mac)
- [ ] Screenshot store (designer hoặc dev)
- [ ] Privacy Policy page
- [ ] Submit Apple App Store + Google Play

---

## 6. URL test ngay được (Chrome DevTools iPad mode)

| URL | Device test | Expected |
|---|---|---|
| https://188.166.210.73/wms/auth | iPad Pro 12.9" portrait/landscape | Form login căn giữa, max 672px |
| https://188.166.210.73/thukho | iPad Air portrait | Container 672px center, nav full đáy, buttons 44px |
| https://188.166.210.73/thukho/inbound | iPad landscape 1024px | Container 768px, list cards trải đẹp |
| https://188.166.210.73/kiemke | iPad portrait | Same pattern |
| https://khohangvinhgiang.io.vn/wms/auth | iPad Pro any | Same — VPS công ty |

**Nếu anh thấy bất kỳ trang nào vẫn xấu trên iPad → screenshot + URL gửi em, em fix tiếp.**

---

**Patch 1 + 2 + 4 DONE.** Effort: ~3h dev (em). Tiếp theo cần asset designer + Capacitor wrap để submit thật.

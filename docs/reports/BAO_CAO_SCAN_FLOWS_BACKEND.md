# BÁO CÁO: Các luồng quét QR/Barcode trong WMS Vĩnh Giang — Backend cần làm gì

**Ngày:** 2026-05-26
**Phạm vi:** Tổng hợp từ mockup `wms_mockups_4.html` (4138 dòng) + đối chiếu code hiện tại.
**Mục đích:** Liệt kê toàn bộ luồng nghiệp vụ có quét camera, payload thực tế của mã quét được, và endpoint backend cần xây/đã có để resolve mã quét → trả về data nghiệp vụ.

---

## 0. Tóm tắt nhanh

| # | UC | Vai trò | Quét gì | Resolve thành | Backend endpoint cần |
|---|---|---|---|---|---|
| 1 | UC-INT-01 | Mọi vai trò mobile | Barcode/QR generic | SKU / ItemCode / Pallet / Location | `/api/scan/resolve` (gộp) |
| 2 | UC-PAL-03 | Thủ kho | Mã hàng (vạch/QR vỏ thùng) | ItemCode | `/api/item-codes/by-barcode` |
| 3 | UC-FK-02 | Xe nâng | QR **vị trí** đích | Location | `/api/locations/by-code` |
| 4 | UC-FK-03 | Xe nâng | QR **vị trí** đích | Location | `/api/locations/by-code` |
| 5 | UC-FK-04 | Xe nâng | Barcode/QR **mã hàng** | ItemCode + FEFO list | `/api/item-codes/by-barcode` + có sẵn `/api/forklift/fefo-suggest` |
| 6 | UC-INV-06 | Người kiểm kê | QR **vị trí** | Location + pallets tại đó | `/api/locations/by-code` + có sẵn `/api/stock-count/[id]/locations/[code]/pallets` |
| 7 | Quick scan (topbar xe nâng) | Xe nâng | Barcode pallet | Pallet info | `/api/pallets/by-code` |
| 8 | Login QR (auth/page.tsx) | Mọi vai trò | QR phiên đăng nhập | Session token | (out-of-scope, chỉ note) |

**Frontend đã có sẵn:**
- Lib: `html5-qrcode@2.3.8` (đã cài trong `package.json`)
- Component: [src/components/shared/BarcodeScannerModal.tsx](src/components/shared/BarcodeScannerModal.tsx) + [BarcodeScanner.tsx](src/components/shared/BarcodeScanner.tsx)
- Đã được nhúng ở: `forklift/pallet`, `forklift/put-away`, `forklift/relocate`, `forklift/return`, `kiemke/scan`, `thukho/pallet/[id]`, `pallets/[id]`, `master-data`, `auth`

→ **Chỉ thiếu backend API để biến mã quét thành data nghiệp vụ.** Modal FE đã gọi callback `onScan(code)`, nhưng phần lớn page chỉ gán code vào input chứ không resolve hoàn chỉnh.

---

## 1. Phân tích chi tiết từng luồng

### 1.1 UC-INT-01 — Quét barcode/QR (Generic Mobile) ★ Must

> File mockup: dòng 3927–3983
> **Mô tả:** Quét generic, áp dụng xuyên suốt mọi flow mobile.

**Input quét được:** chuỗi ASCII (8–20 ký tự). Format mockup gợi ý:
- **EAN-13** (sản phẩm): `8938523103142`
- **EAN-8** (sản phẩm rút gọn): `12345678`
- **Code-128** (vận hành/lô): `PL260506.005` / `L240120`
- **QR Code** (vị trí, pallet, item): mã text trực tiếp

**Backend cần resolve "smart":**

```
POST /api/scan/resolve
Body: { code: "8938523103142" }

Response:
{
  success: true,
  type: "item_code" | "pallet" | "location" | "unknown",
  data: { ... } // tùy type
}
```

Logic resolve thứ tự:
1. Match `Location.code` (ưu tiên — vị trí thường có format `A-03-02`)
2. Match `Pallet.code` (format `PLYYMMDD.NNN`)
3. Match `ItemCode.code` (mã SKU/mã NCC)
4. Match `Product.barcode` (EAN-13/EAN-8) → join sang ItemCode link với Product đó
5. Match `InboundRequest.code` (PHN-YYYY-NNNN) — tra cứu phiếu nhập
6. Match `Lot` trên `PalletLine.lot` — gợi ý các pallet cùng lô
7. Fallback: trả `unknown` + suggest catalog search (UC-PAL-03)

**Fallback nếu không nhận:**
- FE hiển thị nút "Tìm trong danh mục" → mở UC-PAL-03 (catalog search)
- Hoặc "Tạo SKU tạm" → mở UC-MD-02 (tạo ItemCode pending)

---

### 1.2 UC-PAL-03 — Nhận diện mã hàng (đa phương thức) — Thủ kho

> File mockup: dòng 1210–1285

**5 phương thức nhận diện:**
1. **Quét barcode/QR** → camera (đã có FE)
2. **Quét QR code** → cùng camera
3. **Chụp ảnh vỏ thùng** → upload ảnh → OCR/ML detect (chưa có)
4. **Tìm danh mục** → text search `/api/item-codes?q=`
5. **Nhập tay** → user gõ trực tiếp

**Sau khi nhận diện:**
- Hiển thị card xác nhận: `code`, `short_name`, `unit`, `specification` (quy cách), `barcode`
- Button "Tiếp tục nhập SL, Lô, Date →" (mở form PalletLine)

**Backend cần:**

```
GET /api/item-codes/by-barcode?barcode=8938523103142
GET /api/item-codes/by-code?code=VG-NM-001

Response:
{
  success: true,
  data: {
    id, code, short_name, full_name, status,
    unit: { id, name, symbol },
    product: { id, sku, name, barcode },
    specification, weight_per_box, group: {...}
  }
}
```

**Edge case:** Nếu `Product.barcode` match nhưng chưa có `ItemCode` link tới → tự tạo ItemCode pending hoặc trả về Product để FE prompt tạo ItemCode mới.

**Phương thức #3 (chụp ảnh OCR)** = Phase 2, không trong scope must.

---

### 1.3 UC-FK-02 — Đưa pallet vào vị trí (Xe nâng) ★ Must Cốt lõi

> File mockup: dòng 2264–2334

**Flow:**
1. Xe nâng chọn pallet từ "Pallet chờ đưa vào vị trí"
2. Đến vị trí trống thực tế
3. **Quét QR mã vị trí** (vd `A-03-02`)
4. App match Location → confirm → ghi Movement `PUT_AWAY`

**Backend cần:**

```
GET /api/locations/by-code?code=A-03-02

Response:
{
  success: true,
  data: {
    id, code, zone, rack, level,
    type: "STORAGE" | "INBOUND_STAGING" | "OUTBOUND_STAGING" | "STOCKTAKE",
    status: "EMPTY" | "USING" | ...,
    max_pallets, max_weight_kg,
    current_pallets_count, // tính từ Pallet.location_id = this.id
    is_active
  }
}
```

**Validation kèm theo (server-side khi confirm):**
- `Location.type === "STORAGE"` (không cho put-away vào INBOUND_STAGING)
- `Location.status !== "MAINTENANCE"`
- `Location.is_active === true`
- `current_pallets_count < max_pallets` (nếu max_pallets có)

Đã có endpoint cũ `/api/forklift/put-away` (POST) — chỉ cần thêm GET resolve location.

---

### 1.4 UC-FK-03 — Chuyển vị trí ↔ vị trí (Xe nâng)

> File mockup: dòng 2336–2377

**Flow:** giống UC-FK-02 nhưng từ vị trí cũ → vị trí mới.
- Vị trí nguồn: hệ thống tự gán từ `Pallet.location_id` hiện tại
- Vị trí đích: **quét QR**

**Backend:** dùng chung `/api/locations/by-code` của UC-FK-02.

**Validation thêm:**
- `Location.id !== pallet.location_id` (không relocate về vị trí cũ)
- Lý do tùy chọn: "Sắp xếp lại kho" / "Gom hàng cùng lô" / "Giải phóng vị trí" / "Khác"

API confirm đã có: `/api/forklift/relocate`.

---

### 1.5 UC-FK-04 — Sang khu chờ xuất FEFO (Xe nâng) ★ Must Cốt lõi

> File mockup: dòng 2379+ (continue)

**Flow:**
1. Xe nâng cần xuất 1 mã hàng → **quét barcode/QR mã hàng**
2. App resolve → gọi FEFO suggest → hiển thị danh sách pallet theo HSD cận nhất
3. Chọn pallet → modal TH-A (rút nguyên) / TH-B (rút một phần)

**Backend cần:**
- Resolve barcode → ItemCode: dùng `/api/item-codes/by-barcode` (UC-PAL-03)
- Sau đó FE gọi `/api/forklift/fefo-suggest?item_code_id={id}` (**đã có**)

→ Chỉ cần endpoint `by-barcode`. Logic FEFO đã chạy tốt.

---

### 1.6 UC-INV-06 — Kiểm kê theo vị trí (Người kiểm kê) ★ Must

> File mockup: dòng 3186–3260

**Flow 3 bước:**
1. **Bước 1: Quét QR vị trí** (vd `A-03-02`)
2. **Bước 2:** App load tất cả pallet hệ thống ghi nhận ở vị trí đó → hiển thị
3. **Bước 3:** Cho từng pallet, người kiểm kê đếm thực tế → so sánh SL hệ thống → ghi chênh lệch

**Backend cần:**

```
GET /api/locations/by-code?code=A-03-02
   → trả Location + pallets tại đó

Hoặc tách:
GET /api/locations/by-code?code=A-03-02
GET /api/stock-count/sessions/{sessionId}/locations/{locationCode}/pallets
   → trả pallets + lines với SL hệ thống
```

API ghi chênh lệch đã có: `/api/stock-count` + `/api/stock-count/[id]/complete`.

---

### 1.7 Quick Scan trong topbar xe nâng

> File code hiện có: [src/app/forklift/layout.tsx:125](src/app/forklift/layout.tsx#L125)

Nút floating ở top-right `qr_code_scanner` link tới `/forklift/pallet?scan=true`. Mục đích: quét nhanh barcode pallet để xem chi tiết.

**Backend cần:**

```
GET /api/pallets/by-code?code=PL260506.005

Response:
{
  success: true,
  data: {
    id, code, status, location: {...}, supplier: {...},
    lines: [{ item_code, qty_box, lot, expiry_date }, ...],
    total_lines, total_weight_kg,
    parent_pallet_id, split_seq // nếu split pallet
  }
}
```

---

### 1.8 Login bằng QR (out-of-scope nhưng note)

[src/app/auth/page.tsx](src/app/auth/page.tsx) có dùng `BarcodeScanner`. Đây là feature riêng (QR magic-link login), không cần thay đổi BE chính.

---

## 2. Schema đã đủ chưa?

### ✅ Trường nhận diện đã có sẵn

| Bảng | Field unique | Dùng để match khi quét |
|---|---|---|
| `pallets.code` | ✓ VARCHAR(20) | `PL260506.005`, `PL260506.005-P1` |
| `locations.code` | ✓ VARCHAR(20) | `A-03-02` |
| `item_codes.code` | ✓ VARCHAR(100) | `VG-NM-001` |
| `products.sku` | ✓ VARCHAR(50) | SKU chính thức |
| `products.barcode` | ✓ VARCHAR | EAN-13: `8938523103142` |
| `inbound_requests.code` | ✓ VARCHAR | `PHN-2026-0001` |
| `pallet_lines.lot` | (không unique) VARCHAR(40) | Lô SX: `L240120` |

→ **Schema đủ**, không cần migrate.

### ⚠️ Cần thêm (tùy chọn, không bắt buộc)

- `Location.qr_token` (UUID) — nếu muốn QR vị trí KHÔNG phải code dễ đoán. Hiện tại QR = code thẳng (vd in QR `A-03-02`) là OK cho kho nội bộ.
- `ItemCode.alt_barcodes[]` (TEXT[]) — vì 1 SKU có thể có nhiều barcode (mã NCC khác nhau, mã EAN khác). Hiện chỉ `products.barcode` 1 cột.

---

## 3. Backend tasks cụ thể (đề xuất priority)

### Phase 1 — Must (làm trước, ~2 ngày)

| # | Endpoint | Method | Mục đích | UC dùng |
|---|---|---|---|---|
| 1 | `/api/scan/resolve` | POST | Resolve mã generic (smart match) | UC-INT-01 (gateway cho mọi flow) |
| 2 | `/api/locations/by-code` | GET | Match Location.code, kèm trạng thái | UC-FK-02, FK-03, INV-06 |
| 3 | `/api/pallets/by-code` | GET | Match Pallet.code, kèm lines | Quick scan, UC-PAL-03 |
| 4 | `/api/item-codes/by-barcode` | GET | Match barcode EAN/Product.barcode | UC-PAL-03, UC-FK-04 |
| 5 | `/api/item-codes/by-code` | GET | Match ItemCode.code trực tiếp | UC-PAL-03 fallback |

### Phase 2 — Should (nice-to-have, ~1 ngày)

| # | Endpoint | Method | Mục đích |
|---|---|---|---|
| 6 | `/api/scan/audit` | POST | Log mọi scan để analytics (ai quét gì, khi nào) |
| 7 | `/api/scan/ocr-image` | POST | Upload ảnh vỏ thùng → OCR detect barcode (Tesseract.js BE hoặc gọi external API) |
| 8 | `/api/lots/by-code` | GET | Match Lot → trả pallet/location chứa lô đó |

---

## 4. Skeleton code cho 5 endpoint Phase 1

### 4.1 `/api/scan/resolve/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code?.trim()) {
    return NextResponse.json({ success: false, error: "Thiếu code" }, { status: 400 });
  }
  const c = code.trim();

  // 1) Location
  const loc = await prisma.location.findUnique({ where: { code: c } });
  if (loc) return NextResponse.json({ success: true, type: "location", data: loc });

  // 2) Pallet
  const pal = await prisma.pallet.findUnique({
    where: { code: c },
    include: { location: true, lines: { include: { item_code: true } } },
  });
  if (pal) return NextResponse.json({ success: true, type: "pallet", data: pal });

  // 3) ItemCode.code
  const ic = await prisma.itemCode.findUnique({
    where: { code: c },
    include: { unit: true, product: true },
  });
  if (ic) return NextResponse.json({ success: true, type: "item_code", data: ic });

  // 4) Product.barcode
  const prod = await prisma.product.findUnique({ where: { barcode: c } });
  if (prod) {
    const linkedIc = await prisma.itemCode.findFirst({
      where: { product_id: prod.id, status: "standardized" },
      include: { unit: true, product: true },
    });
    if (linkedIc) {
      return NextResponse.json({ success: true, type: "item_code", data: linkedIc, via: "product_barcode" });
    }
    return NextResponse.json({ success: true, type: "product", data: prod, note: "Product có barcode nhưng chưa link ItemCode" });
  }

  // 5) InboundRequest
  const inb = await prisma.inboundRequest.findUnique({ where: { code: c } });
  if (inb) return NextResponse.json({ success: true, type: "inbound_request", data: inb });

  return NextResponse.json({ success: true, type: "unknown", data: null, scanned: c });
}
```

### 4.2 `/api/locations/by-code/route.ts`

```typescript
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ success: false, error: "Thiếu code" }, { status: 400 });

  const loc = await prisma.location.findUnique({
    where: { code },
    include: { pallets: { select: { id: true, code: true, status: true } } },
  });
  if (!loc) {
    return NextResponse.json({ success: false, error: `Vị trí "${code}" không tồn tại` }, { status: 404 });
  }
  return NextResponse.json({
    success: true,
    data: {
      ...loc,
      current_pallets_count: loc.pallets.length,
      is_full: loc.max_pallets ? loc.pallets.length >= loc.max_pallets : false,
    },
  });
}
```

### 4.3 `/api/pallets/by-code/route.ts`

```typescript
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ success: false, error: "Thiếu code" }, { status: 400 });

  const pallet = await prisma.pallet.findUnique({
    where: { code },
    include: {
      location: true,
      supplier: true,
      lines: { include: { item_code: { include: { unit: true } } } },
      parent: { select: { id: true, code: true } },
    },
  });
  if (!pallet) {
    return NextResponse.json({ success: false, error: `Pallet "${code}" không tồn tại` }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: pallet });
}
```

### 4.4 `/api/item-codes/by-barcode/route.ts`

```typescript
export async function GET(req: NextRequest) {
  const barcode = req.nextUrl.searchParams.get("barcode")?.trim();
  if (!barcode) return NextResponse.json({ success: false, error: "Thiếu barcode" }, { status: 400 });

  // 1) Match Product.barcode trước
  const product = await prisma.product.findUnique({ where: { barcode } });
  if (product) {
    const ic = await prisma.itemCode.findFirst({
      where: { product_id: product.id, status: "standardized" },
      include: { unit: true, group: true, product: true },
    });
    if (ic) return NextResponse.json({ success: true, data: ic, via: "product_barcode" });
  }

  // 2) Fallback: ItemCode.code == barcode (đôi khi barcode in trên thùng = code SKU)
  const ic = await prisma.itemCode.findUnique({
    where: { code: barcode },
    include: { unit: true, group: true, product: true },
  });
  if (ic) return NextResponse.json({ success: true, data: ic, via: "item_code_code" });

  return NextResponse.json({ success: false, error: `Không tìm thấy mã hàng cho barcode "${barcode}"`, scanned: barcode }, { status: 404 });
}
```

### 4.5 `/api/item-codes/by-code/route.ts`

```typescript
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return NextResponse.json({ success: false, error: "Thiếu code" }, { status: 400 });

  const ic = await prisma.itemCode.findUnique({
    where: { code },
    include: { unit: true, group: true, product: true },
  });
  if (!ic) {
    return NextResponse.json({ success: false, error: `Mã hàng "${code}" không tồn tại` }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: ic });
}
```

---

## 5. Frontend cần cập nhật

### Đã có sẵn (không cần thay đổi)
- [BarcodeScannerModal.tsx](src/components/shared/BarcodeScannerModal.tsx) — Modal full-screen
- [BarcodeScanner.tsx](src/components/shared/BarcodeScanner.tsx) — Camera component dùng `html5-qrcode`

### Cần wire lại `onScan` để gọi backend
Hiện tại nhiều page chỉ `onScan={(code) => setInput(code)}`. Cần đổi sang:

```typescript
const handleScan = async (code: string) => {
  setScanning(true);
  try {
    const res = await fetch(`${basePath}/api/scan/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const result = await res.json();
    if (result.success && result.type !== "unknown") {
      // Route theo type:
      switch (result.type) {
        case "location": handleLocationScanned(result.data); break;
        case "pallet": handlePalletScanned(result.data); break;
        case "item_code": handleItemScanned(result.data); break;
        default: setError(`Mã "${code}" không nhận diện được`);
      }
    } else {
      setError(`Không tìm thấy "${code}" trong hệ thống`);
    }
  } finally {
    setScanning(false);
  }
};
```

Files cần wire (theo Glob lúc nãy):
- `src/app/forklift/pallet/page.tsx`
- `src/app/forklift/put-away/page.tsx`
- `src/app/forklift/relocate/page.tsx`
- `src/app/forklift/return/page.tsx`
- `src/app/forklift/stage-out/page.tsx` (đã có search, thêm scan)
- `src/app/kiemke/scan/page.tsx`
- `src/app/thukho/pallet/[id]/page.tsx`
- `src/app/pallets/[id]/page.tsx`

---

## 6. Tóm lại

- **Backend làm 5 endpoint REST mới** (Phase 1) — tổng cộng ~200 LOC TypeScript.
- **Schema không cần migrate** — các field unique đã đủ để match.
- **Frontend đã có lib + component**, chỉ cần wire `onScan → fetch resolver`.
- **Validation server-side** (cấm scan vị trí MAINTENANCE, cấm scan pallet không thuộc warehouse, etc.) gắn vào từng endpoint POST nghiệp vụ đã có (`/api/forklift/put-away`, `/api/stock-count`, ...).

**Effort estimate:**
- Backend 5 endpoint: ~3–4 giờ (gồm test cơ bản)
- Wire 8 page FE: ~4 giờ
- E2E test bằng thiết bị thật (in QR Location + Pallet): ~2 giờ
- **Total: 1.5 ngày làm full**

---

## 7. Quyết định cần lấy từ user

1. **QR vị trí dùng plain text hay token UUID?**
   - Plain text (`A-03-02` trực tiếp in QR): đơn giản, người nhìn QR đoán được vị trí — OK cho kho nội bộ.
   - Token UUID (random): an toàn hơn nhưng cần thêm cột schema + công cụ in QR.
   - **Đề xuất:** dùng plain text (nhanh, phù hợp scope).

2. **EAN-13 barcode mặc định lưu ở `Product.barcode` hay `ItemCode.alt_barcodes`?**
   - Hiện schema chỉ có `Product.barcode` (1 cột). Nếu kho NCC giao có nhiều mã NCC khác nhau cho cùng 1 SKU → cần `ItemCode.alt_barcodes[]`.
   - **Đề xuất:** giữ `Product.barcode` cho EAN chính thức + thêm `ItemCode.alt_barcodes[]` (TEXT[]) cho mã phụ — chỉ migrate khi gặp use case thực.

3. **OCR chụp ảnh vỏ thùng (UC-PAL-03 phương thức 3) có làm Phase 1 không?**
   - Phức tạp hơn (Tesseract.js BE hoặc Google Cloud Vision API).
   - **Đề xuất:** Phase 2, không nên block Phase 1.

4. **In QR cho Location và Pallet — ai làm?**
   - Cần script `/api/locations/[id]/qr-png` trả về QR PNG để in dán.
   - **Đề xuất:** add 1 endpoint nhỏ + nút "In QR" trong /locations và /pallets desktop.

---

Mày confirm các quyết định ở section 7 rồi tao làm Phase 1 + deploy ngay.

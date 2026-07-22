# 🎯 KẾ HOẠCH FIX 19 USECASE CÒN LẠI — CHI TIẾT TỪNG BƯỚC

> **Ngày:** 2026-05-25
> **Branch hiện tại:** `feat/phase0-deploy-tools-and-reports` @ `6da94e3`
> **Mockup nguồn:** `wms_mockups_4.html` (4138 dòng)
> **Đã fix:** 21/53 UC (52.5%) — verify 20/21 visual PASS
> **Còn lại:** 19 UC + bug `wms-thukho routing`
>
> **Tài liệu này** = roadmap chi tiết để hoàn thành **100% UC khớp mockup**, được chia thành **6 wave** theo độ ưu tiên + effort.

---

## 📋 MỤC LỤC

1. [Tổng quan 19 UC + matrix ưu tiên](#1-tổng-quan)
2. [Wave 1 — Quick wins (cosmetic, 4-6h)](#wave-1)
3. [Wave 2 — Reusable component (1-2 ngày)](#wave-2)
4. [Wave 3 — Camera scan thật (1 ngày)](#wave-3)
5. [Wave 4 — Workflow chuẩn hóa (3-5 ngày)](#wave-4)
6. [Wave 5 — Charts + Drill-down (1-2 ngày)](#wave-5)
7. [Wave 6 — Protected & Decision-required (gated)](#wave-6)
8. [Tổng kết & Sprint plan](#8-tổng-kết)

---

<a id="1-tổng-quan"></a>

## 1. 📊 TỔNG QUAN 19 UC + MATRIX ƯU TIÊN

### 1.1. Bảng danh sách 19 UC

| # | UC | Tên | Phase mockup | Effort | Wave | Dependencies |
|---|----|-----|--------------|--------|------|--------------|
| 1 | UC-IN-05 | Stepper 8 status phiếu nhập | Must | XS | W1 | — |
| 2 | UC-MD-05 | Sơ đồ visual kho (canvas/SVG) | Must | S | W1 | — |
| 3 | UC-MD-02 | Nút "Chuẩn hóa" mã hàng | Must | S | W4 | UC-MD-01 |
| 4 | UC-FK-01 | DS pallet card cho xe nâng | Must | XS | W1 | — |
| 5 | UC-PAL-03 | Quét mã đa phương thức | Should | M | W3 | UC-INT-01 |
| 6 | UC-INV-06 | Camera scan kiểm kê | Must | M | W3 | UC-INT-01 |
| 7 | UC-PAL-01 | Mobile UI + format PLYYMMDD.STT | Must | M | W6 | — |
| 8 | UC-IN-06 | Wire Excel Unilever thật | Must | M | W4 | mẫu file |
| 9 | UC-INV-07 | Trang KK theo mã riêng | Must | M | W4 | — |
| 10 | UC-MD-01 | CRUD sản phẩm đầy đủ verify | Must | S | W4 | — |
| 11 | UC-FK-05 | Audit log + UI sửa pallet | Must | M | **W6 PROTECTED** | Tech Lead approval |
| 12 | UC-OUT-02 chart | Bar chart Top 5 | Must | S | W5 | recharts |
| 13 | UC-INV-01.B | Drill-down `/inventory/by-sku/[code]/locations` | Must | M | W5 | — |
| 14 | UC-DASH-01 | Dashboard role-based widget | Must | M | W5 | — |
| 15 | UC-DASH-02 | Manager dashboard `/dashboard/manager` | Should | M | W5 | recharts |
| 16 | UC-SYS-01 | Logo upload UI thật + apply | Should | S | W2 | — |
| 17 | UC-INT-01 | Component `BarcodeScanner` reusable | Must | M | W2 | html5-qrcode ✓ |
| 18 | UC-INT-02 | Component `ImageUpload` reusable | Should | S | W2 | — |
| 19 | UC-AUTH-04 | Decision OTP vs email reset | Must | XS | W6 | Stakeholder decision |
| 20 | UC-INTMP-02 | Workflow chọn mã chuẩn dropdown | Must | M | W4 | UC-MD-02 |

> **Tổng effort:** ~12-15 ngày người (8h/ngày).
> **Lưu ý:** Có 20 hàng vì UC-MD-05 + UC-INTMP-02 trong báo cáo gốc list 2 ý riêng nhưng chung UC.

### 1.2. Matrix priority (Impact × Effort)

```
            EFFORT:   XS         S         M         L
IMPACT
HIGH                  IN-05    MD-05     INTMP-02   FK-05*
                      FK-01    OUT-02ch  INV-07     PAL-01
                                          INV-06
                                          DASH-01
                                          INT-01

MEDIUM                AUTH-04  SYS-01    PAL-03     DASH-02
                                MD-02     INV-01.B
                                INT-02    IN-06
                                MD-01

LOW                                       — (no low-impact UC remaining)
```

> **Quy ước:**
> - **XS** = <30 phút thay đổi UI
> - **S** = ~1-2h, đụng 1-2 file
> - **M** = ~4-8h, đụng 3-5 file, có thể cần migrate DB
> - **L** = ~1+ ngày, refactor module hoặc page mới phức tạp
> - **\*** = blocked bởi PROTECTED hoặc decision

### 1.3. Pre-requisite cài thư viện

| Package | Mục đích | Đã có? |
|---|---|---|
| `html5-qrcode` | Scan barcode/QR camera | ✓ ĐÃ CÓ `package.json:21` |
| `recharts` | Bar chart, line chart Top 5 | ❌ **CẦN CÀI** |
| `react-dropzone` (optional) | Drag-drop file upload | ❌ Optional, hiện đùng `input type=file` |
| `qrcode.react` (optional) | Generate QR sticker pallet | ❌ Optional, Phase sau |

```bash
# Pre-requisite cho Wave 5:
npm install recharts
```

---

<a id="wave-2"></a>

<a id="wave-1"></a>

## 2. 🌊 WAVE 1 — QUICK WINS (4-6 GIỜ) ⚡

> **Mục tiêu:** Hoàn thành 4 UC cosmetic trong nửa ngày để tăng % UC khớp mockup nhanh.
> **Lead time:** 1 commit + 1 deploy.

---

### 2.1. UC-IN-05 — Stepper 8 status phiếu nhập

- **Role:** Kế toán · Thủ kho · Quản lý
- **Mockup ref:** `wms_mockups_4.html:1704-1792`
- **Trạng thái hiện tại:** [`src/app/inbound/page.tsx:1-436`](src/app/inbound/page.tsx) — Đã có table với badge status, NHƯNG **thiếu cột "Tiến độ"** với stepper visual 8 bước.
- **Gap:**
  - Thiếu column "Tiến độ" hiển thị 8 dot (`done`/`active`/empty)
  - Thiếu text dưới stepper: "Chờ chốt số (7/8)" / "Đang kiểm đếm (4/8)"
  - Thiếu pill filter "⚠ Có chênh lệch (3)"

#### Bước fix

**Bước 1:** Mở [`src/app/inbound/page.tsx`](src/app/inbound/page.tsx), thêm hàm map status → step count:
```typescript
const STATUS_TO_STEP: Record<string, { step: number; label: string }> = {
  NEW: { step: 1, label: "Mới — chờ TK tiếp nhận" },
  RECEIVING: { step: 2, label: "Chờ TK tiếp nhận" },
  PREP_ZONE_READY: { step: 3, label: "Khu chuẩn bị sẵn sàng" },
  COUNTING: { step: 4, label: "Đang kiểm đếm" },
  PALLET_WAITING: { step: 5, label: "Pallet chờ nhập" },
  IN_LOCATION: { step: 6, label: "Đưa vào vị trí" },
  PENDING_CLOSE: { step: 7, label: "Chờ chốt số" },
  COMPLETED: { step: 8, label: "Đã chốt" },
};
```

**Bước 2:** Thêm component `<Stepper steps={8} current={s.step} />` (dùng inline div, không cần lib):
```tsx
function Stepper({ steps, current }: { steps: number; current: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: steps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 w-3 rounded-full ${
            i < current - 1 ? "bg-emerald-500" :
            i === current - 1 ? "bg-amber-500 animate-pulse" :
            "bg-slate-200"
          }`}
        />
      ))}
    </div>
  );
}
```

**Bước 3:** Render trong cell `<td>` và thêm pill filter "Có chênh lệch" (dựa trên `has_discrepancy`).

#### File đụng
- [src/app/inbound/page.tsx](src/app/inbound/page.tsx) — sửa table column

#### Acceptance
- [ ] DS phiếu hiện stepper 8 dot, status nào → bao nhiêu dot xanh
- [ ] Text dưới stepper hiển thị đúng (X/8)
- [ ] Pill "⚠ Có chênh lệch" filter các phiếu có dòng SL khớp != yêu cầu

**Effort:** 45 phút.

---

### 2.2. UC-MD-05 — Sơ đồ visual kho (canvas/SVG)

- **Role:** Quản lý / Kế toán kho
- **Mockup ref:** `wms_mockups_4.html:910-976`
- **Trạng thái hiện tại:** [`src/app/locations/page.tsx`](src/app/locations/page.tsx) (1024 dòng) — Đã có table CRUD đầy đủ + toggle "Xem dạng sơ đồ" nhưng chưa render SVG.
- **Gap:**
  - Thiếu khu vực sơ đồ: grid 6 cột × 2 hàng cho mỗi kệ, mỗi ô có màu theo status (Trống/Đang chứa/Đầy/Còn 1 phần/Khóa SD/Chờ kiểm)
  - Thiếu legend (chú thích màu)

#### Bước fix

**Bước 1:** Tìm trong [`src/app/locations/page.tsx`](src/app/locations/page.tsx) chỗ toggle view mode (table/diagram).

**Bước 2:** Thêm component `<RackDiagram />`:
```tsx
function RackDiagram({ rack, slots }: { rack: string; slots: Slot[] }) {
  const colorMap = {
    EMPTY: "bg-emerald-50 border-emerald-400 text-emerald-700",
    OCCUPIED: "bg-blue-50 border-blue-400 text-blue-700",
    FULL: "bg-blue-100 border-blue-500 text-blue-800",
    PARTIAL: "bg-amber-50 border-amber-400 text-amber-700",
    LOCKED: "bg-rose-50 border-rose-400 text-rose-700",
    AWAITING_CHECK: "bg-yellow-50 border-yellow-500 text-yellow-800",
    NEEDS_RECHECK: "bg-orange-50 border-orange-500 text-orange-700",
  };
  return (
    <div>
      <div className="text-xs text-slate-500 mb-2">Kệ {rack} — {slots.length} ô</div>
      <div className="grid grid-cols-6 gap-2">
        {slots.map(s => (
          <div key={s.code} className={`p-3 rounded border ${colorMap[s.status]} text-center text-xs`}>
            <b>{s.code}</b>
            <div className="mt-1">{statusLabel(s.status)}</div>
          </div>
        ))}
      </div>
      <Legend />
    </div>
  );
}
```

**Bước 3:** Wire data: gọi `/api/locations?aisle=A&rack=03&include_status=true` (BE có thể cần thêm field `status` derive từ pallet count, đang được tính client-side cũng được).

#### File đụng
- [src/app/locations/page.tsx](src/app/locations/page.tsx)

#### Acceptance
- [ ] Toggle "Xem dạng sơ đồ" hiển thị grid ô màu thay vì table
- [ ] Mỗi ô có màu nền theo trạng thái + legend
- [ ] Click ô → mở modal/drawer chi tiết pallet bên trong

**Effort:** 2h.

---

### 2.3. UC-PAL-01 — Verify format mã PLYYMMDD.STT

- **Role:** Thủ kho
- **Mockup ref:** `wms_mockups_4.html:1011-1090`
- **Trạng thái hiện tại:** [`src/app/thukho/pallet/new/page.tsx`](src/app/thukho/pallet/new/page.tsx) — Đã có form tạo pallet. Cần verify format mã sinh ra đúng `PLYYMMDD.STT`.
- **Gap có thể có:**
  - Format mã pallet có thể đang là UUID hoặc khác
  - Thiếu liên kết PHN (phiếu nhập)
  - Thiếu trạng thái default "Đang kiểm đếm"

#### Bước fix

**Bước 1:** Grep API `/api/pallets/route.ts` (POST handler) → kiểm tra logic sinh code:
```bash
# Đang muốn thấy:
const today = new Date();
const yy = String(today.getFullYear()).slice(-2);
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const prefix = `PL${yy}${mm}${dd}`;
const last = await prisma.pallet.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" } });
const stt = last ? Number(last.code.split(".")[1]) + 1 : 1;
const code = `${prefix}.${String(stt).padStart(3, "0")}`;
```

**Bước 2:** Nếu format không đúng → fix POST handler `/api/pallets/route.ts`. Thêm **transaction + unique constraint** để chống trùng khi nhiều người tạo cùng lúc:
```typescript
await prisma.$transaction(async (tx) => {
  // Lock advisory để serialize
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
  // ... sinh STT
}, { isolationLevel: "Serializable" });
```

**Bước 3:** Verify field `linked_inbound_id` trong form mobile.

#### File đụng
- [src/app/api/pallets/route.ts](src/app/api/pallets/route.ts)
- [src/app/thukho/pallet/new/page.tsx](src/app/thukho/pallet/new/page.tsx)

#### Acceptance
- [ ] Tạo 3 pallet cùng ngày → mã PL260525.001, PL260525.002, PL260525.003
- [ ] Tạo song song 2 tab cùng lúc → không trùng mã
- [ ] Form có dropdown "Liên kết phiếu nhập" (PHN-XXX)

**Effort:** 1h.

---

### 2.4. UC-FK-01 — DS pallet card cho xe nâng

- **Role:** Xe nâng
- **Mockup ref:** `wms_mockups_4.html:2180-2262`
- **Trạng thái hiện tại:** [`src/app/forklift/page.tsx:1-15`](src/app/forklift/page.tsx) renders `ForkliftMobileDashboard` component. Defer vì "dashboard cũ đã đủ".
- **Gap:** Mockup cụ thể yêu cầu mobile UI với:
  - 2 KPI box trên cùng (Pallet chờ vào · Yêu cầu LC)
  - 3 pill tab: Vào vị trí · Luân chuyển · Sang chờ xuất
  - Card list pallet với `Mã pallet`, `N dòng · M đv · Date gần nhất`, `📥 PHN-...` `⏱ XN HH:MM`
  - Border-left orange `#ea580c` cho pallet chờ
  - Tabbar dưới: Việc · Bản đồ · Lịch sử · Tôi

#### Bước fix

**Bước 1:** Tìm `src/components/forklift/ForkliftMobileDashboard.tsx`:
```bash
ls src/components/forklift/
```

**Bước 2:** So sánh UI hiện tại với mockup → bổ sung:
- KPI count: `kpi.pallets_waiting`, `kpi.relocate_requests`
- Pill tabs filter theo `task_type` (PUT_AWAY · RELOCATE · TO_STAGING_OUT)
- Card format: lấy `pallet.code`, `pallet.lines.length`, `sum(qty_box)`, `min(expiry_date)`

**Bước 3:** Verify API `/api/forklift/queue` trả đủ field:
```typescript
{
  pallet_code: string;
  line_count: number;
  total_qty: number;
  nearest_expiry: Date | null;
  source_inbound_code: string | null;
  confirmed_at: Date;
  task_type: "PUT_AWAY" | "RELOCATE" | "TO_STAGING_OUT";
}
```

#### File đụng
- `src/components/forklift/ForkliftMobileDashboard.tsx`
- [src/app/api/forklift/queue/route.ts](src/app/api/forklift/queue/route.ts)

#### Acceptance
- [ ] Mobile view có KPI + pill tabs + card list khớp mockup
- [ ] Filter pill chuyển category đúng
- [ ] Border-left màu cam cho pallet đang chờ

**Effort:** 1.5h.

---

### 2.5. Tổng Wave 1

| UC | Effort | Cumulative |
|---|---|---|
| UC-IN-05 | 0.75h | 0.75h |
| UC-MD-05 | 2h | 2.75h |
| UC-PAL-01 | 1h | 3.75h |
| UC-FK-01 | 1.5h | 5.25h |

**Tổng Wave 1: ~5.25h (nửa ngày).** Commit + deploy + verify = 1 commit.

---

## 3. 🌊 WAVE 2 — REUSABLE COMPONENT (1-2 NGÀY) 🧩

> **Mục tiêu:** Build 3 component reusable cho các UC khác dùng lại (DRY).

---

### 3.1. UC-INT-01 — Component `<BarcodeScanner />` reusable

- **Role:** Tất cả vai trò mobile
- **Mockup ref:** `wms_mockups_4.html:3927-3983`
- **Trạng thái hiện tại:** Chưa có component dùng chung. Một số page có quét nhưng dùng input thường.
- **Tech:** `html5-qrcode@2.3.8` đã cài (`package.json:21`).

#### Bước fix

**Bước 1:** Tạo `src/components/shared/BarcodeScanner.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

type Props = {
  onScan: (text: string) => void;
  onError?: (err: Error) => void;
  formats?: Html5QrcodeSupportedFormats[];
  showTorch?: boolean;
};

export function BarcodeScanner({ onScan, onError, formats, showTorch }: Props) {
  const elemRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (!elemRef.current) return;
    const elemId = `barcode-scanner-${Math.random().toString(36).slice(2, 8)}`;
    elemRef.current.id = elemId;

    const s = new Html5Qrcode(elemId, {
      formatsToSupport: formats || [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = s;

    s.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      onScan,
      () => {}, // ignore decode failure
    ).catch(onError);

    return () => { s.stop().catch(() => {}); };
  }, [onScan, onError, formats]);

  return (
    <div className="relative">
      <div ref={elemRef} className="w-full aspect-square bg-black rounded-lg overflow-hidden" />
      {showTorch && (
        <button
          onClick={() => scannerRef.current?.applyVideoConstraints({ advanced: [{ torch: true } as any] })}
          className="absolute bottom-3 right-3 bg-amber-500 text-white p-2 rounded-full"
        >🔦</button>
      )}
    </div>
  );
}
```

**Bước 2:** Tạo `src/components/shared/BarcodeScannerModal.tsx` wrapper modal:
```tsx
export function BarcodeScannerModal({ open, onClose, onScan, title = "Quét mã" }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="bg-black text-white p-3 flex items-center gap-3">
        <button onClick={onClose}>←</button>
        <span>{title}</span>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <BarcodeScanner onScan={(code) => { onScan(code); onClose(); }} showTorch />
      </div>
      <div className="bg-zinc-900 text-white p-3 flex justify-around text-xs">
        <button>📷 Ảnh</button>
        <button>📋 Danh mục</button>
        <button>⌨️ Nhập tay</button>
      </div>
    </div>
  );
}
```

**Bước 3:** Test bằng cách thêm nút "Quét" vào 1 trang (UC-PAL-03 mobile) trước.

#### File đụng (mới)
- `src/components/shared/BarcodeScanner.tsx` ⭐ NEW
- `src/components/shared/BarcodeScannerModal.tsx` ⭐ NEW

#### Acceptance
- [ ] Modal mở camera, scan EAN-13 → callback `onScan("8938...")`
- [ ] Nút đèn pin (torch) hoạt động trên điện thoại Android
- [ ] Nút × đóng modal

**Effort:** 3h (setup permissions HTTPS-only, test trên ĐT thật).

---

### 3.2. UC-INT-02 — Component `<ImageUpload />` reusable

- **Role:** Thủ kho · Người KK
- **Mockup ref:** `wms_mockups_4.html:3985-4025`
- **Trạng thái hiện tại:** API `/api/attachments` đã có. Một vài page upload ad-hoc. Chưa có component chuẩn.

#### Bước fix

**Bước 1:** Tạo `src/components/shared/ImageUpload.tsx`:
```tsx
"use client";
import { useState } from "react";

type Props = {
  attachableType: "INBOUND_LINE" | "PALLET_LINE" | "STOCK_COUNT" | "INBOUND_TEMP";
  attachableId: string;
  maxFiles?: number;
  maxSizeMB?: number;
  onChange?: (urls: string[]) => void;
};

export function ImageUpload({ attachableType, attachableId, maxFiles = 10, maxSizeMB = 5, onChange }: Props) {
  const [files, setFiles] = useState<{ url: string; name: string; id: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > maxSizeMB * 1024 * 1024) { alert(`File quá ${maxSizeMB}MB`); return; }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("attachable_type", attachableType);
    fd.append("attachable_id", attachableId);
    const res = await fetch("/wms/api/attachments", { method: "POST", body: fd });
    const j = await res.json();
    if (j.success) {
      const next = [...files, { url: j.data.url, name: f.name, id: j.data.id }];
      setFiles(next);
      onChange?.(next.map(x => x.url));
    }
    setUploading(false);
  };

  const handleRemove = async (id: string) => {
    await fetch(`/wms/api/attachments/${id}`, { method: "DELETE" });
    const next = files.filter(f => f.id !== id);
    setFiles(next);
    onChange?.(next.map(x => x.url));
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        {files.map(f => (
          <div key={f.id} className="aspect-square relative bg-slate-100 rounded overflow-hidden">
            <img src={f.url} className="w-full h-full object-cover" />
            <button onClick={() => handleRemove(f.id)}
              className="absolute top-1 right-1 bg-rose-500 text-white w-5 h-5 rounded-full">×</button>
          </div>
        ))}
        {files.length < maxFiles && (
          <label className="aspect-square bg-slate-50 border-2 border-dashed border-slate-300 rounded flex items-center justify-center cursor-pointer">
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleSelect} disabled={uploading} />
            <span className="text-2xl">{uploading ? "..." : "📷"}</span>
          </label>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">{files.length}/{maxFiles} ảnh · Tối đa {maxSizeMB}MB/ảnh</p>
    </div>
  );
}
```

**Bước 2:** Verify schema `Attachment` có đủ `attachable_type`, `attachable_id`, `url` fields.

**Bước 3:** Migrate các page hiện đang upload ad-hoc sang dùng component này (`/inbound-adhoc/new`, `/stock-count/[id]`...) — thay thế dần.

#### File đụng (mới)
- `src/components/shared/ImageUpload.tsx` ⭐ NEW

#### Acceptance
- [ ] Chụp ảnh từ camera ĐT (capture="environment") → upload lên S3/local
- [ ] Hiển thị thumbnail + nút xóa
- [ ] Mobile-friendly grid 4 cột

**Effort:** 2.5h.

---

### 3.3. UC-SYS-01 — Logo upload UI thật + apply globally

- **Role:** Quản lý
- **Mockup ref:** `wms_mockups_4.html:3659-3708`
- **Trạng thái hiện tại:** [`src/app/system/config/page.tsx:1-76`](src/app/system/config/page.tsx) — 76 dòng, đã có 6 config keys (Session #1). Defer: "File picker cho logo + apply globally".

#### Bước fix

**Bước 1:** Thêm 2 input upload cho `logo_url` và `favicon_url`:
```tsx
<div>
  <label className="text-xs font-bold text-slate-500">Logo (PNG/SVG, max 2MB)</label>
  <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
    {logoUrl ? (
      <img src={logoUrl} className="w-20 h-20 mx-auto" alt="logo" />
    ) : (
      <div className="w-20 h-20 mx-auto bg-primary rounded-xl flex items-center justify-center text-white text-3xl font-bold">VG</div>
    )}
    <p className="mt-2 text-sm">{logoFileName || "Chưa có logo"}</p>
    <label className="mt-2 inline-block">
      <input type="file" accept="image/png,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
      <span className="px-3 py-1.5 bg-slate-200 rounded cursor-pointer text-sm">Đổi logo</span>
    </label>
  </div>
</div>
```

**Bước 2:** Sửa header [`src/components/layout/AppLayout.tsx`](src/components/layout/AppLayout.tsx) để load `logo_url` từ `/api/system/config` và render:
```tsx
const [logoUrl, setLogoUrl] = useState<string | null>(null);
useEffect(() => {
  fetch("/wms/api/system/config?key=logo_url")
    .then(r => r.json())
    .then(j => setLogoUrl(j.data?.value || null));
}, []);

return (
  <header>
    {logoUrl ? <img src={logoUrl} className="h-8" /> : <span className="font-bold">📦 WMS Vĩnh Giang</span>}
  </header>
);
```

**Bước 3:** Update `app/layout.tsx` (root) để set dynamic favicon từ `favicon_url`:
```tsx
import { headers } from "next/headers";
export async function generateMetadata(): Promise<Metadata> {
  const cfg = await prisma.systemConfig.findUnique({ where: { key: "favicon_url" } });
  return { icons: cfg?.value || "/favicon.ico" };
}
```

#### File đụng
- [src/app/system/config/page.tsx](src/app/system/config/page.tsx)
- `src/components/layout/AppLayout.tsx`
- [src/app/api/attachments/route.ts](src/app/api/attachments/route.ts) (handle uploading logo)

#### Acceptance
- [ ] Upload logo PNG → preview ngay
- [ ] Lưu → header tự reload logo mới
- [ ] Favicon đổi (cần F5 ko - tab title icon)

**Effort:** 2h.

---

### 3.4. Tổng Wave 2

| UC | Effort |
|---|---|
| UC-INT-01 | 3h |
| UC-INT-02 | 2.5h |
| UC-SYS-01 | 2h |

**Tổng Wave 2: ~7.5h (1 ngày).**

---

<a id="wave-3"></a>

## 4. 🌊 WAVE 3 — CAMERA SCAN THẬT (1 NGÀY) 📷

> **Mục tiêu:** Áp dụng `BarcodeScanner` từ W2 vào 2 UC quan trọng.

---

### 4.1. UC-PAL-03 — Quét mã đa phương thức khi thêm dòng pallet

- **Role:** Thủ kho
- **Mockup ref:** `wms_mockups_4.html:1210-1285`
- **Trạng thái hiện tại:** Trong form thêm dòng `/thukho/pallet/[id]` có button 📷 nhưng chưa wire scanner.
- **Phụ thuộc:** Wave 2 `BarcodeScannerModal`.

#### Bước fix

**Bước 1:** Tìm form thêm dòng trong [`src/app/thukho/pallet/[id]/page.tsx`](src/app/thukho/pallet/[id]/page.tsx).

**Bước 2:** Thay button 📷 thành:
```tsx
import { BarcodeScannerModal } from "@/components/shared/BarcodeScannerModal";

const [scannerOpen, setScannerOpen] = useState(false);

<button onClick={() => setScannerOpen(true)}>📷 Quét</button>
<BarcodeScannerModal
  open={scannerOpen}
  onClose={() => setScannerOpen(false)}
  onScan={async (code) => {
    // Lookup item by barcode
    const r = await fetch(`/wms/api/products?barcode=${code}`);
    const j = await r.json();
    if (j.data?.length) {
      setSelectedItem(j.data[0]);  // pre-fill mã hàng
    } else {
      // Mã chưa có → mở popup tạo mã tạm (UC-MD-02)
      setNewItemModalOpen(true);
      setNewItemBarcode(code);
    }
  }}
/>
```

**Bước 3:** Thêm flow "Không nhận → chuyển catalog (UC-PAL-03) hoặc tạo SKU tạm (UC-MD-02)".

**Bước 4:** Thêm 2 button phụ trong scanner modal: "Tìm danh mục" (mở list product picker) + "Nhập tay" (textarea code).

#### File đụng
- [src/app/thukho/pallet/[id]/page.tsx](src/app/thukho/pallet/[id]/page.tsx)
- Có thể cần endpoint `GET /api/products?barcode=...` (verify đã có)

#### Acceptance
- [ ] Quét EAN-13 mã đã có → pre-fill SKU
- [ ] Quét mã chưa có → popup "Mã chưa có, tạo mới?"
- [ ] Có fallback "Tìm danh mục" + "Nhập tay"

**Effort:** 3h.

---

### 4.2. UC-INV-06 — Camera scan kiểm kê vị trí

- **Role:** Người kiểm kê
- **Mockup ref:** `wms_mockups_4.html:3186-3265`
- **Trạng thái hiện tại:** [`src/app/kiemke/scan/page.tsx:1-102`](src/app/kiemke/scan/page.tsx) — đã có form nhập tay, **chưa có camera scan**.
- **Phụ thuộc:** Wave 2 `BarcodeScannerModal`.

#### Bước fix

**Bước 1:** Sửa step 1 trong [`src/app/kiemke/scan/page.tsx`](src/app/kiemke/scan/page.tsx):
```tsx
<button onClick={() => setScannerOpen(true)}
  className="bg-violet-600 text-white p-4 rounded-xl">
  📷 Mở camera quét QR vị trí
</button>
<BarcodeScannerModal
  open={scannerOpen}
  onClose={() => setScannerOpen(false)}
  onScan={(code) => {
    setLocationCode(code);
    handleSearch();  // auto search
  }}
/>
```

**Bước 2:** Cải tiến UI step 2 (DS pallet tại vị trí) — thêm:
- "Blind count" toggle: ẩn `system_qty` đến khi nhập xong `actual_qty`
- Button "+ Thêm pallet ngoài hệ thống" → POST `/api/stock-count/[id]` thêm dòng ngoài kế hoạch

**Bước 3:** Step 3 (ghi nhận thực tế) — thêm field upload ảnh hiện trường (dùng `<ImageUpload>` từ W2).

#### File đụng
- [src/app/kiemke/scan/page.tsx](src/app/kiemke/scan/page.tsx)
- API stock-count để hỗ trợ "out-of-plan pallet"

#### Acceptance
- [ ] Quét QR vị trí → tự nhảy sang step 2
- [ ] Blind count: ẩn `system_qty` khi nhập
- [ ] Upload ảnh hiện trường lưu vào audit

**Effort:** 3h.

---

### 4.3. Tổng Wave 3

| UC | Effort |
|---|---|
| UC-PAL-03 | 3h |
| UC-INV-06 | 3h |

**Tổng Wave 3: 6h (1 ngày).**

---

<a id="wave-4"></a>

## 5. 🌊 WAVE 4 — WORKFLOW CHUẨN HÓA (3-5 NGÀY) 🔧

> **Mục tiêu:** Hoàn thiện 5 workflow lớn (chuẩn hóa mã, KK theo mã, Excel Unilever, CRUD sản phẩm).

---

### 5.1. UC-MD-01 — CRUD sản phẩm đầy đủ (verify + polish)

- **Role:** Kế toán kho / Quản lý
- **Mockup ref:** `wms_mockups_4.html:604-736`
- **Trạng thái hiện tại:** [`src/app/master-data/page.tsx:1-945`](src/app/master-data/page.tsx) — 945 dòng, có CRUD và `weight_per_box`, `volume_per_box`. **Cần verify**:
  - [ ] Form 6 trường mới (Tên rút gọn, Quy cách, KL/thùng, TT/thùng, Lô, HSD)
  - [ ] Filter Nhóm + Trạng thái + Search
  - [ ] Pagination + Import Excel + Export Excel
  - [ ] Sidebar có sub-menu "Khai báo sản phẩm" "Mã hàng" "Nhóm hàng"...

#### Bước fix

**Bước 1:** Đọc full [`src/app/master-data/page.tsx`](src/app/master-data/page.tsx) → liệt kê cái có sẵn vs mockup → checklist diff.

**Bước 2:** Bổ sung bất kỳ field thiếu (radio "Có quản lý lô" và "Có quản lý HSD", select trạng thái 4 option: Đang dùng/Tạm khóa/Ngừng dùng/Chờ HT).

**Bước 3:** Wire Import Excel: dùng existing `/api/products/import-excel/route.ts`.

**Bước 4:** Wire Export Excel: thêm endpoint hoặc client-side CSV như UC-OUT-02 đang làm.

**Bước 5:** Verify sidebar có structure như mockup.

#### File đụng
- [src/app/master-data/page.tsx](src/app/master-data/page.tsx)
- Có thể cần [src/app/api/products/route.ts](src/app/api/products/route.ts) thêm `?export=true`

#### Acceptance
- [ ] Form đầy đủ 13 field theo mockup
- [ ] Filter + search + paging hoạt động
- [ ] Import file Excel mẫu → tạo nhanh hàng loạt
- [ ] Export Excel ra .xlsx

**Effort:** 3h (mostly verify).

---

### 5.2. UC-MD-02 — Nút "Chuẩn hóa" + workflow 2 vai trò

- **Role:** Kế toán kho (PC chuẩn hóa) · Thủ kho (ĐT tạo nhanh)
- **Mockup ref:** `wms_mockups_4.html:738-820`
- **Trạng thái hiện tại:** [`src/app/item-codes/page.tsx:1-722`](src/app/item-codes/page.tsx) — 722 dòng, có thể đã có nhiều. Cần verify nút "Chuẩn hóa".

#### Bước fix

**Bước 1:** Đọc [`src/app/item-codes/page.tsx`](src/app/item-codes/page.tsx) → check:
- [ ] 3 tab pill: "Chờ xử lý (N)" · "Đã chuẩn hóa (M)" · "Đã hủy (K)"
- [ ] Cột "Hành động" có nút "Chuẩn hóa →"
- [ ] Modal mở khi bấm Chuẩn hóa: pre-fill data, có dropdown chọn mã chuẩn (link sang `/api/products`)

**Bước 2:** Nếu nút chưa có → thêm:
```tsx
<button onClick={() => openStandardizeModal(itemCode)} className="btn-primary">
  Chuẩn hóa →
</button>

<StandardizeModal itemCode={current} onSave={async (productId) => {
  await fetch(`/wms/api/item-codes/${itemCode.id}`, {
    method: "PATCH",
    body: JSON.stringify({ linked_product_id: productId, status: "STANDARDIZED" }),
  });
  refresh();
}} />
```

**Bước 3:** API endpoint `PATCH /api/item-codes/[id]` accept `linked_product_id` + `status`.

**Bước 4:** Mobile: page `/thukho/item-code/new/page.tsx` cần có đủ 8 field theo mockup (Mã, Tên rút gọn, ĐVT lẻ, ĐV quy đổi=Thùng, Quy cách, KL/thùng, Ảnh, Ghi chú).

#### File đụng
- [src/app/item-codes/page.tsx](src/app/item-codes/page.tsx)
- [src/app/api/item-codes/[id]/route.ts](src/app/api/item-codes/[id]/route.ts)
- [src/app/thukho/item-code/new/page.tsx](src/app/thukho/item-code/new/page.tsx)

#### Acceptance
- [ ] Tab "Chờ xử lý" hiển thị mã hàng tạm thời do thủ kho tạo
- [ ] Nút Chuẩn hóa → modal chọn mã chuẩn (autocomplete)
- [ ] Sau chuẩn hóa → mã chuyển sang tab "Đã chuẩn hóa", gắn `linked_product_id`
- [ ] Mobile: ĐV quy đổi = "Thùng" disabled

**Effort:** 4h.

---

### 5.3. UC-INTMP-02 — Workflow chuẩn hóa phiếu nhập tạm (dropdown chi tiết)

- **Role:** Kế toán kho
- **Mockup ref:** `wms_mockups_4.html:2061-2145`
- **Trạng thái hiện tại:** [`src/app/inbound-adhoc/[id]/page.tsx:1-450`](src/app/inbound-adhoc/[id]/page.tsx) — Session #3 đã có wizard 3 bước visual. **Cần bổ sung**:
  - Mỗi dòng có dropdown chọn mã chuẩn (link sang `/api/products`)
  - Nút "Chuẩn hóa →" per row (dispatch)
  - Sidebar "Tiến độ" với checklist: Kiểm nguồn → Chuẩn hóa mã (0/N) → Tạo phiếu chính thức → Chốt phiếu
  - Radio "Liên kết phiếu yêu cầu có sẵn" vs "Tạo phiếu yêu cầu mới (hồi tố)"

#### Bước fix

**Bước 1:** Sửa [`src/app/inbound-adhoc/[id]/page.tsx`](src/app/inbound-adhoc/[id]/page.tsx) — Bước 2 (chuẩn hóa mã hàng):
```tsx
<table>
  <thead>
    <tr><th>Mã (chứng từ)</th><th>Tên</th><th>SL</th><th>Mã chuẩn</th><th>Hành động</th></tr>
  </thead>
  <tbody>
    {lines.map(line => (
      <tr key={line.id}>
        <td><b>{line.temp_code}</b></td>
        <td>{line.short_name}</td>
        <td>{line.qty_box} thùng</td>
        <td>
          <ProductPicker
            value={line.linked_product_id}
            onChange={(productId) => updateLine(line.id, { linked_product_id: productId })}
            allowCreateNew
          />
        </td>
        <td>
          <button onClick={() => standardizeLine(line.id)}
            disabled={!line.linked_product_id}
            className="btn-primary">Chuẩn hóa →</button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Bước 2:** Tạo component `<ProductPicker>` (autocomplete search by SKU + tên rút gọn):
```tsx
export function ProductPicker({ value, onChange, allowCreateNew }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    if (!search) return;
    const t = setTimeout(() => {
      fetch(`/wms/api/products?search=${encodeURIComponent(search)}`)
        .then(r => r.json()).then(j => setItems(j.data || []));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ... dropdown render ...
}
```

**Bước 3:** Backend endpoint `POST /api/inbound-temp/[id]/standardize` để xử lý bulk standardize:
- Update `linked_product_id` của các temp lines
- Tạo phiếu nhập chính thức `PHN-...`
- Tồn tạm → tồn chính thức

**Bước 4:** Sidebar tiến độ:
```tsx
<aside className="sticky top-20">
  <h4>✅ TIẾN ĐỘ</h4>
  <ul>
    <li className={source_ok ? "text-emerald-600" : ""}>✓ Kiểm nguồn</li>
    <li className={progress.standardized === progress.total ? "text-emerald-600" : "text-amber-600"}>○ Chuẩn hóa mã ({progress.standardized}/{progress.total})</li>
    <li className={linked ? "text-emerald-600" : ""}>○ Tạo phiếu chính thức</li>
    <li>○ Chốt phiếu</li>
  </ul>
</aside>
```

#### File đụng
- [src/app/inbound-adhoc/[id]/page.tsx](src/app/inbound-adhoc/[id]/page.tsx)
- `src/components/shared/ProductPicker.tsx` ⭐ NEW
- [src/app/api/inbound-temp/[id]/standardize/route.ts](src/app/api/inbound-temp/[id]/standardize/route.ts) (đã có, có thể cần update)

#### Acceptance
- [ ] Dropdown chọn mã chuẩn cho từng dòng
- [ ] Disable nút Chuẩn hóa nếu chưa chọn mã
- [ ] Sidebar tiến độ cập nhật real-time
- [ ] Hoàn tất → tự tạo PHN-... mới

**Effort:** 6h.

---

### 5.4. UC-INV-07 — Trang kiểm kê theo Mã hàng riêng

- **Role:** Người kiểm kê / Quản lý
- **Mockup ref:** `wms_mockups_4.html:3267-3303`
- **Trạng thái hiện tại:** [`src/app/kiemke/tasks/[id]/page.tsx:1-170`](src/app/kiemke/tasks/[id]/page.tsx) đã render cả `BY_LOCATION` lẫn `BY_ITEM`. **UI hiện chung**, chưa có view dành riêng cho BY_ITEM với:
  - 4 KPI: SL hệ thống · SL thực tế · Chênh lệch · Tiến độ
  - Table: Vị trí · Pallet · Lô · HSD · SL HT · SL TT · Chênh · Người KK · Trạng thái
  - Highlight STAGING-OUT row (background vàng)

#### Bước fix

**Bước 1:** Trong `[id]/page.tsx`, fork view khi `session.type === "BY_ITEM"`:
```tsx
if (session.type === "BY_ITEM") {
  return <KiemkeByItemView session={session} />;
}
```

**Bước 2:** Tạo file `src/components/kiemke/KiemkeByItemView.tsx`:
- Header: tên SKU
- 4 KPI box (tính từ `counts[]`)
- Table với row STAGING-OUT có `bg-yellow-50`
- Button "Tạo phiếu xử lý chênh lệch →" link sang UC-INV-08

**Bước 3:** API `/api/stock-count` cần support `?type=BY_ITEM&item_code=VG-NM-001` khi tạo phiếu → tự lookup tất cả vị trí + staging-out chứa SKU đó.

**Bước 4:** Trang mới `/stock-count/new` cần có toggle "Theo vị trí" vs "Theo mã hàng" + picker SKU.

#### File đụng
- [src/app/kiemke/tasks/[id]/page.tsx](src/app/kiemke/tasks/[id]/page.tsx)
- `src/components/kiemke/KiemkeByItemView.tsx` ⭐ NEW
- [src/app/api/stock-count/route.ts](src/app/api/stock-count/route.ts)
- [src/app/stock-count/new/page.tsx](src/app/stock-count/new/page.tsx)

#### Acceptance
- [ ] Tạo phiếu KK theo mã → liệt kê tất cả vị trí + staging-out chứa SKU
- [ ] Highlight row staging-out
- [ ] 4 KPI tính tổng SL hệ thống vs thực tế
- [ ] Button → UC-INV-08

**Effort:** 5h.

---

### 5.5. UC-IN-06 — Wire Excel Unilever thật

- **Role:** Kế toán · Thủ kho
- **Mockup ref:** `wms_mockups_4.html:1795-1971`
- **Trạng thái hiện tại:** [`src/app/inbound/import/page.tsx:1-488`](src/app/inbound/import/page.tsx) đã có UI parse Excel. **Defer reason** = chưa có file mẫu test thật.

#### Bước fix

**Bước 1:** Yêu cầu file mẫu Excel "Hàng U về" từ user (Unilever). Nếu chưa có → tạo file mock trong `prisma/seed-excel-unilever.ts`:
```typescript
import * as XLSX from "xlsx";
const data = [
  { "Mã hàng": "69719229", "Tên hàng": "CLEAR MEN SP PERFUME WARM FOREST 8X600", "Số lượng thùng": 5, "Trọng lượng (kg)": 5660, "BU": "BE" },
  { "Mã hàng": "65442462", "Tên hàng": "COMFORT LQ W.F.BABY PW FRGR Y25 360X20ML", "Số lượng thùng": 60, "Trọng lượng (kg)": 8000, "BU": "HC" },
  // ... 140 dòng
];
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(wb, ws, "HangUVe");
XLSX.writeFile(wb, "public/templates/HangUVe_template.xlsx");
```

**Bước 2:** Verify endpoint `/api/inbound/import-excel/route.ts` parse đúng:
- Detect column header dynamic (case-insensitive)
- Match by `barcode` hoặc `temp_code` → set `product_id` nếu có, hoặc `item_code_id` nếu tạo nhanh
- Tính nhóm BU summary

**Bước 3:** Bước 3 trong UI (Hoàn tất): summary 4 nhóm BU (HC/BE/PC/F) — đã có structure, verify.

**Bước 4:** Test E2E: upload file mẫu → kiểm phiếu tạo có 142 dòng + 12 mã mới rơi vào tab Chờ xử lý của UC-MD-02.

#### File đụng
- [src/app/inbound/import/page.tsx](src/app/inbound/import/page.tsx)
- [src/app/api/inbound/import-excel/route.ts](src/app/api/inbound/import-excel/route.ts)
- [src/app/api/inbound/import-excel/confirm/route.ts](src/app/api/inbound/import-excel/confirm/route.ts)
- `prisma/seed-excel-unilever.ts` ⭐ NEW (mock data)
- `public/templates/HangUVe_template.xlsx` ⭐ NEW

#### Acceptance
- [ ] Upload file mẫu → parse 142 dòng
- [ ] 128 mã đã có → match đúng `product.barcode`
- [ ] 12 mã mới → tự tạo vào `item_codes` với `status=DRAFT`
- [ ] Hoàn tất tạo PHN-... mới với 142 line

**Effort:** 4h.

---

### 5.6. Tổng Wave 4

| UC | Effort |
|---|---|
| UC-MD-01 | 3h |
| UC-MD-02 | 4h |
| UC-INTMP-02 | 6h |
| UC-INV-07 | 5h |
| UC-IN-06 | 4h |

**Tổng Wave 4: ~22h (~3 ngày).**

---

<a id="wave-5"></a>

## 6. 🌊 WAVE 5 — CHARTS + DRILL-DOWN (1-2 NGÀY) 📊

> **Mục tiêu:** Add `recharts` + 4 UC có chart/page mới.
> **Pre-requisite:** `npm install recharts` (~150KB gzipped).

---

### 6.1. UC-OUT-02 — Bar chart Top 5 mã xuất nhiều

- **Role:** Kế toán · Quản lý
- **Mockup ref:** `wms_mockups_4.html:2761-2821`
- **Trạng thái hiện tại:** [`src/app/outbound/report/page.tsx:1-141`](src/app/outbound/report/page.tsx) — table only, chưa có chart.

#### Bước fix

**Bước 1:** Install + import:
```bash
npm install recharts
```

**Bước 2:** Thêm 2 chart trên cùng:
```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const top5 = [...data].sort((a, b) => b.total_qty_box - a.total_qty_box).slice(0, 5);
const groupData = data.reduce((acc, r) => {
  const g = r.group_name || "Khác";
  acc[g] = (acc[g] || 0) + r.total_qty_box;
  return acc;
}, {} as Record<string, number>);
const pieData = Object.entries(groupData).map(([name, value]) => ({ name, value }));

<div className="grid grid-cols-2 gap-4">
  <Card title="Top 5 mã xuất nhiều nhất">
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={top5}>
        <XAxis dataKey="item_code" angle={-30} textAnchor="end" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="total_qty_box" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  </Card>
  <Card title="Xuất theo nhóm hàng">
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  </Card>
</div>
```

**Bước 3:** Verify table có đủ cột "Số lần xuất" + "BQ/lần" theo mockup.

#### File đụng
- [src/app/outbound/report/page.tsx](src/app/outbound/report/page.tsx)
- `package.json` (thêm recharts)

#### Acceptance
- [ ] Bar chart top 5 SKU
- [ ] Pie chart phân bổ theo nhóm hàng
- [ ] Filter ngày update chart

**Effort:** 2h.

---

### 6.2. UC-INV-01.B — Drill-down page `/inventory/by-sku/[code]/locations`

- **Role:** Tất cả
- **Mockup ref:** `wms_mockups_4.html:2955-2981`
- **Trạng thái hiện tại:** Chưa có page riêng. Nút "Chi tiết →" trong UC-INV-01 dẫn đến đâu? → cần kiểm.

#### Bước fix

**Bước 1:** Tạo `src/app/inventory/by-sku/[code]/locations/page.tsx`:
```tsx
"use client";
import { useParams } from "next/navigation";

export default function BySkuLocationsPage() {
  const { code } = useParams();
  const [data, setData] = useState<LocationLine[]>([]);

  useEffect(() => {
    fetch(`/wms/api/inventory/by-item?item_code=${code}&include_locations=true&order=expiry_desc`)
      .then(r => r.json()).then(j => setData(j.data));
  }, [code]);

  // Sort: HSD xa nhất → đẩy lên top (highlight first row)
  return (
    <AppLayout>
      <h1>VG-NM-001 — {productName}</h1>
      <p>Tổng tồn: <b>{totalQty}</b> · Đang ở <b>{data.length}</b> vị trí</p>
      <table>
        <thead>...</thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={i === 0 ? "bg-amber-50" : ""}>
              <td><b>{row.location_code}</b></td>
              <td>{row.pallet_code}</td>
              <td>{row.lot}</td>
              <td>{format(row.production_date)}</td>
              <td><b>{format(row.expiry_date)}</b> {i === 0 && "★"}</td>
              <td>{row.qty_remaining}</td>
              <td><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </AppLayout>
  );
}
```

**Bước 2:** Update API `/api/inventory/by-item/route.ts` để support `?include_locations=true&order=expiry_desc`.

**Bước 3:** Trong [`src/app/inventory/page.tsx`](src/app/inventory/page.tsx) sửa nút "Chi tiết" để `<Link href={'/inventory/by-sku/' + code + '/locations'}>`.

#### File đụng
- `src/app/inventory/by-sku/[code]/locations/page.tsx` ⭐ NEW
- [src/app/inventory/page.tsx](src/app/inventory/page.tsx)
- [src/app/api/inventory/by-item/route.ts](src/app/api/inventory/by-item/route.ts)

#### Acceptance
- [ ] Click "Chi tiết" trong inventory → drill-down page
- [ ] HSD xa nhất ở top, highlight vàng + ★
- [ ] STAGING-OUT cũng được liệt kê

**Effort:** 4h.

---

### 6.3. UC-DASH-01 — Dashboard role-based widget

- **Role:** Tất cả vai trò
- **Mockup ref:** `wms_mockups_4.html:3432-3584`
- **Trạng thái hiện tại:** [`src/app/dashboard/page.tsx:1-95`](src/app/dashboard/page.tsx) — dashboard chung, không phân vai trò.
- **Mockup yêu cầu 4 dashboard riêng:**
  1. Kế toán (desktop): 4 KPI + 2 card (cảnh báo HSD/tồn, phiếu vừa cập nhật)
  2. Thủ kho (mobile): gradient header + 4 mini-KPI + "Tác vụ ưu tiên" cards
  3. Xe nâng (mobile orange): 4 mini-KPI (chờ xếp / di chuyển / xuất tương đối / hoàn trả)
  4. Người KK (mobile violet): progress bar + DS vị trí được giao

#### Bước fix

**Bước 1:** Sửa [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) → route theo role:
```tsx
const role = useUserRole();  // hook đọc từ localStorage/session
if (role === "ACCOUNTING" || role === "ADMIN") return <AccountingDashboard />;
if (role === "WAREHOUSE_STAFF") return <ThukhoMobileDashboard />;  // existing
if (role === "FORKLIFT") return <ForkliftMobileDashboard />;  // existing
if (role === "STOCK_COUNTER") return <KiemkeMobileDashboard />;
if (role === "MANAGER") return redirect("/dashboard/manager");
```

**Bước 2:** Tạo `AccountingDashboard`:
```tsx
function AccountingDashboard() {
  // 4 KPI: phiếu nhập đang xử lý, tồn tạm chờ chuẩn hóa, phiếu lệch SL, phiếu điều chỉnh chờ duyệt
  // 2 card: cảnh báo HSD/tồn (link to /inventory/alerts), phiếu vừa cập nhật (link to /inbound)
}
```

**Bước 3:** Tạo `KiemkeMobileDashboard` với progress bar phiên KK active.

**Bước 4:** Verify API `/api/dashboard/kpi/route.ts` trả đủ field role-specific.

#### File đụng
- [src/app/dashboard/page.tsx](src/app/dashboard/page.tsx)
- `src/components/dashboard/AccountingDashboard.tsx` ⭐ NEW
- `src/components/dashboard/KiemkeMobileDashboard.tsx` ⭐ NEW
- [src/app/api/dashboard/kpi/route.ts](src/app/api/dashboard/kpi/route.ts)

#### Acceptance
- [ ] Login kế toán → thấy 4 KPI chuyên dùng
- [ ] Login thủ kho mobile → gradient blue header
- [ ] Login xe nâng → gradient orange
- [ ] Login kiểm kê → gradient violet + progress

**Effort:** 5h.

---

### 6.4. UC-DASH-02 — Trang Manager `/dashboard/manager`

- **Role:** Quản lý
- **Mockup ref:** `wms_mockups_4.html:3586-3651`
- **Trạng thái hiện tại:** Chưa có page.

#### Bước fix

**Bước 1:** Tạo `src/app/dashboard/manager/page.tsx`:
```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function ManagerDashboard() {
  const [kpi, setKpi] = useState<ManagerKPI | null>(null);
  const [period, setPeriod] = useState<"day" | "week" | "month">("month");

  // Fetch /api/dashboard/manager-kpi?period=month
  // ...

  return (
    <AppLayout>
      <header>
        <h1>📊 Dashboard Quản lý</h1>
        <select>...period selector...</select>
      </header>
      <div className="grid grid-cols-4 gap-4">
        <KPICard label="Tổng SKU" value={kpi.total_sku} delta="+5 tháng" />
        <KPICard label="Tổng tồn" value={kpi.total_stock} delta="+8% tháng" />
        <KPICard label="Pallet đang dùng" value={`${kpi.pallets_used}/${kpi.total_locations}`} />
        <KPICard label="Cảnh báo" value={kpi.alerts} delta="3 nguy cấp" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Card title="Tồn theo nhóm hàng">
          <BarChart data={kpi.by_group}>...</BarChart>
        </Card>
        <Card title="Top mã xuất tương đối (tháng)">
          <ol>{kpi.top_outbound.map(r => <li>{r.code} - {r.qty}</li>)}</ol>
        </Card>
        <Card title="Cảnh báo HSD">
          <div>🔴 ≤7 ngày: {kpi.expiring_7d}</div>
          <div>🟡 ≤30 ngày: {kpi.expiring_30d}</div>
          <div>🟢 >30 ngày: {kpi.expiring_safe}</div>
        </Card>
        <Card title="Phiếu chờ xử lý">
          <table>...{kpi.pending}...</table>
        </Card>
      </div>
    </AppLayout>
  );
}
```

**Bước 2:** API `/api/dashboard/manager-kpi/route.ts` ⭐ NEW:
- Aggregate stocks by `product_group_id`
- Top 5 SKUs by outbound qty trong period
- Counter các loại phiếu pending

#### File đụng
- `src/app/dashboard/manager/page.tsx` ⭐ NEW
- `src/app/api/dashboard/manager-kpi/route.ts` ⭐ NEW

#### Acceptance
- [ ] Login MANAGER → tự redirect / sidebar link đến `/dashboard/manager`
- [ ] 4 KPI + 4 card chart hiển thị
- [ ] Period selector (hôm nay/tuần/tháng) đổi data

**Effort:** 4h.

---

### 6.5. Tổng Wave 5

| UC | Effort |
|---|---|
| UC-OUT-02 chart | 2h |
| UC-INV-01.B | 4h |
| UC-DASH-01 | 5h |
| UC-DASH-02 | 4h |

**Tổng Wave 5: ~15h (~2 ngày).**

---

<a id="wave-6"></a>

## 7. 🌊 WAVE 6 — PROTECTED & DECISION-REQUIRED (GATED) 🔒

> **Mục tiêu:** Hoàn thành 3 UC cần input từ Tech Lead / Stakeholder.
> **Block:** Không tự fix được — cần chờ approval.

---

### 7.1. UC-FK-05 — Audit log + UI sửa pallet (PROTECTED)

- **Role:** Người được phân quyền (đặc biệt)
- **Mockup ref:** `wms_mockups_4.html:2482-2540`
- **Trạng thái hiện tại:** [`src/app/forklift/return/page.tsx:1-260`](src/app/forklift/return/page.tsx) đã có 260 dòng. AuditLog table + API có sẵn (`src/app/api/audit-logs/route.ts`).
- **Lý do PROTECTED:** Theo `docs/CRITICAL_PATHS.md` — file thay đổi tồn tổng cần Tech Lead review.

#### Pre-requisite trước khi fix

1. **Đọc** `docs/CRITICAL_PATHS.md` — xác nhận flow audit log đã đúng spec
2. **Tag Tech Lead** trên PR (hoặc Slack #wms-dev)
3. **Demo + test E2E** trên staging trước khi merge

#### Bước fix (sau khi approve)

**Bước 1:** Trong [`src/app/forklift/return/page.tsx`](src/app/forklift/return/page.tsx), verify form có đủ 6 field theo mockup:
- Pallet (disabled, pre-fill)
- Mã hàng (editable — lý do tách/gộp)
- SL còn lại (highlighting nếu khác SL ban đầu)
- Lô + HSD (editable)
- Vị trí trả về *
- Lý do (dropdown 4 option) *
- Mô tả chi tiết (textarea) *

**Bước 2:** Verify backend `POST /api/forklift/return` ghi audit log với:
```typescript
await prisma.auditLog.create({
  data: {
    user_id: ctx.user.id,
    action: "RETURN_TO_LOCATION",
    table_name: "pallet_lines",
    record_id: palletLineId,
    old_value: JSON.stringify(oldData),
    new_value: JSON.stringify(newData),
    reason: input.reason_code,
    description: input.description,
    ip_address: ctx.ip,
  },
});
```

**Bước 3:** Audit log page [`src/app/system/audit-log/page.tsx`](src/app/system/audit-log/page.tsx) verify hiển thị filter theo action `RETURN_TO_LOCATION` và tô đậm các thay đổi SL.

#### File đụng
- [src/app/forklift/return/page.tsx](src/app/forklift/return/page.tsx)
- [src/app/api/forklift/return/route.ts](src/app/api/forklift/return/route.ts)
- [src/app/system/audit-log/page.tsx](src/app/system/audit-log/page.tsx)

#### Acceptance
- [ ] Form đầy đủ 6 field, validation lý do + mô tả bắt buộc
- [ ] Submit → AuditLog có entry với `old_value` + `new_value`
- [ ] Audit log UI lọc được theo action
- [ ] Tech Lead approve PR

**Effort:** 4h (sau khi approve, mostly verify).

**🔒 Status: BLOCKED — pending Tech Lead review.**

---

### 7.2. UC-AUTH-04 — Decision OTP vs email reset

- **Role:** Tất cả vai trò
- **Mockup ref:** `wms_mockups_4.html:486-540`
- **Trạng thái hiện tại:** [`src/app/auth/forgot-password/page.tsx:1-486`](src/app/auth/forgot-password/page.tsx) ĐÃ implement OTP flow. **Mockup yêu cầu** email link (gửi link đặt lại MK qua email).

#### Pre-requisite

Hỏi stakeholder:
- (A) Giữ OTP (đã làm) — UX nhanh hơn, không cần SMTP wire phức tạp
- (B) Đổi sang email link — đúng mockup, nhưng cần SMTP ổn định
- (C) Cả 2 — user chọn method (more complex)

#### Bước fix (assuming option B/C được chọn)

**Bước 1:** Tạo endpoint `/api/auth/forgot-password/send-link/route.ts`:
```typescript
const token = crypto.randomBytes(32).toString("hex");
const expires = new Date(Date.now() + 60 * 60 * 1000);  // 1h
await prisma.passwordResetToken.create({ data: { user_id, token, expires } });
const link = `https://188.166.210.73/wms/auth/reset-password?token=${token}`;
await sendMail(user.email, "Đặt lại mật khẩu WMS", `<a href="${link}">Click để đặt lại</a>`);
```

**Bước 2:** Tạo page `/auth/reset-password?token=...` — verify token + form 2 ô MK mới + nút "Đặt lại MK".

**Bước 3:** Migration thêm bảng `password_reset_tokens` (nếu chưa có).

#### File đụng (option B)
- `src/app/api/auth/forgot-password/send-link/route.ts` ⭐ NEW
- `src/app/auth/reset-password/page.tsx` ⭐ NEW
- `prisma/schema.prisma` thêm `PasswordResetToken`

**Effort:** 3h (option B).

**🔒 Status: BLOCKED — pending Stakeholder decision.**

---

### 7.3. UC-PAL-01 — Mobile UI + format mã PLYYMMDD.STT (refactor)

- **Role:** Thủ kho
- **Mockup ref:** `wms_mockups_4.html:1011-1090`
- **Trạng thái hiện tại:** Đã có `/thukho/pallet/page.tsx` + `/new/page.tsx`. Wave 1 đã verify format. Wave 6 = polish toàn diện mobile UI.

> **Lý do tách sang Wave 6:** Khi nào Wave 1-5 xong, đo lại impact: nếu UI hiện tại đã pass visual test thì skip; nếu cần refactor lớn (vd 3-tab pill, KPI grid) thì làm.

#### Bước fix (nếu cần)

**Bước 1:** Verify `/thukho/pallet/page.tsx` có:
- 3 tab: "Đang xử lý (N)" · "Đã xác nhận (M)" · "Đã vào vị trí"
- Card với border-left status color
- FAB "+ Tạo" trên topbar

**Bước 2:** Verify `/thukho/pallet/new/page.tsx`:
- Field mã pallet disabled, pre-fill PL260525.012 (next available)
- Dropdown "Liên kết với phiếu nhập (tùy chọn)"
- Textarea ghi chú
- Helper text: 'Pallet sẽ ở trạng thái "Đang kiểm đếm"...'

**Bước 3:** Nếu UI hiện tại đã sát mockup → SKIP, mark UC done.

#### Acceptance
- [ ] Mobile thực tế: 3 tab pill hoạt động
- [ ] Tạo pallet sinh mã đúng PLYYMMDD.STT (Wave 1 đã verify)
- [ ] UX flow mượt: tạo → chuyển sang [id] để thêm dòng

**Effort:** 2h (mostly polish).

---

### 7.4. Tổng Wave 6

| UC | Effort | Blocker |
|---|---|---|
| UC-FK-05 | 4h | 🔒 Tech Lead review |
| UC-AUTH-04 | 3h | 🔒 Stakeholder decision |
| UC-PAL-01 polish | 2h | — |

**Tổng Wave 6: ~9h (1 ngày, nhưng phụ thuộc unblock).**

---

<a id="8-tổng-kết"></a>

## 8. 📅 TỔNG KẾT & SPRINT PLAN

### 8.1. Effort tổng

| Wave | UC count | Effort | Tỷ trọng |
|---|---|---|---|
| Wave 1 — Quick wins | 4 | 5.25h | 7% |
| Wave 2 — Reusable components | 3 | 7.5h | 11% |
| Wave 3 — Camera scan | 2 | 6h | 9% |
| Wave 4 — Workflow chuẩn hóa | 5 | 22h | 32% |
| Wave 5 — Charts + Drill-down | 4 | 15h | 22% |
| Wave 6 — Protected & Decision | 3 | 9h | 13% |
| **Tổng** | **20** | **~65h (~8 ngày)** | **100%** |

### 8.2. Sprint plan đề xuất

#### Sprint 1 (1 tuần — 5 ngày người) — Quick wins + foundations

| Day | Task | UC |
|---|---|---|
| Day 1 AM | Wave 1 toàn bộ | UC-IN-05, UC-MD-05, UC-PAL-01, UC-FK-01 |
| Day 1 PM | UC-INT-01 setup | BarcodeScanner reusable |
| Day 2 | UC-INT-02 + UC-SYS-01 | ImageUpload + Logo upload |
| Day 3 | Wave 3 toàn bộ | UC-PAL-03, UC-INV-06 |
| Day 4-5 | UC-MD-01, UC-MD-02 | Master Data CRUD + chuẩn hóa |
| **Output Sprint 1** | **9 UC fix · ~30h** | Total **30/53 UC** (57%) |

#### Sprint 2 (1 tuần) — Workflow lớn

| Day | Task | UC |
|---|---|---|
| Day 6 | UC-INTMP-02 wizard | Dropdown chuẩn hóa |
| Day 7 | UC-INV-07 trang KK theo mã | Plus UC-IN-06 wire |
| Day 8 | Install recharts + UC-OUT-02 chart | Bar + Pie chart |
| Day 9 | UC-INV-01.B drill-down | Page mới |
| Day 10 | UC-DASH-01 + UC-DASH-02 | Role-based + Manager |
| **Output Sprint 2** | **6 UC fix · ~28h** | Total **36/53 UC** (68%) |

#### Sprint 3 (4 ngày) — Polish + Protected

| Day | Task | UC |
|---|---|---|
| Day 11 | Wait Tech Lead review UC-FK-05 | (pending) |
| Day 12 | Stakeholder decision AUTH-04 | (pending) |
| Day 13-14 | UC-FK-05 + UC-AUTH-04 (após decision) | Implement |
| Day 14 | UC-PAL-01 polish + bug wms-thukho | (pending) |
| **Output Sprint 3** | **3 UC + 1 bug** | Total **39/53 UC + Phase 0 complete** |

### 8.3. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `html5-qrcode` không chạy trên HTTP (chỉ HTTPS) | 🔴 High | VPS đã có HTTPS (188.166.210.73), test trước trên dev qua `localhost` (allowed by browser exception) |
| Recharts bundle size +150KB | 🟡 Medium | Code-split: dynamic import `recharts` chỉ ở page dashboard/report (next/dynamic) |
| UC-FK-05 Tech Lead không review kịp | 🟡 Medium | Chuẩn bị PR sẵn với test plan + screenshot demo, tag ngay từ Sprint 2 |
| File mẫu Excel Unilever không có | 🔴 High | Tạo mock data 142 dòng trong Sprint 1, test BE parser; nếu user có file thật sau → swap dễ |
| Migration role-based dashboard phá flow cũ | 🟡 Medium | Feature flag `NEXT_PUBLIC_NEW_DASHBOARD=true` để toggle, rollback nhanh |
| Browser permission camera bị deny | 🟡 Medium | UX có fallback "Nhập tay" + thông báo bật permission |

### 8.4. Acceptance toàn dự án

Khi hoàn thành 3 Sprint trên:
- [ ] **39/53 UC khớp mockup** (74%) — còn 14 UC originally PASS từ phase trước
- [ ] Tất cả 4 PM2 instance HTTP 200
- [ ] Smoke test E2E 30+ UC qua Cốc Cốc + Claude in Chrome
- [ ] PR review + merge vào `main`
- [ ] Update [`BAO_CAO_TONG_KET_TOAN_SESSION_2026-05-25.md`](BAO_CAO_TONG_KET_TOAN_SESSION_2026-05-25.md) với số liệu mới
- [ ] Bug `wms-thukho routing` (#5) đã fix bằng rebuild instance

### 8.5. Commit strategy

```
feat(W1): UC-IN-05 stepper + UC-MD-05 sơ đồ + UC-PAL-01 verify + UC-FK-01 cards
feat(W2): component BarcodeScanner + ImageUpload reusable + UC-SYS-01 logo upload
feat(W3): UC-PAL-03 scan thêm dòng + UC-INV-06 scan KK vị trí
feat(W4): UC-MD-01 polish + UC-MD-02 chuẩn hóa + UC-INTMP-02 wizard
feat(W4): UC-INV-07 KK theo mã + UC-IN-06 wire Excel Unilever
feat(W5): install recharts + UC-OUT-02 chart + UC-INV-01.B drill-down
feat(W5): UC-DASH-01 role-based + UC-DASH-02 manager page
feat(W6): UC-FK-05 audit log [PROTECTED]
feat(W6): UC-AUTH-04 email link reset [DECISION-A]
chore: deploy + smoke test toàn 4 instance
docs: update BAO_CAO_TONG_KET với 39/53 UC
```

> Mỗi commit 1 hoặc 2 UC, deploy + verify từng commit → rollback dễ.

---

## 9. 📚 PHỤ LỤC — DANH SÁCH FILE SẼ TẠO MỚI

```
src/components/shared/
├── BarcodeScanner.tsx           ⭐ Wave 2
├── BarcodeScannerModal.tsx      ⭐ Wave 2
├── ImageUpload.tsx              ⭐ Wave 2
└── ProductPicker.tsx            ⭐ Wave 4

src/components/dashboard/
├── AccountingDashboard.tsx      ⭐ Wave 5
└── KiemkeMobileDashboard.tsx    ⭐ Wave 5

src/components/kiemke/
└── KiemkeByItemView.tsx         ⭐ Wave 4

src/app/dashboard/manager/
└── page.tsx                     ⭐ Wave 5

src/app/inventory/by-sku/[code]/locations/
└── page.tsx                     ⭐ Wave 5

src/app/api/dashboard/manager-kpi/
└── route.ts                     ⭐ Wave 5

src/app/auth/reset-password/     (optional - decision UC-AUTH-04)
└── page.tsx                     ⭐ Wave 6

src/app/api/auth/forgot-password/send-link/   (optional)
└── route.ts                     ⭐ Wave 6

prisma/
├── seed-excel-unilever.ts       ⭐ Wave 4 (mock data)
└── migrations/.../password_reset_tokens.sql  (optional Wave 6)

public/templates/
└── HangUVe_template.xlsx        ⭐ Wave 4
```

**Tổng file mới:** ~12-15 file (tùy decision UC-AUTH-04 và UC-PAL-01 cần refactor không).

---

## 10. ✅ CHECKLIST TRƯỚC KHI BẮT ĐẦU

- [ ] Đọc lại `docs/ARCHITECTURE.md`, `docs/CRITICAL_PATHS.md`, `docs/API_CONTRACTS.md`
- [ ] Verify VPS 4/4 PM2 instance HTTP 200
- [ ] Verify `prisma migrate diff` empty (DB schema in sync)
- [ ] Cài `recharts`: `npm install recharts`
- [ ] Tag Tech Lead trên Slack/PR cho UC-FK-05
- [ ] Hỏi Stakeholder decision UC-AUTH-04 (OTP vs email link)
- [ ] Xin file mẫu Excel Unilever từ user (UC-IN-06)
- [ ] Tạo feature branch mới: `feat/phase1-19-uc-wave1` (per Wave hoặc per UC)
- [ ] Set up Cốc Cốc + Claude in Chrome cho visual verify

---

**HẾT KẾ HOẠCH.**

> **Tác giả:** Claude (Opus 4.7 1M context)
> **Ngày tạo:** 2026-05-25
> **Cập nhật cuối:** 2026-05-25
> **Liên hệ:** technology.lamphongtech@gmail.com (user) · #wms-dev (Slack)

# BÁO CÁO LỖI — Màn hình PALLET (Chi tiết & Tạo mới)

> **Ngày:** 2026-05-28
> **Người báo:** Người dùng (Quản lý) — qua 2 screenshot
> **Người phân tích:** Claude (đối chiếu code repo)

---

## TÓM TẮT 2 LỖI

| # | Màn hình | Lỗi | Mức độ | File ảnh hưởng |
|---|---|---|---|---|
| **L1** | `/pallets/[id]` — Chi tiết pallet | Ô **SL THÙNG** trên bảng dòng hàng KHÔNG sửa được — user phải xóa và thêm lại dòng | 🟠 Cao (UX) | `src/app/pallets/[id]/page.tsx` + thiếu endpoint PATCH line |
| **L2** | `/pallets` modal "Tạo pallet mới" | Toast lỗi **"Không cho phép Ngày nhập quá 30 ngày trong tương lai"** spam ~12 lần liên tiếp | 🟠 Cao (UX) | `src/app/pallets/page.tsx:151-166` |

---

## LỖI L1 — Ô SL THÙNG không nhập được

### 1. Hiện trạng (theo screenshot 1)

- Trang: `https://188.166.210.73/wms/pallets/[id]` (cụ thể: `PALLET PL260528.003`)
- Tab "HÀNG HÓA (1)" hiển thị bảng với cột: `# / MÃ HÀNG / TÊN / SL THÙNG / LÔ / HSD / KG`
- Có 1 dòng: `UNI1112 · Bột năng · 1 · — · — · 0.0`
- User vẽ mũi tên đỏ vào ô `SL THÙNG` (giá trị `1`) và viết:
  > *"Muốn có một ô như này để nhập vào"*

### 2. Root cause (đối chiếu code)

**File:** `src/app/pallets/[id]/page.tsx` (line 552–570)

```tsx
pallet.lines.map((line, idx) => (
  <tr key={line.id} ...>
    <td className="px-4 py-2.5">{idx + 1}</td>
    <td>{line.item_code.code}</td>
    <td>{line.item_code.short_name}</td>
    <td className="px-4 py-2.5 text-right font-semibold">{Number(line.qty_box)}</td>  ← CHỈ HIỂN THỊ TEXT, KHÔNG PHẢI INPUT
    <td>{line.lot || "—"}</td>
    <td>{formatDate(line.expiry_date)}</td>
    <td>{Number(line.weight_kg).toFixed(1)}</td>
    <td>
      {canEdit && <button onClick={() => handleDeleteLine(line.id)}>Xóa</button>}
    </td>
  </tr>
))
```

→ Mỗi `<td>` đều là text rendering. **Không có input ô nào trong bảng**.

**File:** `src/app/api/pallets/[id]/lines/[lineId]/route.ts`
- Chỉ có method `DELETE` (xóa dòng).
- **Không có method `PATCH`** để sửa qty_box / lot / expiry_date / note.

### 3. Hậu quả nghiệp vụ

- Thủ kho khi đếm sai (vd: gõ 1 thay vì 10) → **phải xóa hẳn dòng, thêm lại từ đầu** với mã hàng, lô, HSD, ghi chú.
- Mất thời gian, dễ sai sót.
- Mất audit history của dòng cũ.

### 4. Yêu cầu fix (đề xuất)

#### A. Frontend
- Cột `SL THÙNG`, `LÔ`, `HSD`, `GHI CHÚ` cho phép **edit inline** (click vào ô → biến thành input → blur/Enter để save).
- Khi pallet ở status `EMPTY` hoặc `COUNTING` → cho edit; status khác → readonly.
- Hiển thị icon ✓/✗ khi đang save / lỗi.
- Auto-cập nhật `weight_kg` của line theo `qty_box × weight_per_box`.

#### B. Backend
- Thêm `PATCH /api/pallets/[id]/lines/[lineId]` nhận body:
  ```json
  { "qty_box": number?, "lot": string?, "expiry_date": string?, "manufactured_date": string?, "note": string? }
  ```
- Validate: chỉ cho phép sửa khi `pallet.status ∈ {EMPTY, COUNTING}`.
- Recalc `pallet.total_weight_kg` sau update.
- Ghi audit log với `old_value` + `new_value` (dùng helper `logAudit` đã có).

#### C. UX bổ sung
- Thêm cột "GHI CHÚ" (hiện đang ẩn, chỉ có ở form thêm dòng) → để Quản lý/Thủ kho note inline.
- Khi qty_box thay đổi → recalc cả `qty_unit` = qty_box × pack_size (lookup từ item_code) nếu có.

### 5. Test case dự kiến

| TC | Bước | Expected |
|---|---|---|
| TC_EDIT_LINE_001 | Pallet status EMPTY → click ô SL thùng → gõ 10 → Enter | qty_box=10, total_weight_kg recalc, audit log có entry EDIT_PALLET_LINE |
| TC_EDIT_LINE_002 | Pallet status IN_STORAGE → ô SL không thể click (readonly) | Input bị disable, hover hiện tooltip "Pallet đã xếp — không sửa được" |
| TC_EDIT_LINE_003 | Gõ qty_box = 0 hoặc âm | Toast error "SL thùng phải > 0" |
| TC_EDIT_LINE_004 | Gõ qty_box = "abc" | Input chỉ accept số, validate min=0.01 |
| TC_EDIT_LINE_005 | Đổi qty_box → backend lỗi 500 | Toast error + rollback giá trị về cũ |

---

## LỖI L2 — Toast "30 ngày tương lai" spam

### 1. Hiện trạng (theo screenshot 2)

- Trang: `https://188.166.210.73/wms/pallets` — modal "TẠO PALLET MỚI"
- Field "NGÀY NHẬP HÀNG": user gõ `30/06/2026`
- Today: `28/05/2026` → khoảng cách = **33 ngày tương lai** → vượt ngưỡng 30 ngày
- **Bên phải màn hình hiện ~12 toast đỏ giống hệt nhau** nối tiếp dọc theo trục y:
  > "Không cho phép Ngày nhập quá 30 ngày trong tương lai."

### 2. Root cause (đối chiếu code)

**File:** `src/app/pallets/page.tsx:151-166`

```tsx
const handleCreate = async (e: React.FormEvent) => {
  e.preventDefault();
  if (form.inbound_date) {
    const d = new Date(form.inbound_date);
    const year = d.getUTCFullYear();
    if (Number.isNaN(d.getTime()) || year < 2020 || year > 2100) {
      toast.error("Ngày nhập không hợp lệ. Năm phải nằm trong 2020 – 2100.");
      return;
    }
    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 30);
    if (d.getTime() > maxAllowed.getTime()) {
      toast.error("Không cho phép Ngày nhập quá 30 ngày trong tương lai.");
      return;  // ← chỉ return, KHÔNG dedupe toast
    }
  }
  setSaving(true);
  ...
};
```

Phân tích nguyên nhân spam ~12 toast:
1. **Toast hệ thống không có dedupe** — mỗi lần `toast.error()` gọi sẽ push 1 toast mới vào queue, dù message giống hệt.
2. **User có khả năng spam phím Enter** trong khi gõ ngày → form submit nhiều lần → mỗi submit fail tạo 1 toast.
3. **Input `type="date"` có thể fire 2-3 onChange events** khi user gõ từng số (vd: gõ "30" → ngày 30 hợp lệ → "30/06" → "30/06/2026") — không liên quan validate nhưng có thể trigger blur/submit phụ tùy browser.
4. **Không disable nút submit** khi đang validate — user có thể bấm liên tục.
5. **Không có HTML5 `max` attribute trên `<input type="date">`** → browser không tự block ngày quá xa.

### 3. Hậu quả

- Toast chồng nhau che hết phải màn hình (12 toast × ~60px = ~720px).
- User không thể đóng nhanh → phải đợi auto-dismiss.
- Trông như app bị crash.
- Nếu user gõ tiếp ngày khác → toast cũ vẫn đang hiển thị → tích lũy thêm.

### 4. Yêu cầu fix (đề xuất)

#### A. Frontend — Modal tạo pallet
1. **Validate sớm trên `onChange`** thay vì chỉ ở submit:
   ```tsx
   const onDateChange = (val: string) => {
     setForm({ ...form, inbound_date: val });
     // Inline error, không toast
     if (val) {
       const d = new Date(val);
       const maxAllowed = new Date();
       maxAllowed.setDate(maxAllowed.getDate() + 30);
       if (d > maxAllowed) setDateError("Không cho phép Ngày nhập quá 30 ngày trong tương lai.");
       else setDateError(null);
     } else setDateError(null);
   };
   ```
2. **Hiển thị lỗi inline ngay dưới input** (red text) — không dùng toast.
3. **Disable nút "Tạo pallet"** khi có `dateError`.
4. **Thêm HTML5 `max` attribute** = today + 30 ngày → browser tự reject:
   ```tsx
   const maxDateStr = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
   <input type="date" max={maxDateStr} ... />
   ```
5. Bỏ toast.error trong `handleCreate` cho case ngày tương lai vì đã được chặn ở UI level. (Giữ check làm safety net nhưng không gọi toast nếu inline error đã active.)

#### B. Toast system — dedupe
- Toast component cần có cơ chế dedupe: nếu 2 toast cùng message active đồng thời thì gộp lại + show counter (×12).
- Hoặc throttle: tối đa 1 toast cùng message trong 3 giây.
- Đây là fix nền tảng — sẽ ảnh hưởng nhiều màn hình khác.

#### C. UX bổ sung
- Thêm hint dưới input "Mặc định hôm nay; cho phép tương lai tối đa 30 ngày."
- Auto-fill `inbound_date` = `today` khi mở modal nếu chưa link PHN.

### 5. Test case dự kiến

| TC | Bước | Expected |
|---|---|---|
| TC_PAL_DATE_001 | Mở modal tạo pallet, gõ ngày 31 ngày tương lai | Input border đỏ + inline error dưới input, KHÔNG có toast |
| TC_PAL_DATE_002 | Gõ ngày 31 ngày tương lai, bấm "Tạo pallet" | Nút bị disable, không submit |
| TC_PAL_DATE_003 | Gõ ngày hợp lệ → ngày sai → ngày hợp lệ | Toast không xuất hiện, chỉ inline error toggle |
| TC_PAL_DATE_004 | Gõ ngày sai, bấm Enter 10 lần | Toast hệ thống tối đa 1 toast (do dedupe) hoặc 0 toast (do nút disabled) |
| TC_PAL_DATE_005 | Browser hỗ trợ `<input max>` → user mở date picker | Không chọn được ngày > today + 30 |

---

## ƯỚC LƯỢNG EFFORT

| Phần | File | Effort |
|---|---|---|
| L1.A Frontend inline edit | `src/app/pallets/[id]/page.tsx` (cải tạo 4 cột thành input) | 4-6h |
| L1.B API PATCH line | `src/app/api/pallets/[id]/lines/[lineId]/route.ts` (thêm PATCH) | 2h |
| L1.C Mobile thủ kho tương đương | `src/app/thukho/pallet/[id]/page.tsx` | 3h |
| L2.A Modal tạo pallet — inline error + max attr | `src/app/pallets/page.tsx` | 1h |
| L2.B Toast dedupe (option) | `src/components/ui/toast.tsx` | 2h |
| Migration & test | — | 2h |
| **TỔNG** | | **~14-16h (~2 ngày)** |

---

## ĐỀ XUẤT THỨ TỰ FIX

1. **Ưu tiên 1 — Fix L2 modal date** (1h, blocking nhiều user)
2. **Ưu tiên 2 — Fix L1 inline edit qty_box** (4-6h, ảnh hưởng nghiệp vụ thủ kho)
3. **Ưu tiên 3 — Fix L1 mobile thủ kho tương đương** (3h, đồng bộ desktop/mobile)
4. **Ưu tiên 4 — Toast dedupe** (2h, nền tảng)

---

> **Sau khi user duyệt báo cáo, sẽ bắt đầu fix theo thứ tự trên. Mỗi lỗi sẽ commit riêng + deploy + báo lại.**

— **End of report —**

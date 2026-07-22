# BÁO CÁO BUG: Pallet link PHN nhưng KHÔNG tự load danh sách hàng

**Ngày:** 2026-05-27
**Mức độ:** 🟠 **HIGH** — ảnh hưởng UX vận hành thủ kho
**UC liên quan:** UC-PAL-01 (Tạo pallet) · UC-PAL-02 (Thêm dòng) · UC-IN-02 (Tiếp nhận phiếu)
**Tác động:** Thủ kho phải gõ thủ công 2 lần data đã có sẵn → tốn thời gian, dễ sai.

---

## 1. Mô tả vấn đề (lời người dùng)

> Thủ kho/admin tạo pallet liên kết phiếu nhập → liên kết xong → mở xem pallet KHÔNG hiển thị hàng như trong phiếu yêu cầu nhập. Tao muốn là liên kết là phải hiện thị danh sách sản phẩm luôn ở trong pallet.

### Hiện trạng (sai UX)

```
[1] Kế toán tạo PHN-2026-0042 với 3 dòng hàng dự kiến:
       - VG-NM-001 · 200 chai
       - VG-TT-002 · 150 hũ
       - VG-DG-003 · 100 chai
        │
        ▼
[2] Thủ kho tạo pallet PL260527.010 → link PHN-2026-0042
        │  ✅ DB lưu pallet.inbound_request_id = PHN-2026-0042
        ▼
[3] Mở pallet detail
        │  ❌ TAB "Hàng hóa" RỖNG — "Chưa có hàng hóa trong pallet"
        │  ❌ Thủ kho phải tự gõ lại từng dòng:
        │     - Search "VG-NM-001" → chọn → gõ 200 → Lưu
        │     - Search "VG-TT-002" → chọn → gõ 150 → Lưu
        │     - Search "VG-DG-003" → chọn → gõ 100 → Lưu
        ▼
[4] Mất ~3-5 phút gõ lại + RỦI RO gõ sai SL, chọn nhầm mã
```

### Kỳ vọng (đúng UX)

```
[3'] Mở pallet detail
        │  ✅ Tab "Hàng hóa" hiện 3 dòng **TỰ ĐỘNG** từ PHN:
        │     - VG-NM-001 · DK: 200 chai · TN: [_____] (trống, chờ điền)
        │     - VG-TT-002 · DK: 150 hũ · TN: [_____]
        │     - VG-DG-003 · DK: 100 chai · TN: [_____]
        │  ✅ Thủ kho chỉ cần GÕ SỐ LƯỢNG THỰC tế cho từng dòng
        ▼
[4'] Mất ~30s, không sai mã hàng
```

---

## 2. Phân tích kỹ thuật

### 2.1 Hành vi backend hiện tại

**File:** [src/app/api/pallets/route.ts:88-158](src/app/api/pallets/route.ts#L88)

```typescript
// POST /api/pallets — Tạo pallet mới
export async function POST(req: NextRequest) {
  const { supplier_id, inbound_request_id, ... } = body;

  // ✅ Validate PHN tồn tại + auto-fill supplier
  if (inbound_request_id) {
    const ir = await prisma.inboundRequest.findUnique({...});
    if (!resolvedSupplierId && ir.supplier_id) resolvedSupplierId = ir.supplier_id;
  }

  // ❌ Chỉ tạo Pallet, KHÔNG đụng đến InboundLine
  const pallet = await prisma.$transaction(async (tx) => {
    return tx.pallet.create({
      data: {
        code, code_date, code_seq,
        status: "COUNTING",
        supplier_id, inbound_request_id,
        inbound_date, note
      }
    });
  });
}
```

→ **POST chỉ tạo Pallet row, không touch PalletLine**. Pallet sinh ra rỗng.

### 2.2 Data có sẵn từ InboundLine

**Schema** [prisma/schema.prisma:429-448](prisma/schema.prisma#L429):

```prisma
model InboundLine {
  id                 String   @id
  inbound_request_id String   @db.Uuid
  item_code_id       String   @db.Uuid    // ← copy được sang PalletLine
  qty_expected       Decimal                 // ← copy thành qty_box của Pallet
  qty_received       Decimal?                // ← thủ kho điền sau
  qty_accepted       Decimal?
  lot                String?                 // ← copy được sang PalletLine
  expiry_date        DateTime?               // ← copy được sang PalletLine
  note               String?
}
```

→ InboundLine đã có **đủ field** để pre-populate PalletLine.

### 2.3 Mapping InboundLine → PalletLine

| InboundLine field | PalletLine field | Action |
|---|---|---|
| `item_code_id` | `item_code_id` | Copy 1-1 |
| `qty_expected` | `qty_box` | Copy → thủ kho sẽ chỉnh nếu thực tế khác |
| `lot` | `lot` | Copy (có thể NULL) |
| `expiry_date` | `expiry_date` | Copy (có thể NULL) |
| `note` | `note` | Copy hoặc bỏ |
| — | `weight_kg` | Tự tính = qty_box × ItemCode.weight_per_box |
| — | `qty_unit` | = qty_box (tạm 1:1) |

→ Mapping straightforward, không cần migration schema.

---

## 3. Vì sao bug này tồn tại?

### Nguyên nhân thiết kế ban đầu
Có thể team trước đó nghĩ rằng:
- 1 pallet có thể **chỉ chứa MỘT PHẦN** hàng của PHN (vd: PHN có 200 thùng → chia 2 pallet 100 mỗi)
- 1 PHN có thể **chia thành NHIỀU pallet** (vận hành thực tế: thủ kho gom hàng vào nhiều pallet vật lý)
- Vì vậy **không thể copy y nguyên** InboundLine → PalletLine 1-1

→ Nên BE để TRỐNG, để thủ kho tự thêm dòng linh hoạt.

### Vấn đề của hướng tiếp cận hiện tại
- **Lý thuyết đúng** (1 PHN → nhiều pallet), nhưng **UX kém**: thủ kho phải gõ lại 100% dữ liệu đã có
- 90% case thực tế: PHN không quá lớn, 1 pallet đủ chứa toàn bộ → copy y nguyên là OK
- 10% case lớn: chia nhiều pallet → cần UX "chia hàng"

→ Cần **giải pháp linh hoạt**: pre-fill 100% lines từ PHN, cho phép thủ kho **xoá bớt** hoặc **giảm SL** nếu chia pallet.

---

## 4. Đề xuất 3 phương án fix

### 🥇 Phương án A: Auto-create lines khi tạo pallet (đơn giản nhất)

**Logic:** Khi POST `/api/pallets` có `inbound_request_id` → trong cùng transaction, BE đọc `InboundLine[]` của phiếu đó → tạo `PalletLine[]` tương ứng với `qty_box = qty_expected`.

**Pseudo-code:**
```typescript
if (inbound_request_id) {
  const lines = await tx.inboundLine.findMany({
    where: { inbound_request_id },
    include: { item_code: { select: { weight_per_box: true } } },
  });

  // Pre-create PalletLine từ InboundLine
  for (const line of lines) {
    const weightKg = Number(line.qty_expected) * Number(line.item_code.weight_per_box || 0);
    await tx.palletLine.create({
      data: {
        pallet_id: newPallet.id,
        item_code_id: line.item_code_id,
        qty_box: line.qty_expected,
        qty_unit: line.qty_expected,
        lot: line.lot,
        expiry_date: line.expiry_date,
        weight_kg: weightKg,
      },
    });
  }

  // Cập nhật total_lines + total_weight_kg trên Pallet
  await tx.pallet.update({...});
}
```

**Ưu:**
- ✅ Đơn giản — chỉ sửa 1 endpoint
- ✅ UX tốt nhất cho case 90%
- ✅ Không cần thêm endpoint mới

**Nhược:**
- ❌ Case "1 PHN → nhiều pallet" khó: pallet thứ 2 cũng auto-load → trùng. Cần check & cảnh báo.
- ❌ Nếu thủ kho không muốn load → không có cách opt-out

**Giải quyết nhược:**
- Thêm option `auto_populate_lines: true/false` trong POST body (default `true`)
- Khi tạo pallet thứ 2 cho cùng PHN → BE check existing PalletLine của các pallet khác cùng PHN → giảm bớt qty hoặc cảnh báo

### 🥈 Phương án B: Endpoint riêng "Sync from inbound"

**Logic:** Tạo pallet rỗng như cũ. Thêm nút "Tải hàng từ PHN" trong pallet detail → POST `/api/pallets/[id]/sync-from-inbound` → BE copy InboundLine → PalletLine.

**Ưu:**
- ✅ Linh hoạt: thủ kho chủ động chọn lúc nào load
- ✅ Có thể chọn lines nào load (UI checkbox)
- ✅ Re-sync nếu PHN sửa sau

**Nhược:**
- ❌ Thêm 1 endpoint + 1 nút UI
- ❌ Thủ kho phải nhớ bấm — nếu quên → quay lại vấn đề cũ

### 🥉 Phương án C: UI "Lấy hàng từ phiếu" inline trong dropdown

**Logic:** Trong khung "Thêm hàng vào pallet" của pallet detail (mobile), nếu pallet đã link PHN + chưa có line → hiện sẵn list InboundLine kèm checkbox "Chọn tất cả" + nút "Thêm vào pallet".

**Ưu:**
- ✅ UX rõ ràng: thủ kho thấy danh sách trước, chọn rồi bấm thêm
- ✅ Vẫn linh hoạt
- ✅ Re-use UI search existing

**Nhược:**
- ❌ Phức tạp nhất về UI
- ❌ Cần thêm endpoint GET `/api/inbound/[id]/available-lines` (trả lines chưa được link pallet nào)

---

## 5. So sánh 3 phương án

| Tiêu chí | A (Auto-create) | B (Sync button) | C (Inline UI) |
|---|---|---|---|
| **Effort** | 🟢 ~1h (1 file) | 🟡 ~3h (2 file + 1 nút UI) | 🔴 ~5h (3 file + UI lớn) |
| **UX cho thủ kho (case 90%)** | 🟢 Tốt nhất | 🟡 OK (1 lần bấm) | 🟡 OK |
| **Linh hoạt chia pallet** | 🟡 Cần xử lý cảnh báo | 🟢 Tốt | 🟢 Tốt nhất |
| **Risk khi PHN sửa sau** | 🔴 Data lệch | 🟢 Re-sync được | 🟢 Re-sync được |
| **Re-create pallet thứ 2 cho cùng PHN** | 🔴 Auto-tạo trùng line | 🟡 Manual sync | 🟢 Filter chỉ lines chưa pallet |

---

## 6. Khuyến nghị

### 🎯 Đề xuất: **Phương án A + thêm cảnh báo** (sau này upgrade B/C nếu cần)

**Lý do:**
- Case dùng thực tế 90% là 1 PHN → 1 pallet → A đủ tốt
- Nhanh deploy (~1h)
- Sau này nếu phát sinh case "chia pallet" → upgrade thêm endpoint sync hoặc UI inline

### Chi tiết implement Phương án A

1. **Sửa POST `/api/pallets`** ([src/app/api/pallets/route.ts:88-158](src/app/api/pallets/route.ts#L88)):
   - Trong transaction, sau khi tạo Pallet → đọc InboundLine của PHN → tạo PalletLine
   - Update `total_lines` + `total_weight_kg` trên Pallet
   - Body thêm option `auto_populate_lines` (default `true`)

2. **Cảnh báo khi tạo pallet thứ 2 cho cùng PHN:**
   - Trước khi auto-populate, count existing pallet với `inbound_request_id = X` và status != CANCELLED
   - Nếu count >= 1 → trả `warning` trong response: "Đã có pallet khác cho phiếu này, có thể trùng line"
   - FE hiện confirm modal: "PHN-X đã có pallet PL... — vẫn tạo?"

3. **API GET `/api/pallets/[id]`** đã include lines → không cần sửa

4. **UI desktop + mobile**: Không cần sửa gì — pallet detail tự nhiên hiện lines sau khi BE pre-populate

5. **Migration data cũ**: Không cần — chỉ áp dụng cho pallet tạo MỚI từ giờ

---

## 7. Edge cases cần lưu ý

| Trường hợp | Xử lý đề xuất |
|---|---|
| PHN có 0 line | Pallet tạo rỗng (như hiện tại) |
| PHN có line item_code đã ngừng hoạt động | Vẫn copy, BE không check is_active của ItemCode |
| Item_code có weight_per_box = NULL | weight_kg = 0, thủ kho điền sau |
| 1 PHN tạo nhiều pallet | Pallet thứ 2 cũng auto-fill → cảnh báo, user xác nhận hoặc bỏ qua |
| Tạo pallet sau khi PHN đã COMPLETED | Vẫn cho phép — vì pallet COUNTING chưa chốt tồn |
| Thủ kho không muốn auto-fill | Body POST gửi `auto_populate_lines: false` |

---

## 8. Câu hỏi cần leader quyết

| Câu hỏi | Lựa chọn |
|---|---|
| Auto-populate bật mặc định? | (a) ✅ ON / (b) OFF |
| Khi PHN có nhiều pallet → cảnh báo? | (a) ✅ Warn + cho phép / (b) Block tuyệt đối / (c) Tự skip lines đã linked |
| Pallet có thể xoá line đã auto-fill? | (a) ✅ Có (như thêm thủ công) / (b) Lock |
| Auto-populate cho cả desktop và mobile? | (a) ✅ Cả 2 / (b) Chỉ mobile |

**Đề xuất default:** (a, a, a, a) — bật toàn diện, cho phép linh hoạt.

---

## 9. Effort dự kiến

| Hạng mục | Thời gian |
|---|---|
| Sửa POST `/api/pallets` (Phương án A) | ~30 phút |
| Thêm cảnh báo "có pallet khác cùng PHN" | ~20 phút |
| FE confirm modal khi cảnh báo | ~30 phút |
| Test E2E | ~30 phút |
| Deploy 4 instance | ~5 phút |
| **Tổng** | **~2 giờ** |

---

## 10. Tóm tắt 1 phút cho leader

| | |
|---|---|
| **Vấn đề** | Pallet link PHN nhưng không tự load danh sách hàng → thủ kho phải gõ lại |
| **Nguyên nhân** | POST `/api/pallets` chỉ lưu link, không tạo PalletLine từ InboundLine |
| **Phương án đề xuất** | **A — Auto-create lines** trong cùng transaction tạo pallet |
| **Effort** | ~2 giờ |
| **Cần leader quyết** | Auto-populate default ON/OFF? Cảnh báo khi >1 pallet/PHN? |

Mày confirm phương án A + 4 default → tao bắt tay làm + deploy.

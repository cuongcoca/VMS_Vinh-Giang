# BÁO CÁO BUG: Tạo Pallet KHÔNG link với Phiếu yêu cầu nhập (PHN)

**Ngày:** 2026-05-27
**Mức độ:** 🔴 **CRITICAL** — ảnh hưởng nghiệp vụ cốt lõi
**UC liên quan:** UC-PAL-01 (Tạo pallet) · UC-PAL-02 (Thêm dòng) · UC-IN-02 (Tiếp nhận phiếu)
**Người gặp:** Thủ kho, Kế toán kho, Quản lý

---

## 1. Mô tả vấn đề (lời người dùng)

> Cái tạo pallet chưa liên kết với phiếu yêu cầu nhập. Không liên kết thì nó không ra được hàng hóa nhập vào pallet.

### Hiện trạng (sai)

```
[1] Kế toán tạo phiếu PHN-2026-0042 (5 mã hàng dự kiến từ NCC An Phú)
        │
        ▼
[2] Thủ kho nhận hàng từ NCC, tiếp nhận phiếu → status RECEIVING
        │
        ▼
[3] Thủ kho vào /pallets bấm "Tạo pallet" (desktop) → tạo PL260527.005
        │  ❌ KHÔNG có ô chọn PHN → pallet "trôi nổi", inbound_request_id = NULL
        ▼
[4] Thủ kho vào pallet PL260527.005 → Thêm dòng hàng → gõ tên hàng
        │  ❌ Search toàn bộ ItemCode trong DB → ra cả hàng KHÔNG thuộc PHN-2026-0042
        ▼
[5] Thủ kho chọn nhầm hàng từ phiếu khác → pallet sai data
```

### Kỳ vọng (đúng)

```
[3'] Khi tạo pallet → BẮT BUỘC chọn PHN → pallet.inbound_request_id = PHN-2026-0042
[4'] Khi thêm dòng → search CHỈ trong hàng thuộc PHN đó → giảm lỗi nhập sai
```

---

## 2. Phân tích kỹ thuật — 6 điểm BROKEN

### ✅ Đã tốt

| # | Điểm | File | Status |
|---|---|---|---|
| 1 | **Schema có `Pallet.inbound_request_id`** | [prisma/schema.prisma:266](prisma/schema.prisma#L266) | ✅ FK + relation `inbound_request` đầy đủ |
| 2 | **API POST /api/pallets nhận `inbound_request_id`** | [src/app/api/pallets/route.ts:108-132](src/app/api/pallets/route.ts#L108) | ✅ Validate phiếu tồn tại + auto-fill supplier_id từ phiếu |
| 3 | **Mobile thủ kho có form chọn PHN** | [src/app/thukho/pallet/new/page.tsx:104-120](src/app/thukho/pallet/new/page.tsx#L104) | ✅ Dropdown load từ `/api/inbound?status=PENDING` |

### ❌ Bị thiếu (gây ra bug)

#### **🔴 [HIGH] #4 — Desktop form tạo pallet thiếu chọn PHN**
- **File:** [src/app/pallets/page.tsx:92-96](src/app/pallets/page.tsx#L92)
- **Vấn đề:** Modal "Tạo pallet" trên desktop chỉ có 3 field:
  ```tsx
  body: JSON.stringify({
    supplier_id: form.supplier_id || null,
    inbound_date: form.inbound_date || null,
    note: form.note || null,
  }),
  ```
- **Thiếu:** Không có dropdown chọn PHN, không truyền `inbound_request_id` → API nhận `null` → pallet trôi nổi
- **Tác động:** Kế toán/Quản lý tạo pallet trên desktop **luôn** tạo pallet không link PHN

#### **🔴 [HIGH] #5 — API search ItemCode không filter theo PHN**
- **File:** [src/app/api/item-codes/route.ts:17-28](src/app/api/item-codes/route.ts#L17)
- **Vấn đề:** Endpoint `GET /api/item-codes?q=...` trả TOÀN BỘ ItemCode trong DB
- **Thiếu:** Không có param `?inbound_request_id=...` để filter theo `InboundLine` của phiếu đó
- **Tác động:** Khi thủ kho thêm dòng vào pallet (đã link PHN), vẫn search được hàng từ **mọi phiếu khác** → dễ nhầm

#### **🔴 [HIGH] #6 — Pallet detail không truyền `inbound_request_id` khi search**
- **File:** [src/app/thukho/pallet/[id]/page.tsx:103](src/app/thukho/pallet/[id]/page.tsx#L103)
- **Vấn đề:** Form "Thêm hàng vào pallet" search:
  ```tsx
  const res = await fetch(`${basePath}/api/item-codes?q=${encodeURIComponent(itemSearch)}`);
  ```
- **Thiếu:** Pallet đã có `inbound_request_id` nhưng UI không tận dụng → search toàn bộ
- **Tác động:** Thủ kho search được hàng KHÔNG thuộc phiếu của pallet này

#### **🟡 [MEDIUM] #7 — Inbound detail không có nút "Tạo pallet cho phiếu"**
- **File:** [src/app/inbound/[id]/page.tsx](src/app/inbound/[id]/page.tsx)
- **Vấn đề:** Sau khi phiếu chuyển RECEIVING, không có shortcut tạo pallet ngay
- **Thiếu:** Nút "📦 Tạo pallet cho phiếu này" link tới `/thukho/pallet/new?inbound_request_id=X`
- **Tác động:** Thủ kho phải nhớ tự vào `/thukho/pallet/new` rồi tìm phiếu trong dropdown — dễ quên link

#### **🟡 [MEDIUM] #8 — Mobile inbound detail chưa có nút tạo pallet**
- **File:** [src/app/thukho/inbound/[id]/page.tsx](src/app/thukho/inbound/[id]/page.tsx)
- **Vấn đề:** Khi phiếu RECEIVING, thủ kho cần tạo pallet để gom hàng — không có shortcut
- **Thiếu:** Nút "Tạo pallet mới" trong status RECEIVING với inbound_request_id pre-filled

#### **🟢 [LOW] #9 — Pallet list không hiển thị PHN liên kết**
- **File:** [src/app/thukho/pallet/page.tsx](src/app/thukho/pallet/page.tsx)
- **Vấn đề:** Card pallet trong list không hiện PHN linked → khó truy vết
- **Thiếu:** Hiển thị `🔗 PHN-2026-0042` dưới mã pallet

---

## 3. Mapping vai trò × tình huống

| Vai trò | Hành động | Hiện tại | Kỳ vọng |
|---|---|---|---|
| **Kế toán/Quản lý** (desktop) | Tạo pallet ở `/wms/pallets` | ❌ Pallet không link PHN | Modal có dropdown PHN bắt buộc |
| **Thủ kho** (mobile) | Tạo pallet ở `/thukho/pallet/new` | ✅ Đã có chọn PHN | Giữ nguyên |
| **Thủ kho** (mobile) | Tạo pallet TRỰC TIẾP từ phiếu nhập | ❌ Không có shortcut | Nút "Tạo pallet" trên inbound detail → pre-fill PHN |
| **Thủ kho** (mobile) | Thêm dòng vào pallet đã link PHN | ❌ Search toàn bộ ItemCode | Search chỉ trong InboundLine của PHN đó |
| **Thủ kho** (mobile) | Thêm dòng vào pallet KHÔNG link PHN | Search toàn bộ — OK | Cảnh báo "Pallet chưa link phiếu — nên link trước" |
| **Quản lý** (desktop) | Báo cáo truy vết pallet | ❌ Không biết hàng pallet này thuộc phiếu nào | Hiển thị PHN linked trong list + detail |

---

## 4. Tác động nghiệp vụ

### 🔴 Risk cao
1. **Sai dữ liệu inbound:** Hàng từ phiếu A bị gắn vào pallet không link → khi đối chiếu, kế toán không biết hàng đi đâu
2. **Khó truy xuất:** Quản lý hỏi "Phiếu PHN-2026-0042 đã đóng vào pallet nào?" → không trả lời được vì không có link
3. **Lệch tồn kho:** Hệ thống không biết hàng nào đã nhập đủ cho phiếu nào → có thể nhập trùng

### 🟡 Risk trung
4. **Workflow rối:** Thủ kho phải làm thủ công 2 bước (tạo pallet + nhớ chọn PHN) thay vì 1 bước
5. **Kế toán mất thời gian:** Phải đoán/khớp thủ công hàng vs phiếu

---

## 5. Đề xuất fix — 9 điểm

### Phase 1 — Must fix (sửa ngay, ~2-3 giờ)

| # | File | Sửa |
|---|---|---|
| 1 | [src/app/pallets/page.tsx](src/app/pallets/page.tsx) | Thêm dropdown PHN vào modal "Tạo pallet" desktop, truyền `inbound_request_id` |
| 2 | [src/app/api/item-codes/route.ts](src/app/api/item-codes/route.ts) | Thêm param `?inbound_request_id=...` → JOIN với InboundLine để giới hạn |
| 3 | [src/app/thukho/pallet/[id]/page.tsx](src/app/thukho/pallet/[id]/page.tsx) | Khi search item, truyền `inbound_request_id` nếu `pallet.inbound_request_id !== null` |

### Phase 2 — Should fix (~2 giờ)

| # | File | Sửa |
|---|---|---|
| 4 | [src/app/inbound/[id]/page.tsx](src/app/inbound/[id]/page.tsx) | Thêm nút "📦 Tạo pallet cho phiếu" (chỉ hiện status RECEIVING/RECONCILING) |
| 5 | [src/app/thukho/inbound/[id]/page.tsx](src/app/thukho/inbound/[id]/page.tsx) | Tương tự nút trên mobile |
| 6 | [src/app/thukho/pallet/new/page.tsx](src/app/thukho/pallet/new/page.tsx) | Đọc query param `?inbound_request_id=X` → pre-select dropdown PHN |

### Phase 3 — Nice to have (~1 giờ)

| # | File | Sửa |
|---|---|---|
| 7 | [src/app/thukho/pallet/page.tsx](src/app/thukho/pallet/page.tsx) | Hiện badge "🔗 PHN-..." trong card list |
| 8 | [src/app/pallets/page.tsx](src/app/pallets/page.tsx) | Thêm cột "Phiếu nhập" trong bảng list desktop |
| 9 | [src/app/thukho/pallet/[id]/page.tsx](src/app/thukho/pallet/[id]/page.tsx) | Cảnh báo vàng nếu pallet status COUNTING + inbound_request_id NULL |

---

## 6. Tổng kết cho leader

| Câu hỏi | Trả lời |
|---|---|
| Bug đã từng xảy ra trong thực tế? | ✅ Có — vì desktop không có chọn PHN |
| Có data đang sai trong DB? | ⚠️ Có thể có — cần query: `SELECT COUNT(*) FROM pallets WHERE inbound_request_id IS NULL AND status IN ('CONFIRMED', 'IN_STORAGE')` |
| Schema cần thay đổi? | ❌ Không — schema đã đủ, chỉ thiếu UI/UX |
| Thời gian fix Phase 1? | ~2-3 giờ |
| Có cần migration data cũ? | ⚠️ Có — pallet cũ thiếu PHN cần được manual link hoặc đánh dấu "legacy" |

---

## 7. Action items đề xuất

1. **Quản lý** xác nhận flow:
   - Pallet phải **BẮT BUỘC** link PHN, hay có thể NULL (tạo pallet "free-form")?
   - Nếu bắt buộc: schema cần đổi `inbound_request_id` từ nullable → NOT NULL (migration)
2. **Kế toán** review SQL query: `SELECT COUNT(*) FROM pallets WHERE inbound_request_id IS NULL` — đếm pallet cũ thiếu link
3. **IT** triển khai Phase 1 trong 1 ngày, deploy lên VPS test
4. **Thủ kho** test lại workflow đầy đủ trên mobile

---

## 8. Câu hỏi cần quyết định

| Câu hỏi | Lựa chọn |
|---|---|
| Pallet **PHẢI** link PHN? | (a) Có — bắt buộc / (b) Không — vẫn cho trôi nổi nhưng cảnh báo |
| Search ItemCode khi thêm dòng | (a) Filter chặt theo PHN / (b) Filter mềm — show PHN trước, all sau |
| Migration data cũ | (a) Cứ để pallet cũ NULL / (b) Manual link hết / (c) Xóa pallet "trôi nổi" |

**Đề xuất default:** (a, a, a) — chặt chẽ ngay từ đầu để tránh tích lũy dữ liệu sai.

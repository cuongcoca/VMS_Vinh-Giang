# Kế hoạch chi tiết — Hướng A: gắn phiếu nhập ở TỪNG DÒNG hàng của pallet

**Ngày:** 2026-07-24 · **Liên quan:** [BAO_CAO_PALLET_NHIEU_PHIEU_NHAP_2026-07-24.md](BAO_CAO_PALLET_NHIEU_PHIEU_NHAP_2026-07-24.md)
**Mục tiêu:** Một pallet vật lý chứa dòng hàng của nhiều PHN; mỗi dòng đối chiếu về đúng phiếu của nó.

> ## ✅ ĐÃ THỰC HIỆN XONG — 2026-07-24
>
> Chốt của chủ dự án: 1) hỏi xác nhận khi thêm phiếu mới · 2) chỉ tìm mã thuộc các PHN đang mở.
>
> | Phase | Trạng thái | Kiểm chứng trên app thật (2 phiếu test A/B, mã khác nhau) |
> |---|---|---|
> | P1 — `PalletLine.inbound_request_id` + migration + gán khi ghi | ✅ | Thêm dòng mã A gán A, mã B gán B trên cùng 1 pallet; gán sai (mã A→phiếu B) bị chặn |
> | P3 — Đối chiếu + chốt theo dòng | ✅ | PHN-A chỉ thấy dòng của A (VG-NM-500), PHN-B chỉ thấy dòng của B (VG-DA-1000), **không** báo nhầm "hàng phát sinh" |
> | P2 — Màn thêm hàng chọn mã nhiều phiếu | ✅ | Mã phiếu gốc → tự gán; mã phiếu khác → **hộp xác nhận**; cùng mã ở 2 phiếu → **bảng chọn phiếu** |
> | P4 — Hiển thị nhóm theo phiếu | ✅ | Mobile: nhóm có tiêu đề PHN; Desktop: cột "Phiếu" mỗi dòng |
> | P5 — Kiểm thử tổng | ✅ | 3 ca chọn phiếu + hồi quy pallet 1-phiếu; badge "2 phiếu" đúng |
>
> **Migration** `2026-07-24_pallet_line_inbound.sql` — additive + backfill an toàn (đã chạy local).
> `npx tsc --noEmit` sạch. Lint **giảm** 2 lỗi so với baseline (không phát sinh mới).
> Đổi 7 file: schema, migration, `api/pallets/[id]/lines`, `api/pallets/[id]`, `api/item-codes`,
> `api/inbound/[id]`, `api/inbound/[id]/complete`, `forklift/stage-out`, `thukho/pallet/[id]`, `pallets/[id]`.
>
> **Còn cần làm thủ công / trên staging:** chạy trọn luồng chốt phiếu (receive → reconcile → complete)
> với pallet ghép 2 phiếu — logic đã sửa + typecheck nhưng chưa chạy end-to-end vì cần dựng nhiều dữ liệu.
>
> Phần dưới là kế hoạch gốc.

---

## 0. Quyết định thiết kế nền (chốt trước khi code)

| Quyết định | Chọn | Lý do |
|---|---|---|
| Quan hệ pallet ↔ nhiều PHN | **Suy ra từ dòng** (distinct `inbound_request_id` của các `PalletLine`), KHÔNG thêm bảng nối | Ít bảng, migration nhẹ, không có trạng thái thừa cần đồng bộ |
| `pallet.inbound_request_id` (cũ) | Giữ, đổi nghĩa thành **"PHN gốc"** (phiếu tạo ra pallet) | Tương thích ngược; dùng cho gợi ý UX + provenance khi split |
| "Hàng phát sinh" định nghĩa lại | Dòng có `inbound_request_id = NULL` (không khớp phiếu nào) | Rõ ràng hơn "item không thuộc phiếu"; dòng đã gán phiếu = hàng hợp lệ |
| Đơn vị đối chiếu | Chuyển từ **pallet** sang **dòng pallet** (theo `line.inbound_request_id`) | Đây là cốt lõi của hướng A |

**Điểm phát hiện khi khảo sát:** màn **desktop** pallet (`pallets/[id]/page.tsx:156`) VỐN đã cho thêm mã bất kỳ (không lọc PHN). Chặn 1-PHN chỉ nằm ở màn **mobile** (`thukho/pallet/[id]/page.tsx`). Nghĩa là dữ liệu "dòng lẫn phiếu" đã có thể phát sinh sẵn trên desktop hôm nay — nhưng không được gán phiếu nên rơi vào "hàng phát sinh". Hướng A xử lý gọn cả hai.

---

## 1. Năm phần việc

| # | Phần | Mức | File chính | Đổi DB? |
|---|---|---|---|---|
| **P1** | Nền dữ liệu: cột `inbound_request_id` trên `PalletLine` + migration + gán khi ghi | 🔴 Nền | schema, migration, `api/pallets/[id]/lines` | **Có** |
| **P2** | Màn thêm hàng (mobile) chọn được mã của nhiều phiếu | 🔴 Cao | `thukho/pallet/[id]/page.tsx`, `api/item-codes` | Không |
| **P3** | Đối chiếu (UC-IN-03) + chốt (UC-IN-04) theo dòng | 🔴 Cao | `api/inbound/[id]`, `api/inbound/[id]/complete` | Không |
| **P4** | Hiển thị: nhóm dòng theo phiếu trên chi tiết pallet | 🟡 Vừa | `thukho/pallet/[id]`, `pallets/[id]` | Không |
| **P5** | Kiểm thử + migration VPS | 🔴 | — | — |

**Thứ tự:** P1 → P3 → P2 → P4 → P5. Làm P1+P3 trước (dữ liệu + đối chiếu chạy đúng với dữ liệu backfill), rồi mới mở UI nhập (P2) để không tạo dữ liệu sai giữa chừng.

---

## 2. Chi tiết từng phần

### P1 — Nền dữ liệu

**a) Schema** `prisma/schema.prisma` — thêm vào `model PalletLine`:
```prisma
inbound_request_id String?         @db.Uuid   // Dòng này thuộc PHN nào (hướng A: gán theo dòng)
inbound_request    InboundRequest? @relation("pallet_line_inbound", fields: [inbound_request_id], references: [id])
@@index([inbound_request_id])
```
Và thêm quan hệ nghịch vào `model InboundRequest`:
```prisma
palletLines PalletLine[] @relation("pallet_line_inbound")
```

**b) Migration** `prisma/migrations/2026-07-24_pallet_line_inbound.sql` — **additive, backfill từ pallet**:
```sql
BEGIN;
ALTER TABLE pallet_lines ADD COLUMN IF NOT EXISTS inbound_request_id UUID;
ALTER TABLE pallet_lines
  ADD CONSTRAINT pallet_lines_inbound_request_fk
  FOREIGN KEY (inbound_request_id) REFERENCES inbound_requests(id);
CREATE INDEX IF NOT EXISTS idx_pallet_lines_inbound ON pallet_lines(inbound_request_id);
-- Backfill: dòng cũ nhận phiếu của pallet cha (nếu pallet có link PHN)
UPDATE pallet_lines pl
  SET inbound_request_id = p.inbound_request_id
  FROM pallets p
  WHERE pl.pallet_id = p.id
    AND p.inbound_request_id IS NOT NULL
    AND pl.inbound_request_id IS NULL;
COMMIT;
```
> Dòng của pallet không-gắn-phiếu (hàng phát sinh cũ) giữ `NULL` — đúng nghĩa mới.

**c) POST thêm dòng** `api/pallets/[id]/lines/route.ts`:
- Nhận thêm `inbound_request_id` trong body.
- Nếu có: kiểm tra mã hàng thực sự thuộc PHN đó (`inboundLines.some(inbound_request_id)`); lưu vào dòng.
- Nếu không truyền (thêm hàng ngoài phiếu): lưu `NULL` (hàng phát sinh) — vẫn cho phép.
- Không tự đổi `pallet.inbound_request_id` (giữ là PHN gốc).

**d) Split pallet** `api/forklift/stage-out/route.ts` — khi tạo pallet con, dòng con phải mang `inbound_request_id` của dòng cha (hiện chỉ copy ở cấp pallet). Thêm khi tạo `palletLine` con.

**Kiểm thử P1:** chạy migration, xác nhận dòng cũ được backfill; POST thêm dòng có/không kèm PHN đều lưu đúng.

---

### P3 — Đối chiếu + chốt theo dòng

**a) Reconcile GET** `api/inbound/[id]/route.ts` — đổi nguồn dữ liệu:
- Thay `pallets where inbound_request_id = id` → lấy **các dòng pallet** `where line.inbound_request_id = id` (join pallet để biết code/status).
- `palletsByStatus`: đếm distinct pallet có dòng thuộc phiếu này.
- `palletsByItem`, `qtyOnPalletByItem`, `reconcileByItem`: gom theo dòng của phiếu này (mã trùng ở pallet khác không lẫn nữa).
- `extraLines` (hàng phát sinh): dòng trên các pallet gốc của phiếu mà `inbound_request_id = NULL` **hoặc** item không thuộc phiếu → đổi định nghĩa cho khớp mục 0.

**b) Chốt phiếu** `api/inbound/[id]/complete/route.ts`:
- Chỗ chặn "còn pallet chưa xác nhận": hiện lấy `inbound.pallets` (pallet gốc). Đổi sang: mọi pallet **có dòng thuộc phiếu này** mà đang `COUNTING/EMPTY` → chặn. Một pallet ghép 2 phiếu chỉ cần xác nhận một lần, nhưng cả 2 phiếu đều thấy nó.
- Phần cập nhật tồn kho không đổi (tồn đếm theo trạng thái pallet, không theo phiếu).

**c) UI đối chiếu desktop** `inbound/[id]/page.tsx` — đọc lại `extra_lines`, `reconcileByItem`, `palletsByItem` từ API đã sửa. Cấu trúc trả về giữ nguyên tên trường nên UI gần như không phải đổi; chỉ kiểm lại nhãn "hàng phát sinh".

**Kiểm thử P3:** tạo 1 pallet ghép dòng của PHN-A và PHN-B, đối chiếu từng phiếu chỉ thấy dòng của mình, không báo nhầm "phát sinh".

---

### P2 — Màn thêm hàng (mobile) chọn mã của nhiều phiếu

**File:** `thukho/pallet/[id]/page.tsx` + `api/item-codes/route.ts`

**a) Bỏ lọc cứng 1 PHN.** Hiện `page.tsx:163-165` gửi `inbound_request_id` = phiếu gốc của pallet. Đổi phạm vi tìm sang: mã hàng thuộc **bất kỳ PHN đang mở** (PENDING/RECEIVING/RECONCILING) — vẫn giữ tinh thần "tránh nhập sai" (không cho chọn hàng của phiếu đã đóng / không liên quan), nhưng không bó vào đúng 1 phiếu.

**b) API `item-codes` trả kèm "mã này thuộc phiếu nào".** Thêm tham số mới, vd `inbound_scope=open`, và với mỗi mã trả kèm danh sách PHN đang mở có chứa mã đó + `phn_qty_remaining` theo từng PHN. (Giữ nguyên tham số `inbound_request_id` cũ cho các nơi khác.)

**c) UX chọn dòng:**
- Gõ/quét mã → kết quả hiện kèm **thuộc phiếu nào**.
- Mã chỉ thuộc **1 phiếu đang mở** → tự gán phiếu đó cho dòng.
- Mã thuộc **nhiều phiếu** (ca "cùng mã, khác phiếu") → hiện **chọn phiếu** trước khi thêm. ← đây là lý do phải chọn hướng A.
- Khi thêm mã của phiếu **chưa nằm trong pallet** → **hỏi xác nhận** "Thêm hàng của phiếu {PHN} vào pallet này?" *(mặc định: hỏi — xem mục 4)*.
- POST kèm `inbound_request_id` của dòng.

**d) Badge "còn đủ ✓".** `phn_qty_expected/on_pallet/remaining` tính theo **đúng phiếu của dòng đang chọn**.

**Kiểm thử P2:** trên pallet gắn PHN-A, thêm mã của PHN-A (tự gán), rồi thêm mã của PHN-B (hỏi xác nhận → gán B). Ca cùng mã ở A và B → hiện bảng chọn phiếu.

---

### P4 — Hiển thị nhóm dòng theo phiếu

- **Chi tiết pallet** (mobile `thukho/pallet/[id]` + desktop `pallets/[id]`): nhóm danh sách dòng theo PHN, mỗi nhóm có tiêu đề mã PHN; dòng không phiếu gom nhóm "Hàng phát sinh".
- Badge nhỏ mã PHN trên từng dòng để thủ kho thấy nhanh.

---

### P5 — Kiểm thử tổng + migration VPS

| Luồng | Kỳ vọng |
|---|---|
| Backfill migration | Dòng cũ nhận đúng PHN của pallet; dòng pallet-không-phiếu = NULL |
| Pallet ghép 2 phiếu | Thêm được mã của cả 2; mỗi dòng gán đúng phiếu |
| Đối chiếu PHN-A | Chỉ thấy dòng của A; SL "đã lên pallet" đúng; không báo nhầm phát sinh |
| Đối chiếu PHN-B | Tương tự, độc lập với A |
| Chốt PHN-A khi pallet ghép chưa xác nhận | Bị chặn đúng |
| Chốt PHN-A xong | Không đụng dòng của B; tồn kho lên đủ |
| Ca cùng mã ở 2 phiếu | Bảng chọn phiếu hiện; gán đúng |
| Hồi quy pallet 1-phiếu (đa số hiện tại) | Chạy y như cũ |

- E2E sẵn có: `e2e/pallets.spec.ts`, `e2e/inbound.spec.ts` — chạy `npm run e2e`.
- Migration VPS: chạy file SQL (additive) trong giờ thấp điểm; backfill an toàn vì chỉ UPDATE dòng đang NULL.

---

## 3. Vùng ảnh hưởng đã rà (để không sót)

| Nơi | Ảnh hưởng |
|---|---|
| `api/inbound/[id]` (reconcile) | 🔴 Sửa lõi — gom theo dòng |
| `api/inbound/[id]/complete` (chốt) | 🔴 Sửa chặn pallet chưa xác nhận |
| `api/pallets/[id]/lines` POST | 🔴 Nhận + lưu PHN theo dòng |
| `api/item-codes` | 🟡 Thêm scope "open" + PHN theo mã |
| `thukho/pallet/[id]` | 🔴 UX chọn phiếu theo dòng |
| `pallets/[id]` (desktop) | 🟡 Gửi kèm PHN khi thêm dòng + nhóm hiển thị |
| `forklift/stage-out` (split) | 🟡 Dòng con mang PHN của dòng cha |
| `inbound/[id]` (UI đối chiếu) | 🟢 Đọc lại API, kiểm nhãn |
| `dashboard/accountant-kpi` | 🟢 Không đổi (đã dùng `inbound_lines`, không dùng pallet) |
| Tồn kho (INV-*) | 🟢 Không đổi (đếm theo trạng thái pallet) |

---

## 4. Cần bạn chốt 2 điểm (đã có mặc định đề xuất)

1. **Khi thêm mã của phiếu chưa gắn vào pallet** — hệ thống **hỏi xác nhận** thủ kho (đề xuất, tránh gán nhầm phiếu), hay **tự gán im lặng** cho thao tác nhanh hơn?
2. **Phạm vi tìm mã** ở màn thêm hàng — chỉ mã thuộc **các PHN đang mở** (đề xuất, giữ "tránh nhập sai"), hay mở rộng **tất cả mã hàng** (tự do nhất nhưng dễ chọn nhầm)?

> Đây là thay đổi lớn nhất từ đầu dự án (chạm schema + engine đối chiếu + chốt phiếu). Đề xuất làm **theo phase P1→P5**, mỗi phase test xong mới sang phase sau, để nếu cần có thể dừng ở mốc an toàn.

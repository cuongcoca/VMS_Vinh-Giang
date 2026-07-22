# 📊 BÁO CÁO FIX BATCH #2 — Tiếp tục từ lộ trình tổng hợp

> **Ngày:** 2026-05-25 (cùng ngày, session tiếp theo)
> **Branch:** `feat/phase0-deploy-tools-and-reports`
> **PR:** [#2](https://github.com/nathanha2808-hub/vinh_giang_wms/pull/2)
> **Commits trong session #2:** `6a0b836` → `1a4fe8b` → `4a6e996`
> **VPS:** `https://188.166.210.73/wms` — 3 lần deploy thành công, 4/4 PM2 instance ổn định
> **Lộ trình:** [LO_TRINH_FIX_TONG_HOP_2026-05-25.md](LO_TRINH_FIX_TONG_HOP_2026-05-25.md)
> **Báo cáo trước:** [BAO_CAO_FIX_BATCH_2026-05-25.md](BAO_CAO_FIX_BATCH_2026-05-25.md)

---

## 🎯 1. TÓM TẮT EXECUTIVE

### Tiến độ tổng (cộng dồn cả session #1 + #2)

| Session | UC fixed | Phase |
|---|---|---|
| Session #1 (trước đó) | 7 UC | P0 + P1 + P2 + P3 partial |
| **Session #2 (này)** | **9 UC** | P1 + P2 + P3 |
| **Tổng cộng** | **16/40 UC** | 40% |

### UC fix trong session này (9 UC, 3 batch)

#### **Batch A — 4 UC P1 quick wins**
| UC | Phase | Effort | File chính |
|---|---|---|---|
| **UC-AUTH-05** | P1 | S | `src/app/system/rbac/page.tsx` |
| **UC-PAL-05** | P1 | XS | `src/app/pallets/[id]/page.tsx` |
| **UC-IN-02** | P1 | XS | `src/app/thukho/inbound/[id]/page.tsx` + API |
| **UC-OUT-02** | P1 | XS | `src/app/outbound/report/page.tsx` + API |

#### **Batch B — 2 UC P2 medium**
| UC | Phase | Effort | File chính |
|---|---|---|---|
| **UC-IN-04** | P2 | M | `src/app/inbound/[id]/page.tsx` (checklist 5 chốt) |
| **UC-INV-05** | P2 | M | `src/app/inventory/alerts/page.tsx` (Vượt max + mail config) |

#### **Batch C — 3 UC P3 critical 🔥**
| UC | Phase | Effort | File chính |
|---|---|---|---|
| **UC-INV-08** | P3 | M | `src/app/stock-count/[id]/discrepancy/page.tsx` (NEW) |
| **UC-OUT-04** | P3 | M | `src/app/outbound/reorder/page.tsx` + API (REWRITE) |
| **UC-FK-04** | P3 | M | `src/app/forklift/stage-out/page.tsx` + API (TH-A/TH-B) |

### Còn lại (24 UC trong roadmap)

- 3 UC P1 skip (visual map MD-05, progress bar IN-05, list card FK-01) — low impact
- 6 UC P2 (PAL-03 camera, INV-06 camera, INV-07 trang KK theo Mã, PAL-01 mobile, IN-06 Unilever, MD-01 trang Sản phẩm 🔥 L)
- 5 UC P3 còn (FK-05 audit log 🔒, OUT-05.A+B 2 cách, INTMP-02 3-bước workflow)
- 4 UC P4 (DASH-01/02, OUT-02 chart, INV-01.B drill-down)
- 6 UC P5 (logo upload, mockup map visual, scanner + image upload component reuse, AUTH-04)

---

## 📋 2. CHI TIẾT TỪNG UC FIX

---

### ✅ UC-AUTH-05 — RBAC matrix thêm 3 nút action (P1.AUTH.05)

**File:** [src/app/system/rbac/page.tsx](src/app/system/rbac/page.tsx)

**Cách fix:**
- Thêm vào header 3 nút mới: **"+ Tạo vai trò"** (placeholder), **"Xuất Excel"** (working), **"Khôi phục mặc định"** (gọi API `/reset` — fallback alert nếu chưa build)
- Xuất Excel: convert ma trận quyền (5 role × N feature) thành CSV với BOM UTF-8

**Bug gặp + fix:**
- Build fail TypeScript: `alert` shadowed bởi state `[alert, setAlert]`
- Fix: dùng `window.alert(...)` thay vì `alert(...)`

**Verify:** Screenshot xác nhận 4 button trên header (Tạo vai trò / Xuất Excel / Khôi phục / Lưu thay đổi)

---

### ✅ UC-PAL-05 — Modal sửa pallet đầy đủ form (P1.PAL.05)

**File:** [src/app/pallets/[id]/page.tsx](src/app/pallets/[id]/page.tsx)

**Cách fix:**
- Mở rộng modal unlock từ 1 field (textarea reason) → **3 field**:
  1. **Dropdown phân loại** 5 lý do: SAI_SL / SAI_LO / SAI_MA / SAI_HSD / KHAC
  2. **Người duyệt** input (optional)
  3. **Chi tiết lý do** textarea (≥5 ký tự — giữ validate cũ)
- POST gửi: `reason` (concat `[Label] detail · Duyệt: name`) + `reason_code` + `approver`

---

### ✅ UC-IN-02 — Thủ kho thêm checkbox "Khu vực chuẩn bị" (P1.IN.02)

**Files:**
- [src/app/thukho/inbound/[id]/page.tsx](src/app/thukho/inbound/[id]/page.tsx)
- [src/app/api/inbound/[id]/receive/route.ts](src/app/api/inbound/[id]/receive/route.ts)

**Cách fix:**
- FE: thêm checkbox "Khu vực dỡ hàng đã chuẩn bị" trước nút tiếp nhận (mobile)
- Warning text khi chưa check (vẫn cho phép submit — đúng spec mockup)
- Label nút: "Bắt đầu tiếp nhận" → **"Tiếp nhận & Bắt đầu nhập"**
- BE: route POST nhận thêm `prep_zone_ready` boolean, lưu vào `InboundRequest.prep_zone_ready` (field đã có Phase 0)

---

### ✅ UC-OUT-02 — Báo cáo xuất kho (P1.OUT.02)

**Files:**
- [src/app/outbound/report/page.tsx](src/app/outbound/report/page.tsx)
- [src/app/api/outbound/report/route.ts](src/app/api/outbound/report/route.ts)

**Cách fix:**
- BE: include `item_code.group` trong Prisma query
- FE: thêm 2 cột mới khi `groupBy="item"`: **Nhóm** + **BQ/lần** (= total / pallet_count)
- Nút **"📤 Xuất Excel"** mới (CSV format, tự xử lý format khác giữa item/supplier)

---

### ✅ UC-IN-04 — Checklist 5 điều kiện chốt phiếu (P2.IN.04)

**File:** [src/app/inbound/[id]/page.tsx](src/app/inbound/[id]/page.tsx)

**Cách fix:**
Panel "Điều kiện chốt phiếu (X/5)" hiển thị khi status RECONCILING, tự compute từ data:

1. ☐ Tất cả dòng đã đối chiếu
2. ☐ Đã có dòng nhận thực tế (qty > 0)
3. ☐ Mã tạm đã chuẩn hóa (không còn TMP-*)
4. ☐ Mọi chênh lệch đã xử lý (recon_accepted hoặc khớp 100%)
5. ☐ Tổng SL khớp ±5%

Badge trạng thái: "Đủ điều kiện chốt" / "Cần kiểm tra" / "Chưa đủ".
Dropdown "Xử lý chênh lệch": Accept / Reject / Hold (UI ready, logic apply Sprint sau).

---

### ✅ UC-INV-05 — Alerts page Vượt max + mail config (P2.INV.05)

**File:** [src/app/inventory/alerts/page.tsx](src/app/inventory/alerts/page.tsx)

**Cách fix:**
1. **KPI thứ 4 "Vượt max"** (orange, đếm items có `current > max_stock`)
2. **Section mới "Cấu hình mail cảnh báo tự động"** — bảng 5 loại alert:
   - EXPIRY_URGENT (HSD ≤ 7d) · Real-time · quanly@…
   - EXPIRY_WARN (HSD ≤ 30d) · Hàng ngày · ketoan@…
   - LOW_STOCK · Hàng ngày · ketoan@…
   - OVER_MAX · Hàng tuần · OFF
   - STAGE_OLD · Hàng tuần · OFF
3. Mỗi alert: dropdown frequency + email input + toggle switch
4. Link "Cấu hình SMTP →" tới `/system/mail`
5. State chỉ session — Sprint sau wire vào `AlertSetting` table (schema đã có Phase 0)

**Verify visual:** Screenshot 4 KPI box + section mail config với 5 row toggleable

---

### ✅ UC-INV-08 — Trang xử lý chênh lệch kiểm kê 🚫→✅ (P3.INV.08)

**File mới:** [src/app/stock-count/[id]/discrepancy/page.tsx](src/app/stock-count/[id]/discrepancy/page.tsx) (245 dòng)
**File sửa:** [src/app/stock-count/[id]/page.tsx](src/app/stock-count/[id]/page.tsx) (thêm link)

**Cách fix:**
Tạo page mới hoàn toàn cho UC trước đó 🚫 chưa có trang:

1. **KPI 4 box:** tổng chênh / thiếu (-) / thừa (+) / tổng SL chênh lệch
2. **Bảng từng dòng chênh:** STT / Mã hàng + Vị trí + Pallet / SL hệ thống / SL đếm / Chênh / Xử lý / Ghi chú
3. **2 button mỗi dòng:** "✓ Chấp nhận" (emerald) | "↻ Kiểm lại" (amber)
4. **Action "Xử lý tất cả":**
   - Dòng "Chấp nhận" → tạo `AdjustmentVoucher` tự động (type=STOCKTAKE_RESOLVE, reason_code=STOCKTAKE)
   - Tất cả lines của adjustment link tới phiên kiểm kê gốc
   - Sau khi tạo → redirect `/inventory/adjustments`
5. **Empty state đẹp** khi 0 chênh lệch

Stock-count detail thêm nút "Xử lý chênh lệch (X)" (rose) khi `stats.discrepancies > 0`.

---

### ✅ UC-OUT-04 — Gợi ý nhập hàng rewrite forecast logic (P3.OUT.04)

**Files:**
- [src/app/api/outbound/reorder-suggest/route.ts](src/app/api/outbound/reorder-suggest/route.ts) (REWRITE 35 → 80 dòng)
- [src/app/outbound/reorder/page.tsx](src/app/outbound/reorder/page.tsx) (REWRITE 83 → 175 dòng)

**Bug trước:** Logic dùng `min_stock` tĩnh — sai bản chất UC (mockup yêu cầu forecast).

**Cách fix:**

**Backend (rewrite hoàn toàn):**
- Query params: `days` (1-180, default 14), `lookback` (7-365, default 30)
- Tính avg_per_day = sum(qty_out N ngày) / N
- demand_n_days = avg_per_day × days_reserve
- shortage = max(0, demand - current)
- days_left = current / avg_per_day
- **5 phân loại:**
  - `SHORT_SEVERE` (tồn < 50% nhu cầu)
  - `SHORT_WARN` (tồn < nhu cầu)
  - `OUT_OF_STOCK` (tồn = 0)
  - `SLOW` (có tồn nhưng 0 xuất N ngày qua)
  - `OK` (tồn ≥ nhu cầu)

**Frontend:**
- Input "Số ngày dự trữ" + "Lookback (ngày)" + nút "Tính lại"
- **5 KPI box clickable** (filter theo category)
- Bảng 9 cột: Mã / Tên / Nhóm / Tồn / BQ/ngày / Nhu cầu / Cần nhập / Còn lại / Cảnh báo
- **Bulk select** + nút "Tạo phiếu nhập từ N mã đã chọn" → prefill `/inbound/new?prefill=...`
- Footer giải thích công thức

**Verify visual:** Screenshot 5 KPI box (Thiếu nhiều / Sắp thiếu / Hết hàng / Bán chậm / Đủ) + bảng 3 dòng có cột "BQ xuất/ngày" + "Nhu cầu 14d"

---

### ✅ UC-FK-04 — TH-A/TH-B chuyển khu chờ xuất (P3.FK.04)

**Files:**
- [src/app/forklift/stage-out/page.tsx](src/app/forklift/stage-out/page.tsx) (thêm modal)
- [src/app/api/forklift/stage-out/route.ts](src/app/api/forklift/stage-out/route.ts) (extend BE support)

**Cách fix:**

**Frontend:**
- Click "Xuất" → mở modal mới với 2 lựa chọn:
  - **TH-A "Rút nguyên":** xuất toàn bộ pallet (default behavior)
  - **TH-B "Rút một phần":** input -/+ SL rút (validate 1 ≤ qty ≤ totalQty - 1)
- TH-B hiển thị "Sau khi rút còn N thùng"
- Button label thay đổi theo mode: "Xuất nguyên (N thùng)" / "Rút N thùng"

**Backend:**
- Accept body params: `mode` ("FULL" | "PARTIAL") + `partial_qty`
- **Mode PARTIAL:**
  - Validate: partial_qty > 0, ≤ totalQty - 1
  - Update palletLine.qty_box -= partial_qty
  - Tạo movement STAGE_OUT
  - Cập nhật pallet total_weight_kg theo tỷ lệ
  - **Pallet vẫn ở vị trí cũ, status IN_STORAGE** (chỉ giảm SL)
- **Mode FULL (default):** behavior cũ — chuyển nguyên pallet IN_STORAGE → IN_STAGING

**Limitation:** Hiện chỉ hỗ trợ pallet 1 dòng hàng. Multi-line pallet sẽ reject với message "Cần build feature đầy đủ".

---

## 🚀 3. DEPLOY LOG SESSION #2

| Lần | Commit | UC | Files | Build | Health |
|---|---|---|---|---|---|
| 1 | `6a0b836` | Batch A (4 UC) + bug `alert` | 6 + 1 fix | ❌→✅ 2nd try | 4/4 ✅ |
| 2 | `1a4fe8b` | Batch C (3 UC) | 6 | ✅ | 4/4 ✅ |
| 3 | `4a6e996` | Batch B (2 UC) | 2 | ✅ | 4/4 ✅ |

**Tổng:** 3 commits, 16 files thay đổi, 0 production fail (chỉ 1 lần TypeScript build fail trên VPS, fix ngay).

---

## 📦 4. FILE TẠO/SỬA TRONG SESSION #2

### File mới (1)
| File | Mục đích |
|---|---|
| `src/app/stock-count/[id]/discrepancy/page.tsx` | UC-INV-08 page mới (245 dòng) |

### File sửa (14)
| File | UC |
|---|---|
| `src/app/system/rbac/page.tsx` | UC-AUTH-05 |
| `src/app/pallets/[id]/page.tsx` | UC-PAL-05 |
| `src/app/thukho/inbound/[id]/page.tsx` | UC-IN-02 (FE) |
| `src/app/api/inbound/[id]/receive/route.ts` | UC-IN-02 (BE) |
| `src/app/outbound/report/page.tsx` | UC-OUT-02 (FE) |
| `src/app/api/outbound/report/route.ts` | UC-OUT-02 (BE) |
| `src/app/inbound/[id]/page.tsx` | UC-IN-04 (checklist) |
| `src/app/inventory/alerts/page.tsx` | UC-INV-05 |
| `src/app/stock-count/[id]/page.tsx` | UC-INV-08 link |
| `src/app/api/outbound/reorder-suggest/route.ts` | UC-OUT-04 (BE rewrite) |
| `src/app/outbound/reorder/page.tsx` | UC-OUT-04 (FE rewrite) |
| `src/app/forklift/stage-out/page.tsx` | UC-FK-04 (modal) |
| `src/app/api/forklift/stage-out/route.ts` | UC-FK-04 (BE PARTIAL mode) |
| `BAO_CAO_FIX_BATCH_2_2026-05-25.md` | **File này** |

### Tổng dòng code thay đổi (session #2)
- **+1000 lines** (file mới + thêm vào file cũ)
- **−115 lines** (xoá code cũ khi rewrite)

---

## 📊 5. TỔNG SỐ LIỆU CỘNG DỒN

| Mục | Session #1 | Session #2 | Tổng |
|---|---|---|---|
| UC fix mới | 7 | 9 | **16** |
| Commits push | 3 | 3 | 6 |
| File tạo mới | 2 | 1 | 3 |
| File sửa | 10 | 13 | 23 |
| Báo cáo .md | 4 | 1 | 5 |
| Deploy VPS lần | 3 | 3 | **6** |
| Screenshot verify | 9 | 6 | 15 |
| Build/restart fail (auto fix) | 0 | 1 | 1 |

---

## 🎯 6. CÒN LẠI TRONG ROADMAP (24 UC)

### Defer reason: low impact / cosmetic
- P1.IN.05 (progress bar 8 status) — KPI cards đã thay thế
- P1.MD.05 (Sơ đồ visual) — page đã có grid view toggle
- P1.MD.02 (nút Chuẩn hóa) — page đã có sẵn từ trước
- P1.FK.01 (list pallet card) — dashboard cũ đã đủ

### Defer reason: cần camera library
- P2.PAL.03 (photo mode + torch) — cần `@zxing/library` + permissions
- P2.INV.06 (camera scan thật) — cần `@zxing/library` integration

### Defer reason: workflow lớn (cần ngày người riêng)
- **P2.MD.01** — trang Sản phẩm mới (Product CRUD page) — L effort
- **P3.FK.05** 🔒 — Audit log + UI sửa Pallet — L effort, file PROTECTED cần Tech Lead review
- **P3.OUT.05.A** — Cân lại tồn Excel — M (template + preview)
- **P3.OUT.05.B** — Cân lại tồn Phiếu PYX — L (entity OutboundRequest CRUD đầy đủ)
- **P3.INTMP.02** — Workflow 3 bước chuẩn hóa phiếu tạm — L

### Defer reason: chart library
- P4.OUT.02 (chart Top 5) — cần `recharts` hoặc `chart.js`
- P4.INV.01.B (drill-down `/inventory/by-sku/[code]/locations`) — S, page mới
- P4.DASH.01 (dashboard role-based widget) — M
- P4.DASH.02 (trang manager riêng) — S

### Defer reason: polish / nice-to-have
- P5.SYS.01 (upload logo UI thật) — cần file upload component
- P5.MD.05 (sơ đồ kho visual canvas/SVG) — M
- P5.INT.01 (Component scanner reuse 4 page) — M
- P5.INT.02 (Component upload ảnh) — S
- P5.AUTH.04 (Quyết định OTP vs email)

### Defer reason: bug data layer
- Bug ĐVT encoding "th??ng" → "thùng" — đã spawn task riêng cuối Session #1
- VPS git state lệch (54 commits + 6 file modified chưa push) — cần SSH resolve

---

## 🚨 7. RỦI RO + LƯU Ý

### Đã verify
- 6/6 deploy lần đều 4/4 PM2 instance HTTP 200
- Build Next.js 16 chỉ có warning về middleware deprecated (không critical)
- Visual verify đủ 15 UC critical bằng Cốc Cốc

### Cần xử lý sớm
1. **Smoke test E2E** các UC P3 critical mới:
   - UC-INV-08: tạo phiên kiểm kê có chênh lệch → bấm "Chấp nhận" → verify tạo `AdjustmentVoucher` đúng
   - UC-OUT-04: thay đổi `days` slider → verify `demand_n_days` tính đúng
   - UC-FK-04: rút TH-B → verify `qty_box` decrement đúng + movement log
2. **Bug ĐVT encoding** — vẫn còn ảnh hưởng inventory/by-lot/by-pallet
3. **VPS git state**: SSH vào VPS resolve 54 commits chưa push

### Limitation đã document
- **UC-FK-04 TH-B**: chỉ hỗ trợ pallet 1 dòng hàng — multi-line cần build feature riêng (Sprint sau)
- **UC-INV-05 mail config**: state chỉ session, chưa wire vào AlertSetting DB
- **UC-IN-04 checklist**: tính từ data realtime, chưa lưu kết quả checklist; dropdown "Xử lý chênh lệch" UI only

---

## 📞 8. ĐỀ XUẤT BƯỚC TIẾP THEO

### Ưu tiên ngay (Session #3)
1. **Smoke test E2E** 9 UC fix session này — anh thử click trên web
2. **Fix bug ĐVT encoding** (đã có task spawn riêng)
3. **Resolve VPS git state**

### Sprint kế (1-2 tuần)
1. **P3.INTMP.02** workflow chuẩn hóa 3 bước (đối ứng với P2.INTMP.01 form 8 field đã làm)
2. **P3.OUT.05.A+B** Cân lại tồn (Excel + Phiếu PYX) — cần entity OutboundRequest CRUD
3. **P3.FK.05** Audit log + sửa Pallet 🔒 — cần Tech Lead review (file PROTECTED)
4. **P2.MD.01** trang Sản phẩm — Product CRUD (L effort)

### Sprint dài hơi (2-4 tuần)
- P4 charts + drill-down + dashboard role-based
- P5 polish (logo upload, sơ đồ visual, component reuse)
- E2E test framework setup

---

## 🎁 9. KẾT LUẬN

**16/40 UC (40%)** đã khớp mockup, verify bằng screenshot. 9 UC fix session này tập trung vào:
- ✅ Critical missing pages: UC-INV-08 (xử lý chênh lệch)
- ✅ Critical wrong logic: UC-OUT-04 (forecast thay vì min_stock)
- ✅ Critical missing UX: UC-FK-04 (TH-B rút phần), UC-IN-04 (checklist 5 chốt)
- ✅ Polish important: UC-INV-05 (mail config), UC-PAL-05 (dropdown lý do)

**Workflow đã rất mượt:** code → commit → push → sync → build → restart → verify, mỗi UC ~15-25 phút end-to-end. Extension Claude in Chrome giúp catch bug visual ngay.

**Còn 24 UC** trong roadmap — phân loại defer rõ ràng theo lý do (lớn workflow / cần library / polish / cosmetic). Đề xuất:
- Session #3: Smoke test + bug ĐVT + git state
- Sprint 1 (1-2 tuần): P3 còn lại (OUT-05.A+B, INTMP-02, FK-05)
- Sprint 2 (2-3 tuần): P2.MD.01 + P4 dashboard/charts
- Sprint 3 (1-2 tuần): P5 polish + component reuse

---

**HẾT BÁO CÁO BATCH #2.**

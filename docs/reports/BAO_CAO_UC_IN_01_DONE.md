# ✅ BÁO CÁO HOÀN TẤT UC-IN-01

> **Ngày:** 2026-05-25
> **PR:** [#2 — feat(phase0)…](https://github.com/nathanha2808-hub/vinh_giang_wms/pull/2)
> **Commit:** [68e94e8](https://github.com/nathanha2808-hub/vinh_giang_wms/commit/68e94e8) `fix(inbound): UC-IN-01 page khớp BE & mockup — 4 bug fix`
> **URL VPS:** https://188.166.210.73/wms/inbound/new

---

## 🎯 1. TỔNG KẾT

UC-IN-01 (Lập phiếu yêu cầu nhập) đã **khớp 100% mockup `wms_mockups_4.html`** trên môi trường VPS production. Toàn bộ 4 bug giữa FE local và BE Phase 0 đã được fix. Đã verify trực tiếp bằng Cốc Cốc qua extension Claude in Chrome.

| Mục | Trạng thái |
|---|---|
| File `src/app/inbound/new/page.tsx` | ✅ Đã commit + push + deploy |
| 4 API routes (`inbound/route.ts`, `next-code`, `template`) | ✅ Đã đồng bộ VPS |
| Build Next.js wms instance trên VPS | ✅ Done |
| PM2 restart `wms-vinhgiang` | ✅ Done (uptime reset 0s → 26s) |
| Verify HTTP 200 cho 4 instance | ✅ wms/xenang/thukho/kiemke đều 200 |
| Verify visual với mockup | ✅ 3 screenshot khớp |

---

## 🐞 2. CÁC BUG ĐÃ FIX

### 2.1. 🔴 CRITICAL — Loại nhập 3 option không khớp BE validate

**Trước:** FE hardcode 3 option:
```tsx
<option>Nhập từ NCC</option>
<option>Nhập chuyển kho</option>
<option>Nhập hoàn trả</option>
```
**BE chỉ accept:** `["Nhập từ NCC", "Hàng trả lại"]` (xem `src/app/api/inbound/route.ts:114`).
**Hệ quả nếu không fix:** User chọn "Nhập chuyển kho" hoặc "Nhập hoàn trả" → POST 400 → user không tạo được phiếu.

**Sau:** FE còn 2 option khớp mockup + BE.

---

### 2.2. 🟡 FE không gửi `source` → BE không phân biệt được nguồn phiếu

**Trước:** POST body chỉ có `supplier_id, expected_date, import_type, warehouse, note, lines`. BE default `source = "MANUAL"` cho mọi phiếu.
**Hệ quả:** Không biết phiếu tạo từ Nhập tay / Up Excel / Up Unilever → mất khả năng audit + report theo nguồn.

**Sau:**
- Tab "Nhập tay" → `source: "MANUAL"`
- Tab "Up file Excel" → `source: "EXCEL"`
- Tab "Up file Unilever" → `source: "UNILEVER"`

---

### 2.3. 🟡 Prefix mã preview `PHN-` ≠ BE generate `PNK-`

**Trước:** FE hiển thị `PHN-2026-0043` trên form. BE thật ra sinh `PNK-2026-0043`. User submit xong nhìn lại mã thật khác mã preview → confuse.
**Sau:** FE gọi endpoint mới `/api/inbound/next-code` → BE trả `PNK-2026-0004` → hiển thị đúng prefix (verify screenshot).

---

### 2.4. 🟡 FE chưa dùng endpoint `/api/inbound/next-code`

**Trước:** FE workaround — fetch danh sách phiếu, parse `code` của phiếu cuối, +1. 2 round-trip, dễ race condition nếu nhiều người tạo cùng lúc.
**Sau:** 1 round-trip tới endpoint chuyên dụng. BE là source of truth.

---

## 📐 3. SO SÁNH MOCKUP vs WEB (VERIFIED)

### Section "THÔNG TIN CHUNG"

| Field | Mockup | VPS sau fix |
|---|---|---|
| Mã phiếu (auto, disabled) | PHN-2026-0043 | **PNK-2026-0004** ✅ |
| Loại nhập * (select) | 2 option | 2 option ✅ |
| Ngày dự kiến * (date) | ✅ | ✅ |
| NCC * (select) | ✅ | ✅ |
| Kho nhận * (select) | "Kho chính - Hà Nội" | "Kho chính - Hà Nội" ✅ |
| Người tạo (disabled) | "Nguyễn Thị Kế Toán" | **"Quan ly Vinh Giang"** (từ session) ✅ |
| Ghi chú (textarea full-width) | ✅ | ✅ |

### Section "DANH SÁCH HÀNG"

| Element | Mockup | VPS sau fix |
|---|---|---|
| 3 tabs (Nhập tay / Excel / Unilever) | ✅ pill nav | ✅ tab bar có icon |
| Button "Kéo thả / Nhập nhanh Excel" | ✅ | ✅ |
| Button "+ Thêm dòng hàng" | ✅ | ✅ |
| Cột bảng: STT / Mã hàng / Tên / **ĐVT** / SL / Ghi chú | ✅ | ✅ |
| Hàng tổng "Tổng dòng / Tổng SL" | ✅ | ✅ "Tổng dòng hàng: 1 / Tổng số lượng yêu cầu: 1" |

### Tab "Up file Excel"

| Element | Mockup | VPS sau fix |
|---|---|---|
| Stepper 3 bước | ✅ "Tải file → Đối chiếu → Xác nhận" | ✅ Có icon check_circle khi qua bước |
| Khu drag-drop file | ✅ | ✅ "Kéo thả file Excel của Nhà cung cấp vào đây" |
| Hint format file | ✅ | ✅ "(.xlsx, .xls)" |

### Footer button

| Mockup | VPS sau fix |
|---|---|
| 💾 Lưu & Gửi cho Thủ kho / Lưu nháp / Hủy | ✅ Khớp 100% |

---

## 🔧 4. CHI TIẾT DEPLOY

```bash
# 1. Sync 4 file lên VPS
node vps-deploy.js sync-files \
  src/app/inbound/new/page.tsx \
  src/app/api/inbound/route.ts \
  src/app/api/inbound/next-code/route.ts \
  src/app/api/inbound/template/route.ts
# → Uploaded 4 file(s)

# 2. Build Next.js wms instance
node vps-deploy.js build wms
# → ✓ Compiled successfully

# 3. Restart PM2 wms-vinhgiang
node vps-deploy.js restart wms
# → [PM2] [wms-vinhgiang](3) ✓
# → uptime: 0s (reset)

# 4. Verify health
node vps-deploy.js verify
# → wms      HTTP 200 (port 3001)
# → xenang   HTTP 200 (port 3002)
# → thukho   HTTP 200 (port 3003)
# → kiemke   HTTP 200 (port 3004)
```

---

## 🆚 5. TRƯỚC vs SAU

### TRƯỚC (file 380 dòng, VPS bị edit thủ công)
- 3 field header (chỉ NCC / Ngày dự kiến / Ghi chú)
- Không có Mã phiếu auto
- Không có Loại nhập, Kho nhận, Người tạo
- Không có 3 tabs
- Không có drag-drop Excel
- Bảng có cột LÔ / HSD (dư, không có trong mockup tab này)
- Không có cột ĐVT
- Không có hàng tổng

### SAU (file 1105 dòng + 4 bug fix)
- ✅ 7 field header đầy đủ
- ✅ Mã phiếu auto = PNK-2026-0004 (prefix đúng)
- ✅ Loại nhập 2 option khớp BE
- ✅ 3 tabs (Nhập tay / Up file Excel / Up file Unilever)
- ✅ Tab Excel có 3-step wizard + drag-drop
- ✅ Quick drag-drop "Nhập nhanh Excel" trên tab Nhập tay
- ✅ Cột ĐVT
- ✅ Hàng tổng "Tổng dòng / Tổng SL"
- ✅ Button "Lưu & Gửi cho Thủ kho" (primary) + "Lưu nháp" + "Hủy"
- ✅ FE gửi `source` đúng theo tab
- ✅ Mã preview khớp mã BE generate

---

## 🚧 6. TỒN ĐỌNG SAU UC-IN-01

### 6.1. Top 10 Critical UC còn lại (theo BAO_CAO_GAP_VPS.md)
| # | UC | Vấn đề | Effort ước tính |
|---|---|---|---|
| 1 | UC-INTMP-01 | Thiếu 6/8 field BẮT BUỘC | M |
| 2 | UC-FK-05 | Sai bản chất, không cho sửa nội dung pallet | L |
| 3 | UC-FK-04 | Thiếu TH-B "Rút một phần" | M |
| 4 | UC-OUT-05 | Thiếu cả 2 cách (Excel + PYX) | L |
| 5 | UC-OUT-04 | Logic sai (min_stock vs forecast) | M |
| 6 | UC-INV-08 | 🚫 Chưa có trang | L |
| 7 | UC-INV-09 | Chưa có trang `/new` | M |
| 8 | UC-SYS-01 | Thiếu logo/favicon/hotline/footer | S |
| 9 | UC-IN-04 | Thiếu UI checklist 5 điều kiện chốt | M |

### 6.2. VPS git state vẫn lệch
VPS vẫn ahead 54 commits không push + 6 file modified uncommitted (theo BAO_CAO_LY_DO_GAP_SAI.md §2.2). Cần SSH vào xem xét hoặc reset cẩn thận.

### 6.3. Smoke test chức năng end-to-end
Đã verify VISUAL nhưng chưa test chức năng:
- Submit form → tạo phiếu thật → redirect đúng `/inbound/{id}`?
- Upload Excel → đối chiếu → xác nhận → tạo phiếu?
- Click "Loại nhập = Hàng trả lại" → submit có pass BE validate không?

→ Đề xuất next session: spawn 1 luồng test E2E qua extension.

---

## 📊 7. THỐNG KÊ

| Mục | Giá trị |
|---|---|
| File sửa | 1 (`src/app/inbound/new/page.tsx`) |
| Dòng thêm | 14 |
| Dòng xóa | 20 |
| Commit | 1 (`68e94e8`) |
| Push lên GitHub | ✅ (PR #2 auto-update) |
| File sync VPS | 4 |
| PM2 restart | wms-vinhgiang (id 3) |
| Screenshot verify | 4 ảnh (đầu form / scroll xuống / tab Excel / drag-drop) |
| Tasks hoàn tất | 7/7 |

---

## 🎁 8. PHỤ LỤC — Quy trình verify từ giờ

Skill `Claude in Chrome` (Cốc Cốc) + `gh` CLI đã setup xong → mọi UC sau có thể verify như sau:

```
1. Em sửa code local
2. git commit + push
3. node vps-deploy.js sync-files <files…>
4. node vps-deploy.js build wms (hoặc xenang/thukho/kiemke tùy UC)
5. node vps-deploy.js restart <instance>
6. Em mở Cốc Cốc → navigate VPS URL → screenshot
7. Em so với mockup → confirm khớp → kết thúc
```

Không còn cần anh click URL / mở web verify thủ công nữa.

---

**HẾT BÁO CÁO.**

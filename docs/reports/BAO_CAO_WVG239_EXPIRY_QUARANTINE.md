# WVG-239 / WMS-007 — Hàng hết hạn vẫn nằm trong tồn khả dụng

## 1. Hiện tượng
Lô có HSD đã qua (vd HSD 23/07/2003, SL 0.05) vẫn **cộng vào tồn khả dụng
(available) + tổng tồn**, và vẫn **xuất kho thường được** (FEFO ưu tiên pick lô
sắp/đã hết hạn trước). Mở `/wms/inventory`, `/wms/inventory/by-lot` thấy hàng hết
hạn lẫn trong tồn bình thường.

## 2. Nguyên nhân gốc
Toàn hệ thống **không có điểm nào lọc theo HSD**. `expiry_date` (nullable,
`@db.Date` trên `PalletLine`) chỉ dùng để **sắp xếp FEFO**, **hiển thị**, và cửa
sổ "sắp hết hạn" (`lte d7/d30` — cận trên → hàng đã hết hạn vẫn lọt). Gate chung
`STOCK_PALLET_STATUSES` chỉ lọc theo **trạng thái pallet**, không đụng HSD. Không
có status/enum/field `BLOCKED/QUARANTINE`.

## 3. Hướng xử lý (được duyệt)
- **Định nghĩa hết hạn**: `expiry_date != null && expiry_date < codeDate(hôm nay GMT+7)`.
  HSD là ngày cuối dùng được → chặn từ **ngày kế tiếp**. Lô `expiry_date = null`
  (không HSD) **không bao giờ** bị chặn.
- **Tính động, KHÔNG thêm cột/enum/migration**: "blocked" suy ra realtime theo
  ngày → luôn đúng, không cần job flip trạng thái mỗi nửa đêm. `on_hand` (vật lý)
  = `available` (khả dụng, loại hết hạn) + `blocked` (hết hạn) → reconcile được.
  Đúng Acceptance "giữ nguyên field/enum/table/workflow, không đổi technical contract".
- **Chặn xuất thường** + tiêu huỷ hàng hết hạn qua quy trình **Điều chỉnh giảm
  (Adjustment DECREASE)** sẵn có (không build override mới).

## 4. Thay đổi
### Helper chính sách (điểm chuẩn hoá)
`src/lib/inventory-expiry.ts`:
- `expiryCutoff(asOf?)` = `warehouseDateParts(asOf).codeDate` (nửa đêm ngày VN, khớp `@db.Date`).
- `isExpired(expiry, asOf?)` (JS-side).
- `expiredLineWhere(cutoff)` = `{ expiry_date: { not: null, lt: cutoff } }`.
- `availableLineWhere(cutoff)` = `{ OR: [{ expiry_date: null }, { expiry_date: { gte: cutoff } }] }`.

### Tách available / blocked / on_hand ở API tổng hợp tồn
| API | Thay đổi |
|---|---|
| `inventory/by-item` | available/staging/confirmed **loại hết hạn**; thêm `blocked_qty`, `sellable_qty`, `alert_blocked`; cảnh báo thiếu/hết hàng theo **sellable** |
| `inventory/by-item/[code]` | thêm `sellable_qty`, `blocked_qty`; mỗi dòng `is_expired` |
| `inventory/by-lot` | mỗi lô `is_expired`/`is_blocked`; `urgency` thêm mức `"expired"` |
| `inventory/by-location` | thêm `blocked_qty_box`/`sellable_qty_box`/`has_expired`; dòng `is_expired` |
| `inventory/by-pallet` | thêm `qty_blocked`/`qty_sellable`/`has_expired` |
| `inventory/alerts` | low-stock theo **sellable**; mức `"expired"` + `summary.expired` |
| `dashboard/kpi` | `total_stock_items` = khả dụng; thêm `blocked_stock_items`/`physical_stock_items`/`expired_items`; "sắp hết hạn" chỉ tính lô còn hạn |
| `dashboard/accountant-kpi` | low-stock theo sellable; thêm `expired_items` |
| `dashboard/manager-kpi` | `total_stock` = khả dụng; thêm `blocked_stock`/`physical_stock` + bucket `expired` |

### Chặn hàng hết hạn khỏi xuất thường (`availableLineWhere`)
| API | Điểm chặn |
|---|---|
| `outbound/requests/[id]` | GET gợi ý pick + tính tồn khớp; PATCH giữ chỗ on-hand; SHIP staging-gate; **SHIP trừ/deduction thực tế** |
| `outbound/staging` | gắn cờ `is_expired` từng dòng + `blocked_qty_box`/`sellable_qty_box` (không xoá pallet — hàng đang nằm đó thật) |
| `forklift/fefo-suggest`, `forklift/fefo-suggestions` | loại lô hết hạn khỏi gợi ý pick |

### UI
- `/wms/inventory` (by-item): KPI **"Chặn xuất (HSD)"**, cột **"Chặn (HSD)"**, badge **"Hết hạn"**, bộ lọc "Đã hết hạn (chặn xuất)".
- `/wms/inventory/by-lot`: ô KPI **"⛔ Hết hạn"**, dòng lô hết hạn tô đỏ đậm + nhãn "⛔ Hết hạn".

## 5. Kiểm thử (evidence)
- Unit `scripts/test-inventory-expiry.ts` — **16/16 pass** (biên GMT+7 nửa đêm, null, chuỗi rác, where-fragment).
- `npx tsc --noEmit` — **sạch**.
- **Live end-to-end** (`localhost:3000`, tài khoản Quản lý): tạm set 1 dòng (mã VG-DA-1000, 7 thùng) → HSD quá khứ, sau đó **revert**:
  - `by-item`: `available 7→0`, `blocked 0→7`, `sellable = total − blocked = 30`, `alert_blocked=true`.
  - `dashboard/kpi`: `total 93→86`, `blocked 0→7`, `physical=93`, `expired_items 0→1`.
  - `fefo-suggest`: **0 gợi ý** (lô hết hạn bị loại) — không pick được.
  - `by-lot`: lô đó `urgency="expired"`, `is_blocked=true`.
  - Sau revert: `total 93`, `blocked 0` — dữ liệu nguyên vẹn.
- Reconciliation `scripts/audit-expired-stock.ts` (READ-ONLY): liệt kê lô hết hạn còn tồn để xử lý qua Điều chỉnh giảm.

## 6. Ghi chú / bám Acceptance
- **Không migration/DB** → deploy chỉ pull + build + restart.
- Append-only, **không sửa dữ liệu cũ**; "blocked" tính động theo ngày.
- Không sai tồn (on_hand = available + blocked reconcile), không mất audit, không mở rộng quyền.
- Hàng hết hạn xử lý bằng quy trình **Adjustment DECREASE** sẵn có (ngoài phạm vi task này).

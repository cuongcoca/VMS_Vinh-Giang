# WVG-238 / WVG-DATA-001 — Baseline reconciliation tồn kho

**Loại:** DATA/QA (không sửa code nghiệp vụ). Deliverable = công cụ đối chiếu
**READ-ONLY** + báo cáo baseline. Nguyên tắc: mọi chênh lệch có **root cause +
owner + disposition**, **KHÔNG chỉnh balance trực tiếp**.

## 1. Phương pháp
Tồn on-hand (universe = `STOCK_PALLET_STATUSES` = IN_STORAGE + IN_STAGING +
CONFIRMED) được tính tại **một thời điểm** theo **5 chiều độc lập** + 1 chiều
ledger, rồi cross-check:

| Chiều | Nguồn | Vai trò |
|---|---|---|
| D1 theo SKU | `palletLine` group by item_code | đối chiếu |
| D2 theo pallet | group by pallet | đối chiếu |
| D3 theo location | group by pallet.location (null → `UNLOCATED`) | đối chiếu |
| D4 theo lot/HSD | group by (item, lot, expiry) | đối chiếu |
| D5 available/blocked | `availableLineWhere`/`expiredLineWhere` (WVG-239) | reconcile khả dụng |
| D6 theo movement | Σ `movement.qty_box` theo type | drift/ledger check |

D1–D4 lấy từ **cùng bảng** `pallet_lines` → bắt buộc bằng nhau; lệch = lỗi
query/dữ liệu mồ côi. Kèm các kiểm tra toàn vẹn: thiếu mã hàng, qty âm, lệch quy
đổi thùng↔lẻ, IN_STORAGE thiếu vị trí, pallet tồn rỗng, movement thiếu qty.

## 2. Công cụ (đã bàn giao)
- `src/lib/inventory-reconcile.ts` — hàm thuần `buildReconciliation()` (test được).
- `scripts/reconcile-inventory.ts` — truy vấn snapshot **read-only**, xuất **JSON + Markdown** ra `docs/reports/reconciliation/reconcile-<timestamp>.{json,md}`.
- `scripts/test-inventory-reconcile.ts` — unit test (**23/23 pass**).
- Chạy: `export $(grep '^DATABASE_URL=' .env | xargs) && npx tsx scripts/reconcile-inventory.ts`.

## 3. Baseline hiện tại (SAU hotfix) — DB dev @ 2026-07-29
Report chi tiết: `docs/reports/reconciliation/reconcile-2026-07-29T09-37.md`.

| Chiều | Tổng | Ghi chú |
|---|---|---|
| Grand (chân lý) | **93 thùng** | 10 dòng · 9 pallet · 2 mã |
| D1 SKU / D2 pallet / D3 location / D4 lot / D5 physical | 93 / 93 / 93 / 93 / 93 | **✓ khớp tuyệt đối** |
| D3 unlocated | 35 | CONFIRMED chưa put-away (hợp lệ) |
| D4 không HSD | 6 | hàng không quản lý hạn |
| D5 available / blocked | 93 / 0 | không có hàng hết hạn tại thời điểm chụp |
| D6 movement | STAGE_OUT 14 · null-qty 6 | ledger |

**5/5 cross-check ✓ → tổng tồn nhất quán tuyệt đối giữa các chiều. Không có chênh lệch mức ERROR.**

## 4. Chênh lệch & disposition (10: 0 ERROR · 9 WARN · 1 INFO)
| Mã | SL | Root cause | Owner | Disposition |
|---|---|---|---|---|
| `UNITS_PER_BOX_UNCONFIGURED` | 9 | `ItemCode.units_per_box` = 1 (chưa cấu hình) trong khi `qty_unit` mang số lẻ thật (vd 20 thùng × 24 = 480) | OPS/BE | Cấu hình lại hệ số quy đổi cho mã hàng. **Không đổi `qty_box` → KHÔNG ảnh hưởng tổng tồn** (93 thùng vẫn đúng). |
| `MOVEMENT_NULL_QTY` | 1 (6 bản ghi) | Movement nguyên-pallet cũ ghi `qty_box=null` (trước WVG-179) | BE | Đã chuẩn hoá từ **WVG-179** trở đi; **không truy hồi** bản ghi cũ (append-only). |

→ Không có chênh lệch ảnh hưởng **tổng tồn thùng** (nguồn chân lý cho khả dụng/xuất kho). Các WARN là **chuẩn hoá đơn vị lẻ** (không đổi qty_box), INFO là **ghi chú ledger lịch sử**.

## 5. Trước → Sau (định tính, qua các hotfix đã merge)
DB đang ở trạng thái **sau** các hotfix; đối chiếu "before" định lượng cần snapshot
DB trước hotfix (chưa có). Cải thiện độ tin cậy baseline đến từ:

| WVG | Rủi ro trước | Sau |
|---|---|---|
| WVG-97 | Pallet thiếu nguồn truy vết | Mọi pallet có `source_type` + ràng buộc |
| WVG-98 | Mã pallet lệch ngày (local time) | Sinh mã theo ngày kho GMT+7 |
| WVG-131 | Trạng thái inbound hiển thị sai bước | UI khớp state machine 6 status |
| WVG-179 | Movement ledger thiếu item/lot/qty | Snapshot đầy đủ mỗi dòng (từ nay) |
| WVG-239 | Hàng hết hạn cộng vào tồn khả dụng | Tách `available`/`blocked` (D5 reconcile) |

## 6. Open points (owner · due · decision)
| # | Nội dung | Owner | Due | Decision/Waiver |
|---|---|---|---|---|
| OP-1 | Cấu hình `units_per_box` cho 2 mã (VG-NM-500, VG-DA-1000) đang =1 | OPS | 2026-08-03 | Không ảnh hưởng tồn thùng → **waiver** khỏi block sprint; xử lý ở data-cleanup |
| OP-2 | 6 movement cũ null qty | BE | — | **Waiver** (append-only, đã fix từ WVG-179) — ref `DEC-VG-STOCK-001` |
| OP-3 | 35 thùng UNLOCATED (CONFIRMED chưa put-away) | OPS | theo vận hành | Hợp lệ nghiệp vụ, không phải sai lệch — ref `WVG-OPS-001` |

## 7. Kiểm thử / evidence
- Unit `scripts/test-inventory-reconcile.ts` — **23/23 pass** (bộ sạch khớp; bộ lỗi bắt đủ 6 loại discrepancy; biên available/blocked).
- `npx tsc --noEmit` — **sạch**.
- Chạy thật DB dev: 5/5 cross-check ✓, 0 ERROR — report `reconcile-2026-07-29T09-37.{json,md}`.

## 8. Bám Acceptance
- Đối chiếu tổng theo SKU/pallet/location/lot-HSD/movement cùng thời điểm ✅.
- Mọi chênh lệch có root cause + owner + disposition ✅; **không chỉnh balance trực tiếp** ✅.
- Evidence/link/version gắn Jira (script + report + commit) ✅; open point có owner/decision ✅.
- Dependency tham chiếu: `DEC-VG-STOCK-001`, `WVG-OPS-001` ✅.
- Không đổi field/enum/table/workflow — thuần công cụ đọc + tài liệu ✅.

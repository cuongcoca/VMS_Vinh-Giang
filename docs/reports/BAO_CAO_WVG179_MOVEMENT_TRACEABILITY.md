# WVG-179 / WMS-006 — Movement log thiếu dữ liệu truy vết

## 1. Hiện tượng
Lịch sử luân chuyển (Movement ledger) của nhiều thao tác **di chuyển nguyên
pallet** chỉ ghi `pallet_id + from/to + type`, còn `item_code_id`, `lot`,
`qty_box`, `qty_unit`, `expiry_date` = **null** → không truy được lúc đó pallet
chứa mã hàng nào, lô nào, HSD ra sao, số lượng bao nhiêu.

## 2. Nguyên nhân gốc
Một pallet có **nhiều dòng hàng** (`PalletLine`), nhưng bảng `Movement` chỉ có
**một** bộ trường item/lot/qty. Các route move nguyên pallet vì thế tạo **1
movement rỗng nội dung** thay vì phản ánh từng dòng. Một số route xuất kho cũng
bỏ sót `lot` / `expiry_date`.

Ledger là **append-only + snapshot**: phải chụp nội dung **tại thời điểm move**,
không suy diễn lại từ trạng thái hiện tại (pallet có thể đã đổi sau đó).

## 3. Hướng xử lý (được duyệt — Phương án A)
- **1 movement / mỗi dòng pallet**, snapshot đầy đủ item/lot/qty/HSD tại thời điểm move.
- Pallet **rỗng** → vẫn ghi 1 movement mức-pallet (không mất sự kiện).
- **Không sửa ngược** dữ liệu cũ (append-only; dòng cũ giữ nguyên).
- **Guard ở tầng app**: tập trung dựng movement qua 1 helper thuần thay vì rải rác.

## 4. Thay đổi
### Helper trung tâm (guard)
`src/lib/movement-snapshot.ts` — `buildMovementSnapshot(ctx, lines)` sinh mảng
`Movement.createMany`: 1 dòng/line (đủ item/lot/qty/HSD), pallet rỗng → 1 dòng
mức-pallet. Đây là điểm chuẩn hoá để không route nào ghi movement thiếu nội dung.

### Các route move nguyên pallet → snapshot theo dòng (`createMany`)
| Route | Loại | Xử lý |
|---|---|---|
| `forklift/put-away` | PUT_AWAY | `createMany` snapshot từng dòng |
| `forklift/relocate` | RELOCATE | `createMany` snapshot từng dòng |
| `forklift/stage-out` (FULL nguyên pallet) | STAGE_OUT | `createMany` snapshot từng dòng |

### Các route cần giữ 1 movement (để gắn `audit_log_id`) → snapshot dòng chính
| Route | Loại | Xử lý |
|---|---|---|
| `forklift/return` | RETURN | giữ 1 row (audit UC-FK-06) + item/lot/qty/HSD dòng chính |
| `outbound/release` | SHIP | giữ 1 row (audit) + item/lot/HSD dòng chính; `qty_box` = tổng xuất |

### Các route đã/được bổ sung field lẻ
| Route | Loại | Xử lý |
|---|---|---|
| `forklift/stage-out` (PARTIAL split & rút nốt) | STAGE_OUT | vốn đã đủ item/lot/qty/HSD |
| `outbound/requests/[id]` | SHIP (FEFO) | vốn có item/qty → **bổ sung `lot` + `expiry_date`** dòng đang xuất |
| `forklift/web/assign` | marker giao việc | không phải move vật lý → **bổ sung `from_location` + actor + reason**; move thật ghi snapshot ở route tương ứng |

### Hiển thị (UI)
`src/app/thukho/warehouse/movements/page.tsx` — mỗi row hiện thêm **SL thùng · lô
· HSD** bên cạnh mã hàng; API `/api/movements` đã sẵn trả `item_code`, còn
lot/qty/HSD nằm trực tiếp trên bản ghi movement.

## 5. Kiểm thử
- `scripts/test-movement-snapshot.ts` — **29/29 pass** (nhiều dòng, pallet rỗng, default null).
- `npx tsc --noEmit` — **sạch**.

## 6. Ảnh hưởng / lưu ý
- Move nguyên pallet nhiều dòng nay tạo **N movement** (mỗi mã 1 dòng) — đúng bản
  chất truy vết; UI hiển thị tách dòng.
- Dữ liệu movement **cũ** không bị sửa (append-only); chỉ sự kiện **từ nay** đủ nội dung.
- `web/assign` là marker giao việc (đích chưa xác định) nên không snapshot qty theo dòng.

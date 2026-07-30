# WVG-16 / WMS-002 — Đối chiếu ma trận quyền (cho BA xác nhận)

Tài liệu này để **BA Main xác nhận ma trận quyền 5 vai trò** theo baseline UC v3.1
(gate #2 trong review). So sánh **ma trận đang chạy** (`src/lib/permissions.ts`,
server-authoritative, deny-by-default) với **UC v3.1** và nêu điểm cần quyết định.

## 1. Mô hình quyền đang chạy
- Quyền = `(role, resource) → level ∈ {none, read, full, special}`. Route khai báo cần `(resource, action)`; `action` read→cần `read`, write→cần `full`, special→cần `special`.
- **Deny-by-default**: role/kết hợp không có trong ma trận → `none` → chặn.
- **Không wildcard**: QUAN_LY được cấp `special` tường minh mọi resource (không phải "*").
- **Legacy ADMIN/MANAGER/STAFF = deny hoàn toàn** (sau fix gate-4); `PENDING` (default user mới) = deny.
- Override ma trận lưu ở DB (`systemConfig.rbac_permission_matrix`), chỉnh tại `/wms/system/permissions`.

## 2. "Sàn đọc" (READ_FLOOR) — điểm KHÁC UC v3.1 cần BA quyết
Ma trận Pha-2 đặt **sàn đọc**: **mọi** vai baseline được `read` các resource nghiệp vụ
(pallet, item_code, supplier, product_group, unit, location, inbound, outbound,
inventory, movement, stock_count, forklift, dashboard, notification, attachment, scan)
để không gãy các màn chỉ đọc. **KHÔNG** gồm `user / system / audit` (nhạy cảm — chỉ QUAN_LY, KE_TOAN được `audit:read`).

→ Hệ quả: một số ô UC v3.1 để trống (không truy cập) thì bản chạy vẫn cho **đọc**. Ví dụ:
| Vai | UC v3.1 (đọc) | Bản chạy (đọc) | Ghi chú |
|---|---|---|---|
| XE_NANG | không có quyền IN/OUT/MD | **read** inbound/outbound/master-data | rộng hơn UC (chỉ đọc) |
| KIEM_KE | không có quyền IN/OUT/FK | **read** inbound/outbound/forklift | rộng hơn UC (chỉ đọc) |
| THU_KHO | OUT chỉ ở mức ◐/không | **read** outbound | rộng hơn UC (chỉ đọc) |

**Rủi ro của sàn đọc:** thấp — chỉ **xem** (GET), không tạo/sửa/xoá, không đụng tồn/audit/quyền. Ghi/duyệt vẫn siết đúng vai (xem §3).

**Đề xuất disposition (BA chọn 1):**
- **(A) Chấp nhận sàn đọc (khuyến nghị cho sprint này)** — ghi waiver: "đọc là low-risk; siết đúng UC để lại Pha-4" (đúng ghi chú trong `permissions.ts`: *"Tinh chỉnh theo UC baseline v3.1 sẽ làm ở Pha 4"*).
- **(B) Siết ngay theo UC v3.1** — bỏ sàn đọc, cấp `read` đúng từng vai theo UC. Đụng nhiều resource, cần regression toàn bộ màn đọc + chạy lại `rbac-live-matrix.ts`. Nên tách task Pha-4 riêng.

## 3. Ma trận GHI/DUYỆT đang chạy (đã siết đúng vai — khớp UC)
| Resource | QUAN_LY | KE_TOAN | THU_KHO | XE_NANG | KIEM_KE |
|---|---|---|---|---|---|
| pallet | special | full | full | full | read |
| item_code | special | full | full | read | read |
| supplier / product_group / unit / location | special | full | full/(read XN,KK) | read | read |
| inbound | special | full | full | read | read |
| outbound | special | full | read | read | read |
| inventory | special | full | full | read | full |
| stock_count | special | full | full | read | full |
| forklift | special | read | read | full | read |
| movement | special | read | read | full | read |
| user | special | none | none | none | none |
| system | special | none | none | none | none |
| audit | special | read | none | none | none |
| dashboard/notification/attachment/scan | special | full | full | full | full |

(Ghi chú: `special ≥ full ≥ read ≥ none`. THU_KHO có full ở master-data để tạo mã hàng nhanh trên mobile — UC-MD-02.)

**Cần BA xác nhận:** các mức **ghi/duyệt** trên có khớp UC v3.1 không (đặc biệt: chỉ QUAN_LY chạm `user/system`; KE_TOAN không ghi `forklift/movement`; KIEM_KE full `stock_count/inventory` nhưng không ghi `inbound`). Và chọn disposition sàn đọc (A/B) ở §2.

## 4. Đối chiếu nhanh với UC v3.1 (tổng quyền/vai)
- QUAN_LY: toàn quyền (special mọi resource) — khớp UC (55/55).
- KE_TOAN: full master-data + chứng từ + tồn + kiểm kê + báo cáo; đọc audit; **không** chạm forklift-write/user/system — khớp UC (41 UC; `⊙` hoàn trả nằm ở luồng nghiệp vụ, không phải resource).
- THU_KHO / XE_NANG / KIEM_KE: full đúng resource vận hành của mình; phần **đọc** rộng hơn UC do sàn đọc (§2).

## 5. Bằng chứng kèm theo
- Unit test ma trận: `scripts/test-permissions.ts` — **61/61 pass** (deny-by-default, phân tầng, legacy/PENDING = deny).
- Negative + positive API 5 vai: `scripts/rbac-live-matrix.ts` — **36/36 pass** (xem `docs/reports/BAO_CAO_WVG16_RBAC_EVIDENCE.md`).

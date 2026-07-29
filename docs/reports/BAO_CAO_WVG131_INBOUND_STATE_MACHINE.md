# WVG-131 / WMS-005 — Luồng nhập kho: State machine chính thức (6 status)

**Bug:** UI hiển thị tiến trình theo mockup **8 bước** nhưng backend chỉ có **6 status** → thanh tiến trình nhảy `1 → 2 → 4 → 7 → 8` (bỏ 3, 5, 6).
**Quyết định (bám Acceptance "không đổi business scope/technical contract"):** **KHÔNG thêm status giả**. Chuẩn hoá **tài liệu + UI** theo đúng **6-status implementation** đang chạy; tiến trình về **5 bước tuyến tính**, `CANCELLED` là trạng thái kết thúc riêng.

---

## 1. Các trạng thái (enum `InboundStatus`)

| Status | Bước tiến trình | Ý nghĩa |
|---|---|---|
| `DRAFT` | 1 | Mới tạo, chưa gửi |
| `PENDING` | 2 | Đã gửi, chờ Thủ kho tiếp nhận |
| `RECEIVING` | 3 | Thủ kho đang nhập SL thực nhận |
| `RECONCILING` | 4 | Kế toán đang đối chiếu |
| `COMPLETED` | 5 | Đã chốt (hàng vào tồn) |
| `CANCELLED` | — (kết thúc) | Đã hủy |

## 2. Transition table (state machine thực tế)

| # | From → To | API / route | Actor (quyền) | Precondition | Hiệu ứng tồn (stock) | Audit event |
|---|---|---|---|---|---|---|
| 0 | (tạo) → `DRAFT` | `POST /api/inbound`, `…/import-excel/confirm` | Kế toán / Thủ kho (`inbound:write`) | — | Không | Tạo phiếu |
| 1 | `DRAFT` → `PENDING` | `POST /api/inbound/[id]/send` | Kế toán (`inbound:write`) | status = `DRAFT` | Không | Gửi phiếu |
| 2 | `PENDING` → `RECEIVING` | `POST /api/inbound/[id]/receive` | Thủ kho (`inbound:write`) | status = `PENDING` | Không | Bắt đầu tiếp nhận (logAudit) |
| 3 | `RECEIVING` → `RECONCILING` | `POST /api/inbound/[id]/finish-receiving` | Thủ kho (`inbound:write`) | status = `RECEIVING` (đã nhập SL) | Không | Gửi đối chiếu |
| 4 | `RECONCILING` → `RECEIVING` | `POST /api/inbound/[id]/request-recheck` | Kế toán (`inbound:write`) | status = `RECONCILING` | Không | Yêu cầu kiểm lại (ghi lý do vào `note`) |
| 5 | `RECONCILING` → `COMPLETED` | `POST /api/inbound/[id]/complete` | Kế toán (`inbound:write`) | status = `RECONCILING` | **CÓ** — pallet của phiếu (≥ `CONFIRMED`) tính vào **tồn khả dụng** (`STOCK_PALLET_STATUSES`) | Chốt phiếu (logAudit) |
| 6 | (active) → `CANCELLED` | `DELETE`/hủy `…/inbound/[id]` | Kế toán / Thủ kho (`inbound:write`) | status ∈ {`PENDING`,`RECEIVING`} (chưa `COMPLETED`) — bắt buộc **lý do** | Hoàn tác pallet/dòng thuộc phiếu | Hủy phiếu (logAudit) |

> **Cấp dòng (không đổi status phiếu):** `…/lines/[lineId]/receive` (nhập SL thực nhận) và `…/lines/[lineId]/accept` (Kế toán duyệt dòng) chỉ đổi trạng thái **dòng hàng** trong bước RECEIVING/RECONCILING — không phải transition của phiếu.

## 3. Sơ đồ

```
DRAFT ──send──▶ PENDING ──receive──▶ RECEIVING ──finish-receiving──▶ RECONCILING ──complete──▶ COMPLETED
                                          ▲                                │
                                          └──────── request-recheck ───────┘
   (PENDING / RECEIVING) ──cancel──▶ CANCELLED
```

## 4. Sửa UI (bám implementation)
- `src/lib/inbound-status.ts` (mới): `INBOUND_TOTAL_STEPS = 5` + map `INBOUND_STATUS_STEP` **liên tiếp** (`DRAFT`=1 … `COMPLETED`=5, `CANCELLED`=0).
- `src/app/inbound/page.tsx` — `InboundStepper` dùng helper → tiến trình chạy **1→2→3→4→5**, không còn nhảy `1→2→4→7→8`.
- Màn chi tiết `inbound/[id]` dùng nhãn status (không có thanh nhảy) → không đổi hành vi.

## 5. Evidence
- Unit `scripts/test-inbound-steps.ts`: **11/11** — 6 status phủ đủ, 5 bước tiến **liên tiếp** (`[1,2,3,4,5]`), `CANCELLED`=0.
- `npx tsc --noEmit`: 0 lỗi.
- Live `/wms/inbound`: thanh tiến trình liên tiếp theo status.

**Không đổi:** enum/schema/DB/route/workflow (giữ technical contract); không đụng tồn kho/audit/quyền (chỉ hiển thị + tài liệu hoá).

# BÁO CÁO MODULE XUẤT KHO — GAP & ĐỀ XUẤT MỞ RỘNG

> **Ngày lập:** 2026-05-28
> **Người lập:** Claude (assistant)
> **Phạm vi:** Phân tích module Xuất kho (Outbound) hiện trạng + đề xuất hoàn thiện luồng "xuất hàng ra bên ngoài" với phân định vai trò rõ ràng cho từng vị trí trong kho.
> **Project:** WMS Vĩnh Giang — FMCG Warehouse (Next.js 16 + Prisma 7 + Postgres)

---

## MỤC LỤC

1. [Tóm tắt điều hành (Executive Summary)](#1-tóm-tắt-điều-hành)
2. [Hiện trạng module Outbound](#2-hiện-trạng-module-outbound)
3. [Phân tích GAP — Thiếu gì](#3-phân-tích-gap--thiếu-gì)
4. [Phân định VAI TRÒ — Ai phụ trách bước nào](#4-phân-định-vai-trò--ai-phụ-trách-bước-nào)
5. [Use Cases ĐỀ XUẤT MỚI (UC-OUT-06 → UC-OUT-15)](#5-use-cases-đề-xuất-mới)
6. [Data model bổ sung](#6-data-model-bổ-sung)
7. [API endpoints cần xây](#7-api-endpoints-cần-xây)
8. [UI pages cần xây](#8-ui-pages-cần-xây)
9. [RBAC matrix mới](#9-rbac-matrix-mới)
10. [Workflow tổng thể đề xuất](#10-workflow-tổng-thể-đề-xuất)
11. [Roadmap triển khai](#11-roadmap-triển-khai)

---

## 1. TÓM TẮT ĐIỀU HÀNH

### 1.1. Vấn đề
Mockup hiện tại **CHỈ CÓ 5 UC-OUT (01–05)**, gồm:
- UC-OUT-01: Xem hàng tại Khu chờ xuất
- UC-OUT-02: Báo cáo Xuất kho tương đối
- UC-OUT-03: Tốc độ luân chuyển
- UC-OUT-04: Gợi ý nhập hàng
- UC-OUT-05: Cân lại tồn (rebalance)

**Thiếu HOÀN TOÀN luồng "xuất hàng ra bên ngoài" theo nghiệp vụ FMCG thực tế:**
- Không có khái niệm **Khách hàng** (chỉ là string `customer`)
- Không có **Phiếu giao hàng (Delivery Note)** để in/ký
- Không có **Pick Assignment** (giao việc lấy hàng cho thủ kho)
- Không có **Cổng kiểm soát xuất** (bảo vệ check trước khi xe rời kho)
- Không có **Mobile UI** cho thủ kho pick hàng / xe nâng đưa ra staging
- Chỉ 1 vai trò làm hết (Kế toán) → vi phạm nguyên tắc tách quyền

### 1.2. Hậu quả nghiệp vụ
| Hậu quả | Mức độ |
|---|---|
| Không truy vết được pallet nào giao cho ai, khi nào, ai pick | 🔴 Nghiêm trọng |
| Không có bằng chứng pháp lý (chữ ký tài xế / phiếu giao) | 🔴 Nghiêm trọng |
| Thủ kho không biết "hôm nay phải pick gì" — phải hỏi miệng | 🟠 Cao |
| Xe nâng không có lệnh cụ thể, dễ chuyển nhầm pallet | 🟠 Cao |
| Không có kiểm soát SL khi xe rời cổng (có khả năng thất thoát) | 🔴 Nghiêm trọng |
| Báo cáo xuất không khớp số sổ kế toán | 🟠 Cao |

### 1.3. Đề xuất
Bổ sung **10 use case mới** (UC-OUT-06 → UC-OUT-15), **4 model dữ liệu mới** (`Customer`, `DeliveryNote`, `PickAssignment`, `GatePass`), **18 API endpoints**, **9 UI pages** (web + mobile). Phân chia 6 vai trò làm việc trên luồng xuất hàng.

---

## 2. HIỆN TRẠNG MODULE OUTBOUND

### 2.1. Code đã có

#### Frontend (7 pages)
| Path | Chức năng | Vai trò dùng |
|---|---|---|
| `/outbound/page.tsx` | Dashboard Khu chờ xuất (IN_STAGING) | Quản lý, Kế toán |
| `/outbound/requests/page.tsx` | Danh sách phiếu yêu cầu xuất (PYX) | Quản lý, Kế toán |
| `/outbound/requests/new/page.tsx` | Form tạo PYX mới | Kế toán |
| `/outbound/requests/[id]/page.tsx` | Chi tiết & action (START_PICKING/SHIP/CANCEL) | Kế toán |
| `/outbound/rebalance/page.tsx` | Cân lại tồn (UC-OUT-05) | Kế toán |
| `/outbound/reorder/page.tsx` | Gợi ý nhập hàng | Quản lý |
| `/outbound/report/page.tsx` | Báo cáo xuất kho | Quản lý, Kế toán |
| `/outbound/turnover/page.tsx` | Tốc độ luân chuyển | Quản lý |

#### Backend (7 API routes)
| Endpoint | Method | Chức năng |
|---|---|---|
| `/api/outbound/staging` | GET | Danh sách pallet IN_STAGING + KPI |
| `/api/outbound/requests` | GET, POST | List + Tạo PYX |
| `/api/outbound/requests/[id]` | GET, PATCH, DELETE | Detail + chuyển status + xóa |
| `/api/outbound/rebalance` | POST | Upload file → trừ tồn |
| `/api/outbound/reorder-suggest` | GET | Gợi ý nhập |
| `/api/outbound/report` | GET | Báo cáo STAGE_OUT |
| `/api/outbound/turnover` | GET | Turnover rate |

### 2.2. Data model hiện có

```prisma
enum OutboundRequestStatus {
  PENDING       // Chờ lấy hàng
  PICKING       // Đang lấy hàng
  SHIPPED       // Đã xuất
  CANCELLED
}

model OutboundRequest {
  id, code (PYX-YYYY-NNNN), code_year, code_seq
  customer          // String — KHÔNG CÓ relation đến model Customer
  ship_date         // Date
  status            // OutboundRequestStatus
  created_by, shipped_by, shipped_at, note, audit_log_id
  lines: OutboundRequestLine[]
}

model OutboundRequestLine {
  id, outbound_request_id, item_code_id
  pallet_id         // Optional — gợi ý, KHÔNG bind nghiêm
  qty_requested, qty_shipped, note
}

model OutboundRebalance {
  id, code, method, status, file_url, ship_date, total_lines, ...
  lines: OutboundRebalanceLine[]
}

// Movement đã có MovementType.STAGE_OUT
// Pallet đã có status IN_STAGING, RELEASED
```

### 2.3. Workflow hiện tại (đơn sơ)

```
Kế toán tạo PYX (PENDING)
        ↓
Kế toán bấm "Start Picking"  →  PICKING
        ↓
[Phần đen — không có UI]
  - Ai pick? Không xác định
  - Pick xong record vào đâu? Chỉ ghi qty_shipped lúc SHIP
  - Pallet đi đâu? IN_STORAGE → IN_STAGING (cần Movement STAGE_OUT)
  - Ai chuyển sang IN_STAGING? Không rõ
        ↓
Kế toán bấm "Ship"  →  SHIPPED
        ↓
[Hết — không có log chi tiết]
  - Không có DeliveryNote
  - Không có chữ ký tài xế
  - Không có kiểm soát ở cổng
```

### 2.4. RBAC hiện tại

| Role | Quyền outbound |
|---|---|
| ADMIN | Tất cả |
| MANAGER / QUAN_LY | Đầy đủ |
| KE_TOAN | Đầy đủ (tạo, duyệt, ship, rebalance) |
| THU_KHO | ❌ Không có quyền |
| XE_NANG | ❌ Không có quyền (chỉ có /forklift/stage-out để chuyển pallet) |
| KIEM_KE | ❌ Không có quyền |
| STAFF | Đầy đủ (đáng nghi vấn, đang trùng KE_TOAN) |

---

## 3. PHÂN TÍCH GAP — THIẾU GÌ

### 3.1. GAP DỮ LIỆU

| GAP | Mô tả | Hệ quả |
|---|---|---|
| **G1. Customer chỉ là string** | `OutboundRequest.customer: String` → không có lịch sử, không có mã số thuế, địa chỉ, SĐT | Không tổng hợp được theo khách, dễ trùng tên ("Cty A" vs "Công ty A") |
| **G2. Không có DeliveryNote** | Không có phiếu giao hàng/phiếu xuất kho định dạng pháp lý | Không in được phiếu giao cho tài xế ký |
| **G3. Không có PickAssignment** | Không phân công thủ kho nào pick PYX nào | Phải gọi điện/nhắn tin offline |
| **G4. Không có Carrier/Vehicle** | Không track xe nào chở | Không khớp với phiếu xuất bên kế toán |
| **G5. Không có GatePass** | Không kiểm soát hàng rời cổng | Có thể thất thoát mà không ai ký nhận |
| **G6. OutboundRequestLine.pallet_id chỉ là gợi ý** | Không enforce — ship rồi tồn vẫn còn | Sai số sổ kế toán |
| **G7. Không track partial pick** | qty_shipped chỉ ghi 1 lần lúc SHIP | Không biết pick mấy lần, từ pallet nào |

### 3.2. GAP NGHIỆP VỤ

| GAP | Mô tả |
|---|---|
| **G8. Không có "Phiếu xe rời kho"** | Bảo vệ không có UI để check hàng + ký xuất |
| **G9. Không có "Hold" cho khách nợ** | Không block PYX khi khách công nợ quá hạn |
| **G10. Không có FEFO enforce khi pick** | Có thể pick lô hết hạn muộn trong khi còn lô sắp hết hạn |
| **G11. Không có ưu tiên đơn** | PYX cùng status PENDING không có priority/SLA |
| **G12. Không có in nháp / preview phiếu giao** | Phải xuất rồi mới biết format |

### 3.3. GAP QUYỀN HẠN

| GAP | Mô tả |
|---|---|
| **G13. Kế toán làm hết** | Vi phạm nguyên tắc tách quyền (segregation of duties) |
| **G14. Thủ kho không có UI picking** | Bị bỏ ngoài luồng, dùng giấy/giao tiếp miệng |
| **G15. Xe nâng không nhận task xuất** | Tự decide chuyển pallet sang khu chờ xuất → có khả năng nhầm |
| **G16. Bảo vệ không có app** | Không track ai check ở cổng |

### 3.4. GAP UI/UX

| GAP | Mô tả |
|---|---|
| **G17. Không có mobile picking app cho thủ kho** | |
| **G18. Không có mobile gate-control cho bảo vệ** | |
| **G19. Không có in PDF phiếu giao** | |
| **G20. Không có signature pad (chữ ký digital tài xế)** | |
| **G21. Không có QR scan trong picking** | Phải gõ mã pallet bằng tay |

---

## 4. PHÂN ĐỊNH VAI TRÒ — AI PHỤ TRÁCH BƯỚC NÀO

> **Triết lý:** Áp dụng nguyên tắc **Segregation of Duties (SoD)** — không ai vừa tạo phiếu vừa giao hàng vừa cập nhật sổ. Mỗi bước có người riêng để chéo kiểm soát.

### 4.1. Bảng phân vai 7 bước xuất hàng

| Bước | Tên bước | Người phụ trách (Primary) | Người hỗ trợ (Secondary) | UC liên quan |
|---|---|---|---|---|
| **B1** | Nhận đơn / Tạo PYX | **Kế toán kho** (KE_TOAN) hoặc **Quản lý** (QUAN_LY) | Sales (nếu có integration) | UC-OUT-06 (mới), UC-OUT-07 (mới) |
| **B2** | Duyệt PYX & phân công picker | **Quản lý kho** (QUAN_LY) | Kế toán | UC-OUT-08 (mới) |
| **B3** | Picker pick hàng (web/mobile) | **Thủ kho** (THU_KHO) — picker chính | Phụ kho | UC-OUT-09 (mới) |
| **B4** | Xe nâng chuyển pallet → khu chờ xuất | **Xe nâng** (XE_NANG) | Thủ kho hướng dẫn | UC-OUT-10 (mới, reuse `/forklift/stage-out`) |
| **B5** | Kiểm soát cổng (gate check) | **Bảo vệ** (BAO_VE — role mới) | Thủ kho ca | UC-OUT-11 (mới) |
| **B6** | Tài xế ký nhận | **Tài xế bên thứ 3** (không login) | Bảo vệ trợ giúp | UC-OUT-12 (mới — signature pad) |
| **B7** | Kế toán đóng phiếu, cập nhật sổ | **Kế toán kho** (KE_TOAN) | — | UC-OUT-13 (mới) |
| **B8** | Khiếu nại / hoàn trả nếu sai | **Kế toán** + **Quản lý** | Thủ kho | UC-OUT-14 (mới — partial return) |

### 4.2. Vai trò mới đề xuất

**BAO_VE** (Bảo vệ kho) — role mới:
- Mục đích: Kiểm soát xe ra vào cổng kho
- Quyền: chỉ truy cập `/gate/*` mobile app
- Tính năng:
  - Quét QR PYX
  - Đối chiếu SL pallet thực tế với danh sách
  - Cho phép xe đi (release gate pass)
  - Block nếu thiếu pallet → notify Quản lý

**SALES_LEAD** (tùy chọn, P2):
- Nhân viên kinh doanh tạo lệnh xuất từ xa
- Quyền: chỉ tạo + xem PYX của mình
- Không ship được — phải qua Kế toán

### 4.3. Matrix RACI cho từng bước

> **R**=Responsible (làm), **A**=Accountable (chịu trách nhiệm cuối), **C**=Consulted (hỏi ý kiến), **I**=Informed (được báo)

| Bước | Sales | Kế toán | QL kho | Thủ kho | Xe nâng | Bảo vệ |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| B1 Tạo PYX | R | A | I | – | – | – |
| B2 Duyệt + phân công | – | C | R, A | I | I | – |
| B3 Picking | – | I | C | R, A | – | – |
| B4 Stage-out (chuyển pallet) | – | – | I | C | R, A | – |
| B5 Gate check | – | I | I | – | – | R, A |
| B6 Tài xế ký | – | I | – | – | – | R |
| B7 Đóng phiếu + sổ | – | R, A | C | – | – | – |
| B8 Hoàn trả | – | R | A | C | C | – |

---

## 5. USE CASES ĐỀ XUẤT MỚI

### 5.1. UC-OUT-06 — Quản lý Khách hàng (Customer Master)
- **Role**: KE_TOAN (CRUD), QUAN_LY (R)
- **Mục đích**: Định danh khách hàng có mã số thuế, địa chỉ, SĐT, hạn mức công nợ
- **Trường data**: `code, name, tax_code, address, phone, email, credit_limit, current_debt, status (ACTIVE/HOLD/BLOCKED)`
- **Liên quan**: UC-OUT-07 link `OutboundRequest.customer_id`

### 5.2. UC-OUT-07 — Tạo PYX với khách hàng định danh
- **Role**: KE_TOAN, SALES_LEAD (nếu có)
- **Bắt buộc**: chọn từ Customer (không free text), check công nợ
- **Validate**: Nếu customer.status=HOLD → cảnh báo + cần QL duyệt
- **Field thêm vào OutboundRequest**:
  - `customer_id` (FK)
  - `delivery_address` (override nếu khác địa chỉ mặc định)
  - `priority` (HIGH/NORMAL/LOW)
  - `expected_ship_time` (DateTime — không chỉ Date)
  - `carrier_name, vehicle_plate, driver_name, driver_phone`
  - `payment_terms` (COD/NET30/PREPAID)

### 5.3. UC-OUT-08 — Duyệt PYX & phân công picker
- **Role**: QUAN_LY
- **Action**:
  - QL xem danh sách PYX status=PENDING
  - Bấm "Duyệt" → status=APPROVED (state mới giữa PENDING và PICKING)
  - Chọn 1-N thủ kho để giao việc → tạo `PickAssignment`
  - Khi assign, tự gợi ý pallet theo FEFO + ưu tiên IN_STORAGE
- **Notification**: Push notification đến Thủ kho được assign

### 5.4. UC-OUT-09 — Thủ kho pick hàng (web + mobile)
- **Role**: THU_KHO (mới có quyền outbound limited)
- **Workflow**:
  1. Thủ kho mở `/thukho/picking` (mobile-first)
  2. List PickAssignment chưa hoàn thành
  3. Bấm vào 1 assignment → list dòng hàng cần pick
  4. Mỗi dòng có gợi ý pallet (FEFO) — thủ kho có thể chọn pallet khác
  5. **Quét QR pallet** để confirm
  6. Nhập SL pick (có thể partial nếu pallet không đủ → pick thêm pallet khác)
  7. Bấm "Pick xong" → tạo `PickEvent` log
- **Field PickEvent**: `pick_assignment_id, line_id, pallet_id, qty_picked, picked_by, picked_at, photo_url (optional)`

### 5.5. UC-OUT-10 — Xe nâng chuyển pallet ra khu chờ xuất
- **Role**: XE_NANG
- **Mở rộng `/forklift/stage-out`** hiện có:
  - Hiện đang là **standalone** (thủ công chọn pallet)
  - **Bổ sung**: Tab "Theo PYX" — list pallet đã được Thủ kho pick xong, cần chuyển ra staging zone của PYX cụ thể
  - Quét QR pallet → confirm chuyển sang IN_STAGING
  - Movement type=STAGE_OUT, link `outbound_request_id`
- **Gợi ý:** dùng location_id của Customer's staging zone (nếu có multi-zone)

### 5.6. UC-OUT-11 — Bảo vệ kiểm soát cổng (Gate Check)
- **Role**: BAO_VE (mới)
- **Workflow**:
  1. Tài xế đến cổng đưa PYX (hoặc QR PYX)
  2. Bảo vệ mở app `/gate/checkout` (mobile)
  3. Quét QR PYX → load danh sách pallet đã stage-out cho PYX này
  4. **Đối chiếu**: app yêu cầu quét từng pallet trên xe (hoặc tick) — đếm có khớp không
  5. Nếu khớp → bấm "OK, cho đi" → tạo `GatePass`, status PYX = `SHIPPED`
  6. Nếu lệch → bấm "Báo cáo lệch" → notify QL + lock xe lại
- **Field GatePass**: `outbound_request_id, checked_by (bảo vệ), checked_at, vehicle_plate, driver_signature_url, pallet_count_expected, pallet_count_actual, status (OK/DISCREPANCY)`

### 5.7. UC-OUT-12 — Chữ ký digital tài xế
- **Role**: TÀI XẾ (không login — UI public với token PYX)
- **Workflow**:
  1. Bảo vệ đưa tablet/điện thoại
  2. App hiện thông tin: PYX code, customer, danh sách hàng, SL tổng
  3. Tài xế ký bằng tay trên màn (signature pad — canvas)
  4. App lưu signature.png → upload → gắn vào `GatePass.driver_signature_url`
  5. Bấm "Tôi đã nhận đủ" → đóng

### 5.8. UC-OUT-13 — Kế toán đóng phiếu & cập nhật sổ
- **Role**: KE_TOAN
- **Workflow**:
  1. Khi GatePass status=OK + PYX status=SHIPPED:
     - Auto-notify Kế toán
  2. Kế toán mở chi tiết PYX, xem:
     - SL yêu cầu vs SL pick vs SL ship
     - Chữ ký tài xế
     - GatePass info
  3. Bấm "Đóng phiếu" → status=COMPLETED
     - Auto-call `/api/outbound/rebalance` để trừ tồn
     - Lock không sửa được nữa
     - Tạo bút toán kế toán (nếu có integration)
- **Báo cáo**: PYX COMPLETED là source-of-truth cho doanh thu xuất

### 5.9. UC-OUT-14 — Hoàn trả một phần (Partial Return)
- **Role**: KE_TOAN + QUAN_LY phê duyệt
- **Trigger**: Khách giao trả hàng vì lỗi chất lượng / sai mã
- **Workflow**:
  1. Mở PYX cũ → bấm "Tạo phiếu trả"
  2. Chọn dòng cần trả + SL
  3. Tạo `OutboundReturn` (model mới) status=PENDING
  4. QL duyệt → status=APPROVED
  5. Thủ kho nhận lại pallet → tạo pallet mới hoặc gắn lại pallet cũ vào kho
  6. Cộng lại tồn

### 5.10. UC-OUT-15 — In phiếu giao hàng (Delivery Note PDF)
- **Role**: KE_TOAN (in chính thức), THU_KHO (in copy)
- **Trigger**: Khi PYX status=APPROVED (sau B2)
- **Output PDF** A4 chứa:
  - Header công ty Vĩnh Giang
  - Mã PYX, ngày
  - Customer info (tên, MST, địa chỉ, SĐT)
  - Bảng dòng hàng: STT, mã, tên, đv, lot, HSD, SL, đơn giá, thành tiền
  - Tổng tiền (nếu có giá)
  - Carrier info (xe + tài xế)
  - 3 ô ký: Bên giao / Bên nhận / Người vận chuyển
  - QR code PYX (cho bảo vệ quét)
- **Library**: `pdfkit` hoặc `puppeteer` server-side

---

## 6. DATA MODEL BỔ SUNG

### 6.1. Model mới

```prisma
// ───── KHÁCH HÀNG ─────
enum CustomerStatus {
  ACTIVE      // Hoạt động bình thường
  HOLD        // Tạm dừng (nợ quá hạn)
  BLOCKED     // Chặn (vi phạm hợp đồng)
}

model Customer {
  id              String         @id @default(uuid()) @db.Uuid
  code            String         @unique @db.VarChar(20)   // KH-2026-0001
  name            String         @db.VarChar(255)
  tax_code        String?        @db.VarChar(20)
  address         String?        @db.Text
  phone           String?        @db.VarChar(20)
  email           String?        @db.VarChar(120)
  credit_limit    Decimal        @default(0) @db.Decimal(15, 2)
  current_debt    Decimal        @default(0) @db.Decimal(15, 2)
  status          CustomerStatus @default(ACTIVE)
  payment_terms   String?        @db.VarChar(20)   // COD | NET15 | NET30 | PREPAID
  default_delivery_address String? @db.Text
  note            String?        @db.Text
  created_by      String?        @db.Uuid
  created_at      DateTime       @default(now())
  updated_at      DateTime       @updatedAt

  requests        OutboundRequest[]
  @@map("customers")
  @@index([status])
  @@index([name])
}

// ───── PHIẾU YÊU CẦU XUẤT (mở rộng) ─────
enum OutboundRequestStatus {
  DRAFT           // Mới (Sales tạo, chưa gửi)
  PENDING         // Đã gửi, chờ QL duyệt           ← THÊM
  APPROVED        // QL đã duyệt                    ← THÊM
  PICKING         // Thủ kho đang lấy
  STAGED          // Đã chuyển ra khu chờ xuất      ← THÊM
  AT_GATE         // Đang ở cổng chờ check          ← THÊM
  SHIPPED         // Đã rời cổng
  COMPLETED       // Kế toán đã đóng sổ             ← THÊM
  CANCELLED
}

// Bổ sung field cho OutboundRequest:
model OutboundRequest {
  ...
  customer_id         String?  @db.Uuid                  // ← THÊM
  delivery_address    String?  @db.Text                   // ← THÊM (override)
  priority            String?  @db.VarChar(10)            // ← THÊM HIGH/NORMAL/LOW
  expected_ship_time  DateTime?                            // ← THÊM
  carrier_name        String?  @db.VarChar(120)           // ← THÊM
  vehicle_plate       String?  @db.VarChar(20)            // ← THÊM
  driver_name         String?  @db.VarChar(120)           // ← THÊM
  driver_phone        String?  @db.VarChar(20)            // ← THÊM
  payment_terms       String?  @db.VarChar(20)            // ← THÊM
  approved_by         String?  @db.Uuid                   // ← THÊM
  approved_at         DateTime?                            // ← THÊM
  completed_by        String?  @db.Uuid                   // ← THÊM
  completed_at        DateTime?                            // ← THÊM
  return_note         String?  @db.Text                   // ← THÊM

  customer            Customer? @relation(fields: [customer_id], references: [id])
  pick_assignments    PickAssignment[]
  pick_events         PickEvent[]
  gate_pass           GatePass?
  returns             OutboundReturn[]
}

// ───── PHIẾU PICKING ─────
enum PickAssignmentStatus {
  ASSIGNED       // QL giao việc, chưa start
  IN_PROGRESS    // Đang pick
  COMPLETED      // Pick xong
  REJECTED       // Thủ kho từ chối (báo bệnh, ca khác...)
}

model PickAssignment {
  id                  String       @id @default(uuid()) @db.Uuid
  outbound_request_id String       @db.Uuid
  assigned_to         String       @db.Uuid       // user_id thủ kho
  assigned_by         String       @db.Uuid       // user_id QL
  status              PickAssignmentStatus @default(ASSIGNED)
  started_at          DateTime?
  completed_at        DateTime?
  note                String?      @db.Text

  request             OutboundRequest @relation(fields: [outbound_request_id], references: [id])
  events              PickEvent[]

  @@map("pick_assignments")
  @@index([assigned_to, status])
}

model PickEvent {
  id                  String       @id @default(uuid()) @db.Uuid
  pick_assignment_id  String       @db.Uuid
  outbound_request_id String       @db.Uuid
  line_id             String       @db.Uuid       // OutboundRequestLine.id
  pallet_id           String       @db.Uuid
  qty_picked          Decimal      @db.Decimal(10, 2)
  picked_by           String       @db.Uuid
  picked_at           DateTime     @default(now())
  photo_url           String?      @db.VarChar(500)
  note                String?      @db.Text

  assignment          PickAssignment @relation(fields: [pick_assignment_id], references: [id])
  request             OutboundRequest @relation(fields: [outbound_request_id], references: [id])
  pallet              Pallet         @relation(fields: [pallet_id], references: [id])

  @@map("pick_events")
  @@index([outbound_request_id])
}

// ───── CỔNG KIỂM SOÁT ─────
enum GatePassStatus {
  PENDING        // Đang check
  OK             // Cho đi
  DISCREPANCY    // Lệch — block
  RELEASED       // Đã rời cổng
}

model GatePass {
  id                    String       @id @default(uuid()) @db.Uuid
  outbound_request_id   String       @unique @db.Uuid
  checked_by            String       @db.Uuid       // user_id bảo vệ
  checked_at            DateTime?
  vehicle_plate         String       @db.VarChar(20)
  driver_name           String       @db.VarChar(120)
  driver_phone          String?      @db.VarChar(20)
  pallet_count_expected Int          @db.SmallInt
  pallet_count_actual   Int?         @db.SmallInt
  discrepancy_reason    String?      @db.Text
  driver_signature_url  String?      @db.VarChar(500)
  status                GatePassStatus @default(PENDING)
  released_at           DateTime?

  request               OutboundRequest @relation(fields: [outbound_request_id], references: [id])

  @@map("gate_passes")
}

// ───── HOÀN TRẢ ─────
enum OutboundReturnStatus {
  PENDING
  APPROVED
  REJECTED
  COMPLETED
}

model OutboundReturn {
  id                  String       @id @default(uuid()) @db.Uuid
  code                String       @unique @db.VarChar(20)
  outbound_request_id String       @db.Uuid
  reason              String       @db.Text
  status              OutboundReturnStatus @default(PENDING)
  created_by          String       @db.Uuid
  approved_by         String?      @db.Uuid
  approved_at         DateTime?
  completed_at        DateTime?

  request             OutboundRequest @relation(fields: [outbound_request_id], references: [id])
  lines               OutboundReturnLine[]

  @@map("outbound_returns")
}

model OutboundReturnLine {
  id                String       @id @default(uuid()) @db.Uuid
  return_id         String       @db.Uuid
  item_code_id      String       @db.Uuid
  qty_returned      Decimal      @db.Decimal(10, 2)
  reason_code       String?      @db.VarChar(40)   // DEFECT | WRONG_ITEM | EXPIRED | OTHER
  new_pallet_id     String?      @db.Uuid          // Pallet mới để nhập lại kho

  return            OutboundReturn @relation(fields: [return_id], references: [id])

  @@map("outbound_return_lines")
}
```

### 6.2. Migration SQL (additive only)

```sql
-- 1. Customer
CREATE TABLE customers (...);
-- 2. OutboundRequest mở rộng
ALTER TABLE outbound_requests
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id),
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(10),
  ADD COLUMN IF NOT EXISTS expected_ship_time TIMESTAMP,
  ADD COLUMN IF NOT EXISTS carrier_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20),
  ADD COLUMN IF NOT EXISTS driver_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS driver_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(20),
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS completed_by UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
-- 3-6. PickAssignment / PickEvent / GatePass / OutboundReturn
CREATE TABLE pick_assignments (...);
CREATE TABLE pick_events (...);
CREATE TABLE gate_passes (...);
CREATE TABLE outbound_returns (...);
CREATE TABLE outbound_return_lines (...);

-- 7. Migrate dữ liệu cũ: customer string → customer record
-- (Optional, manual review từng cái — tạo script seed)
```

**Nguyên tắc:** Tất cả ADD COLUMN dùng `IF NOT EXISTS`, không UPDATE/DELETE data cũ. Khớp constraint memory cũ về VPS công ty.

---

## 7. API ENDPOINTS CẦN XÂY

### 7.1. Customer (UC-OUT-06)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/customers` | GET | KE_TOAN, QUAN_LY | List + filter |
| `/api/customers` | POST | KE_TOAN | Tạo mới |
| `/api/customers/[id]` | GET, PATCH, DELETE | KE_TOAN | CRUD |
| `/api/customers/[id]/hold` | POST | QUAN_LY | Đặt status HOLD/BLOCKED |
| `/api/customers/import-excel` | POST | KE_TOAN | Import mass |

### 7.2. Outbound mở rộng (UC-OUT-07)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/outbound/requests` | POST | KE_TOAN | (Đã có) — sửa nhận `customer_id`, validate công nợ |
| `/api/outbound/requests/[id]/approve` | POST | QUAN_LY | Duyệt (PENDING → APPROVED) |
| `/api/outbound/requests/[id]/assign` | POST | QUAN_LY | Phân công picker — tạo PickAssignment[] |
| `/api/outbound/requests/[id]/print-delivery-note` | GET | KE_TOAN, THU_KHO | Generate PDF |

### 7.3. Picking (UC-OUT-09)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/picking/assignments` | GET | THU_KHO | List của tôi |
| `/api/picking/assignments/[id]` | GET | THU_KHO | Detail + suggested pallets (FEFO) |
| `/api/picking/assignments/[id]/start` | POST | THU_KHO | Bắt đầu pick (status IN_PROGRESS) |
| `/api/picking/assignments/[id]/complete` | POST | THU_KHO | Pick xong |
| `/api/picking/events` | POST | THU_KHO | Ghi PickEvent (mỗi lần quét pallet + nhập SL) |
| `/api/picking/events` | GET | KE_TOAN, QUAN_LY | Audit log picking |

### 7.4. Stage-out theo PYX (UC-OUT-10)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/forklift/stage-out` | POST | XE_NANG | (Đã có) — bổ sung field `outbound_request_id` để link |
| `/api/forklift/stage-out/queue` | GET | XE_NANG | List pallet đã pick xong, chờ chuyển ra staging |

### 7.5. Gate (UC-OUT-11, UC-OUT-12)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/gate/pending` | GET | BAO_VE | List PYX đang ở status STAGED chờ ra cổng |
| `/api/gate/check/[pyx_id]` | GET | BAO_VE | Load chi tiết PYX + pallet list để đếm |
| `/api/gate/check/[pyx_id]/confirm` | POST | BAO_VE | OK / DISCREPANCY → tạo GatePass |
| `/api/gate/sign/[pyx_id]` | POST | (no auth — token) | Upload chữ ký tài xế (file PNG base64) |
| `/api/gate/release/[pyx_id]` | POST | BAO_VE | Cho xe đi (status RELEASED) |

### 7.6. Close & Return (UC-OUT-13, UC-OUT-14)
| Endpoint | Method | Role | Mô tả |
|---|---|---|---|
| `/api/outbound/requests/[id]/complete` | POST | KE_TOAN | Đóng phiếu (SHIPPED → COMPLETED) + auto-rebalance tồn |
| `/api/outbound/returns` | POST | KE_TOAN | Tạo phiếu hoàn trả |
| `/api/outbound/returns/[id]/approve` | POST | QUAN_LY | Duyệt |
| `/api/outbound/returns/[id]/complete` | POST | THU_KHO | Nhận lại pallet vào kho |

**Tổng:** ~22 endpoint mới.

---

## 8. UI PAGES CẦN XÂY

### 8.1. Desktop (Quản lý + Kế toán)
| Path | Role | Use Case |
|---|---|---|
| `/customers` | KE_TOAN, QUAN_LY | Danh sách khách hàng |
| `/customers/new` | KE_TOAN | Form tạo |
| `/customers/[id]` | KE_TOAN | Detail + lịch sử PYX + công nợ |
| `/outbound/requests/[id]/approve` | QUAN_LY | Modal duyệt + assign picker |
| `/outbound/returns` | KE_TOAN, QUAN_LY | List phiếu trả |
| `/outbound/returns/new` | KE_TOAN | Tạo phiếu trả từ PYX cũ |
| `/outbound/returns/[id]` | KE_TOAN | Chi tiết |

### 8.2. Mobile Thủ kho (THU_KHO instance)
| Path | Use Case |
|---|---|
| `/thukho/picking` | UC-OUT-09 — List assignment |
| `/thukho/picking/[id]` | UC-OUT-09 — Pick from PYX |

### 8.3. Mobile Xe nâng (XE_NANG instance)
| Path | Use Case |
|---|---|
| `/forklift/stage-out` (mở rộng tab) | UC-OUT-10 — Stage out theo PYX |

### 8.4. Mobile Bảo vệ (BAO_VE instance — **mới**)
| Path | Use Case |
|---|---|
| `/gate` | Dashboard |
| `/gate/checkout` | UC-OUT-11 — Quét + đối chiếu |
| `/gate/checkout/[id]/sign` | UC-OUT-12 — Signature pad |
| `/gate/history` | Audit gate pass |

### 8.5. PDF
| Path | Mô tả |
|---|---|
| `/api/outbound/requests/[id]/print-delivery-note` | PDF phiếu giao hàng A4 |

**Tổng:** ~14 page mới + 1 PDF route. Cần build thêm instance PM2 thứ 5: `wms-baove` (port 3005).

---

## 9. RBAC MATRIX MỚI

> Đề xuất cập nhật `DEFAULT_ROLE_FEATURES` trong `src/lib/rbac.ts`

| Feature/route | ADMIN | QUAN_LY | KE_TOAN | THU_KHO | XE_NANG | KIEM_KE | **BAO_VE** (mới) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `/customers/*` | ✓ | R | ✓ | – | – | – | – |
| `/outbound` (dashboard) | ✓ | ✓ | ✓ | – | – | – | – |
| `/outbound/requests` (list) | ✓ | ✓ | ✓ | – | – | – | – |
| `/outbound/requests/new` | ✓ | – | ✓ | – | – | – | – |
| `/outbound/requests/[id]/approve` | ✓ | ✓ | – | – | – | – | – |
| `/outbound/requests/[id]/ship` (B7) | ✓ | – | ✓ | – | – | – | – |
| `/outbound/returns/*` | ✓ | R | ✓ | C | – | – | – |
| `/outbound/rebalance` | ✓ | – | ✓ | – | – | – | – |
| `/thukho/picking/*` | – | – | – | **✓** | – | – | – |
| `/forklift/stage-out` | – | – | – | – | ✓ | – | – |
| `/gate/*` (BAO_VE) | – | – | – | – | – | – | **✓** |

**Ý nghĩa:**
- ✓ = full CRUD
- R = read-only
- C = chỉ phần liên quan
- – = không truy cập

---

## 10. WORKFLOW TỔNG THỂ ĐỀ XUẤT

### 10.1. State Machine cho OutboundRequest

```
DRAFT (optional, Sales)
  ↓ submit
PENDING (KE_TOAN đã gửi)
  ↓ approve [QUAN_LY]
APPROVED + PickAssignment[] tạo
  ↓ start_picking [THU_KHO]
PICKING
  ↓ pick_complete + stage_out_complete
STAGED (đã ở khu chờ xuất)
  ↓ arrive_gate
AT_GATE (bảo vệ đang check)
  ↓ confirm_ok [BAO_VE]
SHIPPED (xe đã rời cổng, có chữ ký)
  ↓ close [KE_TOAN]
COMPLETED (sổ đã update)

[CANCELLED có thể từ DRAFT/PENDING/APPROVED — không từ PICKING trở đi]
```

### 10.2. Sơ đồ tuần tự (sequence)

```
Sales/KT    QL kho      Thủ kho     Xe nâng     Bảo vệ      Tài xế      Kế toán
   │           │           │           │           │           │           │
   │ tạo PYX   │           │           │           │           │           │
   │──────────▶│           │           │           │           │           │
   │           │ duyệt     │           │           │           │           │
   │           │ + assign  │           │           │           │           │
   │           │──────────▶│           │           │           │           │
   │           │           │ pick      │           │           │           │
   │           │           │ (QR scan) │           │           │           │
   │           │           │           │ stage_out │           │           │
   │           │           │──────────▶│           │           │           │
   │           │           │           │  (chuyển  │           │           │
   │           │           │           │   pallet) │           │           │
   │           │           │           │──────────▶│           │           │
   │           │           │           │           │ check     │           │
   │           │           │           │           │ pallet    │           │
   │           │           │           │           │           │ ký nhận   │
   │           │           │           │           │◀──────────│           │
   │           │           │           │           │ release   │           │
   │           │           │           │           │ gate      │           │
   │           │           │           │           │──────────────────────▶│
   │           │           │           │           │           │           │ đóng phiếu
   │           │           │           │           │           │           │ + sổ
```

---

## 11. ROADMAP TRIỂN KHAI

> Ước lượng effort dựa trên kinh nghiệm các phase trước (1 dev full-time)

### **Phase X0 — Setup & data model (1 tuần)**
- Tạo branch `feat/outbound-full-flow`
- Viết migration SQL additive (Customer + 5 model mới + ALTER OutboundRequest)
- Apply lên VPS personal trước, test schema
- Cập nhật Prisma client + types

### **Phase X1 — Customer Master (3-4 ngày)**
- Page `/customers/*` (list/new/detail) — desktop
- API customers CRUD + import-excel
- Migrate data cũ: parse string `OutboundRequest.customer` → bulk insert + link `customer_id` (script `prisma/seed-customers-from-pyx.ts`)
- UC-OUT-06

### **Phase X2 — Quản lý duyệt PYX & Phân công (3 ngày)**
- API `/outbound/requests/[id]/approve` + `/assign`
- Page `/outbound/requests/[id]` thêm tab "Phân công"
- Push notification → THU_KHO
- UC-OUT-07, UC-OUT-08

### **Phase X3 — Mobile Picking (1 tuần)**
- Page `/thukho/picking/*` mobile-first
- Camera QR scan pallet (html5-qrcode đã có sẵn)
- API picking/* (assignment, events)
- Cập nhật RBAC THU_KHO có outbound limited
- UC-OUT-09

### **Phase X4 — Stage-out theo PYX (2 ngày)**
- Mở rộng `/forklift/stage-out` thêm tab "Theo PYX"
- API `/api/forklift/stage-out/queue`
- Link movement với outbound_request_id
- UC-OUT-10

### **Phase X5 — Gate Control & Bảo vệ (1.5 tuần)**
- Tạo PM2 instance thứ 5 `wms-baove` (port 3005)
- DEPLOY.md cập nhật BASE_PATH=/baove
- Page `/gate/*` mobile (cho Bảo vệ)
- Signature pad component (canvas-based)
- API gate/*
- Role BAO_VE — thêm vào enum + RBAC
- UC-OUT-11, UC-OUT-12

### **Phase X6 — PDF Phiếu giao hàng (3 ngày)**
- Install `pdfkit` hoặc dùng `puppeteer` (đã có nếu cần chụp QR)
- API `/api/outbound/requests/[id]/print-delivery-note`
- Layout A4 chuẩn pháp lý
- UC-OUT-15

### **Phase X7 — Close & Sổ kế toán (3 ngày)**
- API `/outbound/requests/[id]/complete`
- Auto-link rebalance khi close
- Page `/outbound/requests/[id]` thêm section "Đóng phiếu" (chỉ visible khi SHIPPED)
- UC-OUT-13

### **Phase X8 — Hoàn trả (4-5 ngày)**
- Page `/outbound/returns/*`
- API outbound/returns/*
- Flow approve + nhận lại vào kho
- UC-OUT-14

### **Phase X9 — Test E2E + Training (1 tuần)**
- Viết test case cho 10 UC mới
- Test E2E: tạo PYX → duyệt → pick → stage → gate → ship → close → return
- Training material cho 6 vai trò
- Documentation final

---

### **TỔNG ƯỚC LƯỢNG**

| Phase | Effort | Output chính |
|---|---|---|
| X0 Setup | 1 tuần | Migration + schema |
| X1 Customer | 3-4 ngày | Customer master |
| X2 Approve | 3 ngày | Approval flow |
| X3 Picking | 1 tuần | Mobile picking |
| X4 Stage-out | 2 ngày | Forklift extension |
| X5 Gate | 1.5 tuần | Bảo vệ app + signature |
| X6 PDF | 3 ngày | Delivery note |
| X7 Close | 3 ngày | Accounting close |
| X8 Return | 4-5 ngày | Return flow |
| X9 Test | 1 tuần | E2E + docs |
| **TỔNG** | **~7-8 tuần** | **10 UC + 6 vai trò + 22 API + 14 page** |

---

## 12. CRITICAL DECISIONS CẦN BA/USER CONFIRM TRƯỚC KHI START

| # | Quyết định cần | Option A | Option B | Ghi chú |
|---|---|---|---|---|
| D1 | Có làm Customer master hay giữ string? | ✓ Có | ✗ Giữ string | A khuyến nghị mạnh |
| D2 | Role BAO_VE có cần không? | ✓ Có (tách quyền) | ✗ Gộp vào THU_KHO ca trực | A tốt hơn cho compliance |
| D3 | Sales tạo PYX từ xa? | ✓ Có (role SALES_LEAD) | ✗ Chỉ KE_TOAN | Phụ thuộc model bán hàng |
| D4 | Cần ký digital trên tablet? | ✓ Có (signature pad) | ✗ Tích/chữ ký giấy | A pháp lý mạnh hơn |
| D5 | PDF phiếu giao có giá không? | ✓ Có giá (cần ItemPrice model) | ✗ Không giá | B đơn giản hơn |
| D6 | FEFO bắt buộc khi pick? | ✓ Force (block không-FEFO) | ✗ Cảnh báo + cho ghi đè | A an toàn |
| D7 | Hold customer nợ quá hạn auto? | ✓ Auto theo current_debt | ✗ QL manual | A cần job nightly |

---

## 13. KẾT LUẬN

Module Xuất kho hiện tại mới chỉ có ~30% công năng cần cho FMCG warehouse thực tế. Để đáp ứng chuẩn nghiệp vụ:

1. **Bắt buộc bổ sung 4 model dữ liệu** (Customer, PickAssignment+Event, GatePass, OutboundReturn)
2. **Bắt buộc tạo 1 vai trò mới** (BAO_VE) hoặc gộp vào THU_KHO ca trực
3. **Bắt buộc xây mobile UI cho 3 vai trò** (Thủ kho picking, Bảo vệ gate, Tài xế ký)
4. **Bắt buộc tách quyền 7 bước** — không để 1 vai trò làm hết
5. **Bắt buộc PDF delivery note** cho yêu cầu pháp lý

**Tổng đầu tư:** ~7-8 tuần dev + 1 tuần test/training = **~2 tháng**. ROI rất cao vì giảm thất thoát + truy vết + tự động hóa.

---

> *Báo cáo này dùng làm cơ sở để BA & user quyết định scope chính thức của module Outbound mở rộng. Sau khi nhận được các quyết định D1-D7, sẽ chốt phạm vi và viết roadmap chi tiết hơn (file thay thế cho `ROADMAP_FIX_BUGS_2026-05-27.md` ở phần Outbound).*

— **End of report —**

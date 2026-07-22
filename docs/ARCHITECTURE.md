# ARCHITECTURE — WMS Vĩnh Giang

> Tài liệu kiến trúc kỹ thuật cho hệ thống Quản lý Kho (Warehouse Management System) của Công ty Vĩnh Giang.
> Phiên bản: 1.0 · Ngày: 2026-05-20 · Trạng thái: APPROVED FOR IMPLEMENTATION

---

## 1. Tổng quan dự án

**WMS Vĩnh Giang** là hệ thống quản lý kho hàng tiêu dùng (FMCG) — quản lý vòng đời pallet từ lúc hàng về (Inbound) → xếp vị trí → rút FEFO → khu chờ xuất (Staging-out) → cân lại tồn.

### Nguyên tắc thiết kế chủ đạo

| Nguyên tắc | Diễn giải |
|---|---|
| **Mobile-first cho tác nghiệp** | Thủ kho, Xe nâng, Người kiểm kê làm việc 100% trên điện thoại tại sàn kho. Desktop chỉ dành cho Kế toán & Quản lý. |
| **Pallet là đơn vị quản lý nhỏ nhất** | Mã pallet `PLYYMMDD.STT` (vd `PL260506.011`) — reset STT theo ngày, sinh tự động, chống trùng. |
| **Vị trí kho theo `Khu-Kệ-Tầng`** | Format chuẩn `A-03-02`. 4 loại: Vị trí chứa / Khu chờ nhập / Khu chờ xuất / Khu kiểm kê. |
| **FEFO triệt để** | Mọi gợi ý rút hàng đều ưu tiên HSD cận nhất. Cảnh báo đỏ ≤ 7 ngày, vàng ≤ 30 ngày. |
| **Audit log bắt buộc cho thao tác nhạy cảm** | UC-FK-05 (hoàn trả khu chờ xuất → vị trí) và UC-INV-09 (phiếu điều chỉnh tồn) — ghi đủ ai/khi/giá trị cũ-mới/lý do. |
| **Đơn vị nhập liệu = THÙNG** | Mọi nhập số lượng trên app dùng đơn vị thùng. Hệ thống tự quy đổi sang đơn vị lẻ (chai/gói/lon) theo `quy_cach` trong product. |
| **Đối chiếu hai phía** | Pallet thực tế đối chiếu với Phiếu yêu cầu nhập (PHN). Engine tự phân loại: Khớp / Thiếu / Thừa / Phát sinh / Chờ chuẩn hóa. |

### Số liệu phạm vi

- **56 Use Cases** (42 Must — MVP · 14 Should — Phase 2)
- **11 module nghiệp vụ**
- **5 vai trò người dùng** (Kế toán kho, Thủ kho, Xe nâng, Người kiểm kê, Quản lý)

---

## 2. Tech Stack đề xuất

### 2.1 Frontend — Web (Kế toán & Quản lý)

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR cho trang báo cáo nặng, file-based routing đơn giản, React Server Components giảm bundle. |
| Language | **TypeScript 5.x (strict)** | Bắt lỗi domain phức tạp (pallet, lô, HSD) tại compile time. |
| UI | **Tailwind CSS + shadcn/ui** | Mockup đã dùng utility-class — match nhanh, dễ tuỳ biến. |
| State server | **TanStack Query v5** | Caching, retry, optimistic update cho thao tác đối chiếu/chốt phiếu. |
| State client | **Zustand** | Đơn giản hơn Redux cho local UI state (filter, modal). |
| Form | **React Hook Form + Zod** | Validation phức tạp (quy cách thùng/lẻ, ngày HSD ≥ ngày NSX). |
| Bảng | **TanStack Table v8** | Báo cáo có sort/filter/pagination/export, cell editing inline. |
| Chart | **Recharts** | Đủ cho KPI dashboard, không over-engineer. |
| Excel import/export | **SheetJS (xlsx)** | UC-IN-06 (đọc file NCC lớn) và mọi nút "Xuất Excel". |

### 2.2 Frontend — Mobile (Thủ kho / Xe nâng / Người kiểm kê)

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Framework | **React Native (Expo SDK 51)** | Tái sử dụng kiến thức React, build APK/IPA nhanh, OTA update qua EAS. |
| Camera/QR/Barcode | **expo-camera + expo-barcode-scanner** | Cần cho UC-INT-01 (quét), UC-PAL-03 (đa phương thức nhận diện), UC-INV-06 (quét vị trí). |
| Offline-first | **WatermelonDB (SQLite)** + sync layer | Sàn kho thường mất sóng — phải cho phép thao tác offline rồi đồng bộ. |
| Image upload | **expo-image-picker + expo-file-system** | Chụp chứng từ (UC-INTMP-01), ảnh hiện trường (UC-INV-06). |
| Auth storage | **expo-secure-store** | JWT lưu Keychain/Keystore, không SharedPreferences. |

> Lý do tách 2 codebase: tác vụ web (báo cáo, ma trận phân quyền, cấu hình SMTP) vs mobile (quét, thao tác nhanh trên màn nhỏ) khác bản chất. Một codebase chung sẽ phải compromise nhiều cho cả hai.

### 2.3 Backend

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Cùng ngôn ngữ FE, ecosystem mạnh cho REST/Excel. |
| Framework | **NestJS 10** | Module/Provider rõ ràng — phù hợp domain 11 module. Decorator cho RBAC, ValidationPipe cho Zod/class-validator. |
| ORM | **Prisma 5** | Type-safe, migration tự động, query rõ ràng cho domain có nhiều quan hệ N-N. |
| Auth | **JWT (access + refresh) + Passport** | Access 15p, refresh 7d. Stateless cho mobile, scale dễ. |
| Validation | **Zod (share với FE) + class-validator** | Schema dùng chung FE-BE qua package `@wms/shared-schemas`. |
| File storage | **MinIO (S3-compatible)** self-host | Lưu ảnh chứng từ + file Excel import — tự host trên server VG, không phụ thuộc cloud. |
| Queue | **BullMQ (Redis)** | Cron cảnh báo HSD (UC-INV-05), gửi email, xử lý Excel lớn (UC-IN-06). |
| Email | **Nodemailer + provider tuỳ cấu hình** | UC-SYS-02 — hỗ trợ SMTP / Mailgun / SendGrid theo cấu hình runtime. |

### 2.4 Database & Hạ tầng

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| RDBMS | **PostgreSQL 16** | Transaction ACID cho luồng "rút hàng FEFO" (cần khoá hàng tránh race). JSON column cho audit log diff. |
| Cache / Queue broker | **Redis 7** | BullMQ jobs + session blacklist + cache báo cáo nặng. |
| Object storage | **MinIO** | Ảnh + file Excel. |
| Reverse proxy | **Nginx** | TLS termination, rate-limit, serve static FE. |
| Container | **Docker + Docker Compose** | Triển khai 1 server VPS đầu tiên; Kubernetes nếu mở rộng nhiều kho. |
| Monitor | **Prometheus + Grafana + Loki** | Log nghiệp vụ + metric HTTP latency + cảnh báo. |
| Backup | **pgBackRest** (PostgreSQL) + **mc mirror** (MinIO → NAS) | Backup tự động hàng ngày, retention 30 ngày. |

### 2.5 DevOps

| Lớp | Lựa chọn | Lý do |
|---|---|---|
| Version control | **Git + GitHub (private)** | Chuẩn ngành. |
| CI/CD | **GitHub Actions** | Build/test/lint trên PR, deploy `main` → staging tự động. |
| IaC | **Docker Compose v2 + Ansible** | Đơn giản, đủ cho quy mô 1-3 server. |
| Quản lý version mobile | **EAS Build + EAS Update** | OTA update không cần publish lại lên store. |

---

## 3. Sơ đồ cấu trúc thư mục

### 3.1 Monorepo tổng

```
wms-vinhgiang/
├── apps/
│   ├── api/                    # NestJS backend
│   ├── web/                    # Next.js (Kế toán / Quản lý)
│   └── mobile/                 # Expo React Native (Thủ kho / Xe nâng / Người kiểm kê)
├── packages/
│   ├── shared-schemas/         # Zod schemas dùng chung FE-BE
│   ├── shared-types/           # TypeScript types từ Prisma + DTO
│   └── ui-tokens/              # Color/spacing tokens (web + native)
├── docs/                       # ARCHITECTURE / DATABASE / API_CONTRACTS / CRITICAL_PATHS / SECURITY
├── infra/
│   ├── docker/                 # Dockerfile cho api, web; docker-compose.yml
│   ├── nginx/                  # nginx.conf
│   ├── ansible/                # playbooks deploy
│   └── prometheus/             # prom.yml + alert rules
├── .github/workflows/          # CI/CD
├── RULES.md                    # Quy ước phát triển (LPT)
├── package.json                # workspaces root
├── pnpm-workspace.yaml
└── turbo.json                  # Turborepo build cache
```

### 3.2 `apps/api/` (NestJS) — chi tiết

```
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── decorators/         # @Roles, @CurrentUser, @AuditLog
│   │   ├── guards/             # JwtAuthGuard, RolesGuard
│   │   ├── interceptors/       # AuditLogInterceptor, TransformInterceptor
│   │   ├── filters/            # AllExceptionsFilter (RFC 7807)
│   │   ├── pipes/              # ZodValidationPipe
│   │   └── utils/              # date, FEFO sort, code generators
│   ├── config/                 # config.ts, validation env Zod
│   ├── prisma/                 # PrismaService, prisma.schema link
│   ├── modules/
│   │   ├── auth/               # UC-AUTH-01/03/04
│   │   ├── users/              # UC-SYS-04, UC-AUTH-05, UC-SYS-05
│   │   ├── master-data/
│   │   │   ├── products/       # UC-MD-01
│   │   │   ├── skus/           # UC-MD-02 (mã hàng theo chứng từ)
│   │   │   ├── categories/     # UC-MD-03
│   │   │   ├── units/          # UC-MD-04
│   │   │   ├── locations/      # UC-MD-05
│   │   │   └── suppliers/      # UC-MD-06
│   │   ├── pallets/            # UC-PAL-01..06          [PROTECTED]
│   │   ├── inbound/
│   │   │   ├── requests/       # UC-IN-01, 02, 05
│   │   │   ├── reconcile/      # UC-IN-03               [PROTECTED]
│   │   │   ├── finalize/       # UC-IN-04
│   │   │   └── excel-import/   # UC-IN-06               [PROTECTED]
│   │   ├── inbound-tmp/        # UC-INTMP-01..03
│   │   ├── forklift/
│   │   │   ├── putaway/        # UC-FK-02
│   │   │   ├── relocate/       # UC-FK-03
│   │   │   ├── pick-fefo/      # UC-FK-04               [PROTECTED]
│   │   │   ├── return/         # UC-FK-05               [PROTECTED][AUDIT]
│   │   │   └── movements/      # UC-FK-06
│   │   ├── outbound/
│   │   │   ├── staging/        # UC-OUT-01
│   │   │   ├── reports/        # UC-OUT-02, 03, 04
│   │   │   └── rebalance/      # UC-OUT-05              [PROTECTED]
│   │   ├── inventory/
│   │   │   ├── stock/          # UC-INV-01, 02, 03, 04
│   │   │   ├── alerts/         # UC-INV-05 (cron)
│   │   │   ├── stocktake/      # UC-INV-06, 07, 08
│   │   │   └── adjustments/    # UC-INV-09              [PROTECTED][AUDIT]
│   │   ├── dashboard/          # UC-DASH-01, 02
│   │   ├── system/
│   │   │   ├── settings/       # UC-SYS-01
│   │   │   ├── mail/           # UC-SYS-02
│   │   │   └── audit-log/      # UC-SYS-03              [PROTECTED]
│   │   └── integration/        # Excel export, image upload helpers
│   ├── jobs/                   # BullMQ processors
│   │   ├── hsd-alert.processor.ts
│   │   ├── email.processor.ts
│   │   └── excel-import.processor.ts
│   └── events/                 # Domain events (Pallet.Confirmed, Movement.Created…)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── test/                       # E2E
└── package.json
```

### 3.3 `apps/web/` (Next.js App Router)

```
apps/web/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── layout.tsx          # sidebar role-aware
│   │   ├── page.tsx            # UC-DASH-01
│   │   ├── master-data/
│   │   │   ├── products/
│   │   │   ├── skus/
│   │   │   ├── categories/
│   │   │   ├── units/
│   │   │   ├── locations/
│   │   │   └── suppliers/
│   │   ├── inbound/
│   │   │   ├── requests/
│   │   │   ├── requests/[id]/reconcile/
│   │   │   ├── requests/[id]/finalize/
│   │   │   └── import-excel/
│   │   ├── inbound-tmp/
│   │   ├── pallets/
│   │   ├── movements/
│   │   ├── outbound/
│   │   │   ├── staging/
│   │   │   ├── reports/
│   │   │   └── rebalance/
│   │   ├── inventory/
│   │   │   ├── by-sku/
│   │   │   ├── by-location/
│   │   │   ├── by-pallet/
│   │   │   ├── fefo/
│   │   │   ├── alerts/
│   │   │   ├── stocktake/
│   │   │   └── adjustments/
│   │   └── system/
│   │       ├── users/
│   │       ├── roles/
│   │       ├── audit-log/
│   │       ├── settings/
│   │       ├── mail/
│   │       └── profile/
│   └── api/                    # Route handlers (BFF mỏng, proxy về NestJS)
├── components/
│   ├── ui/                     # shadcn primitives
│   ├── data-table/             # TanStack Table wrapper
│   ├── forms/                  # ProductForm, PalletForm, AdjustmentForm…
│   ├── charts/
│   └── feature/                # Composed feature components
├── lib/
│   ├── api-client.ts           # fetch wrapper với refresh token
│   ├── auth.ts
│   ├── permissions.ts          # canEdit(role, resource)
│   └── excel.ts                # SheetJS helpers
├── hooks/                      # useDebounce, usePagination, useRole
├── stores/                     # Zustand stores
└── public/
```

### 3.4 `apps/mobile/` (Expo)

```
apps/mobile/
├── app/                        # Expo Router file-based
│   ├── (auth)/login.tsx
│   ├── (tabs)/                 # bottom tabs khác nhau theo role
│   │   ├── _layout.tsx         # role-aware tabs
│   │   ├── home.tsx            # Dashboard theo vai trò
│   │   ├── pallets/            # Thủ kho
│   │   ├── inbound/            # Thủ kho — phiếu nhập, nhập tạm
│   │   ├── forklift/           # Xe nâng — putaway/relocate/pick/return
│   │   ├── stocktake/          # Người kiểm kê
│   │   └── profile.tsx
│   └── _layout.tsx
├── src/
│   ├── api/                    # TanStack Query hooks
│   ├── db/                     # WatermelonDB models + sync
│   ├── components/
│   ├── screens/
│   ├── hooks/
│   ├── utils/
│   │   ├── scanner.ts          # barcode/QR
│   │   └── code-format.ts      # PLYYMMDD.STT, A-03-02
│   └── theme/
├── assets/
└── app.json
```

---

## 4. Sơ đồ luồng dữ liệu tổng thể

### 4.1 Kiến trúc hệ thống (high-level)

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────────────┐
│   Mobile (Expo)     │     │   Web (Next.js)     │     │   Email recipients   │
│  Thủ kho · Xe nâng  │     │  Kế toán · Quản lý  │     │  (cảnh báo HSD,      │
│  Người kiểm kê      │     │                     │     │   quên MK, phiếu…)   │
└──────────┬──────────┘     └──────────┬──────────┘     └──────────▲───────────┘
           │ HTTPS                     │ HTTPS                     │
           │ JWT                       │ JWT                       │ SMTP
           ▼                           ▼                           │
       ┌───────────────────────────────────────────────────────────┴─────┐
       │                       NGINX (TLS, rate-limit)                    │
       └───────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
       ┌──────────────────────────────────────────────────────────────────┐
       │                   NestJS API (Node 20)                            │
       │  ┌────────────────────────────────────────────────────────────┐  │
       │  │ Modules: auth · master-data · pallets · inbound · forklift │  │
       │  │          outbound · inventory · dashboard · system · …     │  │
       │  └────────────────────────────────────────────────────────────┘  │
       │  ┌────────────┐  ┌──────────────┐  ┌────────────────────────┐   │
       │  │ JWT Guard  │  │ RBAC Guard   │  │ AuditLog Interceptor   │   │
       │  └────────────┘  └──────────────┘  └────────────────────────┘   │
       └──────┬───────────────────┬──────────────────────┬───────────────┘
              │                   │                      │
              ▼                   ▼                      ▼
       ┌──────────────┐    ┌──────────────┐      ┌──────────────────┐
       │  PostgreSQL  │    │    Redis     │      │   MinIO (S3)     │
       │  (Prisma)    │    │  BullMQ +    │      │  Ảnh + Excel     │
       │              │    │  cache       │      │                  │
       └──────────────┘    └──────┬───────┘      └──────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │ BullMQ Workers  │
                         │ - HSD cron 6:00 │
                         │ - Email sender  │
                         │ - Excel parser  │
                         └─────────────────┘
```

### 4.2 Luồng nghiệp vụ cốt lõi — Inbound (Nhập kho có phiếu)

```
Kế toán (Web)                                Thủ kho (Mobile)              Xe nâng (Mobile)
     │                                              │                            │
     │ UC-IN-01: Lập Phiếu YC nhập (PHN)            │                            │
     │ ─── POST /inbound/requests ──▶ API           │                            │
     │ ◀── 201 Created ──                           │                            │
     │                                              │                            │
     │ (hoặc UC-IN-06: Import Excel)                │                            │
     │ ─── POST /inbound/requests/import-excel ──▶  │                            │
     │     → BullMQ parse → tạo PHN + SKU tạm       │                            │
     │                                              │                            │
     │                                              │ UC-IN-02: Tiếp nhận PHN     │
     │                                              │ PATCH /inbound/requests/:id │
     │                                              │   /accept ──▶               │
     │                                              │                             │
     │                                              │ UC-PAL-01: Tạo Pallet       │
     │                                              │ POST /pallets ──▶           │
     │                                              │ ◀── PL260506.011            │
     │                                              │                             │
     │                                              │ UC-PAL-02: + dòng hàng      │
     │                                              │ POST /pallets/:id/lines ──▶ │
     │                                              │                             │
     │                                              │ UC-PAL-04: Xác nhận pallet  │
     │                                              │ POST /pallets/:id/confirm ▶ │
     │                                              │                             │
     │ UC-IN-03: Engine đối chiếu (auto)            │                             │
     │   ─── Domain event: PalletConfirmed ──▶      │                             │
     │   ◀── Reconcile result tính sẵn ──           │                             │
     │                                              │                             │
     │                                              │                            │ UC-FK-01: Xem DS pallet
     │                                              │                            │ chờ đưa vị trí
     │                                              │                            │ GET /forklift/pending ▶
     │                                              │                            │
     │                                              │                            │ UC-FK-02: Đưa vào vị trí
     │                                              │                            │ POST /forklift/putaway ▶
     │                                              │                            │ (Pallet.location = A-03-02,
     │                                              │                            │  Movement type=PUTAWAY)
     │                                              │                            │
     │ UC-IN-04: Chốt phiếu                         │                             │
     │ POST /inbound/requests/:id/finalize ──▶      │                             │
     │ (Yêu cầu: tất cả pallet đã putaway,          │                             │
     │  mã tạm đã chuẩn hóa, chênh lệch xử lý)      │                             │
     │ ◀── PHN.status = CLOSED                      │                             │
```

### 4.3 Luồng FEFO + Cân lại tồn

```
Xe nâng (Mobile)                          API                              DB / Redis
     │                                     │                                  │
     │ UC-FK-04: Chọn mã cần rút           │                                  │
     │ GET /inventory/fefo?sku=VG-NM-001 ──▶                                  │
     │                                     │ ── SELECT pallets ORDER BY hsd ▶ │
     │                                     │ ◀── DS ưu tiên cận date          │
     │ ◀── [{loc:A-03-02,hsd:28/04,qty:240,priority:1},…]                     │
     │                                     │                                  │
     │ Chọn A-03-02 → POST /forklift/pick  │                                  │
     │ { palletId, qty:240, mode:FULL } ──▶│ BEGIN TX                         │
     │                                     │   SELECT … FOR UPDATE (pallet)   │
     │                                     │   UPDATE pallet SET loc=STAGING  │
     │                                     │   INSERT movement (PICK_FEFO)    │
     │                                     │ COMMIT                           │
     │ ◀── 200 OK + movementId             │                                  │

Kế toán (Web) — UC-OUT-05: Cân lại tồn khu chờ xuất
     │                                     │                                  │
     │ Upload file SL đã xuất              │                                  │
     │ POST /outbound/rebalance ──▶        │ BullMQ: parse + match            │
     │                                     │ ◀── preview diff (chênh lệch)    │
     │ ◀── 202 Accepted + jobId            │                                  │
     │ Xác nhận preview                    │                                  │
     │ POST /outbound/rebalance/:job/apply ▶ TX: trừ tồn staging-out          │
     │                                     │   + ghi audit log                │
     │                                     │   + Movement type=REBALANCE      │
```

### 4.4 Luồng kiểm kê → điều chỉnh tồn

```
Người KK (Mobile)                  Kế toán (Web)                Quản lý (Web)
     │                                  │                            │
     │ UC-INV-06/07: Quét vị trí        │                            │
     │ → Đếm thực tế → Ghi chênh lệch   │                            │
     │ POST /stocktake/lines ──▶        │                            │
     │                                  │                            │
     │                                  │ UC-INV-08: Duyệt từng dòng │
     │                                  │ chênh lệch                 │
     │                                  │ → "Chấp nhận"              │
     │                                  │                            │
     │                                  │ UC-INV-09: Tạo phiếu ADJ   │
     │                                  │ POST /inventory/adjustments│
     │                                  │   { reason, lines… }       │
     │                                  │                            │
     │                                  │                            │ Quản lý duyệt
     │                                  │                            │ PATCH /…/approve
     │                                  │                            │ → AUDIT LOG ghi
     │                                  │                            │   ai/khi/cũ→mới/lý do
     │                                  │                            │ → Trừ/cộng tồn thực
```

---

## 5. Các service bên ngoài

| Service | Vai trò | UC sử dụng | Lý do chọn |
|---|---|---|---|
| **SMTP / Mailgun / SendGrid** (tuỳ cấu hình runtime) | Gửi email cảnh báo HSD, quên mật khẩu, thông báo phiếu chốt | UC-AUTH-04, UC-INV-05, UC-IN-04, UC-SYS-02 | Quản lý chọn provider trong app, không hard-code. Test mail trước khi lưu. |
| **MinIO** (self-host, S3-compatible) | Lưu ảnh chứng từ, ảnh hiện trường kiểm kê, file Excel import | UC-INTMP-01 (ảnh chứng từ), UC-INV-06 (ảnh hiện trường), UC-IN-06 (file Excel NCC) | Tự host trên server VG — dữ liệu nội bộ không đẩy lên cloud bên thứ 3. |
| **Expo EAS** | Build APK/IPA + OTA update | Tất cả UC mobile | Tránh phải submit Play Store mỗi bản update nhỏ. |
| **Sentry** (optional) | Crash report mobile + web | Tất cả | Bắt sự cố sớm khi triển khai cho 5 vai trò khác nhau ở môi trường thực. |

> **Không phụ thuộc:** Hệ thống không gọi API bên thứ 3 cho nghiệp vụ chính. Toàn bộ data flow nằm trong intranet VG. Email là dịch vụ duy nhất bắt buộc out-bound.

---

## 6. Quyết định kiến trúc (ADR tóm tắt)

| # | Quyết định | Lý do | Alternative đã loại |
|---|---|---|---|
| ADR-01 | Monorepo (pnpm + Turborepo) | Share schemas/types FE-BE, build cache | Polyrepo — sync schema phiền |
| ADR-02 | Tách web & mobile (không React Native Web) | UX khác bản chất | Single codebase — compromise UX nhiều |
| ADR-03 | PostgreSQL thay vì MySQL | Transaction phức tạp (FEFO race), JSON cho audit log | MySQL — kém về JSON & advisory locks |
| ADR-04 | Offline-first cho mobile | Sàn kho mất sóng thường xuyên | Online-only — chặn tác nghiệp |
| ADR-05 | Self-host MinIO thay vì S3/GCS | Dữ liệu kho không đẩy ra cloud | Cloud — chi phí + lo về data sovereignty |
| ADR-06 | JWT thay vì session cookie | Mobile + web cùng API | Session — không tốt cho native |
| ADR-07 | BullMQ thay vì cron OS | Retry, dead-letter, observable | Cron — không track được |
| ADR-08 | Đơn vị nhập = THÙNG, lưu cả `qty_box` & `qty_unit` | Tránh sai số float, đối chiếu chính xác | Lưu chỉ unit — round error khi quy đổi |

---

## 7. Tham chiếu

- [DATABASE.md](DATABASE.md) — Schema chi tiết các bảng
- [API_CONTRACTS.md](API_CONTRACTS.md) — Endpoints
- [CRITICAL_PATHS.md](CRITICAL_PATHS.md) — Luồng nghiệp vụ quan trọng, file PROTECTED
- [SECURITY.md](SECURITY.md) — Mô hình bảo mật
- [../RULES.md](../RULES.md) — Quy ước phát triển

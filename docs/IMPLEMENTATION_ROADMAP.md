# IMPLEMENTATION ROADMAP — WMS Vĩnh Giang

> Đề xuất thứ tự triển khai 11 module theo dependency order. Suy ra từ 56 use cases và Critical Paths.
> Phiên bản: 1.0 · Ngày: 2026-05-20

---

## 0. Tổng quan chiến lược

- **Mô hình:** 2 phase chính — **Phase 1 MVP (42 UC Must)** + **Phase 2 (14 UC Should)**.
- **Sprint:** 2 tuần. Tổng MVP ước tính **18 tuần (9 sprint)** với team chuẩn (xem §7).
- **Nguyên tắc:**
  - Module nền (Auth, Master Data) phải xong trước — chặn mọi thứ khác.
  - Pallet là "đơn vị quản lý nhỏ nhất" → ngay sau master data.
  - Flow nhập trước flow xuất (xuất phụ thuộc có tồn).
  - Báo cáo & Dashboard nằm cuối Phase 1 (cần data thật).
  - UC `Should` không vào Phase 1 trừ khi unblock cho UC khác.

---

## 1. Phụ thuộc giữa các module (Dependency Graph)

```
                       ┌──────────────────────┐
                       │   AUTH (M01)         │
                       │   - JWT, RBAC        │
                       │   - 5 roles seed     │
                       └─────────┬────────────┘
                                 │ (blocker mọi thứ)
                                 │
              ┌──────────────────┼──────────────────────┐
              ▼                  ▼                      ▼
       ┌────────────┐      ┌────────────┐       ┌─────────────┐
       │  SYS (M10) │      │  MD (M02)  │       │  INT (M11)  │
       │ user,mail, │      │ products,  │       │ barcode,    │
       │ settings,  │◀─────│ skus, loc, │       │ excel exp,  │
       │ audit-log  │      │ suppliers, │       │ upload util │
       └─────┬──────┘      │ category,  │       └──────┬──────┘
             │             │ units      │              │
             │             └─────┬──────┘              │
             │                   │                     │
             │                   ▼                     │
             │         ┌─────────────────┐             │
             │         │  PAL (M03)      │◀────────────┤
             │         │  pallet CRUD,   │             │
             │         │  confirm,       │             │
             │         │  unlock         │             │
             │         └────────┬────────┘             │
             │                  │                      │
             │     ┌────────────┴───────────┐          │
             │     │                        │          │
             │     ▼                        ▼          │
             │ ┌──────────┐         ┌──────────────┐   │
             │ │ IN (M04) │         │ INTMP (M05)  │   │
             │ │ phiếu YC │         │ phiếu tạm    │   │
             │ │ + Excel  │◀────────│ + chuẩn hoá  │   │
             │ │ import   │         │              │   │
             │ └────┬─────┘         └──────┬───────┘   │
             │      │                      │           │
             │      └──────────┬───────────┘           │
             │                 │                       │
             │                 ▼                       │
             │           ┌──────────┐                  │
             │           │ FK (M06) │                  │
             │           │ putaway, │                  │
             │           │ relocate,│                  │
             │           │ FEFO,    │                  │
             │           │ return   │                  │
             │           └────┬─────┘                  │
             │                │                        │
             │     ┌──────────┴──────────┐             │
             │     ▼                     ▼             │
             │ ┌──────────┐        ┌──────────┐        │
             │ │OUT (M07) │        │ INV (M08)│        │
             │ │ staging, │        │ stock,   │        │
             │ │ rebalance│◀───────│ stocktake│        │
             │ │ reports  │        │ adjust   │        │
             │ └────┬─────┘        └────┬─────┘        │
             │     │                    │              │
             │     └────────┬───────────┘              │
             │              │                          │
             │              ▼                          │
             │       ┌──────────────┐                  │
             └──────▶│ DASH (M09)   │◀─────────────────┘
                     │ widgets +    │
                     │ KPI          │
                     └──────────────┘
```

**Mũi tên** = "phụ thuộc". Module sau dùng output của module trước.

---

## 2. Thứ tự triển khai chi tiết

### Sprint 0 (1 tuần) — **FOUNDATION**

Mục tiêu: Hạ tầng repo + CI/CD + skeleton 3 app + DB local lên xanh.

- Init monorepo (pnpm + Turborepo).
- Setup `apps/api` (NestJS skeleton), `apps/web` (Next.js skeleton), `apps/mobile` (Expo skeleton).
- Docker Compose: Postgres + Redis + MinIO + Mailhog (dev) chạy được.
- Prisma init + schema rỗng.
- CI GitHub Actions: lint, typecheck, test, build.
- Setup ESLint, Prettier, Husky, lint-staged, gitleaks.
- Setup CODEOWNERS từ [CRITICAL_PATHS.md §13](CRITICAL_PATHS.md).
- Setup logger Pino + healthcheck endpoint.

**Deliverable:** Repo có thể clone, `pnpm dev` chạy 3 app, CI xanh.

---

### Sprint 1–2 (4 tuần) — **M01 AUTH + M10 SYS (core) + M11 INT (foundations)**

#### M01 — AUTH (UC-AUTH-01, 03, 04, 05)
- Schema `users`, `roles`, `permissions`, `role_permissions`, `user_sessions`, `password_resets`.
- Seed 5 roles + permissions ma trận mặc định (§2.3 SECURITY.md).
- Endpoints: login, refresh, logout, forgot/reset password, change password, /me.
- Guards: JwtAuthGuard, PermissionsGuard, default-deny.
- AuditLog interceptor + service (M10 core hỗ trợ).
- FE Web: trang login + auth context + protected routes.
- FE Mobile: trang login + secure-store token.

#### M10 — SYS (UC-SYS-03, 04, 05 — Audit & User CRUD)
- Schema `audit_logs` + trigger BEFORE UPDATE/DELETE.
- Service AuditLog (append-only).
- Endpoints: /users CRUD, /me, /system/audit-logs.
- FE Web: trang quản lý user, ma trận quyền (UC-AUTH-05).

#### M11 — INT (UC-INT-01, 03 foundation)
- `attachments` table + upload service MinIO.
- Excel export helper (SheetJS).
- Barcode lookup endpoint (rỗng — sẽ wire data khi có products).

**Deliverable:**
- 5 user mỗi role login được.
- Manager cấu hình quyền được (UI ma trận).
- Audit log ghi nhận login + sửa quyền.
- Upload ảnh test thành công.

---

### Sprint 3 (2 tuần) — **M02 MASTER DATA**

UC-MD-01 → UC-MD-06.

- Schema: `categories`, `units`, `products`, `skus`, `locations`, `suppliers`.
- Endpoints CRUD đầy đủ + import/export Excel cho products.
- FE Web: 6 trang CRUD theo mockup (sidebar dữ liệu gốc).
- FE Mobile: form "Tạo mã hàng nhanh" cho thủ kho (UC-MD-02).
- Bulk-create locations theo layout (UC-MD-05).
- QR generate cho location (PNG/SVG).

**Deliverable:**
- Kế toán nhập đủ master data (sample 100 products, 50 locations, 5 suppliers).
- Thủ kho tạo nhanh SKU theo chứng từ trên mobile.

---

### Sprint 4 (2 tuần) — **M03 PALLET**

UC-PAL-01 → UC-PAL-06.

- Schema: `pallets`, `pallet_lines`.
- Service sinh code `PLYYMMDD.STT` với advisory lock (🔒 PROTECTED).
- Endpoints: create pallet, add/edit/delete line, confirm, unlock (audit).
- FE Mobile: flow "Pallet của tôi" → "Tạo pallet" → "Thêm dòng" (theo thùng + auto convert) → "Xác nhận".
- FE Web (read-only): danh sách pallet + chi tiết, dành cho kế toán/quản lý.

**Deliverable:**
- Thủ kho tạo + cập nhật + xác nhận pallet đầy đủ trên mobile.
- Test concurrent: 5 thủ kho cùng bấm tạo → không trùng code.

---

### Sprint 5 (2 tuần) — **M04 INBOUND (PHN có phiếu) + M05 INBOUND TMP (phiếu tạm)**

UC-IN-01..05 (trừ -06), UC-INTMP-01..02.

#### M04 (không bao gồm Excel import — đẩy sang Sprint 6)
- Schema: `inbound_requests`, `inbound_request_lines`.
- Endpoints: CRUD PHN, accept, reconcile (🔒 engine), finalize (🔒).
- FE Web: trang lập PHN (nhập tay), theo dõi tiến độ 8 trạng thái, đối chiếu, chốt.
- FE Mobile: trang tiếp nhận PHN (Thủ kho).

#### M05
- Schema: `inbound_temps`, `inbound_temp_lines`.
- Endpoints: tạo phiếu tạm (mobile), standardize (web).
- FE Mobile: form tạo PNT với ảnh chứng từ.
- FE Web: trang chuẩn hoá 3 bước.

**Deliverable:**
- Hoàn thành luồng nhập có phiếu manual (chưa Excel).
- Hoàn thành luồng nhập đột xuất + chuẩn hoá.

---

### Sprint 6 (2 tuần) — **M04 Excel Import (UC-IN-06) + M06 FORKLIFT (putaway + relocate)**

#### UC-IN-06 — Excel import NCC lớn
- Schema: `excel_imports`.
- BullMQ processor parse file (🔒).
- Endpoints: upload, get preview, commit.
- FE Web: 3 bước (upload, preview, hoàn tất) theo mockup.

#### M06 FORKLIFT — phần 1
- Schema: `movements` (đầy đủ).
- Service: putaway (🔒) + relocate (🔒).
- Endpoints: /forklift/pallets-pending, /putaway, /relocate, /movements.
- FE Mobile: 2 flow putaway và relocate.

**Deliverable:**
- Excel NCC lớn (file mẫu Unilever 142 dòng) parse & tạo PHN thành công.
- Xe nâng xếp pallet vào vị trí, di chuyển nội bộ.

---

### Sprint 7 (2 tuần) — **M06 FORKLIFT (FEFO + Return) + M07 OUTBOUND (staging view)**

#### M06 — phần 2
- Service: FEFO engine (🔒) + pick (🔒) + return (🔒🔒 AUDIT bắt buộc).
- Endpoints: /forklift/fefo-suggestions, /pick-fefo, /return.
- FE Mobile: 2 flow pick FEFO (gợi ý ưu tiên) và return (form full sửa nội dung).

#### M07 — phần 1 (UC-OUT-01)
- Endpoint /outbound/staging.
- FE Web: trang khu chờ xuất, cảnh báo HSD.

**Deliverable:**
- Luồng FEFO end-to-end: nhập → vị trí → rút → khu chờ xuất.
- Trả pallet về vị trí có sửa nội dung được, audit log đầy đủ.

---

### Sprint 8 (2 tuần) — **M08 INVENTORY + M07 OUTBOUND (rebalance UC-OUT-05)**

#### M08 — phần 1 (UC-INV-01, 02, 03, 06, 07)
- Endpoints báo cáo: by-sku, by-location, by-pallet.
- Schema: `stocktake_sessions`, `stocktake_lines`.
- Endpoints kiểm kê: tạo session, scan-location, ghi line.
- FE Web: 3 trang báo cáo tồn.
- FE Mobile: flow kiểm kê theo vị trí (3 bước theo mockup).

#### M07 — UC-OUT-05 Cân lại tồn
- Schema: `outbound_rebalances`, `outbound_rebalance_lines`.
- Service: parser + apply (🔒).
- FE Web: 2 cách (file SL xuất, file phiếu yêu cầu xuất).

**Deliverable:**
- Báo cáo tồn 3 chiều chạy được với data thật.
- Người KK kiểm kê theo vị trí trên mobile xong.
- Kế toán cân lại tồn khu chờ xuất.

---

### Sprint 9 (2 tuần) — **M09 DASHBOARD + M10 SYS (mail config) + Hoàn thiện Phase 1**

#### M09 — UC-DASH-01
- Endpoint /dashboard role-aware.
- FE Web: dashboard cho kế toán.
- FE Mobile: dashboard cho thủ kho, xe nâng (UC-DASH-01 mobile).

#### M10 — UC-SYS-01, UC-SYS-02
- Schema: `app_settings`, `mail_settings`, `mail_logs`.
- Endpoints: GET/PUT settings, mail config, test mail.
- FE Web: trang cấu hình chung + cấu hình SMTP với test.

#### UAT + Bug fix
- Tổ chức UAT với 5 vai trò.
- Sửa bug P1/P2.
- Performance test luồng nhập 1000 pallet.
- Security pen-test sơ bộ.

**Deliverable:**
- 42 UC Must complete.
- Hệ thống sẵn sàng pilot 1 tuần với 1 kho thật.

---

## 3. Phase 2 (UC Should — 4 sprint, 8 tuần)

### Sprint 10–11 — **Reports nâng cao**

- UC-OUT-02 Báo cáo Xuất kho tương đối.
- UC-OUT-03 Báo cáo Tốc độ luân chuyển.
- UC-OUT-04 Gợi ý nhập hàng.
- UC-INV-04 Báo cáo FEFO toàn kho.
- UC-INV-05 Cảnh báo HSD & Tồn thấp (cron + email).
- UC-DASH-02 KPI tổng quan (Quản lý).

### Sprint 12 — **Kiểm kê & điều chỉnh hoàn chỉnh**

- UC-INV-08 Xử lý chênh lệch kiểm kê.
- UC-INV-09 Phiếu điều chỉnh tồn (🔒🔒 AUDIT).
- UC-INTMP-03 Theo dõi tồn tạm.

### Sprint 13 — **Tiện ích & polishing**

- UC-PAL-03 Nhận diện mã hàng đa phương thức (camera, OCR ảnh vỏ thùng).
- UC-PAL-05 Sửa Pallet sau khi xác nhận (đã có ở Sprint 4, polish UI + audit).
- UC-MD-06 Nhà cung cấp (nếu chưa hoàn chỉnh ở Sprint 3).
- UC-INT-02 Chụp ảnh chứng từ/hàng hoá (mọi flow).
- UC-INT-03 Xuất Excel báo cáo (cho mọi báo cáo mới).

---

## 4. Tiêu chí Definition of Done (DoD) cho mỗi UC

- [ ] Code FE + BE + (mobile nếu có) đã review & merge.
- [ ] Schema migration đã merge & test.
- [ ] Unit test ≥ 80%, integration test happy + error.
- [ ] Documentation cập nhật (API_CONTRACTS, DATABASE, CRITICAL_PATHS).
- [ ] Manual QA pass theo test plan trong PR.
- [ ] Mockup khớp ≥ 90% (screenshot so sánh).
- [ ] Performance budget đạt (xem [RULES.md §11](../RULES.md)).
- [ ] Audit log đầy đủ (nếu UC trong list bắt buộc).
- [ ] Permission rõ ràng (decorator + ma trận quyền update).
- [ ] Demo cho stakeholder (Kế toán/Thủ kho/Xe nâng) trước khi đóng UC.

---

## 5. Risk Register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Race condition khi tạo pallet trong giờ cao điểm | 🟥 BLOCKER | Advisory lock + load test với 20 concurrent users từ Sprint 4 |
| R2 | Excel NCC format thay đổi liên tục | 🟧 HIGH | Tách parser config-driven, có schema mapping cấu hình runtime |
| R3 | FEFO engine sai gợi ý (lệch HSD) | 🟥 BLOCKER | Test fixture phủ 10 case (nhiều lô cùng date, lô không HSD, …) trước go-live |
| R4 | Mobile offline sync conflict | 🟧 HIGH | Last-write-wins cho master data, conflict resolution cho pallet (manual review) |
| R5 | Audit log table phình to | 🟨 MEDIUM | Partitioning theo tháng từ Sprint 8, archive ≥ 1 năm |
| R6 | Người dùng kháng cự thay đổi quy trình | 🟧 HIGH | Training song song mỗi sprint, có super user là mentor cho từng role |
| R7 | Mất sóng wifi giữa các khu kho | 🟧 HIGH | Khảo sát coverage trước go-live, lắp thêm AP nếu cần; offline-first đã handle |
| R8 | Bug đối chiếu (UC-IN-03) chốt nhầm phiếu | 🟥 BLOCKER | Engine có integration test cover 5 trạng thái; manual UAT cẩn thận sprint 5 |
| R9 | Hiệu năng báo cáo tồn kho > 10k SKU | 🟨 MEDIUM | Index + cache Redis cho query nặng; pagination/virtualization UI |
| R10 | Chuyển dữ liệu từ hệ thống cũ | 🟧 HIGH | Script migration riêng + verification report; chạy thử 3 lần trên staging |

---

## 6. Critical Path tổng hợp (Gantt-style)

```
Tuần:        1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17 18 |  19-26 (Phase 2)
─────────────────────────────────────────────────────────────────────┼──────────────
S0 Found.   ■■                                                       │
S1-2 AUTH+  ■■■■■                                                    │
S3 MD          ■■■■                                                  │
S4 PAL              ■■■■                                             │
S5 IN+TMP              ■■■■                                          │
S6 IN-Excel               ■■■■                                       │
   +FK pt1                                                           │
S7 FK pt2                     ■■■■                                   │
   +OUT pt1                                                          │
S8 INV+OUT                       ■■■■                                │
S9 DASH+SYS                           ■■■■                           │
                                                                     │
S10-11 Reports                                                       │ ■■■■
S12 Stk+ADJ                                                          │      ■■■
S13 Polish                                                           │         ■■

Pilot start: Tuần 19 (1 tuần) → Go-live Tuần 20
```

---

## 7. Team đề xuất

| Role | Số người | Thời gian (FT) |
|---|---|---|
| Tech Lead / Full-stack | 1 | Toàn dự án |
| Backend Engineer (NestJS) | 2 | Toàn dự án |
| Frontend Engineer (Next.js) | 1 | S0–S9 |
| Mobile Engineer (Expo) | 1 | S2–S9 (chính), S10-13 polish |
| QA Engineer | 1 | S2–S13 |
| DevOps | 0.5 | S0–S1 setup, on-call sau |
| Product Owner / BA | 1 | Toàn dự án |
| Designer | 0.5 | S0–S3 (đã có mockup), polish sau |

**Tổng:** 7–8 người (≈ 6 FTE).

---

## 8. Quick reference — Module ↔ UC ↔ Sprint

| Module | Code | UCs | Sprint |
|---|---|---|---|
| Auth | M01 | UC-AUTH-01, 03, 04, 05 | S1-S2 |
| Master Data | M02 | UC-MD-01..06 | S3 (Should: MD-06 polish ở S13) |
| Pallet | M03 | UC-PAL-01, 02, 04, 06 (Must); UC-PAL-03, 05 (S13) | S4 |
| Inbound | M04 | UC-IN-01..05 (S5); UC-IN-06 (S6) | S5–S6 |
| Inbound Tmp | M05 | UC-INTMP-01, 02 (S5); UC-INTMP-03 (S12) | S5 + S12 |
| Forklift | M06 | UC-FK-01..03 (S6); UC-FK-04..06 (S7) | S6–S7 |
| Outbound | M07 | UC-OUT-01, 05 (S7-S8); UC-OUT-02..04 (S10-11) | S7–S8 + S10-11 |
| Inventory | M08 | UC-INV-01..03, 06, 07 (S8); UC-INV-04, 05, 08, 09 (S10-12) | S8 + S10-12 |
| Dashboard | M09 | UC-DASH-01 (S9); UC-DASH-02 (S11) | S9 + S11 |
| System | M10 | UC-SYS-03, 04, 05 (S1-2); UC-SYS-01, 02 (S9) | S1-S2 + S9 |
| Integration | M11 | UC-INT-01 (S2); UC-INT-02, 03 (S13) | S2 + S13 |

---

## 9. Đầu ra mỗi sprint

| Sprint | Demo |
|---|---|
| S0 | "Click login button (404 yet)" — hạ tầng |
| S1-2 | Login 5 role, đổi MK, ma trận quyền, audit ghi |
| S3 | Nhập 100 products, in QR vị trí |
| S4 | Thủ kho tạo + xác nhận 5 pallet trên mobile |
| S5 | Kế toán lập PHN, thủ kho nhận, chốt phiếu khớp |
| S6 | Import file Unilever 142 dòng + xe nâng putaway 10 pallet |
| S7 | Xe nâng rút FEFO 5 lần, trả 2 pallet về vị trí |
| S8 | Báo cáo tồn 3 chiều + cân lại staging-out |
| S9 | **Dashboard 3 role + Mail test xanh → MVP ready** |
| S10-11 | 6 báo cáo + cảnh báo HSD email |
| S12 | Kiểm kê toàn kho + duyệt phiếu điều chỉnh |
| S13 | Polish + đa phương thức quét + xuất Excel mọi báo cáo |

---

## 10. Tham chiếu

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE.md](DATABASE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md)
- [CRITICAL_PATHS.md](CRITICAL_PATHS.md)
- [SECURITY.md](SECURITY.md)
- [../RULES.md](../RULES.md)

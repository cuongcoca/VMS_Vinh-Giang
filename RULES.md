# RULES — WMS Vĩnh Giang

> Quy ước phát triển bắt buộc cho mọi thành viên dự án — viết theo template LPT chuẩn (Logical Project Template).
> Phiên bản: 1.0 · Ngày: 2026-05-20
> **Đọc file này trước khi mở PR đầu tiên.**

---

## 0. Triết lý (Philosophy)

1. **Đúng nghiệp vụ > đẹp code.** Bug nghiệp vụ làm sai sổ kho — không refactor nào bù được.
2. **Đơn giản nhất có thể, không đơn giản hơn.** Không over-engineer cho "tương lai có thể cần".
3. **Trust the spec.** Use cases và Mockup là nguồn sự thật. Mọi thay đổi phải sync ngược lại tài liệu spec trước.
4. **Mọi sửa đổi đều có dấu vết.** Code có Git, dữ liệu nhạy cảm có Audit Log.
5. **Mobile-first cho thao tác kho, Desktop-first cho báo cáo.** Không compromise UX.

---

## 1. Cấu trúc tài liệu (Documentation Structure)

| File | Mục đích | Khi nào sửa |
|---|---|---|
| `docs/ARCHITECTURE.md` | Tech stack, cấu trúc thư mục, sơ đồ luồng | Khi thêm/đổi stack hoặc thêm service mới |
| `docs/DATABASE.md` | Schema bảng, quan hệ, migration rules | Mỗi PR có thay đổi schema |
| `docs/API_CONTRACTS.md` | Endpoints, request/response, auth | Mỗi PR thêm/sửa endpoint |
| `docs/CRITICAL_PATHS.md` | Luồng nghiệp vụ + files PROTECTED | Khi thêm luồng critical hoặc thêm file PROTECTED |
| `docs/SECURITY.md` | Auth model, RBAC, audit, rate-limit, threat | Mỗi PR liên quan auth/permission/audit |
| `RULES.md` | File này — quy ước phát triển | Khi team thống nhất quy ước mới |
| `README.md` | Cách dev local + deploy | Khi đổi setup |

**Quy tắc:** Sửa code mà không sync tài liệu = PR bị reject.

---

## 2. Quy ước Git (Git Workflow)

### 2.1 Branch model

```
main                  # Always deployable to production
  └─ release/v1.x     # Release branch (cut từ main khi prepare release)
       └─ hotfix/*    # Hotfix critical bug từ release branch
  
develop (nếu cần)     # KHÔNG dùng — chúng ta trunk-based development

feature/<scope>-<short-desc>     # vd: feature/inbound-finalize
bugfix/<scope>-<short-desc>      # vd: bugfix/pallet-code-race
chore/<short-desc>               # vd: chore/upgrade-prisma-5.10
docs/<short-desc>                # vd: docs/update-database-erd
migration/<verb>-<noun>          # vd: migration/add-stocktake-blind-count
```

### 2.2 Commit message — Conventional Commits

```
<type>(<scope>): <short description in lowercase>

[optional body explaining "why"]

[optional footer: Refs: UC-XX-XX, Fixes: #123]
```

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `perf`, `style`, `migration`.

**Scopes** (suggest): `auth`, `master-data`, `pallet`, `inbound`, `forklift`, `outbound`, `inventory`, `stocktake`, `dashboard`, `system`, `mobile`, `web`, `api`, `db`, `infra`, `ci`.

**Ví dụ:**
```
feat(forklift): implement FEFO suggestion API

Returns pallets ordered by expiry_date ASC. Includes warningLevel
(CRITICAL ≤7d, WARN ≤30d) so mobile can highlight cards.

Refs: UC-FK-04
```

**Cấm:**
- Commit message một từ ("update", "fix").
- Commit `WIP` trên `main`.
- Commit dấu phẩy không cần thiết hoặc emoji (trừ khi user-facing release notes).

### 2.3 Pull Request

- **1 PR = 1 ý đồ.** Không nhồi nhét refactor không liên quan.
- **Mô tả PR phải có:**
  - **Why:** Vấn đề/yêu cầu nghiệp vụ — link UC code.
  - **What:** Tóm tắt thay đổi (file chính + ảnh hưởng).
  - **Test plan:** Bullets — gồm manual test cho luồng nghiệp vụ.
  - **Screenshots:** Bắt buộc cho FE.
- **Reviewers:**
  - File thường: ≥ 1 reviewer.
  - File `🔒 PROTECTED`: ≥ 2 reviewer, có @tech-lead.
  - File `🔒🔒 PROTECTED MAX`: ≥ 2 reviewer + @tech-lead + @security-lead.
- **Squash merge** vào `main` (giữ history sạch).
- **CI phải xanh** trước khi merge — không bypass.

### 2.4 Cấm tuyệt đối

- ❌ `git push --force` lên `main` / `release/*`.
- ❌ Commit secrets (env, key, password). Có pre-commit hook `gitleaks` check.
- ❌ Commit file `.env`, `*.pem`, `*.key`, `node_modules/`, file > 5MB.
- ❌ Sửa migration đã merge vào `main`. Phải tạo migration mới để fix.
- ❌ `--no-verify` để bypass hook. Nếu hook lỗi, fix gốc.

---

## 3. Code Style

### 3.1 TypeScript (FE + BE)

- **strict mode bật:** `"strict": true, "noUncheckedIndexedAccess": true`.
- **Cấm `any`** — dùng `unknown` rồi narrow.
- **Tên file:** `kebab-case.ts`. **Tên class:** `PascalCase`. **Tên hàm/biến:** `camelCase`. **Constant:** `UPPER_SNAKE_CASE`.
- **Tên enum value:** `UPPER_SNAKE_CASE` (vd `pallet.status='IN_STORAGE'`) — match với DB.
- **Import order:** node built-in → external → @internal → relative. Auto-sort bằng ESLint.
- **Cấm default export** trừ Next.js page/layout (framework yêu cầu).

### 3.2 Linter & Formatter

| Tool | Mục đích | Bắt buộc |
|---|---|---|
| ESLint + `@typescript-eslint` | Lint TS | ✅ Block PR nếu fail |
| Prettier | Format | ✅ Pre-commit hook |
| Stylelint | CSS (web) | ✅ |
| Markdownlint | Doc | ✅ |
| `gitleaks` | Detect secret | ✅ Pre-commit + CI |
| `lint-staged` + `husky` | Chạy lint trên file staged | ✅ |

### 3.3 Naming convention nghiệp vụ

| Khái niệm | Code | DB | UI hiển thị (VN) |
|---|---|---|---|
| Pallet | `pallet`, `palletId`, `palletCode` | `pallets` | "Pallet" |
| Phiếu yêu cầu nhập | `inboundRequest` | `inbound_requests` | "Phiếu yêu cầu nhập" |
| Phiếu nhập tạm | `inboundTemp` | `inbound_temps` | "Phiếu nhập tạm" |
| Mã hàng theo chứng từ | `sku` | `skus` | "Mã hàng" |
| Sản phẩm chuẩn | `product` | `products` | "Sản phẩm" |
| Vị trí kho | `location`, `locationCode` | `locations` | "Vị trí" |
| Khu chờ xuất | `OUTBOUND_STAGING` | `locations.type='OUTBOUND_STAGING'` | "Khu chờ xuất" |
| Khu chờ nhập | `INBOUND_STAGING` | `locations.type='INBOUND_STAGING'` | "Khu chờ nhập" |
| Lô hàng | `lot` | `lot VARCHAR(40)` | "Lô" |
| Hạn sử dụng | `expiryDate` | `expiry_date DATE` | "HSD" |
| Số lượng theo thùng | `qtyBox` | `qty_box DECIMAL(10,2)` | "SL (thùng)" |
| Số lượng lẻ | `qtyUnit` | `qty_unit DECIMAL(14,3)` | "SL (chai/gói…)" |
| Luân chuyển | `movement` | `movements` | "Lịch sử luân chuyển" |
| Phiếu điều chỉnh tồn | `adjustment` | `inventory_adjustments` | "Phiếu điều chỉnh" |
| Phiên kiểm kê | `stocktakeSession` | `stocktake_sessions` | "Phiên kiểm kê" |

**Tuyệt đối nhất quán:** Không mix `inventoryAdjustment` ở chỗ này với `stockAdjustment` ở chỗ khác.

### 3.4 Comments — Khi nào viết

**Default: KHÔNG viết comment.** Đặt tên rõ là đủ.

**Viết comment khi và CHỈ khi:**
- Giải thích **why** (lý do nghiệp vụ), không phải **what**.
- Workaround cho bug bên thứ 3 (link issue).
- Constraint nghiệp vụ không bộc lộ từ code (vd: "Reset STT theo `code_date` để chống trùng khi nhiều thủ kho cùng bấm tạo").
- Tham chiếu UC code: `// UC-FK-04: ưu tiên HSD cận nhất`.

**Cấm:**
- Comment kể chuyện task ("Added by Tuan to fix issue #42").
- Comment block nhiều dòng cho hàm — đã có tên hàm + type.
- Comment "TODO" mà không có ngày + tên người + UC.

### 3.5 Error handling

- **API error:** Throw `BusinessException` với code + message Việt — interceptor convert sang RFC 7807.
- **Cấm catch nuốt error.** Hoặc handle thực sự, hoặc rethrow.
- **Cấm `try { } catch { return null }`** — gây lỗi câm.
- **Validation:** dùng Zod schema (share FE-BE qua `packages/shared-schemas`). Validate ở boundary (controller), không validate giữa service.
- **Log error:** dùng Pino với level `error`, kèm `correlationId` (truyền qua header `X-Correlation-Id`).

---

## 4. Testing

### 4.1 Mức bắt buộc

| Loại | Tool | Coverage tối thiểu |
|---|---|---|
| Unit (services, utils) | Jest | 80% (90% với file PROTECTED) |
| Integration (controller + DB) | Jest + Testcontainers (Postgres) | Mọi endpoint phải có ít nhất 1 happy path + 1 error case |
| E2E API | Playwright (HTTP) | Cover các Critical Path trong [CRITICAL_PATHS.md](docs/CRITICAL_PATHS.md) |
| E2E Web | Playwright (browser) | Cover golden path: Login → Lập PHN → Chốt phiếu |
| Mobile (snapshot + interaction) | Jest + React Native Testing Library + Detox | Cover golden path: Login → Tạo pallet → Putaway |

### 4.2 Quy tắc test

- **Tên test:** "should <expected behaviour> when <condition>". Vd: `should reject putaway when location is INBOUND_STAGING`.
- **AAA pattern:** Arrange / Act / Assert.
- **Cấm test phụ thuộc thứ tự** — mỗi test phải độc lập.
- **Mock đúng chỗ:** mock external service (mail, MinIO), KHÔNG mock DB cho integration test (dùng Testcontainers).
- **Fixture:** dùng `prisma/seed-test.ts` riêng cho test env.
- **Snapshot test mobile:** chỉ cho component pure UI, KHÔNG cho screen có state.

### 4.3 CI test phải chạy

```yaml
on: [pull_request]
jobs:
  - lint
  - typecheck
  - test:unit        # < 2 phút
  - test:integration # < 5 phút
  - test:e2e         # < 10 phút (chỉ trên PR đụng FE/BE chính)
  - build:web
  - build:mobile     # eas build --profile preview (chỉ trên main)
```

Test FAIL = block merge. Không có ngoại lệ.

---

## 5. Database & Migration

(Tham chiếu chi tiết: [docs/DATABASE.md §4](docs/DATABASE.md))

Tóm tắt 8 quy tắc bắt buộc:

| # | Quy tắc |
|---|---|
| R1 | Không destructive trên cột có data prod — phải 3 bước: thêm → migrate → deprecate |
| R2 | Mọi cột NOT NULL phải có DEFAULT (hoặc backfill trước) |
| R3 | Index lớn tạo CONCURRENTLY trong migration riêng |
| R4 | Backward-compatible trong cùng release |
| R5 | Seed riêng (`prisma/seed.ts`), idempotent upsert |
| R6 | Test migration trên CI với snapshot prod |
| R7 | `audit_logs` không destructive — chỉ thêm cột mới |
| R8 | Prod dùng `prisma migrate deploy`, backup trước, smoke test sau |

**Migration được tạo bởi tool, không sửa tay file đã merge.**

---

## 6. Security

(Tham chiếu chi tiết: [docs/SECURITY.md](docs/SECURITY.md))

### 6.1 Top 5 quy tắc

1. **Bí mật không lên git.** Dùng `.env` (không commit) + GitHub Secrets cho CI.
2. **Mọi input từ user phải validate.** Zod ở controller. Không trust client.
3. **Mọi query DB qua ORM hoặc parameterized.** Cấm string concat SQL.
4. **Mọi endpoint phải khai báo permission rõ ràng.** Mặc định DENY — nếu không có `@RequirePermissions` thì guard reject.
5. **File PROTECTED không tự sửa.** Tham khảo [CRITICAL_PATHS.md §12](docs/CRITICAL_PATHS.md).

### 6.2 Cấm tuyệt đối

- ❌ Dùng `eval`, `Function` constructor với input từ user.
- ❌ Lưu password plaintext, log password.
- ❌ Trả password_hash, refresh_token, api_key về client (kể cả admin).
- ❌ Disable HTTPS / TLS verify.
- ❌ CORS `*` cho endpoint có thể thay đổi data.
- ❌ Log full body request có chứa password/token.
- ❌ Bypass RBAC bằng `@Public()` không cần thiết.

---

## 7. Dependencies

### 7.1 Khi thêm package

- **Cân nhắc 3 câu hỏi:**
  1. Mình có thể viết trong < 100 dòng không? → Tự viết.
  2. Package có duy trì đều không? (release < 6 tháng, > 1 maintainer)
  3. Bundle size có chấp nhận được không? (mobile < 50KB, web < 100KB)
- **PR thêm package** phải có comment ở phần "Why" giải thích lý do chọn + alternatives.

### 7.2 Cập nhật

- **Renovate bot** PR tự động cho minor/patch — auto-merge nếu test xanh.
- **Major upgrade** cần PR thủ công + smoke test.
- **Security patch** ưu tiên cao, merge trong 48h.

### 7.3 Cấm

- ❌ Package không có maintainer > 1 năm.
- ❌ Package > 1MB cho mobile.
- ❌ Hai package làm cùng việc (vd `lodash` + `ramda`).
- ❌ Package có known CVE chưa fix.

---

## 8. Logging & Observability

### 8.1 Log levels

| Level | Khi nào dùng |
|---|---|
| `error` | Exception chưa handle, nghiệp vụ fail bất ngờ. Bắt buộc kèm `correlationId`, stack. |
| `warn` | Edge case xử lý được nhưng bất thường (vd retry, fallback). |
| `info` | Sự kiện nghiệp vụ quan trọng (login, finalize, approve adjustment). |
| `debug` | Chỉ dev local. Production OFF. |

### 8.2 Cấu trúc log

```json
{
  "level": "info",
  "time": "2026-05-20T08:00:00.000Z",
  "correlationId": "req_abc123",
  "userId": "uuid",
  "action": "pallet.confirm",
  "resourceId": "1011",
  "duration_ms": 145,
  "msg": "Pallet confirmed"
}
```

### 8.3 Metrics (Prometheus)

Mọi endpoint expose:
- `http_request_duration_seconds` (histogram, label: method, path, status).
- `http_requests_total` (counter).

Domain metrics:
- `pallet_confirm_total{result=success|fail}`
- `forklift_pick_fefo_duration_seconds`
- `inbound_finalize_total{decision=accept|review|adjust}`
- `audit_logs_total{action=...}`

### 8.4 Alert (Grafana → Slack `#wms-alerts`)

| Alert | Threshold | Severity |
|---|---|---|
| API p95 latency > 1s | 5 phút | P2 |
| HTTP 5xx rate > 1% | 5 phút | P1 |
| DB connection pool > 80% | 5 phút | P2 |
| BullMQ failed jobs > 10/giờ | 1 giờ | P2 |
| Mail send fail > 5/giờ | 1 giờ | P3 |
| Audit log table không có row mới > 1 giờ trong giờ làm việc | 1 giờ | P1 (có thể audit bị tắt) |

---

## 9. Folder & File Conventions

### 9.1 Backend (NestJS)

Mỗi module có cấu trúc:
```
modules/<name>/
  <name>.module.ts
  <name>.controller.ts
  services/
    <action>.service.ts        # 1 service mỗi action nghiệp vụ
  dto/
    create-<name>.dto.ts
    update-<name>.dto.ts
  schemas/                     # Zod schemas (import từ packages/shared-schemas nếu share)
  events/
    <name>-<event>.event.ts
  validators/
  __tests__/
    <action>.service.spec.ts
```

**1 file 1 class/concept.** Cấm file `utils.ts` 500 dòng — tách theo chức năng.

### 9.2 Frontend (Next.js & Mobile)

- Component: 1 component / file. Đặt cùng folder với `*.test.tsx` nếu có test.
- Hook: prefix `use*`, đặt trong `hooks/`.
- API call: chỉ qua `lib/api-client.ts` — không gọi fetch trực tiếp trong component.
- State server: TanStack Query — định nghĩa query keys trong `lib/query-keys.ts`.

### 9.3 Cấm

- ❌ File `helpers.ts`, `utils.ts`, `common.ts` "miscellaneous". Tách theo chủ đề.
- ❌ Folder lồng > 4 cấp.
- ❌ Magic number / magic string trong code — tách constant.

---

## 10. UI/UX Standards

### 10.1 Web (Kế toán/Quản lý)

- **Spacing:** scale 4px (Tailwind default).
- **Color tokens:** dùng tokens trong `packages/ui-tokens` — KHÔNG hard-code mã hex trong component.
- **Form:** validate inline + summary lỗi đầu form khi submit.
- **Table:** mọi bảng > 10 dòng phải có pagination/virtualization.
- **Loading state:** mọi action có network call phải có loading spinner (button disable + spinner).
- **Empty state:** mọi list có empty state riêng với CTA rõ ràng.
- **Confirm dialog:** mọi action destructive (delete, finalize) phải có confirm.

### 10.2 Mobile (Thủ kho/Xe nâng/Người kiểm kê)

- **Touch target:** tối thiểu 44×44 dp.
- **Font:** body ≥ 14sp, button ≥ 16sp (sàn kho ánh sáng yếu).
- **Color contrast:** WCAG AA tối thiểu (4.5:1).
- **Action chính:** button full-width ở dưới, primary color.
- **Bottom tabs:** ≤ 4 tab.
- **Camera/quét:** luôn có fallback "Nhập tay" (sàn kho có lúc lens bẩn).
- **Offline indicator:** banner top khi mất kết nối.
- **Số lượng:** dùng stepper (− / + / nhập) — không chỉ keyboard số.

### 10.3 i18n

- Mặc định tiếng Việt. Hard-code tiếng Việt trong UI là TẠM CHẤP NHẬN cho v1.
- Mọi string user-facing đi qua `t()` helper sẵn sàng cho i18n trong v2.
- Số/tiền/ngày dùng `Intl.NumberFormat`/`Intl.DateTimeFormat` với locale `vi-VN`.

---

## 11. Performance Budgets

### 11.1 Web

| Metric | Target |
|---|---|
| First Contentful Paint | < 1.5s (4G) |
| LCP | < 2.5s |
| TTI | < 3.5s |
| Bundle (initial JS, gzipped) | < 200KB |
| Báo cáo nặng (data table > 1k rows) | < 1s render với virtualization |

### 11.2 Mobile

| Metric | Target |
|---|---|
| App startup (cold) | < 3s |
| Screen transition | < 200ms |
| Camera open | < 500ms |
| Quét barcode → API response | < 800ms (4G) |
| App size (APK) | < 50MB |

### 11.3 API

| Metric | Target |
|---|---|
| p50 latency | < 100ms |
| p95 latency | < 300ms |
| p99 latency | < 1000ms |
| Throughput tối thiểu | 100 req/s |

---

## 12. Process — Đời sống PR

1. **Tạo issue / link UC** trước khi tạo branch (trừ trivial).
2. **Tạo branch từ `main` (rebase mới nhất).**
3. **Code + test + tài liệu** đồng thời.
4. **PR draft** sớm để review sớm — mark `Ready for review` khi xong.
5. **Self-review trước khi tag reviewer:** đọc lại diff, xem mình có miss gì.
6. **Tag reviewer:** chỉ tag khi PR thực sự sẵn sàng.
7. **Reviewer phản hồi trong 24h** (giờ làm việc).
8. **Address feedback:** push commit mới, KHÔNG amend (giúp review thấy diff). Squash khi merge.
9. **Merge:** sau khi đủ approval + CI xanh. Squash merge.
10. **Theo dõi prod:** check Grafana/Sentry trong 1h sau deploy.

**Cấm self-merge** trừ trường hợp khẩn cấp (hotfix P1) — phải post-mortem sau.

---

## 13. On-call & Incident

### 13.1 Severity

| Cấp | Định nghĩa | Phản ứng |
|---|---|---|
| P1 | Hệ thống không vận hành được (không login, không tạo pallet, finalize fail) | On-call ack < 15p, fix < 2h |
| P2 | Tính năng quan trọng lỗi nhưng có workaround | Ack < 1h (giờ HC), fix trong ngày |
| P3 | Lỗi nhỏ, không ảnh hưởng nghiệp vụ chính | Ack < 1 ngày, fix trong sprint |

### 13.2 Incident response

1. **Ack** trên Slack `#wms-incident`.
2. **Mitigate trước, root-cause sau:** rollback nếu cần (luôn ưu tiên).
3. **Communication:** mỗi 30 phút update tình hình.
4. **Post-mortem trong 3 ngày** (template trong `docs/templates/postmortem.md`).
5. **Action items** vào backlog với owner + deadline.

---

## 14. Cấm tuyệt đối (Tóm tắt)

| ❌ Cấm | Lý do |
|---|---|
| Bypass `--no-verify`, `--no-gpg-sign` | Hook tồn tại để bảo vệ |
| Force push lên `main`/`release/*` | Mất history, mất commit người khác |
| Commit secrets | Leak credential |
| Dùng `any` trong TS | Mất type safety |
| Mock DB cho integration test | Test sai = ảo tưởng pass |
| Comment WHAT (chỉ comment WHY) | Code rotten |
| Sửa file PROTECTED mà không tag tech-lead | Phá Critical Path |
| Sửa migration đã merge | Khác biệt giữa các env |
| Tạo PR > 500 lines diff | Review không nổi |
| Tự duyệt PR của mình | Cần peer review |
| Dùng `eval`, raw SQL concat | Inject vulnerability |
| Disable RBAC guard tạm thời | Backdoor |
| Trả password hash/token về client | Data leak |

---

## 15. Quy ước nhật ký quyết định (ADR — Architecture Decision Record)

Khi có quyết định kiến trúc lớn (chọn DB, chọn framework, đổi approach), tạo file:

```
docs/adr/NNNN-<title>.md
```

Template:
```markdown
# NNNN. Tiêu đề quyết định

Date: 2026-XX-XX
Status: Proposed | Accepted | Deprecated | Superseded by NNNN

## Context
<Bối cảnh, vấn đề>

## Decision
<Quyết định cụ thể>

## Consequences
<Hậu quả: tốt, xấu, trung lập>

## Alternatives considered
<Các option khác, lý do loại>
```

ADR là **append-only**. Khi đảo quyết định, tạo ADR mới ghi "Supersedes ADR-NNNN".

---

## 16. Sign-off

> Bằng việc commit code vào repo này, bạn xác nhận:
> 1. Đã đọc và đồng ý tuân theo `RULES.md`.
> 2. Hiểu trách nhiệm với file `PROTECTED` và Critical Paths.
> 3. Đồng ý bảo mật thông tin nội bộ Vĩnh Giang.

Mọi câu hỏi / đề xuất sửa rules: tạo PR sửa file này — cần ≥ 3 approver trong đó có @tech-lead.

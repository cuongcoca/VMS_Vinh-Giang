# SECURITY — WMS Vĩnh Giang

> Mô hình bảo mật, RBAC, audit và threat model — viết theo template LPT.
> Phiên bản: 1.0 · Ngày: 2026-05-20
> **Đọc trước khi đụng module Auth, RBAC, hoặc viết endpoint mới.**

---

## 0. Nguyên tắc bảo mật cốt lõi

| Nguyên tắc | Diễn giải |
|---|---|
| **Default deny** | Mặc định reject. Permission phải được khai báo tường minh. Endpoint không có `@RequirePermissions()` → guard reject. |
| **Defense in depth** | Nhiều lớp: Network (TLS, firewall) → App (RBAC, validation) → DB (constraint, audit). Lỗi 1 lớp không sập toàn bộ. |
| **Least privilege** | User chỉ có quyền tối thiểu cần thiết. Cấu hình ma trận quyền nhỏ nhất, mở thêm khi cần. |
| **Audit everything sensitive** | Mọi thay đổi data nhạy cảm phải vào `audit_logs`. Append-only. |
| **Secret never in code** | `.env`, GitHub Secrets, Vault — không bao giờ commit. |
| **Validate at boundary** | Mọi input từ client validate ở controller bằng Zod. Service trust input đã validate. |
| **Fail securely** | Lỗi → reject + log. Không bao giờ "tạm thời cho qua". |

---

## 1. Authentication

### 1.1 Phương thức

| Loại | Cơ chế | Dùng cho |
|---|---|---|
| Email + Password | bcrypt cost 12 → JWT | Web + Mobile (UC-AUTH-01) |
| Phone + Password | Cùng bcrypt + JWT | Mobile (UC-AUTH-01) |
| Refresh Token | HTTP-only cookie (web) / Secure Storage (mobile) | Renew access token |
| Password Reset | Token email TTL 60 phút | UC-AUTH-04 |

### 1.2 Mật khẩu policy

- **Tối thiểu 8 ký tự**, có ≥ 1 hoa, ≥ 1 thường, ≥ 1 số.
- **Không trong danh sách top-1000 mật khẩu phổ biến** (kiểm bằng `zxcvbn` score ≥ 3).
- **Đổi mật khẩu mỗi 90 ngày** (cấu hình được, mặc định 90).
- **Không trùng 5 mật khẩu gần nhất** (lưu hash trong bảng `password_history` nếu enable — chưa bắt buộc v1).
- **bcrypt cost 12** (cấu hình `BCRYPT_COST` env). Khi đăng nhập, nếu hash cũ cost thấp hơn → rehash silently.

### 1.3 Lock chống brute-force

```
failed_login_count++ mỗi lần sai
≥ 5 lần trong 15 phút → lock 15 phút
locked_until = now() + 15m
Sau khi login thành công: reset count = 0
```

Endpoint `/auth/login` có rate-limit 10 req/phút/IP (chống credential stuffing).

### 1.4 JWT structure

```json
{
  "sub": "user-uuid",
  "role": "ACCOUNTANT",
  "permissions": ["product.read", "product.create", "..."],
  "jti": "unique-token-id",
  "iat": 1716192000,
  "exp": 1716192900,
  "iss": "wms.vinhgiang.com",
  "aud": "wms-api"
}
```

- Sign: **RS256** (asymmetric). Private key trên server, public key có thể expose qua `/.well-known/jwks.json` cho tương lai.
- TTL: **access 15 phút**, **refresh 7 ngày**.
- Storage: cookie HTTP-only `SameSite=Strict` `Secure` (web); Keychain/Keystore (mobile via `expo-secure-store`).
- Revoke: refresh token có trong `user_sessions` → set `revoked_at = now()`. Access token không revoke trực tiếp (TTL ngắn).

### 1.5 Cấm tuyệt đối

- ❌ Lưu password plaintext, kể cả tạm thời.
- ❌ Log mật khẩu / token / hash trong app log.
- ❌ Trả `password_hash`, `refresh_token`, `api_key` trong response (kể cả admin).
- ❌ JWT chứa data nhạy cảm (đủ rồi: id, role, permissions).
- ❌ Dùng `HS256` (symmetric) cho JWT — phải `RS256`.
- ❌ Refresh token TTL > 30 ngày.

---

## 2. Authorization (RBAC)

### 2.1 Mô hình

```
User (1) ─── (1) Role (N) ─── (N) Permission

User → có 1 Role (đơn giản hoá v1)
Role → có nhiều Permission qua role_permissions
Permission → định nghĩa "resource.action"
```

### 2.2 Permission catalog

Format: `<resource>.<action>`. Action chuẩn: `create`, `read`, `update`, `delete`, `approve`, `export`, `import`.

| Resource | Permissions |
|---|---|
| user | `user.read`, `user.create`, `user.update`, `user.delete` |
| role | `role.read`, `role.update` |
| product | `product.read`, `product.create`, `product.update`, `product.delete`, `product.export`, `product.import` |
| sku | `sku.read`, `sku.create`, `sku.update` (map/reject) |
| category, unit, supplier | `*.read`, `*.create`, `*.update`, `*.delete` |
| location | `location.read`, `location.create`, `location.update`, `location.delete` |
| pallet | `pallet.read`, `pallet.create`, `pallet.update`, `pallet.confirm`, `pallet.unlock` |
| inbound | `inbound.read`, `inbound.create`, `inbound.update`, `inbound.accept`, `inbound.finalize` |
| inbound_temp | `inbound_temp.read`, `inbound_temp.create`, `inbound_temp.update` |
| forklift | `forklift.read`, `forklift.putaway`, `forklift.relocate`, `forklift.pick`, `forklift.return` |
| movement | `movement.read`, `movement.export` |
| outbound | `outbound.read`, `outbound.report`, `outbound.rebalance`, `outbound.rebalance.apply` |
| inventory | `inventory.read`, `alert.read`, `alert.update` |
| stocktake | `stocktake.create`, `stocktake.update`, `stocktake.resolve` |
| adjustment | `adjustment.read`, `adjustment.create`, `adjustment.approve` |
| dashboard | (mặc định mọi user thấy dashboard của role mình) |
| kpi | `kpi.read` |
| setting | `setting.read`, `setting.update` |
| mail | `mail.read`, `mail.update`, `mail.test` |
| audit | `audit.read` |

### 2.3 Ma trận quyền mặc định (5 role)

| Permission | Manager | Accountant | Keeper | Forklift | Stocktaker |
|---|---|---|---|---|---|
| user.* | ✅ all | ❌ | ❌ | ❌ | ❌ |
| role.update | ✅ | ❌ | ❌ | ❌ | ❌ |
| product.read | ✅ | ✅ | ✅ (read) | ✅ (read) | ✅ (read) |
| product.create/update/delete | ✅ | ✅ | ❌ | ❌ | ❌ |
| sku.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| sku.create | ✅ | ✅ | ✅ (mobile UC-MD-02) | ❌ | ❌ |
| sku.update (map/reject) | ✅ | ✅ | ❌ | ❌ | ❌ |
| category/unit.* | ✅ | ✅ | ❌ | ❌ | ❌ |
| location.* | ✅ | ✅ (create/update) | ❌ | ❌ | ❌ |
| supplier.* | ✅ | ✅ | ❌ | ❌ | ❌ |
| pallet.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| pallet.create/update/confirm | ❌ | ❌ | ✅ | ❌ | ❌ |
| pallet.unlock | ✅ (cấp đặc biệt) | ❌ | ❌ | ❌ | ❌ |
| inbound.read | ✅ | ✅ | ✅ | ❌ | ❌ |
| inbound.create | ❌ | ✅ | ❌ | ❌ | ❌ |
| inbound.accept | ❌ | ❌ | ✅ | ❌ | ❌ |
| inbound.finalize | ❌ | ✅ | ❌ | ❌ | ❌ |
| inbound_temp.create | ❌ | ❌ | ✅ | ❌ | ❌ |
| inbound_temp.update (standardize) | ❌ | ✅ | ❌ | ❌ | ❌ |
| forklift.putaway/relocate/pick | ❌ | ❌ | ❌ | ✅ | ❌ |
| forklift.return (UC-FK-05) | ✅ | ✅ | ❌ | ✅ (nếu được cấp) | ❌ |
| movement.read | ✅ | ✅ | ✅ | ✅ | ❌ |
| outbound.* (read/report) | ✅ | ✅ | ❌ | ❌ | ❌ |
| outbound.rebalance.apply | ✅ | ✅ | ❌ | ❌ | ❌ |
| inventory.read | ✅ | ✅ | ✅ | ✅ | ✅ |
| alert.read/update | ✅ | ✅ | ❌ | ❌ | ❌ |
| stocktake.create | ✅ | ✅ | ❌ | ❌ | ✅ |
| stocktake.update | ❌ | ❌ | ❌ | ❌ | ✅ |
| stocktake.resolve | ✅ | ✅ | ❌ | ❌ | ❌ |
| adjustment.create | ❌ | ✅ | ❌ | ❌ | ❌ |
| adjustment.approve | ✅ | ❌ | ❌ | ❌ | ❌ |
| kpi.read | ✅ | ❌ | ❌ | ❌ | ❌ |
| setting.read/update | ✅ | ❌ | ❌ | ❌ | ❌ |
| mail.read/update/test | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit.read | ✅ | ❌ | ❌ | ❌ | ❌ |

> Manager có thể tự cấu hình lại ma trận này qua UC-AUTH-05 (UI ma trận quyền). Mọi thay đổi vào `audit_logs`.

### 2.4 Triển khai code (NestJS)

```ts
// decorator
@RequirePermissions('pallet.confirm')
@Post(':id/confirm')
confirmPallet() { ... }

// guard
@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>('permissions', ctx.getHandler());
    if (!required) {
      // DEFAULT DENY — endpoint không khai báo = từ chối
      throw new ForbiddenException('Endpoint chưa khai báo permission');
    }
    const user = ctx.switchToHttp().getRequest().user;
    return required.every(p => user.permissions.includes(p));
  }
}
```

**Endpoint public** (login, forgot-password, refresh) phải khai báo tường minh `@Public()`. Guard skip nếu có decorator này.

---

## 3. Audit Log

### 3.1 Mục đích

- **Compliance:** Truy vết ai làm gì với data nhạy cảm.
- **Forensics:** Khi có sự cố, recover lại sequence.
- **Trust:** Người dùng tin tưởng hệ thống có lưu vết.

### 3.2 Bắt buộc ghi audit log cho

| Action | UC | Bảng/cột |
|---|---|---|
| Cấu hình permission của role | UC-AUTH-05 | `role_permissions` |
| Mở khoá pallet đã confirm | UC-PAL-05 | `pallets.status`, lines |
| Map/Reject mã hàng tạm | UC-MD-02 | `skus.mapped_product_id` |
| Chốt phiếu nhập | UC-IN-04 | `inbound_requests.status` |
| Trả pallet từ khu chờ xuất về vị trí (có sửa nội dung) | UC-FK-05 | `pallets`, `pallet_lines` — **BẮT BUỘC** |
| Apply rebalance | UC-OUT-05 | `pallet_lines.qty_unit` — **BẮT BUỘC** |
| Duyệt phiếu điều chỉnh tồn | UC-INV-09 | `inventory_adjustments.status=APPROVED` — **BẮT BUỘC** |
| Cấu hình SMTP | UC-SYS-02 | `mail_settings` |
| Sửa app settings | UC-SYS-01 | `app_settings` |
| Tạo/sửa/xoá user | UC-SYS-04 | `users` |

### 3.3 Cấu trúc audit log

(Chi tiết bảng: [DATABASE.md §2.8](DATABASE.md))

Mỗi entry phải có:
- `actor_id` (user thực hiện) + `actor_role` (snapshot).
- `action` (vd `forklift.return`).
- `resource_type` + `resource_id` + `resource_code`.
- `before` + `after` (JSON diff đầy đủ).
- `reason` (BẮT BUỘC với UC-FK-05, UC-INV-09).
- `ip`, `user_agent`.

### 3.4 Bảo vệ audit log

| Quy tắc | Triển khai |
|---|---|
| Append-only | DB trigger BEFORE UPDATE/DELETE → raise exception |
| Backup riêng | pgBackRest backup tách bảng `audit_logs` retention ≥ 2 năm |
| Không cho admin xoá qua UI | API chỉ có GET — không POST/PATCH/DELETE |
| Alarm khi audit dừng | Cron giám sát: nếu 1h trong giờ HC không có row mới → P1 alert |
| Permission xem riêng | `audit.read` — chỉ Manager (mặc định) |

### 3.5 Implementation

```ts
// Interceptor — auto cho mọi endpoint có @AuditAction()
@AuditAction({ action: 'pallet.confirm', resource: 'pallet' })
@Post(':id/confirm')
confirmPallet(...) { ... }

// Service tách riêng cho action cần diff chi tiết
await this.auditLogService.record({
  action: 'forklift.return',
  resourceType: 'pallet',
  resourceId: pallet.id,
  resourceCode: pallet.code,
  before: { lines: oldLines },
  after: { lines: newLines, location: newLoc },
  reason: dto.reasonDetail,
  actor: currentUser,
  ip: req.ip,
  userAgent: req.headers['user-agent'],
});
```

---

## 4. Input Validation

### 4.1 Boundary validation

- **Mọi controller endpoint:** Zod schema (từ `packages/shared-schemas`) validate request body, query, params.
- **Pipe:** `ZodValidationPipe` global — chặn ở DI level, không nhờ developer nhớ.
- **Fail message:** Vietnamese, structured như RFC 7807 với `errors[]`.

### 4.2 Quy tắc

| Loại input | Validation |
|---|---|
| Email | `z.string().email().toLowerCase()` |
| Phone VN | `z.string().regex(/^(0|\+84)[35789]\d{8}$/)` |
| Password | Min 8, có pattern, zxcvbn ≥ 3 |
| Mã pallet | `^PL\d{6}\.\d{3}$` |
| Mã vị trí | `^[A-Z]-\d{2}-\d{2}$` (linh hoạt theo `app_settings`) |
| Decimal SL | `z.number().positive().multipleOf(0.001)` |
| Date | `z.string().date()` hoặc Date — không string tự do |
| File upload | Whitelist mime (xlsx, png, jpg, pdf), max size theo loại |

### 4.3 SQL Injection — Prevention

- **Mọi query qua Prisma** (parameterized).
- **Cấm `$queryRawUnsafe`** — nếu phải raw, dùng `$queryRaw` với template tagged string.
- **Linter rule** chặn pattern `${variable}` trong raw SQL.

### 4.4 XSS — Prevention

- **Web (Next.js):** Mặc định escape — KHÔNG dùng `dangerouslySetInnerHTML` trừ khi sanitize qua DOMPurify trước.
- **CSP header:** `default-src 'self'; script-src 'self' 'nonce-<...>'; style-src 'self' 'unsafe-inline'`.
- **Email template:** Sanitize trước khi render Handlebars.

### 4.5 CSRF — Prevention

- API hoàn toàn JWT trong header → không vulnerable CSRF classic.
- Nếu refresh token nằm trong cookie, dùng `SameSite=Strict` + double-submit token cho endpoint mutating.

### 4.6 File upload

- **Whitelist mime + extension** (xlsx, png, jpg, pdf).
- **Max size:** Excel 10MB, ảnh 5MB, PDF 10MB.
- **Tên file sanitize:** strip path traversal (`../`), thay space bằng `_`.
- **Lưu MinIO** với key `<resource>/<id>/<uuid>.<ext>` — không dùng original name.
- **Scan virus:** ClamAV scan async cho file > 1MB (BullMQ job).
- **Pre-signed URL TTL 5 phút** — không expose key trực tiếp.

---

## 5. Network Security

### 5.1 TLS

- **HTTPS bắt buộc.** HTTP redirect 301 sang HTTPS.
- **TLS 1.2+ only.** TLS 1.0/1.1 disabled.
- **HSTS header:** `max-age=63072000; includeSubDomains; preload`.
- **Certificate:** Let's Encrypt auto-renew qua certbot.
- **Mobile:** Certificate pinning cho production build (Expo có hỗ trợ qua expo-network).

### 5.2 CORS

```ts
{
  origin: [
    'https://wms.vinhgiang.com',
    'https://app.wms.vinhgiang.com',
    // production whitelist only
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Correlation-Id', 'X-Refresh-Token'],
}
```

Mobile (Expo) không bị CORS (native fetch). Web phải nằm trong whitelist.

### 5.3 Headers bảo mật (qua Nginx + helmet)

```
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: <theo §4.4>
Permissions-Policy: camera=(self), microphone=(), geolocation=(self)
```

### 5.4 Firewall & Network ACL

- **Server VPS:**
  - Ingress: 22 (SSH key only, fail2ban), 80/443 (Nginx), Wireguard VPN port (admin DB access).
  - Egress: 25/465/587 (SMTP), 443 (download container image).
- **Database & Redis & MinIO:** không expose public — bind `127.0.0.1` hoặc docker network internal.
- **Admin DB access:** chỉ qua VPN, không expose port 5432 public.

### 5.5 Rate limiting

(Chi tiết: [API_CONTRACTS.md §14](API_CONTRACTS.md))

Triển khai bằng `@nestjs/throttler` + Redis store. Vượt → 429 Too Many Requests.

---

## 6. Secrets Management

### 6.1 Phân loại

| Loại | Lưu ở đâu | Ai có quyền truy cập |
|---|---|---|
| DB password, Redis password | `.env` server (chmod 600), KHÔNG git | DevOps |
| JWT private key (RSA) | `.env`/file (chmod 600), KHÔNG git | DevOps |
| SMTP password / API key | Encrypted column trong `mail_settings` (AES-256-GCM) | Manager qua UI |
| MinIO credentials | `.env` | DevOps |
| OAuth client secret (tương lai) | `.env` | DevOps |
| GitHub token CI | GitHub Secrets | Admin GitHub |
| Sentry DSN | `.env` (cho prod), expose cho client build nếu cần | Devops |

### 6.2 Quy tắc

- ❌ Không commit `.env*` (chỉ `.env.example` với placeholder).
- ❌ Không log secrets (interceptor mask field `password`, `token`, `secret`, `apiKey`).
- ❌ Không truyền secrets qua URL query string.
- ✅ Rotate JWT key, DB password ≥ mỗi 6 tháng.
- ✅ `gitleaks` pre-commit + CI check.
- ✅ AES key cho `mail_settings.password_enc` lưu ở `MAIL_ENC_KEY` env — khi rotate phải re-encrypt records.

### 6.3 Encryption at rest

| Data | Cơ chế |
|---|---|
| `mail_settings.password_enc`, `api_key_enc` | AES-256-GCM, key từ env |
| `password_history` (tương lai) | Bcrypt hash |
| Backup files | GPG encrypt với public key, key ở vault offline |
| MinIO disks | Disk encryption (LUKS) ở mức OS |

### 6.4 Encryption in transit

Đã cover ở §5.1 (TLS).

---

## 7. Mobile-specific Security

### 7.1 Token storage

- **iOS:** Keychain qua `expo-secure-store` (accessibility `WHEN_UNLOCKED`).
- **Android:** EncryptedSharedPreferences (Keystore-backed) qua `expo-secure-store`.
- ❌ Không lưu token trong AsyncStorage / SharedPreferences / file plain.

### 7.2 Biometric (tương lai)

- `expo-local-authentication` — Face ID / Fingerprint để re-unlock app sau timeout (không thay thế password login lần đầu).

### 7.3 Code obfuscation

- Build EAS production bật `proguardRules` cho Android.
- Không obfuscate logic nghiệp vụ (làm khó debug crash).

### 7.4 Jailbreak/Root detection

- v1 không bắt buộc. Khi mở rộng cho khách bên ngoài, dùng `expo-root-detection` (3rd party) để cảnh báo.

---

## 8. Logging Security

- **Cấm log:** password, token, refresh, api_key, full email body, body upload binary.
- **Cấm log:** PII không cần thiết (số CCCD, địa chỉ chi tiết) — chỉ log id.
- **Mask middleware:** chặn các field nhạy cảm trước khi log.
- **Log retention:** App log 90 ngày (Loki), Audit log ≥ 2 năm (PostgreSQL backup).
- **Access log:** Nginx access log không log query string của endpoint auth.

---

## 9. Threat Model (Top 10)

### T-01: Credential stuffing trên `/auth/login`
**Mitigation:** Rate limit IP + email, lock account 5 lần sai, captcha nếu phát hiện burst (v2).

### T-02: SQL Injection
**Mitigation:** Prisma parameterized; lint chặn raw SQL concat; pen-test trước khi go-live.

### T-03: XSS qua field user nhập (ghi chú, full_name, lý do điều chỉnh)
**Mitigation:** React default escape; CSP; sanitize khi render trong PDF/Email template.

### T-04: IDOR (chỉnh id để truy cập resource người khác)
**Mitigation:** Mọi endpoint check ownership/role trước khi trả data. Vd `GET /pallets/:id` check user role có quyền xem pallet thuộc kho đó không (tương lai multi-warehouse).

### T-05: Privilege escalation qua role edit
**Mitigation:** Chỉ `Manager` có `role.update`. UI ma trận quyền không cho user tự thêm permission cho role của mình (UX block). Audit log đầy đủ.

### T-06: Bypass audit log
**Mitigation:** Audit log có DB trigger chặn UPDATE/DELETE. Service ghi log nằm trong file `🔒🔒 PROTECTED`. Cron giám sát.

### T-07: Race condition khi tạo pallet (UC-PAL-01)
**Mitigation:** Advisory lock theo `code_date` + UNIQUE constraint `(code_date, code_seq)`.

### T-08: Race condition khi pick FEFO (UC-FK-04)
**Mitigation:** `SELECT ... FOR UPDATE` trong TX. Retry với exponential backoff phía client nếu 409.

### T-09: File upload độc hại
**Mitigation:** Mime whitelist, size limit, ClamAV scan, pre-signed URL không trả qua plain URL.

### T-10: Excel formula injection (UC-IN-06, export)
**Mitigation:** Khi parse Excel input, strip leading `=`, `+`, `-`, `@` ở cell text. Khi export, escape user-provided string trong cell trị bằng prefix `'`.

---

## 10. Compliance & Privacy

### 10.1 PII

| Loại PII | Trường | Bảo vệ |
|---|---|---|
| Email user | `users.email` | Hash khi gửi mail bulk (không log full) |
| Phone user | `users.phone` | Mask khi hiển thị (`090****567`) cho non-self |
| Tên người giao hàng | `inbound_temps.delivered_by` | Audit log only |

### 10.2 Quyền của user

- **Right to access:** User xem profile + lịch sử login của chính mình.
- **Right to update:** UC-SYS-05 (sửa profile).
- **Right to delete:** Manager xoá user (soft delete, anonymize PII sau 90 ngày).

### 10.3 Audit retention

- `audit_logs`: ≥ 2 năm (regulatory).
- `mail_logs`: 6 tháng.
- `user_sessions`: revoke + cleanup sau expire 30 ngày.

---

## 11. Disaster Recovery

### 11.1 Backup

| Đối tượng | Tần suất | Retention | Tool |
|---|---|---|---|
| PostgreSQL full | Hằng ngày 02:00 | 30 ngày | pgBackRest |
| PostgreSQL WAL | Liên tục | 7 ngày | pgBackRest |
| MinIO bucket | Hằng ngày | 30 ngày | `mc mirror` → NAS |
| Audit log dump riêng | Hằng tuần | 2 năm | `pg_dump --table=audit_logs` GPG → cold storage |
| Config (.env, docker-compose, nginx.conf) | Mỗi khi đổi | mãi mãi | Git infra repo private |

### 11.2 RTO / RPO

| Scenario | RTO | RPO |
|---|---|---|
| Server crash | 1 giờ | 5 phút (WAL) |
| Data corruption | 4 giờ | 24 giờ (full backup) |
| Toàn bộ datacenter | 24 giờ | 24 giờ |

### 11.3 Test DR

- Mỗi quý test restore từ backup vào staging.
- Mỗi nửa năm test toàn diện DR drill.

---

## 12. Vulnerability Management

### 12.1 Scan

- **Dependency:** `npm audit` + Renovate + Snyk (CI).
- **Container:** Trivy scan Docker image trước deploy.
- **SAST:** Semgrep trong CI (rules nghiệp vụ + security).
- **DAST:** OWASP ZAP scan staging mỗi tháng.

### 12.2 Disclosure

- Email: `security@vinhgiang.com`.
- SLA: ack trong 48h, P1 fix < 7 ngày, P2 < 30 ngày.

### 12.3 Patch cadence

- Critical CVE: emergency patch trong 48h.
- High CVE: patch trong 7 ngày.
- Medium/Low: trong sprint thường.

---

## 13. Onboard / Off-board

### 13.1 Onboard nhân viên mới

1. Manager tạo user trong UC-SYS-04, chọn role.
2. Hệ thống gửi mail invite kèm mật khẩu tạm (random) → buộc đổi lần login đầu.
3. Nhân viên đổi MK, cập nhật profile.
4. Tham gia training: đọc `RULES.md`, hiểu role + permission của mình.

### 13.2 Off-board

1. Manager set `is_active=false`.
2. Hệ thống revoke toàn bộ `user_sessions` của user.
3. Sau 90 ngày: anonymize PII (`email='deleted+<id>@vinhgiang.local'`, `phone=NULL`, `full_name='[Deleted User]'`).
4. Giữ `id` để truy vết audit log historical.

---

## 14. Incident Response (Security)

### 14.1 Khi phát hiện breach

1. **Cô lập:** disable tài khoản, revoke session, block IP nếu cần.
2. **Đánh giá:** scope ảnh hưởng, data leaked?
3. **Thông báo:**
   - Internal: `#wms-security` Slack + email management.
   - External: nếu PII leak → thông báo user trong 72h.
4. **Forensics:** đọc audit log, app log, mail log để tái hiện sequence.
5. **Post-mortem:** trong 7 ngày — template `docs/templates/security-incident.md`.
6. **Action items:** thêm vào backlog, theo dõi đến đóng.

### 14.2 Drill

- Mỗi 6 tháng tổ chức tabletop exercise scenario (vd: "1 thủ kho leak token").

---

## 15. Checklist trước go-live

### Tech

- [ ] HTTPS bắt buộc, HSTS bật, certificate auto-renew.
- [ ] CSP, X-Frame-Options, các header bảo mật đầy đủ.
- [ ] Rate limit cấu hình đúng.
- [ ] CORS whitelist production domain.
- [ ] JWT RS256, key pair sinh riêng cho prod (không reuse staging).
- [ ] Password policy enforce.
- [ ] `bcrypt cost ≥ 12`.
- [ ] Audit log trigger active, test thử UPDATE/DELETE bị reject.
- [ ] Database backup chạy đầy đủ, đã test restore.
- [ ] Pen-test xong, fix Critical + High.
- [ ] Dependency scan không có CVE Critical/High open.

### Process

- [ ] CODEOWNERS đầy đủ cho file PROTECTED.
- [ ] Branch protection rule trên `main` (require review, status checks).
- [ ] Secret scanning bật trên GitHub.
- [ ] On-call rotation xác định.
- [ ] Runbook DR + Incident sẵn sàng.
- [ ] Training cho 5 role hoàn thành.

---

## 16. Tham chiếu

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DATABASE.md](DATABASE.md)
- [API_CONTRACTS.md](API_CONTRACTS.md)
- [CRITICAL_PATHS.md](CRITICAL_PATHS.md)
- [../RULES.md](../RULES.md)
- OWASP Top 10 (2021)
- NIST SP 800-63B (Digital Identity Guidelines)

# BÁO CÁO WVG-19 [BE] — UC-AUTH-01 Đăng nhập: chốt nguồn JWT secret + audit thất bại

**Ticket:** WVG-19 (subtask [BE] của Story WVG-17 / UC-AUTH-01)
**Phạm vi:** LOCAL (chưa deploy) · nhánh `cuongdd_web`
**Ngày:** 2026-07-30

---

## 1. Vấn đề (root cause)

Cụm 6 file xác thực tự đọc `process.env.JWT_SECRET` **kèm một literal hard-code làm giá trị dự phòng**:

```
const JWT_SECRET = process.env.JWT_SECRET || "<literal secret trong source>";
```

Rủi ro bảo mật (AUTH-003): nếu môi trường deploy **thiếu** biến `JWT_SECRET`, mọi token
sẽ được ký bằng một secret **công khai trong mã nguồn** → bất kỳ ai đọc source đều có thể
**giả mạo JWT** (leo thang quyền, mạo danh Admin). Đây là kiểu lỗi "im lặng": hệ thống vẫn
chạy bình thường, không báo lỗi, nên khó phát hiện khi vận hành.

---

## 2. Giải pháp

### G1 — Nguồn secret DUY NHẤT, không fallback (`src/lib/jwt.ts`)

Tạo helper dùng chung, **bỏ literal**, **throw khi thiếu env** (fail-fast thay vì ký bằng secret công khai):

```ts
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Server chưa cấu hình JWT_SECRET — từ chối ký/verify token.");
  }
  return secret;
}
```

Gọi ở **call-time** (không phải module-load) để không chặn import ở ngữ cảnh không cần token.

Thay thế literal trong toàn cụm auth (8 file cùng dùng `getJwtSecret()`):

| File | Vai trò | Thao tác |
|------|---------|----------|
| `src/lib/jwt.ts` | **Nguồn secret** | MỚI — helper throw-nếu-thiếu |
| `src/app/api/auth/login/route.ts` | Ký token (sign) | Bỏ literal → `getJwtSecret()` (2 chỗ sign) |
| `src/app/api/auth/me/route.ts` | Verify | `getJwtSecret()` |
| `src/app/api/auth/sessions/route.ts` | Verify | `getJwtSecret()` |
| `src/app/api/auth/sessions/[id]/route.ts` | Verify | `getJwtSecret()` |
| `src/app/api/auth/change-password/route.ts` | Verify | `getJwtSecret()` |
| `src/lib/audit.ts` | Verify (trích actor) | `getJwtSecret()` |
| `src/lib/auth-server.ts` | Verify (RBAC gate) | Bỏ hàm cục bộ → dùng chung |

### G2 — Audit đăng nhập THẤT BẠI + KHOÁ tài khoản (`login/route.ts`)

Trước đây chỉ ghi audit khi đăng nhập **thành công** (`action: "LOGIN"`). Nhánh sai mật khẩu
không để lại dấu vết → không phát hiện được **brute-force**. Bổ sung best-effort audit (try/catch,
không chặn response) ở nhánh sai mật khẩu:

- Sai mật khẩu (chưa khoá) → `action: "LOGIN_FAILED"`
- Sai đủ 5 lần → khoá tài khoản → `action: "ACCOUNT_LOCKED"`

Mỗi bản ghi lưu `ip_address`, `user_agent`, số lần sai cũ/mới (`old_value`/`new_value`), `reason`.

### G3 — Giữ nguyên thông báo (không đổi hành vi enumeration)

Theo yêu cầu: **không** đổi các message hiện có (tài khoản không tồn tại / sai mật khẩu / bị khoá)
để tránh phá vỡ test-case UC-AUTH-01 sẵn có. Chỉ thêm lớp audit ngầm phía sau.

### G4 — FE dọn nhãn role legacy (`src/app/auth/page.tsx`)

`DESKTOP_LABELS` còn nhãn `ADMIN/MANAGER/STAFF` (đã di trú sang `QUAN_LY` ở WVG-16). Bỏ 3 nhãn thừa,
giữ `QUAN_LY` + `KE_TOAN`. Bảng chỉ dùng để hiển thị thông báo chuyển hướng, không ảnh hưởng logic.

---

## 3. Bằng chứng kiểm thử

### 3.1 Quét bảo mật — literal secret đã BIẾN MẤT khỏi toàn `src/`

```
$ grep -rniE "vinhgiang_super_secret_key|JWT_SECRET *\|\|" src/
>>> SẠCH 100%   (0 dòng)
```

Không còn literal secret, cũng không còn bất kỳ pattern fallback `JWT_SECRET || ...` nào.

### 3.2 Tất cả điểm ký/verify đi qua 1 nguồn

```
$ grep -rln "getJwtSecret" src/
  src/lib/jwt.ts                              (định nghĩa)
  src/lib/auth-server.ts                      (RBAC gate)
  src/lib/audit.ts                            (trích actor)
  src/app/api/auth/login/route.ts            (sign)
  src/app/api/auth/me/route.ts               (verify)
  src/app/api/auth/sessions/route.ts         (verify)
  src/app/api/auth/sessions/[id]/route.ts    (verify)
  src/app/api/auth/change-password/route.ts  (verify)
```

### 3.3 Type-check & lint

- `npx tsc --noEmit`: **SẠCH** (chỉ còn cảnh báo trong `.next/dev/types` — artifact dev của Next, không phải mã nguồn).
- `eslint` 8 file đã sửa: không phát sinh lỗi mới. (2 cảnh báo cũ trong `auth/page.tsx` — `set-state-in-effect` dòng 26 & `no-img-element` dòng 127 — là **nợ có sẵn**, không nằm trong diff WVG-19; xác nhận qua `git diff`.)

---

## 4. Mapping API (UC-AUTH-01)

| Endpoint | Method | Ký/Verify | Ghi chú |
|----------|--------|-----------|---------|
| `/api/auth/login` | POST | **sign** ×2 (temp + có sessionId) | Reset failed-attempts khi thành công; audit LOGIN / LOGIN_FAILED / ACCOUNT_LOCKED |
| `/api/auth/me` | GET | verify | Trả thông tin user hiện tại |
| `/api/auth/sessions` | GET | verify | Liệt kê phiên đăng nhập |
| `/api/auth/sessions/[id]` | DELETE | verify | Thu hồi 1 phiên |
| `/api/auth/change-password` | PUT | verify | Đổi mật khẩu + thu hồi phiên khác |
| *(mọi route business)* | * | verify qua `auth-server.ts` | `requireAuth`/`requirePermission` — RBAC deny-by-default (WVG-16) |

---

## 5. Kết luận

- ✅ **G1**: 1 nguồn JWT secret, bỏ literal, fail-fast khi thiếu env — bịt lỗ giả mạo token.
- ✅ **G2**: audit LOGIN_FAILED + ACCOUNT_LOCKED — có dấu vết phát hiện brute-force.
- ✅ **G3**: giữ nguyên thông báo, không phá test-case sẵn có.
- ✅ **G4**: FE dọn nhãn role legacy.
- ✅ tsc sạch, quét bảo mật sạch 100%.

**Trạng thái:** hoàn tất trên LOCAL, **chưa deploy** (theo chỉ đạo). Chờ commit.

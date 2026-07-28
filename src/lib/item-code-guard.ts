// WVG-63 / WMS-003 — Chặn dữ liệu TÀI KHOẢN lọt vào Mã hàng (item_codes).
//
// Bối cảnh: luồng import Excel nhập kho (và POST tạo mã hàng) tạo item_codes từ
// giá trị thô. Nếu import nhầm file/sheet chứa email/SĐT/tên tài khoản, các dòng
// account sẽ hiện ra như "mã hàng chờ chuẩn hóa". Helper này chặn ở tầng ghi.
//
// 2 lớp phòng thủ (bổ trợ, hạn chế false-positive với mã hàng thật):
//   1) TĨNH  — looksLikeAccount(): bắt giá trị giống EMAIL hoặc SĐT DI ĐỘNG VN.
//              Mã hàng thật (số 8 chữ số, "TEMP-*", tên SP có dấu) KHÔNG dính.
//   2) ĐỐI CHIẾU DB — matchesUserAccount(): bắt giá trị TRÙNG ĐÚNG một tài khoản
//              trong bảng users (email/phone/username/full_name) — kể cả SĐT lạ
//              mà lớp tĩnh bỏ sót (vd số cố định 0123456789).
//
// Dùng CHUNG cho: src/app/api/inbound/import-excel/confirm/route.ts và
//                 src/app/api/item-codes/route.ts (POST).

// Email: có phần local + '@' + domain có ít nhất 1 dấu chấm.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Có chứa '@' kèm ký tự 2 bên (bắt cả chuỗi "abc@xyz" chưa đủ domain).
const HAS_AT_RE = /\S@\S/;
// SĐT di động VN: 10 số bắt đầu 0[3|5|7|8|9], hoặc +84/84 + [3|5|7|8|9] + 8 số.
const VN_MOBILE_RE = /^(?:\+?84|0)[35789]\d{8}$/;

/**
 * Trả về `null` nếu giá trị KHÔNG giống tài khoản, hoặc chuỗi thông báo lỗi
 * tiếng Việt nếu giống email / SĐT di động VN. Bỏ trống → null (không xét).
 */
export function looksLikeAccount(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (EMAIL_RE.test(v) || HAS_AT_RE.test(v)) {
    return "Giá trị giống email/tài khoản người dùng, không phải mã hàng.";
  }
  // Bỏ khoảng trắng/gạch nối khi so SĐT (vd "0971 140 828").
  const digits = v.replace(/[\s.-]/g, "");
  if (VN_MOBILE_RE.test(digits)) {
    return "Giá trị giống số điện thoại, không phải mã hàng.";
  }
  return null;
}

/** Chuẩn hoá 1 giá trị để so khớp danh tính (trim + lower). */
export function normalizeIdentity(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export interface UserIdentityRow {
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  full_name?: string | null;
}

/**
 * Gộp toàn bộ định danh tài khoản (email/phone/username/full_name) đã chuẩn hoá
 * thành 1 Set để đối chiếu nhanh trong bộ nhớ. Bỏ qua giá trị rỗng.
 */
export function buildUserIdentitySet(users: UserIdentityRow[]): Set<string> {
  const set = new Set<string>();
  for (const u of users) {
    for (const field of [u.email, u.phone, u.username, u.full_name]) {
      const key = normalizeIdentity(field);
      if (key) set.add(key);
    }
  }
  return set;
}

/** True nếu `value` trùng đúng một định danh tài khoản trong Set. */
export function matchesUserAccount(
  value: string | null | undefined,
  idSet: Set<string>
): boolean {
  const key = normalizeIdentity(value);
  return key.length > 0 && idSet.has(key);
}

/**
 * Kiểm 1 giá trị (mã hàng hoặc tên) có phải dữ liệu tài khoản không.
 * Trả `null` nếu hợp lệ, hoặc thông báo lỗi tiếng Việt nếu giống tài khoản.
 * `label` để ghép câu ("Mã hàng"/"Tên rút gọn").
 */
export function assertNotAccount(
  value: string | null | undefined,
  idSet: Set<string>,
  label: string
): string | null {
  const staticErr = looksLikeAccount(value);
  if (staticErr) return `${label}: ${staticErr}`;
  if (matchesUserAccount(value, idSet)) {
    return `${label}: trùng với tài khoản người dùng, không phải mã hàng.`;
  }
  return null;
}

// Validate trường "Quy cách" (specification) — TC_001_012.
//
// Quy cách là trường TÙY CHỌN: để trống vẫn hợp lệ. Nhưng nếu có nhập thì phải là
// mô tả đóng gói có nghĩa, KHÔNG được là chuỗi rác toàn ký tự đặc biệt.
//
// Hợp lệ: chỉ gồm chữ (kể cả tiếng Việt có dấu), số, khoảng trắng và các ký tự quy
// cách thông dụng ( / × x * . , - ( ) + % : ) — VÀ phải chứa ít nhất 1 chữ hoặc số.
//   ✓ "24 chai/thùng"  "500ml/chai"  "1220x2440x18mm"  "Thùng 12 lon"  "1,5 kg"
//   ✗ "!@#$%^&*"  "<<>>"  "====="  (toàn ký tự đặc biệt, vô nghĩa)
//
// Dùng CHUNG cho frontend (màn hình Thủ kho tạo mã hàng) và backend (POST
// /api/item-codes) để chặn nhất quán ở cả 2 lớp.

export const SPEC_MAX_LENGTH = 100;

// Tập ký tự cho phép trong quy cách đóng gói.
const SPEC_ALLOWED = /^[\p{L}\p{N}\s/×x*.,()+%:\-]+$/u;
// Phải có ít nhất 1 chữ hoặc số (chặn chuỗi chỉ gồm dấu/khoảng trắng).
const SPEC_HAS_ALNUM = /[\p{L}\p{N}]/u;

/**
 * Trả về `null` nếu Quy cách hợp lệ (kể cả khi bỏ trống), hoặc chuỗi thông báo
 * lỗi tiếng Việt nếu không hợp lệ.
 */
export function validateSpecification(raw: string | null | undefined): string | null {
  const spec = (raw ?? "").trim();
  if (!spec) return null; // tùy chọn — bỏ trống là hợp lệ
  if (spec.length > SPEC_MAX_LENGTH) {
    return `Quy cách không vượt quá ${SPEC_MAX_LENGTH} ký tự.`;
  }
  if (!SPEC_HAS_ALNUM.test(spec) || !SPEC_ALLOWED.test(spec)) {
    return "Quy cách không hợp lệ. Chỉ gồm chữ, số và ký tự thông dụng (ví dụ: 24 chai/thùng, 500ml/chai, 1220x2440x18mm).";
  }
  return null; // hợp lệ
}

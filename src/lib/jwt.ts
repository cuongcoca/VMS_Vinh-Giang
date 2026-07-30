// WVG-19 / UC-AUTH-01 (AUTH-003) — Nguồn JWT secret DUY NHẤT cho toàn hệ thống.
//
// Trước đây 6 file cụm auth (login/me/sessions/change-password/audit) tự đọc biến
// môi trường JWT_SECRET NHƯNG kèm một chuỗi literal hard-code làm giá trị dự phòng.
// → literal secret nằm trong source: nếu deploy THIẾU env JWT_SECRET, token được ký
// bằng secret CÔNG KHAI → giả mạo được. Helper này BỎ fallback, throw khi thiếu.
//
// Gọi ở CALL-TIME (không phải module-load) để không block import khi env chưa set
// trong ngữ cảnh không cần verify token.

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Server chưa cấu hình JWT_SECRET — từ chối ký/verify token.");
  }
  return secret;
}

// Client fetch helper that attaches the JWT (localStorage) as Authorization: Bearer.
// Dùng cho mọi gọi API cần xác thực để tránh 401 (vd /api/system/rbac) và để các
// route ghi dữ liệu có thể enforce requireAuth mà không vỡ giao diện.
import { auth } from "./auth";

export function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = typeof window !== "undefined" ? auth.getToken() : null;
  return { ...(extra || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = { ...((init.headers as Record<string, string>) || {}), ...authHeaders() };
  return fetch(input, { ...init, headers });
}

/**
 * WVG-64 / WMS-004 — Lỗi API phía client (kèm HTTP status) để UI hiện thông báo + Thử lại.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * WVG-64 / WMS-004 — fetch + parse JSON AN TOÀN.
 *
 * Chặn anti-pattern "lỗi biến thành empty state":
 *  - Lỗi mạng → ApiError(0).
 *  - `!res.ok` → đọc message JSON nếu có, không thì thông báo theo status → ApiError(status).
 *  - Response KHÔNG phải JSON (HTML 404/502/504, redirect...) → ApiError thay vì
 *    ném "Unexpected token '<'" và bị nuốt thành rỗng.
 *  - Body `{ success: false }` (kể cả HTTP 200) → ApiError(body.error).
 *
 * Trả về body đã parse (thường là envelope `{ success, data }`).
 */
export async function fetchJson<T = unknown>(input: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(input, init);
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }

  const isJson = (res.headers.get("content-type") || "").includes("application/json");

  if (!res.ok) {
    let message =
      res.status === 401
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : res.status === 403
          ? "Bạn không có quyền thực hiện thao tác này."
          : `Máy chủ trả về lỗi ${res.status}. Vui lòng thử lại.`;
    if (isJson) {
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* body không đọc được → giữ message theo status */
      }
    }
    throw new ApiError(res.status, message);
  }

  if (!isJson) {
    // Đây chính là ca "Unexpected token '<'": server trả HTML/redirect thay JSON.
    throw new ApiError(res.status, "Máy chủ trả về dữ liệu không hợp lệ (không phải JSON). Vui lòng thử lại.");
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, "Không đọc được dữ liệu từ máy chủ (JSON hỏng). Vui lòng thử lại.");
  }

  if (body && typeof body === "object" && (body as { success?: boolean }).success === false) {
    throw new ApiError(res.status, (body as { error?: string }).error || "Thao tác thất bại.");
  }
  return body as T;
}

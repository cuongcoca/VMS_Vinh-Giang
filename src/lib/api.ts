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

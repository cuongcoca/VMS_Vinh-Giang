import Constants from 'expo-constants';
import { tokenStorage } from '../auth/token-storage';

// Backend là app web Next.js (basePath /wms) → API gốc tại /wms/api.
// Ưu tiên biến môi trường khi build; nếu không có thì lấy từ app.json (extra.apiUrl).
const BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  Constants.expoConfig?.extra?.apiUrl ??
  'https://khohangvinhgiang.io.vn/wms/api';

export type ApiError = {
  type?: string;
  title?: string;
  status: number;
  detail?: string;
  errors?: Array<{ field?: string; message: string }>;
};

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccess(): Promise<string | null> {
  const refresh = await tokenStorage.getRefresh();
  if (!refresh) return null;
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  });
  if (!res.ok) {
    await tokenStorage.clear();
    return null;
  }
  const body = await res.json();
  const access = body.data?.accessToken as string | undefined;
  if (!access) return null;
  await tokenStorage.setAccess(access);
  return access;
}

async function call<T>(
  path: string,
  init: RequestInit,
  retried = false,
  unwrap = true,
): Promise<T> {
  const token = await tokenStorage.getAccess();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (res.status === 401 && !retried) {
    if (!refreshPromise) refreshPromise = refreshAccess();
    const newAccess = await refreshPromise;
    refreshPromise = null;
    if (newAccess) return call<T>(path, init, true, unwrap);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Backend Next.js trả lỗi dạng { success:false, error:"..." };
    // chuẩn hoá về `detail` để các màn hình dùng chung.
    const b = body as ApiError & { error?: string };
    const detail = b.detail ?? b.error ?? res.statusText;
    throw Object.assign(new Error(detail), { ...b, detail, status: res.status });
  }
  // unwrap=true: trả body.data (mặc định). unwrap=false: trả nguyên body
  // (dùng cho endpoint có dữ liệu ở field khác như `detail`, `session_id`).
  return (unwrap ? (body.data ?? body) : body) as T;
}

export const api = {
  get: <T>(path: string) => call<T>(path, { method: 'GET' }),
  // Trả nguyên JSON body (không unwrap `data`)
  getRaw: <T>(path: string) => call<T>(path, { method: 'GET' }, false, false),
  post: <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    call<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => call<T>(path, { method: 'DELETE' }),
};

export const apiBase = BASE;
// Gốc host (bỏ hậu tố /api) — dùng để dựng URL ảnh/tệp tĩnh.
export const apiOrigin = BASE.replace(/\/api\/?$/, '');

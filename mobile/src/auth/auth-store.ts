import { create } from 'zustand';
import { tokenStorage, type AuthUser } from './token-storage';
import { api } from '../api/client';

// Backend web Next.js (/wms/api/auth/login) trả về:
//   { success, token, user: { id, fullName, role: "THU_KHO", phone, email, avatarUrl } }
interface NextAuthUser {
  id: string | number;
  fullName?: string;
  full_name?: string;
  role: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}
interface LoginResponse {
  success?: boolean;
  token?: string;
  user: NextAuthUser;
}

// Nhãn hiển thị cho từng mã vai trò.
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý',
  QUAN_LY: 'Quản lý kho',
  KE_TOAN: 'Kế toán kho',
  STAFF: 'Nhân viên',
  THU_KHO: 'Thủ kho',
  XE_NANG: 'Xe nâng',
  KIEM_KE: 'Người kiểm kê',
};

interface AuthState {
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser) => Promise<void>;
  hasPermission: (perm: string) => boolean;
  hasAnyRole: (...codes: string[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  hydrated: false,

  hydrate: async () => {
    const u = await tokenStorage.getUser();
    set({ user: u, hydrated: true });
  },

  login: async (identifier, password) => {
    const res = await api.post<LoginResponse>('/auth/login', { identifier, password });
    if (!res.token) {
      throw Object.assign(new Error('Đăng nhập thất bại'), {
        detail: 'Phản hồi đăng nhập không hợp lệ từ máy chủ.',
      });
    }
    const u = res.user;
    const mapped: AuthUser = {
      id: String(u.id),
      email: u.email ?? '',
      phone: u.phone ?? null,
      fullName: u.fullName ?? u.full_name ?? '',
      role: { code: u.role, name: ROLE_LABELS[u.role] ?? u.role },
      permissions: [],
      avatarUrl: u.avatarUrl ?? u.avatar_url ?? null,
    };
    // Backend chưa cấp refresh token riêng → dùng lại access token.
    await tokenStorage.setTokens(res.token, res.token);
    await tokenStorage.setUser(mapped);
    set({ user: mapped });
  },

  setUser: async (u) => {
    await tokenStorage.setUser(u);
    set({ user: u });
  },

  logout: async () => {
    const refresh = await tokenStorage.getRefresh();
    try {
      if (refresh) await api.post('/auth/logout', { refreshToken: refresh });
    } catch {
      // best-effort
    }
    await tokenStorage.clear();
    set({ user: null });
  },

  hasPermission: (perm) => !!get().user?.permissions.includes(perm),
  hasAnyRole: (...codes) => {
    const code = get().user?.role.code;
    return !!code && codes.includes(code);
  },
}));

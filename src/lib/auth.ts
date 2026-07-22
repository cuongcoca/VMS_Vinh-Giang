export interface AuthUser {
  id: string;
  fullName: string;
  role: "ADMIN" | "MANAGER" | "STAFF" | "QUAN_LY" | "KE_TOAN" | "THU_KHO" | "XE_NANG" | "KIEM_KE";
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}

const TOKEN_KEY = "vinhgiang_wms_token";
const USER_KEY = "vinhgiang_wms_user";

export const auth = {
  saveToken(token: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },
  getToken() {
    if (typeof window !== "undefined") {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },
  removeToken() {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },
  saveUser(user: AuthUser) {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
  getUser(): AuthUser | null {
    if (typeof window !== "undefined") {
      const userStr = localStorage.getItem(USER_KEY);
      if (userStr) {
        try {
          return JSON.parse(userStr);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  },
  isAuthenticated() {
    return !!this.getToken();
  },
};

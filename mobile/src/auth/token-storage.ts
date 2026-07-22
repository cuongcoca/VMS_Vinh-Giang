import * as SecureStore from 'expo-secure-store';

/**
 * Token storage — SecureStore on device (Keychain iOS / EncryptedSharedPreferences
 * Android-backed). User profile is also persisted so the app can boot
 * offline-aware UI without an immediate /me round-trip.
 */
const ACCESS_KEY = 'wms.access';
const REFRESH_KEY = 'wms.refresh';
const USER_KEY = 'wms.user';

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  role: { code: string; name: string };
  permissions: string[];
  avatarUrl: string | null;
}

export const tokenStorage = {
  async setTokens(access: string, refresh: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh);
  },
  async setAccess(access: string) {
    await SecureStore.setItemAsync(ACCESS_KEY, access);
  },
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setUser(user: AuthUser) {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },
  async getUser(): Promise<AuthUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  },
};

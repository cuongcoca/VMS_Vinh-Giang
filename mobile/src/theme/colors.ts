import { Platform } from 'react-native';

/**
 * Color tokens — Brand "Vĩnh Giang" (navy + đỏ trên nền kem).
 * Design system thống nhất cho toàn app mobile.
 */
export const colors = {
  bg: '#faf9f6', // kem
  bgSoft: '#f3f1ec',
  panel: '#ffffff',
  ink: '#16202c',
  inkSoft: '#3f4654',
  muted: '#6b7280',
  line: '#e6e3dc', // viền chuẩn (hairline)

  // ==== BRAND ====
  navy: '#022448', // màu thương hiệu chủ đạo (khung, nút chính, hero)
  navyMid: '#0b3a6b',
  navySoft: '#eef2f7',
  brandRed: '#c1121f', // accent đỏ (nhấn, viền, trạng thái)
  brandRedDark: '#8c0d16',
  brandRedSoft: '#fdeef0',

  accent: '#1e3a5f',
  accentSoft: '#e8eef5',

  // Brand palette — mirror web frontend (src/app/globals.css @theme)
  primary: '#000e24',
  primaryContainer: '#022448', // nút chính + nền màn đăng nhập
  brandText: '#001e71', // chữ "Warehouse Management System"
  secondary: '#455f87', // link "Quên mật khẩu?"
  outline: '#74777f',
  outlineVariant: '#c4c6cf',
  surfaceVariant: '#e3e2e0',

  // ==== TRẠNG THÁI (quy ước nghĩa) ====
  ok: '#15803d',
  okSoft: '#e7f6ec',
  warn: '#b45309',
  warnSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fdeef0',
  info: '#2563eb',
  infoSoft: '#e6f1fb',

  // Role colors (mockup) — used in tab top-bars for role identity
  roleKeeper: '#1e3a5f',
  roleForklift: '#ea580c',
  roleStocktaker: '#7c3aed',

  // Kiểm kê (tím) — chi tiết
  purple: '#7c3aed',
  purpleDark: '#6d28d9',
  purpleSoft: '#f3e8ff',
  blue: '#2563eb',
  amber: '#d97706',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Thang cỡ chữ cố định (11 · 13 · 15 · 20 · 28)
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 28,
};

// Bo góc chuẩn
export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 100,
};

// Font mono cho mã hàng / mã vị trí / số lượng
export const mono = Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }) as string;

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../../src/auth/auth-store';
import { api } from '../../src/api/client';
import { ScreenContainer } from '../../src/components/ScreenContainer';
import { colors, spacing } from '../../src/theme/colors';
import { KiemkeDashboard } from '../../src/roles/KiemkeDashboard';

interface Widget {
  type: string;
  value: number | string;
  delta?: string;
}
interface DashResp {
  role: string;
  widgets: Widget[];
}

const WIDGET_META: Record<
  string,
  { label: string; href?: string; tone: 'accent' | 'warn' | 'danger' | 'ok' | 'default' }
> = {
  PHN_NEW: { label: 'Phiếu chờ tiếp nhận', href: '/(tabs)/inbound', tone: 'accent' },
  PALLETS_COUNTING: { label: 'Pallet đang kiểm đếm', href: '/(tabs)/pallets', tone: 'warn' },
  PALLETS_CONFIRMED: { label: 'Pallet chờ xe nâng', href: '/(tabs)/pallets', tone: 'ok' },
  PENDING_PUTAWAY: { label: 'Pallet chờ xếp', href: '/(tabs)/forklift', tone: 'accent' },
  IN_STAGING: { label: 'Pallet tại khu chờ xuất', tone: 'warn' },
  OPEN_SESSIONS: { label: 'Phiên kiểm kê mở', href: '/(tabs)/stocktake', tone: 'accent' },
  DISCREPANCIES: { label: 'Chênh lệch chờ xử lý', href: '/(tabs)/stocktake', tone: 'danger' },
};

const ROLE_LABEL: Record<string, string> = {
  MANAGER: 'Quản lý',
  ACCOUNTANT: 'Kế toán kho',
  KE_TOAN: 'Kế toán kho',
  QUAN_LY: 'Quản lý kho',
  THU_KHO: 'Thủ kho',
  XE_NANG: 'Xe nâng',
  KIEM_KE: 'Người kiểm kê',
  WAREHOUSE_KEEPER: 'Thủ kho',
  FORKLIFT: 'Xe nâng',
  STOCKTAKER: 'Người kiểm kê',
};

const TONE_BORDER: Record<string, string> = {
  accent: colors.accent,
  warn: colors.warn,
  danger: colors.danger,
  ok: colors.ok,
  default: colors.line,
};

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const q = useQuery<DashResp>({
    queryKey: ['mobile-dashboard'],
    queryFn: () => api.get('/dashboard'),
  });

  if (!user) return null;

  // Vai trò kiểm kê: dùng dashboard riêng khớp giao diện web.
  if (user.role.code === 'KIEM_KE' || user.role.code === 'STOCKTAKER') {
    return <KiemkeDashboard />;
  }

  return (
    <ScreenContainer>
      <View style={styles.greeting}>
        <Text style={styles.kicker}>Chào,</Text>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.role}>{ROLE_LABEL[user.role.code] ?? user.role.code}</Text>
      </View>

      <Text style={styles.sectionTitle}>Tác vụ ưu tiên</Text>

      {q.isLoading && <Text style={styles.muted}>Đang tải…</Text>}

      <View style={styles.grid}>
        {q.data?.widgets.map((w) => {
          const meta = WIDGET_META[w.type] ?? { label: w.type, tone: 'default' as const };
          return (
            <Pressable
              key={w.type}
              onPress={meta.href ? () => router.push(meta.href as never) : undefined}
              style={({ pressed }) => [
                styles.tile,
                { borderLeftColor: TONE_BORDER[meta.tone], opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.tileLabel}>{meta.label}</Text>
              <Text style={styles.tileValue}>{w.value}</Text>
              {w.delta && <Text style={styles.tileDelta}>{w.delta}</Text>}
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  greeting: { marginBottom: spacing.lg },
  kicker: { fontSize: 13, color: colors.muted },
  name: { fontSize: 22, fontWeight: '700', color: colors.ink, marginTop: 4 },
  role: { fontSize: 13, color: colors.accent, marginTop: 2, fontWeight: '600' },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  grid: { gap: spacing.sm },
  tile: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    padding: spacing.lg,
  },
  tileLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  tileValue: { fontSize: 32, fontWeight: '700', color: colors.ink },
  tileDelta: { fontSize: 12, color: colors.muted, marginTop: 4 },
  muted: { color: colors.muted, fontStyle: 'italic' },
});

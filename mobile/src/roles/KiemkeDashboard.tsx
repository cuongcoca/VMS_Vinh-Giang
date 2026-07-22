import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '../auth/auth-store';
import { api } from '../api/client';
import { colors, spacing, radius, mono } from '../theme/colors';
import {
  AppHeader,
  Card,
  EmptyState,
  Mono,
  PrimaryButton,
  SectionLabel,
  StatTile,
  StatusBadge,
} from '../ui/kit';
import { AnimatedBar, FadeInUp, PressScale } from '../ui/anim';

interface StockSession {
  id: string;
  code?: string;
  type?: string;
  status: string;
  discrepancies?: number;
  total_counts?: number;
  counted?: number;
  progress?: number;
  created_at: string;
}
interface CountRow {
  location?: { zone?: string; rack?: string } | null;
  actual_qty?: number | null;
}
interface SessionDetail {
  counts?: CountRow[];
}

const ACTIVE = ['OPEN', 'COUNTING', 'RECONCILING'];

const STATUS: Record<string, { label: string; tone: 'info' | 'warn' | 'red' | 'ok' | 'neutral' }> = {
  OPEN: { label: 'Đang mở', tone: 'info' },
  COUNTING: { label: 'Đang đếm', tone: 'warn' },
  RECONCILING: { label: 'Đối chiếu', tone: 'red' },
  CLOSED: { label: 'Đã xong', tone: 'ok' },
};

export function KiemkeDashboard() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const sessionsQ = useQuery<StockSession[]>({
    queryKey: ['stock-count'],
    queryFn: () => api.get('/stock-count'),
  });

  const notiQ = useQuery<{ unread_count?: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.getRaw('/notifications?limit=30'),
  });
  const unread = notiQ.data?.unread_count ?? 0;

  const sessions = sessionsQ.data ?? [];
  const active = sessions.find((s) => ACTIVE.includes(s.status)) ?? null;

  const detailQ = useQuery<SessionDetail>({
    queryKey: ['stock-count', active?.id],
    queryFn: () => api.get(`/stock-count/${active!.id}`),
    enabled: !!active?.id,
  });

  const zones = (() => {
    const counts = detailQ.data?.counts;
    if (!counts) return [] as { zone: string; rack: string; total: number; counted: number }[];
    const g: Record<string, { zone: string; rack: string; total: number; counted: number }> = {};
    counts.forEach((c) => {
      const loc = c.location;
      if (!loc) return;
      const k = `${loc.zone}-${loc.rack}`;
      if (!g[k]) g[k] = { zone: loc.zone ?? '', rack: loc.rack ?? '', total: 0, counted: 0 };
      g[k].total += 1;
      if (c.actual_qty != null) g[k].counted += 1;
    });
    return Object.values(g).sort((a, b) => (a.zone !== b.zone ? a.zone.localeCompare(b.zone) : a.rack.localeCompare(b.rack)));
  })();

  const openCount = sessions.filter((s) => s.status === 'OPEN').length;
  const countingCount = sessions.filter((s) => s.status === 'COUNTING').length;
  const closedCount = sessions.filter((s) => s.status === 'CLOSED').length;
  const discCount = sessions.filter((s) => (s.discrepancies ?? 0) > 0).length;

  const name = user?.fullName || 'Người kiểm kê';
  const progress = Math.min(100, active?.progress ?? 0);
  const remaining = active ? (active.total_counts ?? 0) - (active.counted ?? 0) : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <AppHeader
        title={name}
        subtitle="KIỂM KÊ · KHO A"
        icon="clipboard-outline"
        rightIcon="notifications-outline"
        onRightPress={() => router.push('/notifications')}
        rightBadge={unread}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero gradient */}
        <FadeInUp>
          <LinearGradient colors={['#2563eb', '#022448']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={styles.heroKicker}>ĐỢT KIỂM KÊ HÔM NAY</Text>
            <Text style={styles.heroTitle}>
              {active ? (remaining > 0 ? `Còn ${remaining} vị trí` : 'Đã hoàn tất hôm nay') : 'Chưa có đợt nào'}
            </Text>
            {active && (
              <Text style={styles.heroSub}>
                Hoàn tất {active.counted ?? 0}/{active.total_counts ?? 0} · {progress}%
              </Text>
            )}
          </LinearGradient>
        </FadeInUp>

        {sessionsQ.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.navy} />
          </View>
        ) : active ? (
          <>
            {/* Phiên đang đếm */}
            <Card style={styles.sessionCard}>
              <View style={styles.rowBetween}>
                <Mono style={styles.code}>{active.code}</Mono>
                <StatusBadge label={active.status === 'OPEN' ? 'ĐANG MỞ' : 'ĐANG ĐẾM'} tone="red" />
              </View>
              <Text style={styles.sub}>
                {active.type === 'BY_LOCATION' ? 'Theo vị trí' : 'Theo mã hàng'} ·{' '}
                {new Date(active.created_at).toLocaleDateString('vi-VN')}
              </Text>
              <View style={{ marginTop: 12 }}>
                <AnimatedBar value={progress} color={colors.navy} />
                <Text style={styles.progressText}>
                  Tiến độ {active.counted ?? 0}/{active.total_counts ?? 0} vị trí ({progress}%)
                </Text>
              </View>
            </Card>

            {/* Vị trí được giao */}
            <SectionLabel>Vị trí được giao</SectionLabel>
            {detailQ.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.navy} />
              </View>
            ) : zones.length === 0 ? (
              <Card>
                <Text style={styles.sub}>Không có vị trí cụ thể nào được giao.</Text>
              </Card>
            ) : (
              zones.map((z, i) => {
                const done = z.counted === z.total;
                return (
                  <Card key={i} style={styles.zoneCard}>
                    <View>
                      <Text style={styles.zoneName}>
                        Khu {z.zone} · Kệ {z.rack}
                      </Text>
                      <Text style={styles.sub}>Tổng số: {z.total} vị trí</Text>
                    </View>
                    <StatusBadge
                      label={done ? `Hoàn tất ${z.counted}/${z.total}` : `${z.counted}/${z.total}`}
                      tone={done ? 'ok' : 'warn'}
                    />
                  </Card>
                );
              })
            )}

            <PrimaryButton
              title="Tiếp tục kiểm kê"
              icon="arrow-forward"
              onPress={() => router.push(`/(tabs)/stocktake/${active.id}`)}
            />
          </>
        ) : (
          <EmptyState
            icon="clipboard-outline"
            title="Không có đợt kiểm kê"
            hint="Phiên mới sẽ xuất hiện khi quản lý giao việc."
            action="Quét vị trí để đếm nhanh"
            onAction={() => router.push('/(tabs)/scan')}
          />
        )}

        {/* Phím tắt */}
        <SectionLabel>Tác vụ nhanh</SectionLabel>
        <FadeInUp delay={120}>
          <View style={styles.actionsRow}>
            <ActionCard icon="clipboard-outline" label="Nhiệm vụ" grad={['#3b82f6', '#1e3a8a']} onPress={() => router.push('/(tabs)/stocktake')} />
            <ActionCard icon="qr-code-outline" label="Quét & Đếm" grad={['#fb7185', '#c1121f']} onPress={() => router.push('/(tabs)/scan')} />
            <ActionCard icon="time-outline" label="Tra cứu" grad={['#22d3ee', '#0e7490']} onPress={() => router.push('/(tabs)/history')} />
          </View>
        </FadeInUp>

        {/* Thống kê nhanh */}
        <SectionLabel>Thống kê nhanh</SectionLabel>
        <FadeInUp delay={180}>
          <View style={styles.kpiGrid}>
            <StatTile label="Đang mở" value={openCount} tone="info" icon="folder-open-outline" />
            <StatTile label="Đang đếm" value={countingCount} tone="warn" icon="time-outline" />
            <StatTile label="Đã đóng" value={closedCount} tone="ok" icon="checkmark-done-outline" />
            <StatTile label="Lệch SL" value={discCount} tone="red" icon="alert-circle-outline" />
          </View>
        </FadeInUp>

        {/* Phiên gần đây */}
        {sessions.length > 0 && (
          <>
            <SectionLabel>Phiên gần đây</SectionLabel>
            {sessions.slice(0, 5).map((s) => {
              const st = STATUS[s.status] ?? { label: s.status, tone: 'neutral' as const };
              return (
                <PressScale key={s.id} onPress={() => router.push(`/(tabs)/stocktake/${s.id}`)}>
                  <Card style={styles.recentCard}>
                    <Mono style={styles.recentCode}>{s.code ?? `STK-${String(s.id).slice(0, 8)}`}</Mono>
                    <StatusBadge label={st.label} tone={st.tone} />
                  </Card>
                </PressScale>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionCard({ icon, label, grad, onPress }: { icon: any; label: string; grad: [string, string]; onPress: () => void }) {
  return (
    <PressScale onPress={onPress} style={{ flex: 1 }}>
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionCard}>
        <Ionicons name={icon} size={24} color="#fff" />
        <Text style={styles.actionLabel}>{label}</Text>
      </LinearGradient>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  actionCard: { flex: 1, borderRadius: radius.lg, paddingVertical: 16, alignItems: 'center', gap: 6 },
  actionLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },

  hero: {
    backgroundColor: colors.navy,
    borderRadius: radius.lg,
    padding: 18,
    shadowColor: '#022448',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroKicker: { color: '#ffffffb3', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 3 },
  heroSub: { color: '#ffffffb3', fontSize: 12, marginTop: 2 },

  sessionCard: { borderLeftWidth: 4, borderLeftColor: colors.brandRed },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontSize: 15, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 3 },
  progressText: { fontSize: 12, color: colors.inkSoft, fontWeight: '600', marginTop: 8 },

  zoneCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  zoneName: { fontSize: 13, fontWeight: '700', color: colors.ink },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  recentCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  recentCode: { fontSize: 14, fontWeight: '700', color: colors.navy },
});

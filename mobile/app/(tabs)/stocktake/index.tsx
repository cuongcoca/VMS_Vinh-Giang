import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { colors, spacing, radius } from '../../../src/theme/colors';
import { Card, EmptyState, Mono, ProgressBar, ScreenTitle, StatusBadge } from '../../../src/ui/kit';

interface Session {
  id: string;
  code?: string;
  type?: string;
  status: string;
  progress?: number;
  total_counts?: number;
  counted?: number;
}

const STATUS: Record<string, { label: string; tone: 'navy' | 'info' | 'warn' | 'red' | 'ok' | 'neutral' }> = {
  OPEN: { label: 'Đang mở', tone: 'info' },
  COUNTING: { label: 'Đang đếm', tone: 'warn' },
  RECONCILING: { label: 'Đối chiếu', tone: 'red' },
  CLOSED: { label: 'Đã xong', tone: 'ok' },
};

const FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'OPEN', label: 'Đang mở' },
  { key: 'COUNTING', label: 'Đang đếm' },
  { key: 'RECONCILING', label: 'Đối chiếu' },
  { key: 'CLOSED', label: 'Đã xong' },
];

export default function StocktakeListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(20);

  const q = useQuery<Session[]>({
    queryKey: ['stock-count', 'list', filter],
    queryFn: () => api.get(`/stock-count${filter ? `?status=${filter}` : ''}`),
  });
  const all = q.data ?? [];
  const shown = all.slice(0, limit);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenTitle title="Nhiệm vụ kiểm kê" icon="clipboard-outline" />

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, active && styles.chipActive]}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={shown}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['stock-count'] })}
            tintColor={colors.navy}
          />
        }
        ListFooterComponent={
          all.length > limit ? (
            <Pressable style={styles.moreBtn} onPress={() => setLimit((l) => l + 20)}>
              <Text style={styles.moreText}>Xem thêm ({all.length - limit})</Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.navy} />
            </View>
          ) : (
            <EmptyState title="Chưa có phiên nào" hint="Phiên kiểm kê được giao sẽ hiển thị ở đây." />
          )
        }
        renderItem={({ item }) => {
          const st = STATUS[item.status] ?? { label: item.status, tone: 'neutral' as const };
          const progress = Math.min(100, item.progress ?? 0);
          return (
            <Pressable
              onPress={() => router.push(`/(tabs)/stocktake/${item.id}`)}
              style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            >
              <Card style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Mono style={styles.code}>{item.code ?? `STK-${String(item.id).slice(0, 8)}`}</Mono>
                    <Text style={styles.sub}>{item.type === 'BY_LOCATION' ? 'Theo vị trí' : 'Theo mã hàng'}</Text>
                  </View>
                  <StatusBadge label={st.label} tone={st.tone} />
                </View>
                {item.total_counts ? (
                  <View style={styles.progressRow}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={progress} tone="navy" />
                    </View>
                    <Text style={styles.progressText}>
                      {item.counted ?? 0}/{item.total_counts} ({progress}%)
                    </Text>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  filterWrap: { borderBottomWidth: 1, borderBottomColor: colors.line },
  filterRow: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.sm },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.bgSoft },
  chipActive: { backgroundColor: colors.navy },
  chipText: { fontSize: 13, color: colors.inkSoft, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  list: { padding: spacing.lg, gap: spacing.sm },
  center: { paddingVertical: 48, alignItems: 'center' },

  card: { gap: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  code: { fontSize: 15, fontWeight: '700', color: colors.navy },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 10 },
  progressText: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  moreBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  moreText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
});

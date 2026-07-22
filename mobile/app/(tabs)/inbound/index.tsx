import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { Badge } from '../../../src/components/Badge';
import { Empty } from '../../../src/components/Empty';
import { colors, spacing } from '../../../src/theme/colors';

type PhnStatus =
  | 'NEW' | 'PENDING_KEEPER' | 'PREPARING' | 'COUNTING' | 'PALLET_WAITING'
  | 'PUTAWAY' | 'PENDING_FINALIZE' | 'CLOSED' | 'CANCELLED';

interface Phn {
  id: number;
  code: string;
  status: PhnStatus;
  expectedDate: string;
  supplier: { code: string; name: string } | null;
  _count: { lines: number; pallets: number };
}

interface ListResp {
  data: Phn[];
  meta: { total: number };
}

const STATUS_LABEL: Record<PhnStatus, string> = {
  NEW: 'Mới',
  PENDING_KEEPER: 'Chờ TK',
  PREPARING: 'Chuẩn bị',
  COUNTING: 'Kiểm đếm',
  PALLET_WAITING: 'Pallet chờ',
  PUTAWAY: 'Đã xếp',
  PENDING_FINALIZE: 'Chờ chốt',
  CLOSED: 'Đã chốt',
  CANCELLED: 'Đã huỷ',
};

const FILTERS: Array<{ key: string; label: string; status?: PhnStatus }> = [
  { key: 'pending', label: 'Chờ tiếp nhận', status: 'NEW' },
  { key: 'preparing', label: 'Chuẩn bị', status: 'PREPARING' },
  { key: 'counting', label: 'Đang đếm', status: 'COUNTING' },
  { key: 'all', label: 'Tất cả' },
];

export default function InboundListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('pending');

  const status = FILTERS.find((f) => f.key === filter)?.status;

  const q = useQuery<ListResp>({
    queryKey: ['mobile-inbound-list', filter],
    queryFn: () =>
      api.get(`/inbound/requests?page=1&pageSize=50${status ? `&status=${status}` : ''}`),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Phiếu yêu cầu nhập</Text>
        <Pressable
          onPress={() => router.push('/(tabs)/inbound/new-temp')}
          style={({ pressed }) => [
            styles.tempBtn,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.tempBtnText}>⚡ Đột xuất</Text>
        </Pressable>
      </View>

      <View style={styles.chips}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.chip, filter === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={q.data?.data ?? []}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['mobile-inbound-list'] })}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isLoading ? (
            <Text style={styles.muted}>Đang tải…</Text>
          ) : (
            <Empty icon="📭" title="Không có phiếu" />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/inbound/${item.id}`)}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.code}>{item.code}</Text>
              <Badge label={STATUS_LABEL[item.status]} variant="accent" />
            </View>
            <Text style={styles.sub}>
              {item.supplier?.name ?? 'Không có NCC'} · {item._count.lines} mã ·{' '}
              {item._count.pallets} pallet
            </Text>
            <Text style={styles.meta}>
              📅 Dự kiến {new Date(item.expectedDate).toLocaleDateString('vi-VN')}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink },
  tempBtn: {
    backgroundColor: colors.warn,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  tempBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  chips: { flexDirection: 'row', gap: 6, padding: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: colors.bgSoft,
  },
  chipActive: { backgroundColor: colors.ink },
  chipText: { fontSize: 12, color: colors.inkSoft, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkSoft, marginTop: 4, fontSize: 13 },
  meta: { color: colors.muted, marginTop: 4, fontSize: 12 },
  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.lg },
});

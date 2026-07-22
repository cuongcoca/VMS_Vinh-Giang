import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { Badge } from '../../../src/components/Badge';
import { Empty } from '../../../src/components/Empty';
import { colors, spacing } from '../../../src/theme/colors';

type PalletStatus =
  | 'EMPTY' | 'COUNTING' | 'CONFIRMED' | 'IN_STORAGE' | 'IN_STAGING' | 'RELEASED' | 'CANCELLED';

interface Pallet {
  id: number;
  code: string;
  status: PalletStatus;
  totalLines: number;
  totalWeightKg: number;
  inboundRequestId: number | null;
  location: { code: string } | null;
  createdAt: string;
  stagedAt?: string | null;
}

interface ListResp {
  data: Pallet[];
  meta: { total: number };
}

const STATUS_LABEL: Record<PalletStatus, string> = {
  EMPTY: 'Chưa kích hoạt',
  COUNTING: 'Đang kiểm đếm',
  CONFIRMED: 'Đã xác nhận',
  IN_STORAGE: 'Đã vào vị trí',
  IN_STAGING: 'Khu chờ xuất',
  RELEASED: 'Đã rời kho',
  CANCELLED: 'Đã huỷ',
};
const STATUS_VARIANT: Record<PalletStatus, 'default' | 'warn' | 'accent' | 'ok' | 'danger'> = {
  EMPTY: 'default',
  COUNTING: 'warn',
  CONFIRMED: 'accent',
  IN_STORAGE: 'ok',
  IN_STAGING: 'accent',
  RELEASED: 'default',
  CANCELLED: 'danger',
};

const FILTERS: Array<{ key: string; label: string; status?: PalletStatus }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'COUNTING', label: 'Đang đếm', status: 'COUNTING' },
  { key: 'CONFIRMED', label: 'Đã XN', status: 'CONFIRMED' },
  { key: 'IN_STORAGE', label: 'Vị trí', status: 'IN_STORAGE' },
  { key: 'IN_STAGING', label: 'Chờ xuất', status: 'IN_STAGING' },
];

function formatWaitTime(stagedAtStr: string | null | undefined, createdAtStr: string) {
  const timeStr = stagedAtStr || createdAtStr;
  const date = new Date(timeStr);
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  if (diffMins < 60) return `Chờ: ${diffMins}p`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `Chờ: ${diffHours}h`;
  return `Chờ: ${Math.floor(diffHours / 24)}n`;
}

export default function PalletsListScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');

  const status = FILTERS.find((f) => f.key === filter)?.status;

  const q = useQuery<ListResp>({
    queryKey: ['mobile-pallets', filter],
    queryFn: () =>
      api.get(`/pallets?page=1&pageSize=50${status ? `&status=${status}` : ''}`),
  });

  const createMut = useMutation({
    mutationFn: () => api.post<{ id: number; code: string }>('/pallets', {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mobile-pallets'] });
      router.push(`/(tabs)/pallets/${res.id}`);
    },
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.title}>Pallet của tôi</Text>
        <Pressable
          onPress={() => createMut.mutate()}
          disabled={createMut.isPending}
          style={({ pressed }) => [
            styles.createBtn,
            { opacity: createMut.isPending ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={styles.createBtnText}>{createMut.isPending ? '...' : '+ Tạo'}</Text>
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
            onRefresh={() => qc.invalidateQueries({ queryKey: ['mobile-pallets'] })}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={{ padding: spacing.xl }}>
              <Text style={styles.muted}>Đang tải…</Text>
            </View>
          ) : (
            <Empty
              icon="📦"
              title="Chưa có pallet"
              hint="Bấm + Tạo để khởi tạo pallet mới"
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/(tabs)/pallets/${item.id}`)}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.code}>{item.code}</Text>
              <Badge label={STATUS_LABEL[item.status]} variant={STATUS_VARIANT[item.status]} />
            </View>
            <Text style={styles.sub}>
              {item.totalLines} dòng · {Number(item.totalWeightKg).toFixed(1)} kg
            </Text>
            <View style={styles.cardRowSecondary}>
              {item.inboundRequestId && (
                <Text style={styles.metaItem}>📥 PHN #{item.inboundRequestId}</Text>
              )}
              {item.location && <Text style={styles.metaItem}>📍 {item.location.code}</Text>}
              {item.status === 'IN_STAGING' ? (
                <Text style={[styles.metaItem, { color: colors.accent, fontWeight: '600', marginLeft: 'auto' }]}>
                  ⏱️ Vào: {new Date(item.stagedAt || item.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} ({formatWaitTime(item.stagedAt, item.createdAt)})
                </Text>
              ) : (
                <Text style={[styles.metaItem, { marginLeft: 'auto' }]}>
                  {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>
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
  createBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },

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

  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardRowSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: spacing.sm,
  },
  code: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: colors.ink },
  sub: { color: colors.inkSoft, marginTop: 4, fontSize: 13 },
  metaItem: { fontSize: 11, color: colors.muted },
  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center' },
});

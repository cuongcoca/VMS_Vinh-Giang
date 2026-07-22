import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { Badge } from '../../../src/components/Badge';
import { Empty } from '../../../src/components/Empty';
import { colors, spacing } from '../../../src/theme/colors';

type MovementType =
  | 'PUTAWAY'
  | 'RELOCATE'
  | 'PICK_FEFO'
  | 'PICK_DIRECT'
  | 'RETURN_TO_STORAGE'
  | 'ADJUST'
  | 'RECEIVE';

interface Movement {
  id: number;
  type: MovementType;
  palletId: number | null;
  productId: number | null;
  qtyUnit: number;
  fromLocation: { code: string } | null;
  toLocation: { code: string } | null;
  pallet: { code: string } | null;
  product: { sku: string; shortName: string } | null;
  performedBy: { fullName: string } | null;
  createdAt: string;
  mode: string | null;
}
interface ListResp {
  data: Movement[];
  meta: { total: number; page: number; pageSize: number };
}

const TYPE_LABEL: Record<MovementType, string> = {
  PUTAWAY: 'Xếp vị trí',
  RELOCATE: 'Di chuyển',
  PICK_FEFO: 'Lấy FEFO',
  PICK_DIRECT: 'Lấy trực tiếp',
  RETURN_TO_STORAGE: 'Trả về kho',
  ADJUST: 'Điều chỉnh',
  RECEIVE: 'Tiếp nhận',
};

const TYPE_VARIANT: Record<MovementType, 'default' | 'accent' | 'ok' | 'warn' | 'danger'> = {
  PUTAWAY: 'ok',
  RELOCATE: 'accent',
  PICK_FEFO: 'warn',
  PICK_DIRECT: 'warn',
  RETURN_TO_STORAGE: 'default',
  ADJUST: 'danger',
  RECEIVE: 'default',
};

const TYPE_ICON: Record<MovementType, string> = {
  PUTAWAY: '📍',
  RELOCATE: '↔️',
  PICK_FEFO: '🎯',
  PICK_DIRECT: '🎯',
  RETURN_TO_STORAGE: '↩️',
  ADJUST: '✏️',
  RECEIVE: '📥',
};

const FILTERS: Array<{ key: string; label: string; type?: MovementType }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'putaway', label: 'Xếp', type: 'PUTAWAY' },
  { key: 'pick', label: 'Lấy', type: 'PICK_FEFO' },
  { key: 'relocate', label: 'Di chuyển', type: 'RELOCATE' },
];

export default function MovementsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState('all');

  const type = FILTERS.find((f) => f.key === filter)?.type;

  const q = useQuery<ListResp>({
    queryKey: ['mobile-fk-movements', filter],
    queryFn: () =>
      api.get(
        `/forklift/movements?page=1&pageSize=50${type ? `&type=${type}` : ''}`,
      ),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>📋 Lịch sử di chuyển</Text>
        <View style={{ width: 40 }} />
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
        keyExtractor={(m) => String(m.id)}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['mobile-fk-movements'] })}
            tintColor={colors.roleForklift}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isLoading ? (
            <Text style={styles.muted}>Đang tải…</Text>
          ) : (
            <Empty icon="📭" title="Không có lịch sử" />
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <View style={styles.cardLeft}>
                <Text style={styles.icon}>{TYPE_ICON[item.type]}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.headerRow}>
                    <Badge
                      label={TYPE_LABEL[item.type]}
                      variant={TYPE_VARIANT[item.type]}
                    />
                    {item.mode && <Text style={styles.mode}>{item.mode}</Text>}
                  </View>
                  {item.pallet && <Text style={styles.code}>{item.pallet.code}</Text>}
                  {item.product && (
                    <Text style={styles.product}>
                      {item.product.sku} · {item.product.shortName}
                    </Text>
                  )}
                  <View style={styles.fromTo}>
                    {item.fromLocation && (
                      <Text style={styles.meta}>📍 {item.fromLocation.code}</Text>
                    )}
                    {item.fromLocation && item.toLocation && (
                      <Text style={styles.arrow}>→</Text>
                    )}
                    {item.toLocation && (
                      <Text style={styles.meta}>📍 {item.toLocation.code}</Text>
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.cardRight}>
                {Number(item.qtyUnit) > 0 && (
                  <Text style={styles.qty}>{Number(item.qtyUnit).toFixed(1)}</Text>
                )}
                <Text style={styles.time}>
                  {new Date(item.createdAt).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                {item.performedBy && (
                  <Text style={styles.by}>{item.performedBy.fullName}</Text>
                )}
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.roleForklift,
  },
  topbarTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center', color: '#fff' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: '#fff' },

  chips: { flexDirection: 'row', gap: 6, padding: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: colors.bgSoft,
  },
  chipActive: { backgroundColor: colors.roleForklift },
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
  cardRow: { flexDirection: 'row' },
  cardLeft: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  cardRight: { alignItems: 'flex-end', minWidth: 70 },

  icon: { fontSize: 22 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mode: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  code: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: colors.ink, marginTop: 4 },
  product: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  fromTo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: colors.muted },
  arrow: { fontSize: 11, color: colors.muted },

  qty: { fontSize: 16, fontWeight: '700', color: colors.roleForklift },
  time: { fontSize: 11, color: colors.muted },
  by: { fontSize: 10, color: colors.muted, marginTop: 2, fontStyle: 'italic' },

  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.lg },
});

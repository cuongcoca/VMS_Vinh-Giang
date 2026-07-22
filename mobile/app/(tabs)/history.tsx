import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api/client';
import { colors, spacing, radius } from '../../src/theme/colors';

type Tab = 'pallet' | 'movement';

interface Pallet {
  id: string;
  code?: string;
  status?: string;
  supplier?: { name?: string } | null;
}
interface HistoryEvent {
  id: string;
  kind?: string;
  action?: string;
  label?: string;
  reason?: string | null;
  performed_by_name?: string | null;
  performed_by_role?: string | null;
  performed_at?: string;
  from_location?: { code?: string } | null;
  to_location?: { code?: string } | null;
}
interface Movement {
  id: string;
  movement_type?: string;
  performed_at?: string;
  pallet?: { code?: string } | null;
  from_location?: { code?: string } | null;
  to_location?: { code?: string } | null;
  item_code?: { code?: string; short_name?: string } | null;
  performer?: { full_name?: string } | null;
}

const PALLET_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  EMPTY: { label: 'Đang thêm', bg: '#f1f5f9', fg: '#475569' },
  COUNTING: { label: 'Đang đếm', bg: '#dbeafe', fg: '#1d4ed8' },
  CONFIRMED: { label: 'Đã xác nhận', bg: '#ecfdf5', fg: '#047857' },
  IN_STORAGE: { label: 'Trong kho', bg: '#eef2ff', fg: '#4338ca' },
  IN_STAGING: { label: 'Chờ xuất', bg: '#fffbeb', fg: '#b45309' },
  RELEASED: { label: 'Đã xuất', bg: '#f3e8ff', fg: '#6d28d9' },
  CANCELLED: { label: 'Đã hủy', bg: '#fef2f2', fg: '#b91c1c' },
};
const MOVEMENT_LABEL: Record<string, string> = {
  PUT_AWAY: 'Xếp kho',
  RELOCATE: 'Chuyển vị trí',
  STAGE_OUT: 'Sang khu chờ xuất',
  RETURN: 'Hoàn trả',
  ADJUSTMENT: 'Điều chỉnh',
  OUTBOUND: 'Xuất kho',
};

const fmt = (s?: string) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>('pallet');
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [selected, setSelected] = useState<Pallet | null>(null);
  const [limit, setLimit] = useState(20);

  const palletsQ = useQuery<Pallet[]>({
    queryKey: ['pallets', submitted],
    queryFn: () => api.get(`/pallets?q=${encodeURIComponent(submitted)}`),
    enabled: tab === 'pallet' && submitted.length > 0,
  });

  const historyQ = useQuery<HistoryEvent[]>({
    queryKey: ['pallet-history', selected?.id],
    queryFn: () => api.get(`/pallets/${selected!.id}/history`),
    enabled: !!selected?.id,
  });

  const movementsQ = useQuery<Movement[]>({
    queryKey: ['movements', submitted],
    queryFn: () => api.get(`/movements${submitted ? `?q=${encodeURIComponent(submitted)}` : ''}`),
    enabled: tab === 'movement',
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Ionicons name="time" size={22} color={colors.navy} />
        <Text style={styles.title}>Tra cứu</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['pallet', 'movement'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              setTab(t);
              setSelected(null);
            }}
            style={[styles.tab, tab === t && styles.tabActive]}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pallet' ? 'Lịch sử pallet' : 'Luân chuyển'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search */}
      {!selected && (
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.outline} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => setSubmitted(query.trim())}
            placeholder={tab === 'pallet' ? 'Tìm mã pallet…' : 'Tìm mã pallet, mã hàng…'}
            placeholderTextColor={colors.outline}
            returnKeyType="search"
            autoCapitalize="characters"
          />
          <Pressable onPress={() => setSubmitted(query.trim())} hitSlop={8}>
            <Text style={styles.searchGo}>Tìm</Text>
          </Pressable>
        </View>
      )}

      {/* Pallet detail */}
      {selected ? (
        <View style={{ flex: 1 }}>
          <Pressable style={styles.backRow} onPress={() => setSelected(null)}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
            <Text style={styles.backText}>Quay lại</Text>
          </Pressable>
          <View style={styles.detailHead}>
            <Text style={styles.code}>{selected.code}</Text>
            <Text style={styles.sub}>{selected.supplier?.name ?? ''}</Text>
          </View>
          <FlatList
            data={historyQ.data ?? []}
            keyExtractor={(e) => e.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              historyQ.isLoading ? (
                <ActivityIndicator color={colors.navy} style={{ marginTop: 24 }} />
              ) : (
                <Text style={styles.muted}>Không có lịch sử</Text>
              )
            }
            renderItem={({ item }) => (
              <View style={styles.eventCard}>
                <View style={styles.eventDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.eventLabel}>{item.label ?? item.action}</Text>
                  <Text style={styles.sub}>{fmt(item.performed_at)}</Text>
                  {item.from_location?.code && item.to_location?.code && (
                    <Text style={styles.sub}>
                      {item.from_location.code} → {item.to_location.code}
                    </Text>
                  )}
                  {item.reason && <Text style={styles.sub}>📝 {item.reason}</Text>}
                  {item.performed_by_name && (
                    <Text style={styles.sub}>
                      👤 {item.performed_by_name} {item.performed_by_role ? `· ${item.performed_by_role}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            )}
          />
        </View>
      ) : tab === 'pallet' ? (
        <FlatList
          data={(palletsQ.data ?? []).slice(0, limit)}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            (palletsQ.data ?? []).length > limit ? (
              <Pressable style={styles.moreBtn} onPress={() => setLimit((l) => l + 20)}>
                <Text style={styles.moreText}>Xem thêm</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            palletsQ.isFetching ? (
              <ActivityIndicator color={colors.navy} style={{ marginTop: 24 }} />
            ) : (
              <Text style={styles.muted}>
                {submitted ? 'Không tìm thấy pallet' : 'Nhập mã pallet để tìm'}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const st = PALLET_STATUS[item.status ?? ''] ?? { label: item.status ?? '', bg: colors.bgSoft, fg: colors.inkSoft };
            return (
              <Pressable style={styles.card} onPress={() => setSelected(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.code}>{item.code}</Text>
                  <Text style={styles.sub}>{item.supplier?.name ?? ''}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: st.bg }]}>
                  <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={(movementsQ.data ?? []).slice(0, limit)}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            (movementsQ.data ?? []).length > limit ? (
              <Pressable style={styles.moreBtn} onPress={() => setLimit((l) => l + 20)}>
                <Text style={styles.moreText}>Xem thêm</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            movementsQ.isFetching ? (
              <ActivityIndicator color={colors.navy} style={{ marginTop: 24 }} />
            ) : (
              <Text style={styles.muted}>Không có lịch sử</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.eventCard}>
              <View style={styles.eventDot} />
              <View style={{ flex: 1 }}>
                <View style={styles.rowBetween}>
                  <Text style={styles.code}>{item.pallet?.code ?? '—'}</Text>
                  <View style={[styles.badge, { backgroundColor: colors.navySoft }]}>
                    <Text style={[styles.badgeText, { color: colors.navy }]}>
                      {MOVEMENT_LABEL[item.movement_type ?? ''] ?? item.movement_type}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sub}>{fmt(item.performed_at)}</Text>
                {(item.from_location?.code || item.to_location?.code) && (
                  <Text style={styles.sub}>
                    {item.from_location?.code ?? '—'} → {item.to_location?.code ?? '—'}
                  </Text>
                )}
                {item.item_code?.code && (
                  <Text style={styles.sub}>
                    {item.item_code.code} · {item.item_code.short_name}
                  </Text>
                )}
                {item.performer?.full_name && <Text style={styles.sub}>👤 {item.performer.full_name}</Text>}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: 18, fontWeight: '700', color: colors.primary },

  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  tab: { paddingBottom: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.navy },
  tabText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  tabTextActive: { color: colors.navy },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.ink },
  searchGo: { color: colors.navy, fontWeight: '700', fontSize: 14 },

  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.xl },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 15, fontWeight: '700', color: colors.primary },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  backRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  backText: { fontSize: 14, fontWeight: '600', color: colors.primary },
  detailHead: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },

  eventCard: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.panel, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: spacing.md },
  eventDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.navy, marginTop: 6 },
  eventLabel: { fontSize: 14, fontWeight: '700', color: colors.ink },
  moreBtn: { marginTop: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  moreText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
});

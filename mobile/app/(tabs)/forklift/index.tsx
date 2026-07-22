import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { Empty } from '../../../src/components/Empty';
import { Input } from '../../../src/components/Input';
import { colors, spacing } from '../../../src/theme/colors';

interface PendingPallet {
  id: number;
  code: string;
  status: string;
  totalLines: number;
  totalWeightKg: number;
  inboundRequest: { code: string } | null;
  confirmedAt: string | null;
  lines: Array<{
    id: number;
    qtyBox: number;
    qtyUnit: number;
    product: { sku: string; shortName: string } | null;
  }>;
}

export default function ForkliftHomeScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery<PendingPallet[]>({
    queryKey: ['mobile-fk-pending'],
    queryFn: () => api.get('/forklift/pallets-pending'),
  });

  const [target, setTarget] = useState<PendingPallet | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Text style={styles.topbarTitle}>🚜 Xe nâng</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={() => router.push('/(tabs)/forklift/pick')}
          style={styles.actionBtn}
        >
          <Text style={styles.actionIcon}>🎯</Text>
          <Text style={styles.actionLabel}>Lấy hàng (FEFO)</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/forklift/movements')}
          style={styles.actionBtn}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>Lịch sử</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        PALLET CHỜ XẾP VỊ TRÍ ({q.data?.length ?? 0})
      </Text>

      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => String(p.id)}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['mobile-fk-pending'] })}
            tintColor={colors.roleForklift}
          />
        }
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          q.isLoading ? (
            <Text style={styles.muted}>Đang tải…</Text>
          ) : (
            <Empty icon="✨" title="Sạch" hint="Không có pallet nào đang chờ xếp vị trí" />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setTarget(item)}
            style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
          >
            <View style={styles.cardRow}>
              <Text style={styles.code}>{item.code}</Text>
              <Badge label="CONFIRMED" variant="accent" />
            </View>
            <Text style={styles.sub}>
              {item.totalLines} dòng · {Number(item.totalWeightKg).toFixed(1)} kg
            </Text>
            {item.inboundRequest && (
              <Text style={styles.meta}>📥 {item.inboundRequest.code}</Text>
            )}
            {item.lines.slice(0, 2).map((l) => (
              <Text key={l.id} style={styles.lineHint}>
                · {l.product?.sku ?? '—'} {l.product?.shortName ?? ''} ({l.qtyBox} thùng)
              </Text>
            ))}
            {item.lines.length > 2 && (
              <Text style={styles.lineHintMore}>+{item.lines.length - 2} dòng khác</Text>
            )}
            <View style={styles.cardCta}>
              <Text style={styles.cardCtaText}>Bấm để xếp vị trí →</Text>
            </View>
          </Pressable>
        )}
      />

      {target && (
        <PutawayModal
          pallet={target}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            qc.invalidateQueries({ queryKey: ['mobile-fk-pending'] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

function PutawayModal({
  pallet,
  onClose,
  onDone,
}: {
  pallet: PendingPallet;
  onClose: () => void;
  onDone: () => void;
}) {
  const [locCode, setLocCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      api.post('/forklift/putaway', {
        palletId: pallet.id,
        toLocationCode: locCode.toUpperCase().trim(),
      }),
    onSuccess: () => {
      Alert.alert('Đã xếp pallet', `${pallet.code} → ${locCode.toUpperCase().trim()}`, [
        { text: 'OK', onPress: onDone },
      ]);
    },
    onError: (err: { detail?: string }) =>
      setError(err.detail ?? 'Không thể putaway'),
  });

  const looksValid = /^[A-Z]{1,3}-\d{1,2}-\d{1,2}$/.test(locCode.toUpperCase().trim());

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Xếp vị trí pallet</Text>
          <Text style={styles.modalSub}>{pallet.code}</Text>

          <View style={styles.modalMetaRow}>
            <Text style={styles.modalMetaItem}>
              {pallet.totalLines} dòng · {Number(pallet.totalWeightKg).toFixed(1)} kg
            </Text>
          </View>

          <Input
            label="Vị trí đích"
            value={locCode}
            onChangeText={(v) => {
              setLocCode(v.toUpperCase());
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            placeholder="vd: A-03-02"
          />
          <Text style={styles.hint}>
            Định dạng: Khu-Kệ-Tầng (A–C), vị trí loại STORAGE
          </Text>

          {error && <Text style={styles.errorText}>⚠ {error}</Text>}

          <View style={styles.modalBtnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Huỷ" variant="ghost" onPress={onClose} full />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                title="✓ Xếp vào vị trí"
                onPress={() => mut.mutate()}
                disabled={!looksValid}
                loading={mut.isPending}
                full
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.roleForklift,
  },
  topbarTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },

  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.panel,
    padding: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  actionIcon: { fontSize: 28, marginBottom: 4 },
  actionLabel: { fontSize: 13, fontWeight: '600', color: colors.ink },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

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
  lineHint: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  lineHintMore: { color: colors.muted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },

  cardCta: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  cardCtaText: { color: colors.roleForklift, fontWeight: '600', fontSize: 13 },

  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.lg },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalSub: { fontSize: 14, color: colors.inkSoft, fontFamily: 'monospace' },
  modalMetaRow: { flexDirection: 'row', marginTop: 4 },
  modalMetaItem: { fontSize: 12, color: colors.muted },
  hint: { fontSize: 11, color: colors.muted, fontStyle: 'italic' },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4 },

  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

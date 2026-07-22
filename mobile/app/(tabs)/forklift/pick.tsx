import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../../src/api/client';
import { Badge } from '../../../src/components/Badge';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Empty } from '../../../src/components/Empty';
import { Input } from '../../../src/components/Input';
import { colors, spacing } from '../../../src/theme/colors';

interface Product {
  id: number;
  sku: string;
  shortName: string;
  unit: { name: string };
}
interface ProductList { data: Product[]; }

interface Location {
  id: number;
  code: string;
  type: string;
}
interface LocationList { data: Location[]; }

interface FefoSuggestion {
  palletId: number;
  palletCode: string;
  locationId: number | null;
  locationCode: string;
  lineId: number;
  lot: string | null;
  expiryDate: string | null;
  qtyUnitAvailable: number;
  weightKg: number;
  warningLevel: 'CRITICAL' | 'WARN' | 'NONE';
  daysToExpiry: number | null;
  priority: number;
}

export default function FefoPickScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [staging, setStaging] = useState<Location | null>(null);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showStagingPicker, setShowStagingPicker] = useState(false);
  const [target, setTarget] = useState<FefoSuggestion | null>(null);

  const fefoQ = useQuery<FefoSuggestion[]>({
    queryKey: ['mobile-fk-fefo', product?.id],
    queryFn: () => api.get(`/forklift/fefo-suggestions?productId=${product!.id}`),
    enabled: !!product,
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>🎯 Lấy hàng (FEFO)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <Text style={styles.label}>1. Chọn sản phẩm cần lấy</Text>
        <Pressable onPress={() => setShowProductPicker(true)} style={styles.selectorBtn}>
          {product ? (
            <View>
              <Text style={styles.selectorSku}>{product.sku}</Text>
              <Text style={styles.selectorName}>{product.shortName}</Text>
            </View>
          ) : (
            <Text style={styles.selectorPlaceholder}>Chạm để chọn sản phẩm…</Text>
          )}
        </Pressable>

        <Text style={[styles.label, { marginTop: spacing.md }]}>2. Khu vực xuất</Text>
        <Pressable onPress={() => setShowStagingPicker(true)} style={styles.selectorBtn}>
          {staging ? (
            <View>
              <Text style={styles.selectorSku}>{staging.code}</Text>
              <Text style={styles.selectorName}>Khu chờ xuất</Text>
            </View>
          ) : (
            <Text style={styles.selectorPlaceholder}>Chạm để chọn khu chờ xuất…</Text>
          )}
        </Pressable>

        {product && (
          <>
            <Text style={[styles.label, { marginTop: spacing.lg }]}>
              3. GỢI Ý FEFO ({fefoQ.data?.length ?? 0} pallet)
            </Text>
            {fefoQ.isLoading && <Text style={styles.muted}>Đang tính FEFO…</Text>}
            {fefoQ.data && fefoQ.data.length === 0 && (
              <Empty
                icon="🚫"
                title="Không còn hàng"
                hint={`Không còn pallet IN_STORAGE chứa ${product.sku}`}
              />
            )}
            {fefoQ.data?.map((s) => {
              const cardStyle =
                s.warningLevel === 'CRITICAL'
                  ? styles.cardCritical
                  : s.warningLevel === 'WARN'
                    ? styles.cardWarn
                    : null;
              return (
                <Pressable
                  key={s.lineId}
                  onPress={() => {
                    if (!staging) {
                      Alert.alert('Thiếu khu xuất', 'Vui lòng chọn khu chờ xuất trước.');
                      return;
                    }
                    setTarget(s);
                  }}
                  style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
                >
                  <Card style={cardStyle}>
                    <View style={styles.suggestHead}>
                      <View style={styles.priorityBadge}>
                        <Text style={styles.priorityText}>#{s.priority}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.code}>{s.palletCode}</Text>
                        <Text style={styles.metaInline}>📍 {s.locationCode}</Text>
                      </View>
                      {s.warningLevel === 'CRITICAL' && (
                        <Badge label="HSD ≤7" variant="danger" />
                      )}
                      {s.warningLevel === 'WARN' && (
                        <Badge label="HSD ≤30" variant="warn" />
                      )}
                    </View>

                    <View style={styles.suggestMeta}>
                      {s.lot && <Text style={styles.metaItem}>Lô {s.lot}</Text>}
                      {s.expiryDate && (
                        <Text style={styles.metaItem}>
                          HSD {s.expiryDate}
                          {s.daysToExpiry !== null && ` (còn ${s.daysToExpiry}n)`}
                        </Text>
                      )}
                      {!s.expiryDate && <Text style={styles.metaItem}>Không HSD</Text>}
                    </View>

                    <View style={styles.suggestQty}>
                      <Text style={styles.qtyValue}>{s.qtyUnitAvailable.toFixed(1)}</Text>
                      <Text style={styles.qtyUnit}>{product.unit.name} sẵn</Text>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>

      {showProductPicker && (
        <ProductPickerModal
          onClose={() => setShowProductPicker(false)}
          onPick={(p) => {
            setProduct(p);
            setShowProductPicker(false);
          }}
        />
      )}

      {showStagingPicker && (
        <StagingPickerModal
          onClose={() => setShowStagingPicker(false)}
          onPick={(loc) => {
            setStaging(loc);
            setShowStagingPicker(false);
          }}
        />
      )}

      {target && staging && product && (
        <PickModal
          suggestion={target}
          product={product}
          staging={staging}
          onClose={() => setTarget(null)}
          onDone={() => {
            setTarget(null);
            qc.invalidateQueries({ queryKey: ['mobile-fk-fefo'] });
            qc.invalidateQueries({ queryKey: ['mobile-fk-movements'] });
          }}
        />
      )}
    </SafeAreaView>
  );
}

function ProductPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (p: Product) => void;
}) {
  const [search, setSearch] = useState('');
  const q = useQuery<ProductList>({
    queryKey: ['mobile-product-pick-fefo', search],
    queryFn: () =>
      api.get(
        `/master-data/products?page=1&pageSize=20${
          search ? `&q=${encodeURIComponent(search)}` : ''
        }`,
      ),
  });
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backText}>✕</Text>
          </Pressable>
          <Text style={styles.topbarTitle}>Chọn sản phẩm</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: spacing.lg, flex: 1 }}>
          <Input
            label="Tìm"
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="SKU / tên"
          />
          <FlatList
            data={q.data?.data ?? []}
            keyExtractor={(p) => String(p.id)}
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item)} style={styles.pickItem}>
                <Text style={styles.code}>{item.sku}</Text>
                <Text style={styles.selectorName}>{item.shortName}</Text>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function StagingPickerModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (loc: Location) => void;
}) {
  const q = useQuery<LocationList>({
    queryKey: ['mobile-staging-pick'],
    queryFn: () =>
      api.get('/master-data/locations?page=1&pageSize=50&type=OUTBOUND_STAGING'),
  });
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topbar}>
          <Pressable onPress={onClose} style={styles.backBtn}>
            <Text style={styles.backText}>✕</Text>
          </Pressable>
          <Text style={styles.topbarTitle}>Chọn khu chờ xuất</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ padding: spacing.lg, flex: 1 }}>
          {q.isLoading && <Text style={styles.muted}>Đang tải…</Text>}
          <FlatList
            data={q.data?.data ?? []}
            keyExtractor={(l) => String(l.id)}
            ListEmptyComponent={
              !q.isLoading ? (
                <Empty
                  icon="📍"
                  title="Chưa có vị trí OUTBOUND_STAGING"
                  hint="Tạo trong Master Data (web)"
                />
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable onPress={() => onPick(item)} style={styles.pickItem}>
                <Text style={styles.code}>{item.code}</Text>
                <Text style={styles.selectorName}>Khu chờ xuất</Text>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function PickModal({
  suggestion,
  product,
  staging,
  onClose,
  onDone,
}: {
  suggestion: FefoSuggestion;
  product: Product;
  staging: Location;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [qtyText, setQtyText] = useState(String(suggestion.qtyUnitAvailable));
  const [error, setError] = useState<string | null>(null);

  const qty = Number(qtyText);
  const canSubmit =
    !Number.isNaN(qty) &&
    qty > 0 &&
    qty <= suggestion.qtyUnitAvailable &&
    suggestion.locationId !== null;

  const mut = useMutation({
    mutationFn: () =>
      api.post('/forklift/pick-fefo', {
        palletId: suggestion.palletId,
        fromLocationId: suggestion.locationId,
        toLocationId: staging.id,
        productId: product.id,
        qtyUnit: qty,
        mode,
      }),
    onSuccess: () => {
      Alert.alert(
        'Đã lấy hàng',
        `${suggestion.palletCode}: ${qty} ${product.unit.name} → ${staging.code}`,
        [{ text: 'OK', onPress: onDone }],
      );
    },
    onError: (err: { detail?: string }) =>
      setError(err.detail ?? 'Lấy hàng thất bại'),
  });

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Xác nhận lấy hàng</Text>
          <Text style={styles.modalSub}>{suggestion.palletCode}</Text>
          <Text style={styles.modalMetaItem}>
            📍 {suggestion.locationCode} → 🚪 {staging.code}
          </Text>
          <Text style={styles.modalMetaItem}>
            {product.sku} · {product.shortName}
          </Text>
          {suggestion.lot && (
            <Text style={styles.modalMetaItem}>Lô {suggestion.lot}</Text>
          )}
          {suggestion.expiryDate && (
            <Text style={styles.modalMetaItem}>HSD {suggestion.expiryDate}</Text>
          )}

          <Text style={[styles.label, { marginTop: spacing.md }]}>Kiểu lấy</Text>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => {
                setMode('FULL');
                setQtyText(String(suggestion.qtyUnitAvailable));
              }}
              style={[styles.seg, mode === 'FULL' && styles.segActive]}
            >
              <Text style={[styles.segText, mode === 'FULL' && styles.segTextActive]}>
                FULL (cả pallet)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('PARTIAL')}
              style={[styles.seg, mode === 'PARTIAL' && styles.segActive]}
            >
              <Text style={[styles.segText, mode === 'PARTIAL' && styles.segTextActive]}>
                PARTIAL (một phần)
              </Text>
            </Pressable>
          </View>

          <Input
            label={`Số lượng (${product.unit.name})`}
            value={qtyText}
            onChangeText={(v) => {
              setQtyText(v);
              setError(null);
            }}
            keyboardType="decimal-pad"
            editable={mode === 'PARTIAL'}
          />
          <Text style={styles.hint}>Tối đa: {suggestion.qtyUnitAvailable} {product.unit.name}</Text>

          {error && <Text style={styles.errorText}>⚠ {error}</Text>}

          <View style={styles.modalBtnRow}>
            <View style={{ flex: 1 }}>
              <Button title="Huỷ" variant="ghost" onPress={onClose} full />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                title="✓ Xác nhận lấy"
                onPress={() => mut.mutate()}
                disabled={!canSubmit}
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

  label: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: 4,
  },
  selectorBtn: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    padding: spacing.md,
    minHeight: 60,
    justifyContent: 'center',
  },
  selectorSku: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: colors.ink },
  selectorName: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  selectorPlaceholder: { fontSize: 14, color: colors.muted, fontStyle: 'italic' },

  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.md },

  cardCritical: { borderColor: colors.danger, borderWidth: 2 },
  cardWarn: { borderColor: colors.warn, borderWidth: 2 },

  suggestHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  priorityBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.roleForklift,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  code: { fontFamily: 'monospace', fontSize: 15, fontWeight: '700', color: colors.ink },
  metaInline: { fontSize: 12, color: colors.muted, marginTop: 2 },

  suggestMeta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' },
  metaItem: { fontSize: 12, color: colors.inkSoft },

  suggestQty: { marginTop: spacing.sm, alignItems: 'flex-end' },
  qtyValue: { fontSize: 22, fontWeight: '700', color: colors.roleForklift },
  qtyUnit: { fontSize: 11, color: colors.muted },

  pickItem: {
    backgroundColor: colors.panel,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },

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
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  modalSub: { fontSize: 14, color: colors.inkSoft, fontFamily: 'monospace', marginTop: 2 },
  modalMetaItem: { fontSize: 12, color: colors.muted, marginTop: 2 },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.sm,
  },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  segActive: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  segText: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  segTextActive: { color: colors.ink, fontWeight: '700' },

  hint: { fontSize: 11, color: colors.muted, fontStyle: 'italic' },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 4 },

  modalBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});

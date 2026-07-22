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
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { Input } from '../../../src/components/Input';
import { colors, spacing } from '../../../src/theme/colors';

interface Product {
  id: number;
  sku: string;
  shortName: string;
  qtyPerBox: number;
  unit: { name: string };
}
interface ProductList {
  data: Product[];
}

interface LineInput {
  productId: number;
  product: Product;
  qtyBox: number;
  lot: string;
  expiryDate: string;
}

export default function NewTempInboundScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [sourceType, setSourceType] = useState<'SUPPLIER' | 'RETURN' | 'OTHER'>('SUPPLIER');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<LineInput[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () =>
      api.post<{ id: number; code: string }>('/inbound-temps', {
        sourceType,
        deliveredBy: deliveredBy || null,
        reason,
        lines: lines.map((l) => ({
          productId: l.productId,
          qtyBox: l.qtyBox,
          lot: l.lot || null,
          expiryDate: l.expiryDate || null,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mobile-inbound-list'] });
      Alert.alert('Đã tạo PNT', '', [{ text: 'OK', onPress: () => router.back() }]);
    },
    onError: (err: { detail?: string }) => setError(err.detail ?? 'Lỗi'),
  });

  const canSubmit = reason.trim().length >= 3 && lines.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.topbarTitle}>⚡ Nhập đột xuất</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            <Text style={{ fontWeight: '700' }}>Nhập đột xuất:</Text> dùng khi hàng về chưa có phiếu yêu cầu.
            Kế toán sẽ chuẩn hoá sau.
          </Text>
        </View>

        <View>
          <Text style={styles.label}>Nguồn hàng *</Text>
          <View style={styles.segmented}>
            {(['SUPPLIER', 'RETURN', 'OTHER'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setSourceType(v)}
                style={[styles.seg, sourceType === v && styles.segActive]}
              >
                <Text style={[styles.segText, sourceType === v && styles.segTextActive]}>
                  {v === 'SUPPLIER' ? 'NCC' : v === 'RETURN' ? 'Hàng trả' : 'Khác'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Input
          label="Người giao"
          value={deliveredBy}
          onChangeText={setDeliveredBy}
          placeholder="vd: Anh Tâm — xe 29A12345"
        />
        <Input
          label="Lý do"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="vd: Hàng U về đột xuất, có phiếu giao tay"
          multiline
          numberOfLines={3}
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <Text style={[styles.label, { marginTop: spacing.md }]}>
          DÒNG HÀNG ({lines.length})
        </Text>
        {lines.map((l, i) => (
          <Card key={i}>
            <View style={styles.lineRowCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineSku}>{l.product.sku}</Text>
                <Text style={styles.lineName}>{l.product.shortName}</Text>
                {(l.lot || l.expiryDate) && (
                  <Text style={styles.lineMeta}>
                    {l.lot && `Lô ${l.lot}`}
                    {l.lot && l.expiryDate && ' · '}
                    {l.expiryDate && `HSD ${l.expiryDate}`}
                  </Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.lineQty}>{l.qtyBox}</Text>
                <Text style={styles.lineQtyUnit}>thùng</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setLines(lines.filter((_, j) => j !== i))}
              style={{ alignSelf: 'flex-end', marginTop: 4 }}
            >
              <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '600' }}>Xoá</Text>
            </Pressable>
          </Card>
        ))}

        <Button title="+ Thêm dòng" variant="ghost" onPress={() => setShowPicker(true)} full />

        {error && (
          <Text style={{ color: colors.danger, marginTop: spacing.sm }}>{error}</Text>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <Button
            title="Tạo PNT"
            onPress={() => createMut.mutate()}
            disabled={!canSubmit}
            loading={createMut.isPending}
            full
          />
        </View>
      </ScrollView>

      {showPicker && (
        <ProductPickerModal
          onClose={() => setShowPicker(false)}
          onPick={(p) => {
            setLines([...lines, { productId: p.id, product: p, qtyBox: 1, lot: '', expiryDate: '' }]);
            setShowPicker(false);
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
    queryKey: ['mobile-product-pick-temp', search],
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
                <Text style={styles.lineSku}>{item.sku}</Text>
                <Text style={styles.lineName}>
                  {item.shortName} · {item.qtyPerBox} {item.unit.name}/thùng
                </Text>
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>
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
    backgroundColor: colors.panel,
  },
  topbarTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center', color: colors.ink },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 24, color: colors.accent },

  notice: {
    backgroundColor: colors.warnSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.warn,
    padding: spacing.md,
    borderRadius: 6,
    marginBottom: spacing.lg,
  },
  noticeText: { fontSize: 13, color: colors.ink, lineHeight: 18 },

  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.bgSoft,
    borderRadius: 8,
    padding: 4,
    marginBottom: spacing.md,
  },
  seg: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 6 },
  segActive: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  segText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  segTextActive: { color: colors.ink, fontWeight: '700' },

  lineRowCard: { flexDirection: 'row', alignItems: 'flex-start' },
  lineSku: { fontFamily: 'monospace', fontWeight: '700', fontSize: 14, color: colors.ink },
  lineName: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  lineMeta: { fontSize: 11, color: colors.muted, marginTop: 4 },
  lineQty: { fontSize: 22, fontWeight: '700', color: colors.ink },
  lineQtyUnit: { fontSize: 10, color: colors.muted },

  pickItem: {
    backgroundColor: colors.panel,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.sm,
  },
});

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/api/client';
import { colors, spacing, radius, mono } from '../../../src/theme/colors';
import { DateField } from '../../../src/ui/kit';

interface Loc {
  code?: string;
  zone?: string;
  rack?: string;
  level?: string;
  type?: string;
}
interface ItemCode {
  code?: string;
  short_name?: string;
  full_name?: string;
}
interface PalletLine {
  id: string;
  qty_box?: number;
  lot?: string | null;
  expiry_date?: string | null;
  pallet?: { code?: string };
  item_code?: { code?: string; short_name?: string };
}
interface Count {
  id: string;
  location_id?: string | null;
  item_code_id?: string | null;
  system_qty?: string | number | null;
  actual_qty?: string | number | null;
  discrepancy?: string | number | null;
  lot_actual?: string | null;
  expiry_actual?: string | null;
  note?: string | null;
  is_outside_system?: boolean;
  found_pallet_code?: string | null;
  adjusted?: boolean;
  adjusted_voucher_code?: string | null;
  location?: Loc | null;
  item_code?: ItemCode | null;
  pallet_lines?: PalletLine[];
}
interface Session {
  id: string;
  code?: string;
  type?: string;
  status: string;
  counts?: Count[];
}

interface LocalEdit {
  actual_qty: string; // chuỗi trong input
  lot: string;
  expiry_date: string; // yyyy-mm-dd
  note: string;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Mở',
  COUNTING: 'Đang đếm',
  RECONCILING: 'Đang xử lý chênh',
  CLOSED: 'Đã đóng',
};

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Tách prefix "[Pallet: XXX]" khỏi note
function parseNote(raw?: string | null): { prefix: string; clean: string } {
  if (!raw) return { prefix: '', clean: '' };
  const m = raw.match(/^(\[Pallet:[^\]]*\])\s*(.*)$/s);
  if (m) return { prefix: m[1], clean: m[2] ?? '' };
  return { prefix: '', clean: raw };
}

export default function StocktakeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyDiff, setOnlyDiff] = useState(false);
  const [edits, setEdits] = useState<Record<string, LocalEdit>>({});

  const q = useQuery<Session>({
    queryKey: ['stock-count', id],
    queryFn: () => api.get(`/stock-count/${id}`),
    enabled: !!id,
  });

  const counts = useMemo(() => q.data?.counts ?? [], [q.data]);

  // Khởi tạo local edits khi data về
  useEffect(() => {
    if (!q.data?.counts) return;
    const init: Record<string, LocalEdit> = {};
    q.data.counts.forEach((c) => {
      const { clean } = parseNote(c.note);
      init[c.id] = {
        actual_qty: c.actual_qty !== null && c.actual_qty !== undefined ? String(num(c.actual_qty)) : '',
        lot: c.lot_actual ?? c.pallet_lines?.[0]?.lot ?? '',
        expiry_date: (c.expiry_actual ?? c.pallet_lines?.[0]?.expiry_date ?? '').slice(0, 10),
        note: clean,
      };
    });
    setEdits(init);
  }, [q.data]);

  const session = q.data;
  const isReadonly = session?.status === 'CLOSED' || session?.status === 'RECONCILING';

  const totalCounts = counts.length;
  const countedCount = counts.filter((c) => {
    const e = edits[c.id];
    return e ? e.actual_qty !== '' : c.actual_qty !== null && c.actual_qty !== undefined;
  }).length;
  const progress = totalCounts > 0 ? Math.round((countedCount / totalCounts) * 100) : 0;

  const isDiffLine = (c: Count) => {
    const e = edits[c.id];
    if (!e || e.actual_qty === '') return false;
    return num(e.actual_qty) - num(c.system_qty) !== 0;
  };
  const diffCount = counts.filter(isDiffLine).length;

  const visible = counts.filter((c) => {
    if (onlyDiff && !isDiffLine(c)) return false;
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      c.location?.code?.toLowerCase().includes(s) ||
      c.item_code?.code?.toLowerCase().includes(s) ||
      c.item_code?.short_name?.toLowerCase().includes(s)
    );
  });

  const setField = (cid: string, field: keyof LocalEdit, value: string) =>
    setEdits((prev) => ({ ...prev, [cid]: { ...prev[cid], [field]: value } }));

  // LƯU TẤT CẢ
  const saveMut = useMutation({
    mutationFn: async () => {
      const payload: {
        count_id: string;
        actual_qty: number | null;
        note: string | null;
        lot: string | null;
        expiry_date: string | null;
      }[] = [];
      counts.forEach((c) => {
        if (c.adjusted || c.is_outside_system) return;
        const e = edits[c.id];
        if (!e) return;
        const { prefix, clean } = parseNote(c.note);
        const origActual = c.actual_qty !== null && c.actual_qty !== undefined ? String(num(c.actual_qty)) : '';
        const origLot = c.lot_actual ?? c.pallet_lines?.[0]?.lot ?? '';
        const origExp = (c.expiry_actual ?? c.pallet_lines?.[0]?.expiry_date ?? '').slice(0, 10);
        const changed =
          e.actual_qty !== origActual || e.lot !== origLot || e.expiry_date !== origExp || e.note !== clean;
        if (!changed) return;
        const finalNote = e.note ? (prefix ? `${prefix} ${e.note}` : e.note) : prefix || null;
        payload.push({
          count_id: c.id,
          actual_qty: e.actual_qty === '' ? null : Math.max(0, num(e.actual_qty)),
          note: finalNote,
          lot: e.lot || null,
          expiry_date: e.expiry_date || null,
        });
      });
      if (payload.length === 0) return 0;
      await api.put(`/stock-count/${id}`, { counts: payload });
      return payload.length;
    },
    onSuccess: (n: number) => {
      qc.invalidateQueries({ queryKey: ['stock-count'] });
      Alert.alert('Đã lưu', n > 0 ? `Đã lưu ${n} dòng.` : 'Không có thay đổi để lưu.');
    },
    onError: (e: any) => Alert.alert('Lỗi', e?.detail ?? 'Không lưu được.'),
  });

  // HOÀN TẤT
  const completeMut = useMutation({
    mutationFn: () => api.post(`/stock-count/${id}/complete`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-count'] });
      Alert.alert('Hoàn tất', 'Đã hoàn tất kiểm kê.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (e: any) => Alert.alert('Chưa thể hoàn tất', e?.detail ?? 'Còn mục chưa đếm.'),
  });

  function confirmComplete() {
    Alert.alert('Hoàn tất kiểm kê', 'Bạn chắc chắn muốn hoàn tất phiên kiểm kê này?', [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Hoàn tất', onPress: () => completeMut.mutate() },
    ]);
  }

  // ĐẾM LẠI dòng lệch
  const recountMut = useMutation({
    mutationFn: () => {
      const lines = counts.filter(isDiffLine).map((c) => ({ count_id: c.id, note: '' }));
      return api.post(`/stock-count/${id}/recount`, { recounts: lines });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-count'] });
      Alert.alert('Đã yêu cầu', 'Các dòng lệch đã được đặt đếm lại.');
    },
    onError: (e: any) => Alert.alert('Lỗi', e?.detail ?? 'Không yêu cầu được.'),
  });
  function confirmRecount() {
    Alert.alert('Đếm lại', `Đặt đếm lại ${diffCount} dòng lệch?`, [
      { text: 'Huỷ', style: 'cancel' },
      { text: 'Đồng ý', onPress: () => recountMut.mutate() },
    ]);
  }

  // PALLET NGOÀI HỆ THỐNG tại vị trí đang đếm
  const [outsideLoc, setOutsideLoc] = useState<{ id: string; code: string } | null>(null);
  const [oCode, setOCode] = useState('');
  const [oItem, setOItem] = useState<{ id: string; code?: string; short_name?: string } | null>(null);
  const [oQty, setOQty] = useState('');
  const [oLot, setOLot] = useState('');
  const [oExp, setOExp] = useState('');
  const [oNote, setONote] = useState('');

  const oLookup = useMutation({
    mutationFn: (code: string) =>
      api.get<{ id: string; code?: string; short_name?: string }>(`/item-codes/by-code?code=${encodeURIComponent(code.trim())}`),
    onSuccess: (it) => setOItem(it),
    onError: () => Alert.alert('Không tìm thấy', 'Mã hàng không tồn tại.'),
  });

  const oSubmit = useMutation({
    mutationFn: () => {
      if (!oItem) throw Object.assign(new Error(''), { detail: 'Hãy tra mã hàng trước.' });
      if (num(oQty) <= 0) throw Object.assign(new Error(''), { detail: 'Số lượng phải lớn hơn 0.' });
      return api.post('/stock-count/quick-scan', {
        location_id: outsideLoc!.id,
        session_id: id,
        items: [],
        extra_pallets: [{ item_code_id: oItem.id, actual_qty: num(oQty), lot: oLot || undefined, expiry: oExp || undefined, note: oNote || undefined }],
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-count'] });
      closeOutside();
      Alert.alert('Đã thêm', 'Đã thêm pallet ngoài hệ thống.');
    },
    onError: (e: any) => Alert.alert('Lỗi', e?.detail ?? 'Không thêm được.'),
  });
  function closeOutside() {
    setOutsideLoc(null);
    setOCode('');
    setOItem(null);
    setOQty('');
    setOLot('');
    setOExp('');
    setONote('');
  }

  if (q.isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.navy} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <Header onBack={() => router.back()} />
        <View style={styles.center}>
          <Text style={styles.muted}>Không tải được phiên kiểm kê.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header onBack={() => router.back()} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header phiên */}
          <View style={styles.heroCard}>
            <Text style={styles.heroCode}>{session.code ?? `STK-${String(session.id).slice(0, 8)}`}</Text>
            <Text style={styles.heroType}>
              {session.type === 'BY_LOCATION' ? '📍 Kiểm kê theo vị trí' : '🏷️ Kiểm kê theo mã hàng'}
            </Text>
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>{STATUS_LABEL[session.status] ?? session.status}</Text>
            </View>
            <View style={styles.heroProgressRow}>
              <Text style={styles.heroProgressText}>
                Đã đếm {countedCount}/{totalCounts}
              </Text>
              <Text style={styles.heroProgressText}>{progress}%</Text>
            </View>
            <View style={styles.heroTrack}>
              <View style={[styles.heroFill, { width: `${progress}%` }]} />
            </View>
          </View>

          {/* Tìm kiếm */}
          {totalCounts > 0 && (
            <View style={styles.searchBox}>
              <Ionicons name="search" size={18} color={colors.outline} />
              <TextInput
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Tìm vị trí / mã hàng..."
                placeholderTextColor={colors.outline}
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.outline} />
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Đối chiếu chênh lệch */}
          {diffCount > 0 && (
            <View style={styles.diffBar}>
              <View style={styles.diffBarLeft}>
                <Ionicons name="alert-circle" size={18} color={colors.brandRed} />
                <Text style={styles.diffBarText}>
                  Chênh lệch: <Text style={{ fontWeight: '800', color: colors.brandRed }}>{diffCount}</Text> dòng
                </Text>
              </View>
              <Pressable
                onPress={() => setOnlyDiff((v) => !v)}
                style={[styles.diffToggle, onlyDiff && styles.diffToggleOn]}
              >
                <Text style={[styles.diffToggleText, onlyDiff && styles.diffToggleTextOn]}>
                  {onlyDiff ? 'Xem tất cả' : 'Chỉ xem lệch'}
                </Text>
              </Pressable>
            </View>
          )}

          {diffCount > 0 && (
            <Pressable style={styles.recountBtn} onPress={confirmRecount} disabled={recountMut.isPending}>
              <Ionicons name="refresh" size={16} color={colors.navy} />
              <Text style={styles.recountText}>Yêu cầu đếm lại {diffCount} dòng lệch</Text>
            </Pressable>
          )}

          <Text style={styles.sectionLabel}>
            {onlyDiff ? 'DÒNG LỆCH' : `DANH SÁCH ${session.type === 'BY_LOCATION' ? 'VỊ TRÍ' : 'MÃ HÀNG'}`} ({visible.length})
          </Text>

          {visible.map((c, idx) => {
            const e = edits[c.id];
            const system = num(c.system_qty);
            const hasActual = e ? e.actual_qty !== '' : false;
            const diff = hasActual ? num(e.actual_qty) - system : 0;
            const lineReadonly = isReadonly || c.adjusted;
            const isStaging = /STAGING|OUTBOUND|CHO_XUAT/i.test(c.location?.type ?? '');

            // Dòng ngoài hệ thống — chỉ đọc
            if (c.is_outside_system) {
              return (
                <View key={c.id} style={[styles.countCard, styles.outsideCard]}>
                  <View style={styles.countHead}>
                    <Text style={styles.stt}>#{idx + 1}</Text>
                    <Ionicons name="location" size={16} color={colors.amber} />
                    <Text style={styles.locCode}>{c.location?.code ?? '—'}</Text>
                    <View style={styles.outsideBadge}>
                      <Text style={styles.outsideBadgeText}>Ngoài hệ thống</Text>
                    </View>
                  </View>
                  <Text style={styles.itemLine}>
                    {c.item_code?.code} · {c.item_code?.short_name}
                  </Text>
                  <Text style={styles.sub}>
                    SL thực: {num(c.actual_qty)} · Pallet {c.found_pallet_code ?? '—'}
                  </Text>
                </View>
              );
            }

            return (
              <View key={c.id} style={styles.countCard}>
                <View style={styles.countHead}>
                  <Text style={styles.stt}>#{idx + 1}</Text>
                  <Ionicons name={isStaging ? 'warning-outline' : 'location-outline'} size={16} color={isStaging ? colors.warn : colors.navy} />
                  <Text style={styles.locCode}>{c.location?.code ?? '—'}</Text>
                  {isStaging && (
                    <View style={styles.stagingBadge}>
                      <Text style={styles.stagingText}>Khu chờ xuất</Text>
                    </View>
                  )}
                  {hasActual && (
                    <View style={[styles.diffBadge, diff === 0 ? styles.diffOk : styles.diffBad]}>
                      <Text style={[styles.diffText, diff === 0 ? styles.diffOkText : styles.diffBadText]}>
                        {diff === 0 ? '0' : diff > 0 ? `+${diff}` : `${diff}`}
                      </Text>
                    </View>
                  )}
                </View>
                {(c.location?.zone || c.item_code) && (
                  <Text style={styles.sub}>
                    {c.location?.zone ? `Khu ${c.location.zone} · Kệ ${c.location.rack} · Tầng ${c.location.level}` : ''}
                    {c.item_code ? `${c.location?.zone ? '  ·  ' : ''}${c.item_code.code} ${c.item_code.short_name ?? ''}` : ''}
                  </Text>
                )}

                {/* pallet_lines */}
                {c.pallet_lines && c.pallet_lines.length > 0 && (
                  <View style={styles.palletBox}>
                    {c.pallet_lines.map((pl) => (
                      <Text key={pl.id} style={styles.palletLine}>
                        • {pl.pallet?.code ?? ''} {pl.lot ? `· Lô ${pl.lot}` : ''} {pl.qty_box ? `· SL ${pl.qty_box}` : ''}
                      </Text>
                    ))}
                  </View>
                )}

                {c.adjusted ? (
                  <View style={styles.adjustedBox}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.ok} />
                    <Text style={styles.adjustedText}>
                      Đã chốt — kế toán chấp nhận {c.adjusted_voucher_code ? `(${c.adjusted_voucher_code})` : ''}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* HT thống + chênh lệch */}
                    <View style={styles.countTop}>
                      <Text style={styles.htLabel}>
                        HT thống: <Text style={styles.htVal}>{system}</Text>
                      </Text>
                      {hasActual && (
                        <View style={[styles.diffPill, { backgroundColor: diff === 0 ? colors.okSoft : colors.dangerSoft }]}>
                          <Text style={{ color: diff === 0 ? colors.ok : colors.danger, fontWeight: '800', fontSize: 13 }}>
                            Lệch {diff > 0 ? `+${diff}` : diff}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Bộ đếm − [số] + · Khớp HT */}
                    <View style={styles.stepRow}>
                      <Pressable
                        style={[styles.stepBtn, lineReadonly && styles.stepDisabled]}
                        onPress={() => !lineReadonly && setField(c.id, 'actual_qty', String(Math.max(0, num(e?.actual_qty || '0') - 1)))}
                        disabled={lineReadonly}
                      >
                        <Ionicons name="remove" size={26} color={colors.navy} />
                      </Pressable>
                      <TextInput
                        style={[styles.bigInput, lineReadonly && styles.inputDisabled]}
                        value={e?.actual_qty ?? ''}
                        onChangeText={(v) => setField(c.id, 'actual_qty', v.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.outline}
                        editable={!lineReadonly}
                        textAlign="center"
                      />
                      <Pressable
                        style={[styles.stepBtn, lineReadonly && styles.stepDisabled]}
                        onPress={() => !lineReadonly && setField(c.id, 'actual_qty', String(num(e?.actual_qty || '0') + 1))}
                        disabled={lineReadonly}
                      >
                        <Ionicons name="add" size={26} color={colors.navy} />
                      </Pressable>
                      <Pressable
                        style={[styles.matchBtn, lineReadonly && styles.stepDisabled]}
                        onPress={() => !lineReadonly && setField(c.id, 'actual_qty', String(system))}
                        disabled={lineReadonly}
                      >
                        <Text style={styles.matchText}>Khớp{'\n'}HT</Text>
                      </Pressable>
                    </View>

                    {/* Lô + HSD */}
                    <View style={styles.lotRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>Lô</Text>
                        <TextInput
                          style={[styles.textInput, lineReadonly && styles.inputDisabled]}
                          value={e?.lot ?? ''}
                          onChangeText={(v) => setField(c.id, 'lot', v)}
                          placeholder="Lô..."
                          placeholderTextColor={colors.outline}
                          editable={!lineReadonly}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabel}>HSD</Text>
                        <DateField
                          value={e?.expiry_date ?? ''}
                          onChange={(v) => setField(c.id, 'expiry_date', v)}
                          editable={!lineReadonly}
                        />
                      </View>
                    </View>

                    {/* Ghi chú */}
                    <Text style={styles.fieldLabel}>Ghi chú</Text>
                    <TextInput
                      style={[styles.textInput, lineReadonly && styles.inputDisabled]}
                      value={e?.note ?? ''}
                      onChangeText={(v) => setField(c.id, 'note', v)}
                      placeholder="Ghi chú..."
                      placeholderTextColor={colors.outline}
                      editable={!lineReadonly}
                    />
                    {!lineReadonly && c.location_id && (
                      <Pressable
                        style={styles.outsideAddBtn}
                        onPress={() => setOutsideLoc({ id: c.location_id as string, code: c.location?.code ?? '' })}
                      >
                        <Ionicons name="add-circle-outline" size={16} color={colors.brandRed} />
                        <Text style={styles.outsideAddText}>Thêm pallet ngoài HT tại vị trí này</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            );
          })}

          {visible.length === 0 && (
            <Text style={styles.muted}>Không có mục nào khớp tìm kiếm.</Text>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Actions cố định */}
      {!isReadonly && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
            onPress={() => saveMut.mutate()}
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveText}>Lưu tất cả</Text>
              </>
            )}
          </Pressable>
          {progress >= 80 && (
            <Pressable
              style={({ pressed }) => [styles.completeBtn, pressed && { opacity: 0.9 }]}
              onPress={confirmComplete}
              disabled={completeMut.isPending}
            >
              <Ionicons name="checkmark-done" size={18} color={colors.ok} />
              <Text style={styles.completeText}>Hoàn tất</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Modal pallet ngoài hệ thống */}
      <Modal visible={!!outsideLoc} transparent animationType="slide" onRequestClose={closeOutside}>
        <View style={styles.omBackdrop}>
          <View style={styles.omCard}>
            <Text style={styles.omTitle}>Pallet ngoài HT · {outsideLoc?.code}</Text>
            <View style={styles.omRow}>
              <TextInput style={styles.omInput} value={oCode} onChangeText={setOCode} placeholder="Mã hàng / mã vạch" placeholderTextColor={colors.outline} autoCapitalize="characters" />
              <Pressable style={styles.omLookup} onPress={() => oCode.trim() && oLookup.mutate(oCode)}>
                {oLookup.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.omLookupText}>Tra</Text>}
              </Pressable>
            </View>
            {oItem && <Text style={styles.omFound}>✓ {oItem.code} · {oItem.short_name}</Text>}
            <View style={styles.omRow}>
              <TextInput style={[styles.omField, { flex: 1 }]} value={oQty} onChangeText={(v) => setOQty(v.replace(/[^0-9]/g, ''))} keyboardType="numeric" placeholder="SL thực *" placeholderTextColor={colors.outline} />
              <TextInput style={[styles.omField, { flex: 1 }]} value={oLot} onChangeText={setOLot} placeholder="Lô" placeholderTextColor={colors.outline} />
            </View>
            <DateField value={oExp} onChange={setOExp} placeholder="Hạn sử dụng" />
            <TextInput style={styles.omField} value={oNote} onChangeText={setONote} placeholder="Ghi chú" placeholderTextColor={colors.outline} />
            <View style={styles.omBtns}>
              <Pressable style={styles.omCancel} onPress={closeOutside}><Text style={styles.omCancelText}>Huỷ</Text></Pressable>
              <Pressable style={styles.omAdd} onPress={() => oSubmit.mutate()} disabled={oSubmit.isPending}>
                {oSubmit.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.omAddText}>Thêm</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.topbar}>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={styles.backText}>DS nhiệm vụ</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  muted: { color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: spacing.md },

  topbar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 13, fontWeight: '700', color: colors.primary, letterSpacing: 0.5 },

  scroll: { padding: spacing.lg, gap: spacing.md },

  heroCard: { backgroundColor: colors.navy, borderRadius: 18, padding: 18 },
  heroCode: { color: '#fff', fontSize: 20, fontWeight: '700' },
  heroType: { color: '#ffffffcc', fontSize: 13, marginTop: 2 },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff33',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    marginTop: 8,
  },
  heroBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  heroProgressText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroTrack: { height: 8, backgroundColor: '#ffffff33', borderRadius: 8, overflow: 'hidden', marginTop: 6 },
  heroFill: { height: '100%', backgroundColor: '#fff' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: colors.ink },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    letterSpacing: 1,
  },
  diffBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.brandRedSoft,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
  },
  diffBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diffBarText: { fontSize: 13, color: colors.brandRedDark, fontWeight: '600' },
  diffToggle: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.brandRed, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  diffToggleOn: { backgroundColor: colors.brandRed },
  diffToggleText: { fontSize: 12, fontWeight: '700', color: colors.brandRed },
  diffToggleTextOn: { color: '#fff' },

  countCard: {
    backgroundColor: colors.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    gap: 8,
  },
  outsideCard: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  countHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stt: { fontSize: 12, fontWeight: '700', color: colors.muted },
  locCode: { fontSize: 14, fontWeight: '700', color: colors.ink, flex: 1 },
  itemLine: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  sub: { fontSize: 12, color: colors.muted },

  outsideBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  outsideBadgeText: { fontSize: 10, fontWeight: '700', color: '#b45309' },
  stagingBadge: { backgroundColor: colors.warnSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  stagingText: { fontSize: 10, fontWeight: '700', color: colors.warn },

  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffOk: { backgroundColor: '#ecfdf5' },
  diffBad: { backgroundColor: '#fef2f2' },
  diffText: { fontSize: 12, fontWeight: '700' },
  diffOkText: { color: '#047857' },
  diffBadText: { color: '#b91c1c' },

  palletBox: { backgroundColor: colors.bgSoft, borderRadius: 8, padding: 8, gap: 2 },
  palletLine: { fontSize: 11, color: colors.inkSoft },

  adjustedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    padding: 10,
  },
  adjustedText: { fontSize: 12, color: '#047857', fontWeight: '600', flex: 1 },

  qtyRow: { flexDirection: 'row', gap: spacing.sm },
  qtyCol: { flex: 1, alignItems: 'center' },
  qtyLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' },
  qtySystem: { fontSize: 18, fontWeight: '700', color: colors.inkSoft, marginTop: 4 },
  qtyInput: {
    marginTop: 4,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.navy,
    borderRadius: 8,
    paddingVertical: 8,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  qtyDiff: { fontSize: 18, fontWeight: '700', marginTop: 4 },

  countTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  htLabel: { fontSize: 14, color: colors.inkSoft, fontWeight: '600' },
  htVal: { fontSize: 16, color: colors.ink, fontWeight: '800', fontFamily: mono },
  diffPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.navy,
    backgroundColor: colors.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDisabled: { opacity: 0.4 },
  bigInput: {
    flex: 1,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.navy,
    borderRadius: radius.md,
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: mono,
  },
  matchBtn: {
    height: 52,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchText: { color: '#fff', fontSize: 12, fontWeight: '700', textAlign: 'center', lineHeight: 14 },

  lotRow: { flexDirection: 'row', gap: spacing.sm },
  fieldLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 4 },
  textInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.panel,
  },
  inputDisabled: { backgroundColor: colors.bgSoft, color: colors.muted },

  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.navy,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  completeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.ok,
    borderRadius: 12,
    paddingVertical: 14,
  },
  completeText: { color: colors.ok, fontSize: 14, fontWeight: '700' },

  recountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.navy, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 11 },
  recountText: { color: colors.navy, fontWeight: '700', fontSize: 13 },
  outsideAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  outsideAddText: { color: colors.brandRed, fontWeight: '700', fontSize: 13 },

  omBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  omCard: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  omTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginBottom: 2 },
  omRow: { flexDirection: 'row', gap: spacing.sm },
  omInput: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 11, fontSize: 14, color: colors.ink, fontFamily: mono },
  omLookup: { backgroundColor: colors.navy, borderRadius: radius.sm, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  omLookupText: { color: '#fff', fontWeight: '700' },
  omFound: { color: colors.ok, fontWeight: '600', fontSize: 13 },
  omField: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 11, fontSize: 14, color: colors.ink },
  omBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  omCancel: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  omCancelText: { color: colors.inkSoft, fontWeight: '700' },
  omAdd: { flex: 2, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  omAddText: { color: '#fff', fontWeight: '700' },
});

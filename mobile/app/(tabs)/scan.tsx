import { useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
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
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../../src/api/client';
import { buzz } from '../../src/settings/settings-store';
import { colors, spacing, radius, mono } from '../../src/theme/colors';
import { ScreenTitle, SectionLabel } from '../../src/ui/kit';

interface Line {
  item_code_id: string;
  item_code?: string;
  item_name?: string;
  lot?: string | null;
  qty_box?: number;
}
interface LocationDetail {
  id: string;
  code?: string;
  zone?: string;
  rack?: string;
  level?: string;
  lines?: Line[];
}
interface Group {
  item_code_id: string;
  code: string;
  name: string;
  system_qty: number;
  lots: string[];
}
interface ItemCode {
  id: string;
  code?: string;
  short_name?: string;
  product?: { name?: string } | null;
}
interface ExtraPallet {
  item_code_id: string;
  code: string;
  name: string;
  actual_qty: number;
  lot?: string;
  expiry?: string;
  found_pallet_code?: string;
  note?: string;
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export default function ScanScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loc, setLoc] = useState<LocationDetail | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [blind, setBlind] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraMode, setCameraMode] = useState<'location' | 'item'>('location');
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  // Pallet ngoài hệ thống
  const [extras, setExtras] = useState<ExtraPallet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [fCode, setFCode] = useState('');
  const [fItem, setFItem] = useState<ItemCode | null>(null);
  const [fQty, setFQty] = useState('');
  const [fLot, setFLot] = useState('');
  const [fExp, setFExp] = useState('');
  const [fPallet, setFPallet] = useState('');
  const [fNote, setFNote] = useState('');

  const findMut = useMutation({
    mutationFn: async (c: string) => {
      const res = await api.getRaw<{ detail?: LocationDetail }>(
        `/inventory/by-location?code=${encodeURIComponent(c.trim().toUpperCase())}`,
      );
      if (!res.detail) throw new Error('NOT_FOUND');
      return res.detail;
    },
    onSuccess: (detail) => {
      buzz(60);
      setLoc(detail);
      setCounts({});
      setNotes({});
      setExtras([]);
      setError(null);
    },
    onError: () => setError(`Không tìm thấy vị trí "${code.toUpperCase()}".`),
  });

  const lookupMut = useMutation({
    mutationFn: (c: string) => api.get<ItemCode>(`/item-codes/by-code?code=${encodeURIComponent(c.trim())}`),
    onSuccess: (ic) => setFItem(ic),
    onError: () => Alert.alert('Không tìm thấy', 'Mã hàng không tồn tại.'),
  });

  const groups: Group[] = useMemo(() => {
    if (!loc?.lines) return [];
    const map: Record<string, Group> = {};
    loc.lines.forEach((l) => {
      const k = l.item_code_id;
      if (!map[k]) map[k] = { item_code_id: k, code: l.item_code ?? '', name: l.item_name ?? '', system_qty: 0, lots: [] };
      map[k].system_qty += num(l.qty_box);
      if (l.lot && !map[k].lots.includes(l.lot)) map[k].lots.push(l.lot);
    });
    return Object.values(map);
  }, [loc]);

  const countRows = Object.keys(counts).filter((k) => counts[k] !== '').length;
  const totalRows = countRows + extras.length;

  function addExtra() {
    if (!fItem) {
      Alert.alert('Thiếu mã hàng', 'Hãy tra mã hàng trước.');
      return;
    }
    if (num(fQty) <= 0) {
      Alert.alert('Thiếu số lượng', 'Số lượng thực phải lớn hơn 0.');
      return;
    }
    setExtras((p) => [
      ...p,
      {
        item_code_id: fItem.id,
        code: fItem.code ?? '',
        name: fItem.short_name ?? fItem.product?.name ?? '',
        actual_qty: num(fQty),
        lot: fLot || undefined,
        expiry: fExp || undefined,
        found_pallet_code: fPallet || undefined,
        note: fNote || undefined,
      },
    ]);
    setFItem(null);
    setFCode('');
    setFQty('');
    setFLot('');
    setFExp('');
    setFPallet('');
    setFNote('');
    setShowForm(false);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const items = groups
        .filter((g) => counts[g.item_code_id] !== undefined && counts[g.item_code_id] !== '')
        .map((g) => ({
          item_code_id: g.item_code_id,
          actual_qty: Math.max(0, num(counts[g.item_code_id])),
          note: notes[g.item_code_id] || undefined,
        }));
      if (items.length === 0 && extras.length === 0) throw new Error('EMPTY');
      return api.post<{ session_id?: string; message?: string }>('/stock-count/quick-scan', {
        location_id: loc!.id,
        items,
        extra_pallets: extras.map((e) => ({
          item_code_id: e.item_code_id,
          actual_qty: e.actual_qty,
          lot: e.lot,
          expiry: e.expiry,
          found_pallet_code: e.found_pallet_code,
          note: e.note,
        })),
      });
    },
    onSuccess: (res) => {
      const sid = res?.session_id;
      Alert.alert('Đã lưu', res?.message ?? 'Đã lưu kết quả kiểm kê.', [
        {
          text: 'OK',
          onPress: () => {
            reset();
            if (sid) router.push(`/(tabs)/stocktake/${sid}`);
          },
        },
      ]);
    },
    onError: (e: any) =>
      Alert.alert('Lỗi', e?.message === 'EMPTY' ? 'Chưa nhập số đếm nào.' : e?.detail ?? 'Không lưu được.'),
  });

  function reset() {
    setLoc(null);
    setCode('');
    setCounts({});
    setNotes({});
    setExtras([]);
    setError(null);
  }

  async function openCamera() {
    if (!permission?.granted) {
      const r = await requestPermission();
      if (!r.granted) {
        Alert.alert('Cần quyền camera', 'Vui lòng cấp quyền camera để quét mã.');
        return;
      }
    }
    scanLock.current = false;
    setCameraOpen(true);
  }

  function onScanned(value: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    setCameraOpen(false);
    buzz(60);
    if (cameraMode === 'item') {
      setFCode(value);
      lookupMut.mutate(value);
    } else {
      setCode(value);
      findMut.mutate(value);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenTitle title="Quét & Đếm nhanh" icon="qr-code-outline" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {!loc ? (
            <View style={styles.step1}>
              <Ionicons name="qr-code-outline" size={60} color={colors.navy} style={{ alignSelf: 'center' }} />
              <Pressable style={styles.scanBtn} onPress={() => { setCameraMode('location'); openCamera(); }}>
                <Ionicons name="camera" size={18} color="#fff" />
                <Text style={styles.scanBtnText}>Mở camera quét QR vị trí</Text>
              </Pressable>
              <View style={styles.dividerRow}>
                <View style={styles.divider} />
                <Text style={styles.dividerText}>hoặc nhập tay</Text>
                <View style={styles.divider} />
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.codeInput}
                  value={code}
                  onChangeText={(v) => setCode(v.toUpperCase())}
                  placeholder="VD: A-03-02"
                  placeholderTextColor={colors.outline}
                  autoCapitalize="characters"
                />
                <Pressable style={styles.findBtn} onPress={() => code.trim() && findMut.mutate(code)} disabled={findMut.isPending}>
                  {findMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.findBtnText}>Tìm</Text>}
                </Pressable>
              </View>
              {error && <Text style={styles.errorText}>{error}</Text>}
              <Pressable style={styles.blindRow} onPress={() => setBlind((v) => !v)}>
                <View style={[styles.checkbox, blind && styles.checkboxOn]}>
                  {blind && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={styles.blindText}>Đếm mù (ẩn SL hệ thống đến khi nhập)</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.locCard}>
                <Ionicons name="location" size={20} color={colors.navy} />
                <View>
                  <Text style={styles.locCode}>{loc.code}</Text>
                  <Text style={styles.sub}>Khu {loc.zone} · Kệ {loc.rack} · Tầng {loc.level}</Text>
                </View>
              </View>

              <SectionLabel>Hàng tại vị trí ({groups.length} mã)</SectionLabel>
              {groups.length === 0 ? (
                <View style={styles.emptyCard}><Text style={styles.sub}>Vị trí trống</Text></View>
              ) : (
                groups.map((g) => {
                  const entered = counts[g.item_code_id] !== undefined && counts[g.item_code_id] !== '';
                  const diff = entered ? num(counts[g.item_code_id]) - g.system_qty : 0;
                  const showSystem = !blind || entered;
                  return (
                    <View key={g.item_code_id} style={styles.itemCard}>
                      <Text style={styles.itemCode}>{g.code}</Text>
                      <Text style={styles.sub}>{g.name}</Text>
                      {g.lots.length > 0 && <Text style={styles.sub}>Lô: {g.lots.join(', ')}</Text>}
                      <View style={styles.qtyRow}>
                        <View style={styles.qtyCol}><Text style={styles.qtyLabel}>HT</Text><Text style={styles.qtySystem}>{showSystem ? g.system_qty : '•••'}</Text></View>
                        <View style={styles.qtyCol}><Text style={styles.qtyLabel}>Thực</Text>
                          <TextInput style={styles.qtyInput} value={counts[g.item_code_id] ?? ''}
                            onChangeText={(v) => setCounts((p) => ({ ...p, [g.item_code_id]: v.replace(/[^0-9]/g, '') }))}
                            keyboardType="numeric" placeholder="—" placeholderTextColor={colors.outline} />
                        </View>
                        <View style={styles.qtyCol}><Text style={styles.qtyLabel}>CL</Text>
                          <Text style={[styles.qtyDiff, { color: diff === 0 ? colors.ok : colors.danger }]}>{entered ? (diff > 0 ? `+${diff}` : diff) : '—'}</Text>
                        </View>
                      </View>
                      {entered && diff !== 0 && (
                        <TextInput style={styles.noteInput} value={notes[g.item_code_id] ?? ''}
                          onChangeText={(v) => setNotes((p) => ({ ...p, [g.item_code_id]: v }))}
                          placeholder="Ghi chú lý do chênh lệch..." placeholderTextColor={colors.outline} />
                      )}
                    </View>
                  );
                })
              )}

              {/* Pallet ngoài hệ thống */}
              <SectionLabel>Pallet ngoài hệ thống ({extras.length})</SectionLabel>
              {extras.map((e, i) => (
                <View key={i} style={styles.extraCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemCode}>{e.code} <Text style={styles.outBadge}>NGOÀI HT</Text></Text>
                    <Text style={styles.sub}>{e.name}</Text>
                    <Text style={styles.sub}>SL {e.actual_qty}{e.lot ? ` · Lô ${e.lot}` : ''}{e.found_pallet_code ? ` · ${e.found_pallet_code}` : ''}</Text>
                  </View>
                  <Pressable onPress={() => setExtras((p) => p.filter((_, idx) => idx !== i))} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              ))}

              {!showForm ? (
                <Pressable style={styles.addExtraBtn} onPress={() => setShowForm(true)}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.navy} />
                  <Text style={styles.addExtraText}>Thêm pallet ngoài hệ thống</Text>
                </Pressable>
              ) : (
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>Khai báo pallet ngoài hệ thống</Text>
                  <View style={styles.inputRow}>
                    <TextInput style={styles.codeInput} value={fCode} onChangeText={setFCode}
                      placeholder="Mã hàng / mã vạch" placeholderTextColor={colors.outline} autoCapitalize="characters" />
                    <Pressable style={styles.camMini} onPress={() => { setCameraMode('item'); openCamera(); }}>
                      <Ionicons name="camera" size={20} color="#fff" />
                    </Pressable>
                    <Pressable style={styles.findBtn} onPress={() => fCode.trim() && lookupMut.mutate(fCode)} disabled={lookupMut.isPending}>
                      {lookupMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.findBtnText}>Tra</Text>}
                    </Pressable>
                  </View>
                  {fItem && (
                    <Text style={styles.foundItem}>✓ {fItem.code} · {fItem.short_name ?? fItem.product?.name}</Text>
                  )}
                  <View style={styles.formRow}>
                    <TextInput style={[styles.fInput, { flex: 1 }]} value={fQty} onChangeText={(v) => setFQty(v.replace(/[^0-9]/g, ''))}
                      keyboardType="numeric" placeholder="SL thực *" placeholderTextColor={colors.outline} />
                    <TextInput style={[styles.fInput, { flex: 1 }]} value={fLot} onChangeText={setFLot}
                      placeholder="Lô" placeholderTextColor={colors.outline} />
                  </View>
                  <View style={styles.formRow}>
                    <TextInput style={[styles.fInput, { flex: 1 }]} value={fExp} onChangeText={setFExp}
                      placeholder="HSD 2026-12-31" placeholderTextColor={colors.outline} />
                    <TextInput style={[styles.fInput, { flex: 1 }]} value={fPallet} onChangeText={setFPallet}
                      placeholder="Mã pallet hiện trường" placeholderTextColor={colors.outline} />
                  </View>
                  <TextInput style={styles.fInput} value={fNote} onChangeText={setFNote}
                    placeholder="Ghi chú" placeholderTextColor={colors.outline} />
                  <View style={styles.formBtnRow}>
                    <Pressable style={styles.formCancel} onPress={() => { setShowForm(false); setFItem(null); }}>
                      <Text style={styles.formCancelText}>Huỷ</Text>
                    </Pressable>
                    <Pressable style={styles.formAdd} onPress={addExtra}>
                      <Text style={styles.formAddText}>Thêm vào danh sách</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              <View style={styles.btnRow}>
                <Pressable style={styles.backBtn} onPress={reset}><Text style={styles.backBtnText}>Quay lại</Text></Pressable>
                <Pressable style={styles.saveBtn} onPress={() => saveMut.mutate()} disabled={saveMut.isPending || totalRows === 0}>
                  {saveMut.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Lưu {totalRows} dòng</Text>}
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={cameraOpen} animationType="slide" onRequestClose={() => setCameraOpen(false)}>
        <View style={styles.cameraWrap}>
          <CameraView style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'code39', 'ean8', 'upc_a'] }}
            onBarcodeScanned={({ data }) => onScanned(data)} />

          {/* Lớp phủ mờ + khung quét */}
          <View style={StyleSheet.absoluteFill}>
            <View style={styles.mask} />
            <View style={styles.maskRow}>
              <View style={styles.mask} />
              <View style={styles.window}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
                <View style={styles.scanLine} />
              </View>
              <View style={styles.mask} />
            </View>
            <View style={[styles.mask, styles.maskBottom]}>
              <Ionicons name="qr-code-outline" size={22} color="#fff" />
              <Text style={styles.cameraHint}>
                {cameraMode === 'item' ? 'Đưa mã hàng / mã vạch vào khung' : 'Đưa mã QR vị trí vào khung'}
              </Text>
              <Text style={styles.cameraHintSub}>Tự nhận diện khi mã rõ nét</Text>
            </View>
          </View>

          <Pressable style={styles.cameraClose} onPress={() => setCameraOpen(false)}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md },
  step1: { gap: spacing.md, paddingTop: spacing.lg },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 14 },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  divider: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { fontSize: 12, color: colors.muted },
  inputRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: { flex: 1, borderWidth: 1, borderColor: colors.outline, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 16, color: colors.ink, letterSpacing: 1, fontFamily: mono },
  findBtn: { backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  camMini: { backgroundColor: colors.brandRed, borderRadius: radius.md, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  findBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  errorText: { color: colors.danger, fontSize: 13 },
  blindRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 1.5, borderColor: colors.outline, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  blindText: { fontSize: 13, color: colors.inkSoft, flex: 1 },

  locCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.navySoft, borderRadius: radius.lg, padding: spacing.md },
  locCode: { fontSize: 16, fontWeight: '700', color: colors.navy, fontFamily: mono },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  emptyCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, alignItems: 'center' },

  itemCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: 4 },
  itemCode: { fontSize: 14, fontWeight: '700', color: colors.ink, fontFamily: mono },
  qtyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 6 },
  qtyCol: { flex: 1, alignItems: 'center' },
  qtyLabel: { fontSize: 10, color: colors.muted, fontWeight: '600', textTransform: 'uppercase' },
  qtySystem: { fontSize: 18, fontWeight: '700', color: colors.inkSoft, marginTop: 4, fontFamily: mono },
  qtyInput: { marginTop: 4, width: '100%', borderWidth: 1, borderColor: colors.navy, borderRadius: radius.sm, paddingVertical: 8, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.ink, fontFamily: mono },
  qtyDiff: { fontSize: 18, fontWeight: '700', marginTop: 4, fontFamily: mono },
  noteInput: { marginTop: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: colors.ink },

  extraCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderRadius: radius.lg, borderWidth: 1, borderColor: '#fde68a', padding: spacing.md },
  outBadge: { fontSize: 9, fontWeight: '700', color: colors.warn },
  addExtraBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.navy, borderStyle: 'dashed', borderRadius: radius.md, paddingVertical: 12 },
  addExtraText: { color: colors.navy, fontWeight: '700', fontSize: 14 },

  formCard: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.md, gap: spacing.sm },
  formTitle: { fontSize: 14, fontWeight: '700', color: colors.navy },
  foundItem: { fontSize: 13, color: colors.ok, fontWeight: '600' },
  formRow: { flexDirection: 'row', gap: spacing.sm },
  fInput: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: colors.ink, backgroundColor: colors.panel },
  formBtnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 2 },
  formCancel: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 11, alignItems: 'center' },
  formCancelText: { color: colors.inkSoft, fontWeight: '700' },
  formAdd: { flex: 2, backgroundColor: colors.navy, borderRadius: radius.sm, paddingVertical: 11, alignItems: 'center' },
  formAddText: { color: '#fff', fontWeight: '700' },

  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  backBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  backBtnText: { color: colors.inkSoft, fontWeight: '700', fontSize: 15 },
  saveBtn: { flex: 2, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  cameraWrap: { flex: 1, backgroundColor: '#000' },
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  maskRow: { flexDirection: 'row', height: 260 },
  maskBottom: { alignItems: 'center', justifyContent: 'flex-start', paddingTop: 26, gap: 6 },
  window: { width: 260, height: 260 },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  scanLine: { position: 'absolute', top: '50%', left: 10, right: 10, height: 2, backgroundColor: colors.brandRed },
  cameraHint: { color: '#fff', fontSize: 15, fontWeight: '700' },
  cameraHintSub: { color: '#ffffffaa', fontSize: 12 },
  cameraClose: { position: 'absolute', top: 50, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: '#00000088', alignItems: 'center', justifyContent: 'center' },
});

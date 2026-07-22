import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/auth/auth-store';
import { useSettings } from '../../src/settings/settings-store';
import { api, apiBase, apiOrigin } from '../../src/api/client';
import { tokenStorage } from '../../src/auth/token-storage';
import { colors, spacing, radius, mono } from '../../src/theme/colors';
import { Card, OutlineButton, PrimaryButton, SectionLabel, StatTile } from '../../src/ui/kit';

const ROLE_LABEL: Record<string, string> = {
  MANAGER: 'Quản lý', KE_TOAN: 'Kế toán kho', QUAN_LY: 'Quản lý kho',
  THU_KHO: 'Thủ kho', XE_NANG: 'Xe nâng', KIEM_KE: 'Người kiểm kê',
  WAREHOUSE_KEEPER: 'Thủ kho', FORKLIFT: 'Xe nâng', STOCKTAKER: 'Người kiểm kê',
};

const ACTIVE = ['OPEN', 'COUNTING', 'RECONCILING'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, setUser } = useAuthStore();
  const settings = useSettings();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.fullName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [showPwd, setShowPwd] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!settings.hydrated) void settings.hydrate();
  }, [settings]);

  // Chỉ số cá nhân (từ danh sách phiên)
  const statsQ = useQuery<any[]>({ queryKey: ['stock-count'], queryFn: () => api.get('/stock-count') });
  const sessions = statsQ.data ?? [];
  const closed = sessions.filter((s) => s.status === 'CLOSED').length;
  const active = sessions.filter((s) => ACTIVE.includes(s.status)).length;

  const saveMut = useMutation({
    mutationFn: async () => {
      const fn = name.trim();
      if (!fn) throw Object.assign(new Error(''), { detail: 'Họ tên không được để trống.' });
      if (phone && !/^0\d{9}$/.test(phone)) throw Object.assign(new Error(''), { detail: 'SĐT phải gồm 10 số, bắt đầu bằng 0.' });
      await api.put('/auth/profile', { full_name: fn, phone: phone || null });
      return { fn, phone };
    },
    onSuccess: async ({ fn, phone }) => {
      if (user) await setUser({ ...user, fullName: fn, phone: phone || null });
      setEditing(false);
      Alert.alert('Đã lưu', 'Cập nhật hồ sơ thành công.');
    },
    onError: (e: any) => Alert.alert('Lỗi', e?.detail ?? 'Không lưu được.'),
  });

  async function pickAvatar() {
    if (!user) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Cần quyền', 'Cho phép truy cập ảnh để đổi avatar.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6, allowsEditing: true, aspect: [1, 1] });
    if (r.canceled || !r.assets?.[0]) return;
    const asset = r.assets[0];
    setUploading(true);
    try {
      const token = await tokenStorage.getAccess();
      // Suy ra đuôi & MIME hợp lệ (server chỉ nhận JPEG/PNG/WebP/GIF)
      const uriExt = (asset.uri.split('.').pop() || 'jpg').toLowerCase().split('?')[0];
      const ext = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(uriExt) ? uriExt : 'jpg';
      const mime =
        asset.mimeType && asset.mimeType.startsWith('image/')
          ? asset.mimeType
          : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
      const form = new FormData();
      form.append('file', { uri: asset.uri, name: asset.fileName || `avatar.${ext}`, type: mime } as any);
      form.append('entity_type', 'USER_AVATAR');
      form.append('entity_id', user.id);

      const res = await fetch(`${apiBase}/attachments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        body: form,
      });
      const txt = await res.text();
      let json: any = {};
      try { json = JSON.parse(txt); } catch { /* non-json */ }
      const fileUrl: string | undefined = json?.data?.file_url ?? json?.file_url;
      if (!res.ok || !fileUrl) {
        throw new Error(json?.error || json?.detail || `Máy chủ trả mã ${res.status}`);
      }
      const url = fileUrl.startsWith('http') ? fileUrl : `${apiOrigin}${fileUrl}`;
      await api.put('/auth/profile', { avatar_url: url });
      await setUser({ ...user, avatarUrl: url });
      Alert.alert('Đã cập nhật', 'Ảnh đại diện đã được thay đổi.');
    } catch (err: any) {
      Alert.alert('Lỗi tải ảnh', err?.message || 'Thử lại sau.');
    } finally {
      setUploading(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Identity */}
        <LinearGradient colors={['#2563eb', '#022448']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.idCard}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            {user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{user.fullName.charAt(0).toUpperCase()}</Text></View>
            )}
            <View style={styles.camBadge}>
              {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={14} color="#fff" />}
            </View>
          </Pressable>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.role}>{ROLE_LABEL[user.role.code] ?? user.role.code}</Text>
          <Text style={styles.idText}>Mã NV: {user.id}</Text>
        </LinearGradient>

        {/* Chỉ số */}
        <SectionLabel>Chỉ số cá nhân</SectionLabel>
        <View style={styles.kpiRow}>
          <StatTile label="Phiên đã đóng" value={closed} tone="ok" icon="checkmark-done-outline" />
          <StatTile label="Đang tham gia" value={active} tone="info" icon="time-outline" />
        </View>

        {/* Thông tin */}
        <SectionLabel>Thông tin cá nhân</SectionLabel>
        <Card>
          {!editing ? (
            <>
              <Field label="Họ tên" value={user.fullName} />
              <Field label="Email" value={user.email || '—'} />
              <Field label="SĐT" value={user.phone || '—'} />
              <View style={{ marginTop: spacing.md }}>
                <OutlineButton title="Sửa thông tin" icon="create-outline" onPress={() => { setName(user.fullName); setPhone(user.phone ?? ''); setEditing(true); }} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.fLabel}>Họ tên</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Họ tên" placeholderTextColor={colors.outline} />
              <Text style={styles.fLabel}>SĐT</Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0xxxxxxxxx" placeholderTextColor={colors.outline} />
              <View style={styles.editBtns}>
                <Pressable style={styles.cancelBtn} onPress={() => setEditing(false)}><Text style={styles.cancelText}>Huỷ</Text></Pressable>
                <View style={{ flex: 2 }}><PrimaryButton title="Lưu" icon="checkmark" loading={saveMut.isPending} onPress={() => saveMut.mutate()} /></View>
              </View>
            </>
          )}
        </Card>

        {/* Cài đặt */}
        <SectionLabel>Cài đặt</SectionLabel>
        <Card>
          <ToggleRow icon="volume-high-outline" label="Âm thanh khi quét/đếm" value={settings.sound} onChange={(v) => settings.set({ sound: v })} />
          <View style={styles.divider} />
          <ToggleRow icon="phone-portrait-outline" label="Rung phản hồi" value={settings.haptic} onChange={(v) => settings.set({ haptic: v })} />
        </Card>

        {/* Bảo mật */}
        <SectionLabel>Bảo mật</SectionLabel>
        <Card>
          <OutlineButton title="Đổi mật khẩu" icon="lock-closed-outline" onPress={() => setShowPwd(true)} />
        </Card>

        <View style={{ marginTop: spacing.lg }}>
          <OutlineButton title="Đăng xuất" icon="log-out-outline" color={colors.brandRed} onPress={handleLogout} />
        </View>
        <Text style={styles.footnote}>WMS Vĩnh Giang Mobile</Text>
      </ScrollView>

      <ChangePasswordModal visible={showPwd} onClose={() => setShowPwd(false)} onDone={handleLogout} />
    </SafeAreaView>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fLabel}>{label}</Text>
      <Text style={styles.fValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ icon, label, value, onChange }: { icon: any; label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Ionicons name={icon} size={20} color={colors.navy} />
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.navy }} />
    </View>
  );
}

function ChangePasswordModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: () => void }) {
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const mut = useMutation({
    mutationFn: async () => {
      if (!cur || !nw || !cf) throw Object.assign(new Error(''), { detail: 'Nhập đủ 3 trường.' });
      if (nw.length < 8) throw Object.assign(new Error(''), { detail: 'Mật khẩu mới tối thiểu 8 ký tự.' });
      if (nw !== cf) throw Object.assign(new Error(''), { detail: 'Xác nhận mật khẩu không khớp.' });
      await api.put('/auth/change-password', { currentPassword: cur, newPassword: nw, confirmPassword: cf });
    },
    onSuccess: () => Alert.alert('Thành công', 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.', [{ text: 'OK', onPress: onDone }]),
    onError: (e: any) => Alert.alert('Lỗi', e?.detail ?? 'Không đổi được mật khẩu.'),
  });
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Đổi mật khẩu</Text>
          <TextInput style={styles.input} value={cur} onChangeText={setCur} secureTextEntry placeholder="Mật khẩu hiện tại" placeholderTextColor={colors.outline} />
          <TextInput style={styles.input} value={nw} onChangeText={setNw} secureTextEntry placeholder="Mật khẩu mới (≥8 ký tự)" placeholderTextColor={colors.outline} />
          <TextInput style={styles.input} value={cf} onChangeText={setCf} secureTextEntry placeholder="Xác nhận mật khẩu mới" placeholderTextColor={colors.outline} />
          <View style={styles.editBtns}>
            <Pressable style={styles.cancelBtn} onPress={onClose}><Text style={styles.cancelText}>Huỷ</Text></Pressable>
            <View style={{ flex: 2 }}><PrimaryButton title="Đổi mật khẩu" loading={mut.isPending} onPress={() => mut.mutate()} /></View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, gap: spacing.md },
  idCard: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' },
  avatarWrap: { marginBottom: spacing.sm },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff22', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ffffff22' },
  avatarText: { fontSize: 30, fontWeight: '800', color: '#fff' },
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brandRed, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.navy },
  name: { fontSize: 18, fontWeight: '700', color: '#fff' },
  role: { fontSize: 13, color: '#ffffffcc', marginTop: 2, fontWeight: '600' },
  idText: { fontSize: 12, color: '#ffffff99', marginTop: 4, fontFamily: mono },

  kpiRow: { flexDirection: 'row', gap: spacing.sm },
  field: { paddingVertical: 6 },
  fLabel: { fontSize: 11, color: colors.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  fValue: { fontSize: 15, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: colors.ink, marginBottom: spacing.sm },
  editBtns: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 4 },
  toggleLabel: { flex: 1, fontSize: 14, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: 4 },

  footnote: { textAlign: 'center', fontSize: 11, color: colors.muted, marginTop: spacing.xl },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.panel, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: spacing.lg, paddingBottom: spacing.xl, gap: 4 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.navy, marginBottom: spacing.sm },
});

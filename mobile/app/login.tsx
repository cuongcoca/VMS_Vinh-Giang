import { useState } from 'react';
import {
  Text,
  StyleSheet,
  View,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../src/auth/auth-store';
import { colors, spacing } from '../src/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!identifier || !password) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(identifier, password);
      router.replace('/(tabs)/home');
    } catch (e) {
      const err = e as { detail?: string };
      setError(err.detail ?? 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            {/* Brand header */}
            <View style={styles.header}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.brandText}>Warehouse Management System</Text>
            </View>

            <View style={styles.body}>
              {/* Username */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>TÊN ĐĂNG NHẬP</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={colors.outline}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    value={identifier}
                    onChangeText={setIdentifier}
                    placeholder="Nhập tên đăng nhập hoặc mã NV"
                    placeholderTextColor={colors.outline}
                    autoCapitalize="none"
                    autoComplete="username"
                    maxLength={50}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>MẬT KHẨU</Text>
                  <Text style={styles.required}>*</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color={colors.outline}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={[styles.input, styles.inputPassword]}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Nhập mật khẩu truy cập"
                    placeholderTextColor={colors.outline}
                    secureTextEntry={!showPassword}
                    autoComplete="current-password"
                    maxLength={20}
                  />
                  <Pressable
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.outline}
                    />
                  </Pressable>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Utilities row */}
              <View style={styles.utilRow}>
                <Pressable
                  style={styles.remember}
                  onPress={() => setRememberMe((v) => !v)}
                  hitSlop={6}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text>
                </Pressable>
                <Pressable hitSlop={6}>
                  <Text style={styles.forgot}>Quên mật khẩu?</Text>
                </Pressable>
              </View>

              {/* Submit */}
              <Pressable
                style={({ pressed }) => [
                  styles.submit,
                  pressed && styles.submitPressed,
                  loading && styles.submitDisabled,
                ]}
                onPress={submit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitText}>Đăng nhập</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.primaryContainer },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: colors.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: 'hidden',
    shadowColor: '#022448',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceVariant,
    backgroundColor: colors.panel,
  },
  logo: {
    width: 110,
    height: 96,
    marginBottom: spacing.sm,
  },
  brandText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: colors.brandText,
    textAlign: 'center',
  },
  body: {
    padding: spacing.xl,
    gap: spacing.lg,
  },
  field: { gap: spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    color: colors.inkSoft,
  },
  required: { color: colors.danger, fontSize: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 10,
    backgroundColor: colors.panel,
    minHeight: 52,
  },
  inputIcon: { marginLeft: spacing.md },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.ink,
  },
  inputPassword: { paddingRight: 0 },
  eyeBtn: { paddingHorizontal: spacing.md, paddingVertical: 14 },
  errorBox: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
    padding: spacing.sm,
  },
  errorText: { color: colors.danger, fontSize: 13, fontWeight: '500' },
  utilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryContainer,
  },
  rememberText: { fontSize: 13, color: colors.inkSoft },
  forgot: { fontSize: 13, color: colors.secondary, fontWeight: '600' },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.primaryContainer,
  },
  submitPressed: { opacity: 0.9 },
  submitDisabled: { opacity: 0.8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

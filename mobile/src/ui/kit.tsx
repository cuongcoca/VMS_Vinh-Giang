import { ReactNode, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius, mono } from '../theme/colors';
import { CountUp } from './anim';

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = 'navy' | 'red' | 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, { bg: string; fg: string }> = {
  navy: { bg: colors.navySoft, fg: colors.navy },
  red: { bg: colors.brandRedSoft, fg: colors.brandRedDark },
  ok: { bg: colors.okSoft, fg: colors.ok },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  info: { bg: colors.infoSoft, fg: colors.info },
  neutral: { bg: colors.bgSoft, fg: colors.inkSoft },
};

/** Header màn — avatar/icon + tiêu đề + phụ đề + nút phải tuỳ chọn */
export function AppHeader({
  title,
  subtitle,
  icon = 'cube-outline',
  rightIcon,
  onRightPress,
  rightBadge = 0,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  rightIcon?: IconName;
  onRightPress?: () => void;
  rightBadge?: number;
}) {
  return (
    <View style={s.header}>
      <View style={s.headerLeft}>
        <View style={s.headerAvatar}>
          <Ionicons name={icon} size={20} color={colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
        </View>
      </View>
      {rightIcon && (
        <Pressable onPress={onRightPress} hitSlop={8} style={s.bellWrap}>
          <Ionicons name={rightIcon} size={24} color={colors.inkSoft} />
          {rightBadge > 0 && (
            <View style={s.badgeDot}>
              <Text style={s.badgeDotText}>{rightBadge > 9 ? '9+' : rightBadge}</Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Tiêu đề màn đơn giản (icon + chữ) */
export function ScreenTitle({ title, icon }: { title: string; icon?: IconName }) {
  return (
    <View style={s.screenTitle}>
      {icon && <Ionicons name={icon} size={22} color={colors.navy} />}
      <Text style={s.screenTitleText}>{title}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

export function Mono({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[{ fontFamily: mono }, style]}>{children}</Text>;
}

export function StatusBadge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONE[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg }]}>
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function ProgressBar({ value, tone = 'navy' }: { value: number; tone?: Tone }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${v}%`, backgroundColor: TONE[tone].fg }]} />
    </View>
  );
}

export function StatTile({
  label,
  value,
  tone = 'navy',
  icon,
}: {
  label: string;
  value: number | string;
  tone?: Tone;
  icon?: IconName;
}) {
  const t = TONE[tone];
  return (
    <View style={[s.tile, { backgroundColor: t.bg, borderColor: 'transparent' }]}>
      <View style={s.tileTop}>
        {icon && <Ionicons name={icon} size={15} color={t.fg} />}
        <Text style={[s.tileLabel, { color: t.fg }]}>{label}</Text>
      </View>
      {typeof value === 'number' ? (
        <CountUp value={value} style={[s.tileValue, { color: t.fg }]} />
      ) : (
        <Text style={[s.tileValue, { color: t.fg }]}>{value}</Text>
      )}
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  icon,
  loading,
  disabled,
  tone = 'navy',
  style,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'navy' | 'red';
  style?: StyleProp<ViewStyle>;
}) {
  const bg = tone === 'red' ? colors.brandRed : colors.navy;
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled || loading}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, bounciness: 0, speed: 50 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start()}
        style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.5 : 1 }]}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && <Ionicons name={icon} size={18} color="#fff" />}
            <Text style={s.btnText}>{title}</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function OutlineButton({
  title,
  onPress,
  icon,
  color = colors.navy,
  style,
}: {
  title: string;
  onPress?: () => void;
  icon?: IconName;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.outlineBtn, { borderColor: color, opacity: pressed ? 0.8 : 1 }, style]}
    >
      {icon && <Ionicons name={icon} size={18} color={color} />}
      <Text style={[s.outlineBtnText, { color }]}>{title}</Text>
    </Pressable>
  );
}

/** Chọn ngày (HSD) — dùng lịch native, không gõ tay */
export function DateField({
  value,
  onChange,
  placeholder = 'Chọn ngày',
  editable = true,
}: {
  value: string; // yyyy-mm-dd
  onChange: (v: string) => void;
  placeholder?: string;
  editable?: boolean;
}) {
  const [show, setShow] = useState(false);
  const dateVal = value ? new Date(`${value}T00:00:00`) : new Date();
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <Pressable onPress={() => editable && setShow(true)} style={[s.dateField, { flex: 1 }, !editable && { opacity: 0.6 }]}>
        <Ionicons name="calendar-outline" size={18} color={colors.navy} />
        <Text style={[s.dateText, !value && { color: colors.outline }]}>
          {value ? value.split('-').reverse().join('/') : placeholder}
        </Text>
      </Pressable>
      {!!value && editable && (
        <Pressable onPress={() => onChange('')} style={s.dateClear} hitSlop={6}>
          <Ionicons name="close" size={16} color={colors.muted} />
        </Pressable>
      )}
      {show && (
        <DateTimePicker
          value={dateVal}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShow(false);
            if (e.type === 'set' && d) {
              const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              onChange(ymd);
            }
          }}
        />
      )}
    </View>
  );
}

export function EmptyState({
  icon = 'document-text-outline',
  title,
  hint,
  action,
  onAction,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={icon} size={42} color="#c9ccc4" />
      <Text style={s.emptyTitle}>{title}</Text>
      {!!hint && <Text style={s.emptyHint}>{hint}</Text>}
      {action && (
        <Pressable onPress={onAction} style={({ pressed }) => [s.emptyAction, pressed && { opacity: 0.9 }]}>
          <Text style={s.emptyActionText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panel,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.navySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.navy },
  headerSub: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, marginTop: 1 },
  bellWrap: { padding: 2 },
  badgeDot: { position: 'absolute', top: -4, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandRed, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: colors.panel },
  badgeDotText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  screenTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  screenTitleText: { fontSize: 20, fontWeight: '700', color: colors.navy },

  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    shadowColor: '#022448',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 1.2, textTransform: 'uppercase' },

  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

  track: { height: 7, backgroundColor: '#eceae3', borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },

  tile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  tileTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tileLabel: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 28, fontWeight: '800', marginTop: 4, fontFamily: mono },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: 16,
    minHeight: 54,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: 15,
    minHeight: 54,
  },
  outlineBtnText: { fontSize: 15, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 44, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  emptyHint: { fontSize: 13, color: colors.muted, textAlign: 'center', paddingHorizontal: 24 },
  emptyAction: { marginTop: 10, backgroundColor: colors.navy, borderRadius: radius.md, paddingHorizontal: 18, paddingVertical: 10 },
  emptyActionText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  dateField: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: colors.panel },
  dateText: { fontSize: 14, color: colors.ink },
  dateClear: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  dateBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: spacing.lg },
  dateCard: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  dateTitle: { fontSize: 17, fontWeight: '700', color: colors.navy },
  dateRow: { flexDirection: 'row', gap: spacing.sm },
  dateLbl: { fontSize: 11, color: colors.muted, fontWeight: '600', marginBottom: 4 },
  dateInput: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 12, textAlign: 'center', fontSize: 18, fontWeight: '700', color: colors.ink },
  dateQuick: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: { flex: 1, backgroundColor: colors.navySoft, borderRadius: radius.sm, paddingVertical: 9, alignItems: 'center' },
  quickText: { color: colors.navy, fontWeight: '700', fontSize: 12 },
  dateBtns: { flexDirection: 'row', gap: spacing.sm },
  dateCancel: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  dateCancelText: { color: colors.inkSoft, fontWeight: '700' },
  dateOk: { flex: 1, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center' },
  dateOkText: { color: '#fff', fontWeight: '700' },
});

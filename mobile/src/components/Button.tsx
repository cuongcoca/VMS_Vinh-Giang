import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme/colors';

type Variant = 'primary' | 'ghost' | 'danger' | 'warn';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  full?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = 'primary', disabled, loading, full, style }: Props) {
  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'danger'
        ? colors.danger
        : variant === 'warn'
          ? colors.warn
          : colors.bgSoft;
  const fg = variant === 'ghost' ? colors.ink : '#fff';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        full && styles.full,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // touch target
  },
  full: { width: '100%' },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});

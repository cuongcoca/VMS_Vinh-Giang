import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

type Variant = 'default' | 'ok' | 'warn' | 'danger' | 'accent';

interface Props {
  label: string;
  variant?: Variant;
}

export function Badge({ label, variant = 'default' }: Props) {
  const palette = {
    default: { bg: colors.bgSoft, fg: colors.inkSoft },
    ok: { bg: colors.okSoft, fg: colors.ok },
    warn: { bg: colors.warnSoft, fg: colors.warn },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    accent: { bg: colors.accentSoft, fg: colors.accent },
  }[variant];

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

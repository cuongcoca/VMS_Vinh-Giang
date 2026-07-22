import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/colors';

export function Empty({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  icon: { fontSize: 48, marginBottom: spacing.sm },
  title: { fontSize: 16, color: colors.inkSoft, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, color: colors.muted, marginTop: 6, textAlign: 'center' },
});

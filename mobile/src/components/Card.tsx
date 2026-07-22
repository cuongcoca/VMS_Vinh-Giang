import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface Props extends ViewProps {
  borderColor?: string;
}

export function Card({ children, style, borderColor, ...rest }: Props) {
  return (
    <View
      style={[
        styles.card,
        borderColor ? { borderColor, borderWidth: 1.5 } : null,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});

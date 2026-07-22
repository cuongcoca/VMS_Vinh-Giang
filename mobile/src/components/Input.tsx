import { Text, TextInput, TextInputProps, View, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Input({ label, error, required, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={{ color: colors.danger }}> *</Text>}
        </Text>
      )}
      <TextInput
        style={[styles.input, error && styles.inputError, style]}
        placeholderTextColor={colors.muted}
        {...rest}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.panel,
    minHeight: 44,
  },
  inputError: { borderColor: colors.danger },
  error: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 4,
  },
});

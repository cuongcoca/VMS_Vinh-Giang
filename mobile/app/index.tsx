import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuthStore } from '../src/auth/auth-store';
import { colors } from '../src/theme/colors';

/**
 * Entry gate — hydrate auth from SecureStore, then redirect:
 *   - no user → /login
 *   - signed in → /(tabs)/home
 */
export default function Index() {
  const { user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!hydrated) {
      void hydrate();
    }
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/login" />;
}

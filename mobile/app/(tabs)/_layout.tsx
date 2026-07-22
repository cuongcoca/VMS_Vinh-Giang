import { Tabs, Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/auth/auth-store';
import { colors } from '../../src/theme/colors';

/**
 * Role-aware bottom tabs (mã vai trò theo backend Next.js).
 * - Thủ kho (THU_KHO): Trang chủ · Pallet · Phiếu nhập · Tài khoản
 * - Xe nâng (XE_NANG): Trang chủ · Xe nâng · Tài khoản
 * - Kiểm kê (KIEM_KE): Trang chủ · Kiểm kê · Tra cứu · Quét & Đếm · Tài khoản
 */
export default function TabsLayout() {
  const { user, hydrated, hydrate } = useAuthStore();

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  const role = user.role.code;
  const isKeeper = role === 'THU_KHO' || role === 'WAREHOUSE_KEEPER';
  const isForklift = role === 'XE_NANG' || role === 'FORKLIFT';
  const isStocktaker = role === 'KIEM_KE' || role === 'STOCKTAKER';

  // Brand: navy là màu nhấn chủ đạo cho mọi vai trò (xe nâng giữ cam riêng).
  const accent = isForklift ? colors.roleForklift : colors.navy;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.line, paddingTop: 4, height: 62 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Trang chủ',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="stocktake"
        options={{
          href: isStocktaker ? '/(tabs)/stocktake' : null,
          title: 'Kiểm kê',
          tabBarIcon: ({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          href: isStocktaker ? '/(tabs)/history' : null,
          title: 'Tra cứu',
          tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          href: isStocktaker ? '/(tabs)/scan' : null,
          title: 'Quét & Đếm',
          tabBarIcon: ({ color, size }) => <Ionicons name="qr-code-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="pallets"
        options={{
          href: isKeeper ? '/(tabs)/pallets' : null,
          title: 'Pallet',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="inbound"
        options={{
          href: isKeeper ? '/(tabs)/inbound' : null,
          title: 'Phiếu nhập',
          tabBarIcon: ({ color, size }) => <Ionicons name="download-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="forklift"
        options={{
          href: isForklift ? '/(tabs)/forklift' : null,
          title: 'Xe nâng',
          tabBarIcon: ({ color, size }) => <Ionicons name="car-outline" size={size} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Tài khoản',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

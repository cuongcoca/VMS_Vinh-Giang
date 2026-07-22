import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api/client';
import { colors, spacing, radius } from '../src/theme/colors';
import { EmptyState } from '../src/ui/kit';

interface Noti {
  id: string;
  type?: string;
  title?: string;
  body?: string | null;
  read_at?: string | null;
  created_at?: string;
}

const fmt = (s?: string) =>
  s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export default function NotificationsScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const q = useQuery<{ data?: Noti[] }>({
    queryKey: ['notifications'],
    queryFn: () => api.getRaw('/notifications?limit=30'),
  });
  const list = q.data?.data ?? [];

  async function markRead(n: Noti) {
    if (n.read_at) return;
    try {
      await api.post(`/notifications/${n.id}/read`);
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      // best-effort
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </Pressable>
        <Text style={styles.title}>Thông báo</Text>
      </View>

      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        refreshing={q.isFetching}
        onRefresh={() => qc.invalidateQueries({ queryKey: ['notifications'] })}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.navy} /></View>
          ) : (
            <EmptyState icon="notifications-off-outline" title="Chưa có thông báo" hint="Thông báo mới sẽ hiện ở đây." />
          )
        }
        renderItem={({ item }) => {
          const unread = !item.read_at;
          return (
            <Pressable onPress={() => markRead(item)} style={[styles.card, unread && styles.cardUnread]}>
              <View style={[styles.dot, { backgroundColor: unread ? colors.brandRed : 'transparent' }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.notiTitle, unread && { fontWeight: '800' }]}>{item.title}</Text>
                {!!item.body && <Text style={styles.notiBody}>{item.body}</Text>}
                <Text style={styles.notiTime}>{fmt(item.created_at)}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.panel },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700', color: colors.navy },
  list: { padding: spacing.lg, gap: spacing.sm },
  center: { paddingVertical: 48, alignItems: 'center' },
  card: { flexDirection: 'row', gap: spacing.sm, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: spacing.md },
  cardUnread: { borderColor: colors.brandRed, backgroundColor: '#fff' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  notiTitle: { fontSize: 14, fontWeight: '600', color: colors.ink },
  notiBody: { fontSize: 13, color: colors.inkSoft, marginTop: 2 },
  notiTime: { fontSize: 11, color: colors.muted, marginTop: 4 },
});

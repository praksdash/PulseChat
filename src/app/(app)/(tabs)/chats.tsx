import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon, AppText, ChatRow, type ChatRowModel, SearchBar } from '@/components/ui';
import { useAppTheme } from '@/theme';

const DEMO_CHATS: ChatRowModel[] = [
  { id: 'demo-alex', name: 'Alex Morgan', preview: 'The new interface looks great.', time: '12:30', unread: 2, online: true },
  { id: 'demo-team', name: 'Pulse Team', preview: 'Groups arrive after core messaging.', time: '11:05', sentByMe: true },
  { id: 'demo-maya', name: 'Maya Chen', preview: 'See you tomorrow 👋', time: 'Yesterday', online: false },
  { id: 'demo-design', name: 'Design Crew', preview: 'Phase 3 components are ready.', time: 'Tue', unread: 5 },
];

export default function ChatsScreen() {
  const theme = useAppTheme();

  const openChat = (chat: ChatRowModel) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: chat.id,
        name: chat.name,
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View>
          <AppText variant="title">PulseChat</AppText>
          <AppText variant="caption" tone="secondary">4 conversations</AppText>
        </View>
        <Pressable
          accessibilityLabel="New message preview"
          style={({ pressed }) => [
            styles.headerButton,
            { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.primarySoft },
          ]}>
          <AppIcon
            name={{ ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' }}
            size={22}
            color={theme.colors.primary}
          />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar editable={false} placeholder="Search conversations" />
      </View>

      <View style={styles.filterRow}>
        <View style={[styles.filterChip, { backgroundColor: theme.colors.primarySoft }]}>
          <AppText variant="captionStrong" tone="primary">All</AppText>
        </View>
        <View style={[styles.filterChip, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppText variant="captionStrong" tone="secondary">Unread</AppText>
        </View>
      </View>

      <FlatList
        data={DEMO_CHATS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatRow chat={item} onPress={() => openChat(item)} />}
        contentContainerStyle={styles.listContent}
        style={[styles.list, { backgroundColor: theme.colors.surface }]}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 14, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  listContent: { paddingTop: 4, paddingBottom: 12 },
});

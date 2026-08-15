import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, ChatRow, type ChatRowModel, EmptyState, SearchBar } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { listMyConversations } from '@/services/conversation-service';
import { subscribeToConversationActivity } from '@/services/conversation-events';
import { useAppTheme } from '@/theme';
import type { ConversationListItem } from '@/types/conversation';

function formatConversationTime(iso: string | null) {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat(undefined, sameYear
    ? { weekday: 'short' }
    : { day: 'numeric', month: 'short' }).format(date);
}

function toChatRow(item: ConversationListItem, currentUserId: string | undefined): ChatRowModel {
  const hasLastMessage = Boolean(item.last_message_created_at);

  return {
    id: item.conversation_id,
    name: item.display_name,
    avatarUri: getAvatarPublicUrl(item.avatar_path),
    preview: item.last_message_preview ?? 'No messages yet — say hello.',
    time: formatConversationTime(item.last_message_created_at ?? item.last_activity_at),
    sentByMe: hasLastMessage && item.last_message_sender_id === currentUserId,
    unread: item.unread_count ?? 0,
  };
}

export default function ChatsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (mode: 'load' | 'refresh' | 'background' = 'load') => {
    if (mode === 'load') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    setError(null);

    try {
      const data = await listMyConversations();
      setConversations(data);
    } catch (loadError) {
      console.warn('Unable to load conversations:', loadError);
      setError('Unable to load your conversations right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadConversations('load');
    }, [loadConversations]),
  );

  useEffect(() => subscribeToConversationActivity(() => {
    void loadConversations('background');
  }), [loadConversations]);

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;

    return conversations.filter((conversation) => {
      const name = conversation.display_name.toLowerCase();
      const username = conversation.username?.toLowerCase() ?? '';
      return name.includes(normalized) || username.includes(normalized);
    });
  }, [conversations, query]);

  const openChat = (conversation: ConversationListItem) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: conversation.conversation_id,
        name: conversation.display_name,
      },
    });
  };

  const openDiscovery = () => {
    router.push('/search');
  };

  const renderContent = () => {
    if (isLoading && conversations.length === 0) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Loading conversations…</AppText>
        </View>
      );
    }

    if (error && conversations.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' }}
            title="Chats unavailable"
            description={error}
          />
          <View style={styles.actionWidth}>
            <AppButton label="Try again" variant="secondary" onPress={() => void loadConversations('load')} />
          </View>
        </View>
      );
    }

    if (conversations.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'message.badge', android: 'chat_bubble', web: 'chat_bubble' }}
            title="No conversations yet"
            description="Find someone on PulseChat and start your first direct conversation."
          />
          <View style={styles.actionWidth}>
            <AppButton
              label="Find people"
              icon={{ ios: 'person.badge.plus', android: 'person_search', web: 'person_search' }}
              onPress={openDiscovery}
            />
          </View>
        </View>
      );
    }

    if (visibleConversations.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
            title="No matching chats"
            description="Try another name or username."
          />
        </View>
      );
    }

    return (
      <FlatList
        data={visibleConversations}
        keyExtractor={(item) => item.conversation_id}
        renderItem={({ item }) => (
          <ChatRow chat={toChatRow(item, user?.id)} onPress={() => openChat(item)} />
        )}
        refreshControl={(
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadConversations('refresh')}
            tintColor={theme.colors.primary}
          />
        )}
        contentContainerStyle={styles.listContent}
        style={[styles.list, { backgroundColor: theme.colors.surface }]}
        showsVerticalScrollIndicator={false}
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View>
          <AppText variant="title">PulseChat</AppText>
          <AppText variant="caption" tone="secondary">
            {conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0) > 0
              ? `${conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0)} unread`
              : (conversations.length === 1 ? '1 conversation' : `${conversations.length} conversations`)}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new conversation"
          onPress={openDiscovery}
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
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {error && conversations.length > 0 ? (
        <View style={[styles.inlineError, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppText variant="caption" tone="danger">{error}</AppText>
        </View>
      ) : null}

      <View style={styles.content}>{renderContent()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  inlineError: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  content: { flex: 1 },
  list: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  listContent: { paddingTop: 4, paddingBottom: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 70, gap: 18 },
  actionWidth: { width: '100%', maxWidth: 280 },
});

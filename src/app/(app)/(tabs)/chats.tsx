import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, ChatRow, type ChatRowModel, EmptyState, SearchBar } from '@/components/ui';
import {
  CHAT_LIST_INITIAL_RENDER,
  CHAT_LIST_MAX_TO_RENDER_PER_BATCH,
  CHAT_LIST_UPDATE_BATCH_MS,
  CHAT_LIST_WINDOW_SIZE,
} from '@/config/performance-config';
import { useAuth } from '@/hooks/use-auth';
import { useConnectivity } from '@/hooks/use-connectivity';
import { getGroupAvatarPublicUrl } from '@/services/group-service';
import { cacheConversationList, loadCachedConversationList } from '@/services/offline-cache-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { listMyConversations } from '@/services/conversation-service';
import { subscribeToConversationActivity } from '@/services/conversation-events';
import { useAppTheme } from '@/theme';
import type { ConversationListItem } from '@/types/conversation';

const conversationClockFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const conversationWeekdayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const conversationDateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

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
    return conversationClockFormatter.format(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();

  if (isYesterday) return 'Yesterday';

  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? conversationWeekdayFormatter : conversationDateFormatter).format(date);
}

function toChatRow(item: ConversationListItem, currentUserId: string | undefined): ChatRowModel {
  const hasLastMessage = Boolean(item.last_message_created_at);

  return {
    id: item.conversation_id,
    name: item.display_name,
    avatarUri: item.kind === 'group'
      ? getGroupAvatarPublicUrl(item.avatar_path)
      : getAvatarPublicUrl(item.avatar_path),
    preview: item.kind === 'group' && item.last_message_sender_id !== currentUserId && item.last_message_sender_name
      ? `${item.last_message_sender_name}: ${item.last_message_preview ?? 'Message'}`
      : (item.last_message_preview ?? 'No messages yet — say hello.'),
    time: formatConversationTime(item.last_message_created_at ?? item.last_activity_at),
    sentByMe: hasLastMessage && item.last_message_sender_id === currentUserId,
    unread: item.unread_count ?? 0,
  };
}

export default function ChatsScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const userId = user?.id;
  const { isOnline } = useConnectivity();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShowingCached, setIsShowingCached] = useState(false);
  const wasOnlineRef = useRef(isOnline);
  const mountedRef = useRef(true);
  const loadSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      loadSequenceRef.current += 1;
    };
  }, []);

  const loadConversations = useCallback(async (mode: 'load' | 'refresh' | 'background' = 'load') => {
    const requestSequence = ++loadSequenceRef.current;
    const isLatestRequest = () => (
      mountedRef.current && loadSequenceRef.current === requestSequence
    );

    if (mode === 'load') setIsLoading(true);
    if (mode === 'refresh') setIsRefreshing(true);
    setError(null);

    if (!isOnline && userId) {
      const cached = await loadCachedConversationList(userId);
      if (!isLatestRequest()) return;
      if (cached?.data?.length) {
        setConversations(cached.data);
        setIsShowingCached(true);
        setError('Offline — showing conversations saved on this device.');
      } else {
        setError('You are offline and no saved conversations are available yet.');
      }
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      const data = await listMyConversations();
      if (!isLatestRequest()) return;
      setConversations(data);
      setIsShowingCached(false);
      if (userId) void cacheConversationList(userId, data);
    } catch (loadError) {
      console.warn('Unable to load conversations:', loadError);
      const cached = userId ? await loadCachedConversationList(userId) : null;
      if (!isLatestRequest()) return;
      if (cached?.data?.length) {
        setConversations(cached.data);
        setIsShowingCached(true);
        setError('Offline — showing conversations saved on this device.');
      } else {
        setError('Unable to load your conversations right now.');
      }
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [isOnline, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadConversations('load');
    }, [loadConversations]),
  );

  useEffect(() => subscribeToConversationActivity(() => {
    void loadConversations('background');
  }), [loadConversations]);

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) void loadConversations('background');
  }, [isOnline, loadConversations]);

  const chatRows = useMemo(() => {
    const rows = new Map<string, ChatRowModel>();
    conversations.forEach((conversation) => {
      rows.set(conversation.conversation_id, toChatRow(conversation, userId));
    });
    return rows;
  }, [conversations, userId]);

  const unreadCount = useMemo(
    () => conversations.reduce((sum, item) => sum + (item.unread_count ?? 0), 0),
    [conversations],
  );

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return conversations;

    return conversations.filter((conversation) => {
      const name = conversation.display_name.toLowerCase();
      const username = conversation.username?.toLowerCase() ?? '';
      return name.includes(normalized) || username.includes(normalized);
    });
  }, [conversations, query]);

  const openChat = useCallback((conversation: ConversationListItem) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: conversation.conversation_id,
        name: conversation.display_name,
      },
    });
  }, []);

  const openDiscovery = useCallback(() => {
    router.push('/search');
  }, []);

  const openGroupCreator = useCallback(() => {
    router.push('/groups/new');
  }, []);

  const renderChatItem = useCallback(({ item }: { item: ConversationListItem }) => {
    const row = chatRows.get(item.conversation_id);
    if (!row) return null;
    return <ChatRow chat={row} onPress={() => openChat(item)} />;
  }, [chatRows, openChat]);

  const renderContent = () => {
    if (isLoading && conversations.length === 0) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator accessibilityLabel="Loading conversations" accessibilityRole="progressbar" size="large" color={theme.colors.primary} />
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
        renderItem={renderChatItem}
        initialNumToRender={CHAT_LIST_INITIAL_RENDER}
        maxToRenderPerBatch={CHAT_LIST_MAX_TO_RENDER_PER_BATCH}
        updateCellsBatchingPeriod={CHAT_LIST_UPDATE_BATCH_MS}
        windowSize={CHAT_LIST_WINDOW_SIZE}
        removeClippedSubviews={Platform.OS !== 'web'}
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
            {unreadCount > 0
              ? `${unreadCount} unread`
              : (conversations.length === 1 ? '1 conversation' : `${conversations.length} conversations`)}
          </AppText>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Create group"
            onPress={openGroupCreator}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.primarySoft },
            ]}>
            <AppIcon
              name={{ ios: 'person.3.fill', android: 'group_add', web: 'group_add' }}
              size={22}
              color={theme.colors.primary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start a new direct conversation"
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
        <View accessibilityLiveRegion="polite" accessibilityRole="alert" style={[styles.inlineError, { backgroundColor: theme.colors.surfaceMuted }]}> 
          <AppText variant="caption" tone={isShowingCached ? 'secondary' : 'danger'}>{error}</AppText>
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 12 },
  inlineError: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  content: { flex: 1 },
  list: { flex: 1, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  listContent: { paddingTop: 4, paddingBottom: 12 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 70, gap: 18 },
  actionWidth: { width: '100%', maxWidth: 280 },
});

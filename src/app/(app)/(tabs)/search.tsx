import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  AppText,
  ChatRow,
  type ChatRowModel,
  EmptyState,
  MessageSearchRow,
  SearchBar,
  UserRow,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { getGroupAvatarPublicUrl } from '@/services/group-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import {
  GLOBAL_SEARCH_MIN_LENGTH,
  MESSAGE_SEARCH_PAGE_SIZE,
  searchMyConversations,
  searchMyMessages,
} from '@/services/search-service';
import { searchUsers } from '@/services/user-discovery-service';
import { useAppTheme } from '@/theme';
import type { PublicUserProfile } from '@/types/user-discovery';
import type {
  ConversationSearchResult,
  GlobalSearchSection,
  MessageSearchResult,
} from '@/types/search';

const SEARCH_DEBOUNCE_MS = 320;
const SECTION_PREVIEW_LIMIT = 5;

function formatConversationTime(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function toChatRow(item: ConversationSearchResult, currentUserId: string | undefined): ChatRowModel {
  return {
    id: item.conversation_id,
    name: item.display_name,
    avatarUri: item.kind === 'group'
      ? getGroupAvatarPublicUrl(item.avatar_path)
      : getAvatarPublicUrl(item.avatar_path),
    preview: item.kind === 'group' && item.last_message_sender_id !== currentUserId && item.last_message_sender_name
      ? `${item.last_message_sender_name}: ${item.last_message_preview ?? 'Message'}`
      : (item.last_message_preview ?? 'No messages yet'),
    time: formatConversationTime(item.last_message_created_at ?? item.last_activity_at),
    sentByMe: Boolean(item.last_message_created_at && item.last_message_sender_id === currentUserId),
    unread: item.unread_count ?? 0,
  };
}

const sectionOptions: Array<{ key: GlobalSearchSection; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'people', label: 'People' },
  { key: 'chats', label: 'Chats' },
  { key: 'messages', label: 'Messages' },
];

export default function SearchScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [section, setSection] = useState<GlobalSearchSection>('all');
  const [people, setPeople] = useState<PublicUserProfile[]>([]);
  const [chats, setChats] = useState<ConversationSearchResult[]>([]);
  const [messages, setMessages] = useState<MessageSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestSequence = useRef(0);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= GLOBAL_SEARCH_MIN_LENGTH;

  useEffect(() => {
    requestSequence.current += 1;
    if (trimmedQuery.length >= GLOBAL_SEARCH_MIN_LENGTH) setIsSearching(true);

    const timer = setTimeout(() => setDebouncedQuery(trimmedQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  useEffect(() => {
    const requestId = ++requestSequence.current;

    if (debouncedQuery.length < GLOBAL_SEARCH_MIN_LENGTH) {
      setPeople([]);
      setChats([]);
      setMessages([]);
      setHasMoreMessages(false);
      setError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    void Promise.allSettled([
      searchUsers(debouncedQuery),
      searchMyConversations(debouncedQuery, 12),
      searchMyMessages(debouncedQuery, null, MESSAGE_SEARCH_PAGE_SIZE),
    ]).then(([peopleResult, chatResult, messageResult]) => {
      if (requestId !== requestSequence.current) return;

      const failures = [peopleResult, chatResult, messageResult].filter((result) => result.status === 'rejected').length;
      setPeople(peopleResult.status === 'fulfilled' ? peopleResult.value : []);
      setChats(chatResult.status === 'fulfilled' ? chatResult.value : []);
      const nextMessages = messageResult.status === 'fulfilled' ? messageResult.value : [];
      setMessages(nextMessages);
      setHasMoreMessages(nextMessages.length >= MESSAGE_SEARCH_PAGE_SIZE);

      if (failures === 3) {
        setError('Search is unavailable right now. Check your connection and try again.');
      } else if (failures > 0) {
        setError('Some search results could not be loaded. You can retry.');
      }
    }).finally(() => {
      if (requestId === requestSequence.current) setIsSearching(false);
    });
  }, [debouncedQuery, retryNonce]);

  const totalResults = people.length + chats.length + messages.length;

  const visiblePeople = section === 'all' ? people.slice(0, SECTION_PREVIEW_LIMIT) : people;
  const visibleChats = section === 'all' ? chats.slice(0, SECTION_PREVIEW_LIMIT) : chats;
  const visibleMessages = section === 'all' ? messages.slice(0, SECTION_PREVIEW_LIMIT) : messages;

  const resultCounts = useMemo(() => ({
    people: people.length,
    chats: chats.length,
    messages: messages.length,
  }), [chats.length, messages.length, people.length]);

  const openUser = (profile: PublicUserProfile) => {
    router.push({ pathname: '/users/[userId]', params: { userId: profile.id } });
  };

  const openChat = (chat: ConversationSearchResult) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: { conversationId: chat.conversation_id, name: chat.display_name },
    });
  };

  const openMessage = (message: MessageSearchResult) => {
    router.push({
      pathname: '/chat/[conversationId]',
      params: {
        conversationId: message.conversation_id,
        name: message.conversation_display_name,
        focusMessageId: message.message_id,
      },
    });
  };

  const loadMoreMessages = async () => {
    if (isLoadingMore || !hasMoreMessages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    setIsLoadingMore(true);
    try {
      const nextPage = await searchMyMessages(debouncedQuery, {
        createdAt: last.created_at,
        id: last.message_id,
      });
      setMessages((current) => {
        const known = new Set(current.map((item) => item.message_id));
        return [...current, ...nextPage.filter((item) => !known.has(item.message_id))];
      });
      setHasMoreMessages(nextPage.length >= MESSAGE_SEARCH_PAGE_SIZE);
    } catch (loadError) {
      console.warn('Unable to load more message search results:', loadError);
      setError('Unable to load more message results right now.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const sectionHeader = (title: string, count: number, target: GlobalSearchSection) => (
    <View style={styles.sectionHeader}>
      <AppText variant="captionStrong" tone="secondary">{title.toUpperCase()}</AppText>
      {section === 'all' && count > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setSection(target)} hitSlop={8}>
          <AppText variant="captionStrong" tone="primary">See all {count}</AppText>
        </Pressable>
      ) : (
        <AppText variant="micro" tone="tertiary">{count} result{count === 1 ? '' : 's'}</AppText>
      )}
    </View>
  );

  const renderResults = () => {
    if (!canSearch) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            title="Search PulseChat"
            description="Find people, conversations and messages. Enter at least 2 characters."
          />
        </View>
      );
    }

    if (isSearching) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Searching your PulseChat…</AppText>
        </View>
      );
    }

    if (error && totalResults === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' }}
            title="Search unavailable"
            description={error}
          />
          <View style={styles.retryButton}>
            <AppButton label="Try again" variant="secondary" onPress={() => setRetryNonce((value) => value + 1)} />
          </View>
        </View>
      );
    }

    const selectedCount = section === 'all'
      ? totalResults
      : section === 'people'
        ? people.length
        : section === 'chats'
          ? chats.length
          : messages.length;

    if (selectedCount === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'magnifyingglass', android: 'search_off', web: 'search_off' }}
            title="No results"
            description={`Nothing in ${section === 'all' ? 'PulseChat' : section} matches “${trimmedQuery}”.`}
          />
        </View>
      );
    }

    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContent}>
        {error ? (
          <Pressable
            onPress={() => setRetryNonce((value) => value + 1)}
            style={[styles.partialError, { backgroundColor: theme.colors.surfaceMuted }]}>
            <AppText variant="micro" tone="danger">{error} Tap to retry.</AppText>
          </Pressable>
        ) : null}

        {(section === 'all' || section === 'people') && visiblePeople.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            {sectionHeader('People', resultCounts.people, 'people')}
            {visiblePeople.map((profile) => (
              <UserRow key={profile.id} user={profile} onPress={() => openUser(profile)} />
            ))}
          </View>
        ) : null}

        {(section === 'all' || section === 'chats') && visibleChats.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            {sectionHeader('Chats', resultCounts.chats, 'chats')}
            {visibleChats.map((chat) => (
              <ChatRow key={chat.conversation_id} chat={toChatRow(chat, user?.id)} onPress={() => openChat(chat)} />
            ))}
          </View>
        ) : null}

        {(section === 'all' || section === 'messages') && visibleMessages.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
            {sectionHeader('Messages', resultCounts.messages, 'messages')}
            {visibleMessages.map((message) => (
              <MessageSearchRow
                key={message.message_id}
                query={debouncedQuery}
                result={{
                  id: message.message_id,
                  conversationName: message.conversation_display_name,
                  conversationAvatarUri: message.conversation_kind === 'group'
                    ? getGroupAvatarPublicUrl(message.conversation_avatar_path)
                    : getAvatarPublicUrl(message.conversation_avatar_path),
                  senderLabel: message.sender_id === user?.id ? 'You' : (message.sender_display_name ?? 'PulseChat user'),
                  snippet: message.match_snippet,
                  createdAt: message.created_at,
                  messageType: message.message_type,
                }}
                onPress={() => openMessage(message)}
              />
            ))}
            {section === 'messages' && hasMoreMessages ? (
              <View style={styles.loadMoreWrap}>
                <AppButton
                  label={isLoadingMore ? 'Loading…' : 'Load more messages'}
                  variant="secondary"
                  disabled={isLoadingMore}
                  onPress={() => void loadMoreMessages()}
                />
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <AppText variant="title">Search</AppText>
        <AppText variant="caption" tone="secondary">People, chats and messages</AppText>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search PulseChat"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={100}
          returnKeyType="search"
        />
      </View>

      <View style={styles.segmentWrap}>
        {sectionOptions.map((option) => {
          const active = section === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              onPress={() => setSection(option.key)}
              style={[
                styles.segment,
                { backgroundColor: active ? theme.colors.primary : theme.colors.surfaceMuted },
              ]}>
              <AppText variant="captionStrong" tone={active ? 'inverse' : 'secondary'}>{option.label}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>{renderResults()}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, gap: 2 },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  segmentWrap: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, gap: 7 },
  segment: { flex: 1, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  body: { flex: 1 },
  resultsContent: { paddingBottom: 32, gap: 12 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionHeader: {
    minHeight: 42,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingBottom: 70, gap: 18 },
  retryButton: { width: '100%', maxWidth: 260 },
  partialError: { marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  loadMoreWrap: { paddingHorizontal: 16, paddingVertical: 14 },
});

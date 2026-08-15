import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppIcon, AppText, Avatar, EmptyState, MessageBubble } from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { MAX_TEXT_MESSAGE_LENGTH } from '@/services/message-service';
import { getConversationSummary } from '@/services/conversation-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { useAppTheme } from '@/theme';
import type { ConversationSummary } from '@/types/conversation';
import type { ChatMessage } from '@/types/message';

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function ConversationScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    name?: string | string[];
  }>();

  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const fallbackName = Array.isArray(params.name) ? params.name[0] : params.name;

  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const {
    messages,
    isInitialLoading,
    isLoadingOlder,
    hasMore,
    loadError,
    realtimeState,
    reload,
    loadOlder,
    queueTextMessage,
    retryMessage,
  } = useConversationMessages(conversationId, user?.id);

  const loadSummary = useCallback(async () => {
    if (!conversationId) {
      setSummaryError('This conversation link is invalid.');
      setIsLoadingSummary(false);
      return;
    }

    setIsLoadingSummary(true);
    setSummaryError(null);

    try {
      const data = await getConversationSummary(conversationId);
      setSummary(data);
      if (!data) setSummaryError('This conversation is unavailable or you are no longer a member.');
    } catch (loadSummaryError) {
      console.warn('Unable to load conversation:', loadSummaryError);
      setSummaryError('Unable to load this conversation right now.');
    } finally {
      setIsLoadingSummary(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const name = summary?.display_name ?? fallbackName ?? 'Conversation';
  const avatarUri = getAvatarPublicUrl(summary?.avatar_path);
  const canSend = Boolean(summary && user?.id && draft.trim().length > 0);

  const headerSubtitle = useMemo(() => {
    if (realtimeState !== 'connected') return 'Reconnecting…';
    if (summary?.username) return `@${summary.username}`;
    return summary?.kind === 'group' ? 'group' : 'direct chat';
  }, [realtimeState, summary?.kind, summary?.username]);

  const sendDraft = () => {
    if (!canSend) return;

    const accepted = queueTextMessage(draft);
    if (accepted) setDraft('');
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const outgoing = item.sender_id === user?.id;
    const body = item.deleted_at ? 'Message deleted' : (item.body ?? '');

    return (
      <View style={styles.messageRow}>
        <MessageBubble
          text={body}
          time={formatMessageTime(item.created_at)}
          outgoing={outgoing}
          status={outgoing ? (item.localState ?? 'sent') : undefined}
          onRetry={item.localState === 'failed'
            ? () => retryMessage(item.client_message_id)
            : undefined}
        />
      </View>
    );
  };

  const renderMessages = () => {
    if (isInitialLoading && messages.length === 0) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Loading messages…</AppText>
        </View>
      );
    }

    if (loadError && messages.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'wifi.exclamationmark', android: 'wifi_off', web: 'wifi_off' }}
            title="Messages unavailable"
            description={loadError}
          />
          <View style={styles.actionWidth}>
            <AppButton label="Try again" variant="secondary" onPress={() => void reload()} />
          </View>
        </View>
      );
    }

    if (messages.length === 0) {
      return (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'message', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }}
            title={`Message ${summary?.display_name ?? name}`}
            description="Send the first message. It will be stored in PostgreSQL and delivered live through a private Realtime channel."
          />
        </View>
      );
    }

    return (
      <FlatList
        data={messages}
        inverted
        keyExtractor={(item) => `${item.id}:${item.client_message_id}`}
        renderItem={renderMessage}
        onEndReached={() => {
          if (hasMore) void loadOlder();
        }}
        onEndReachedThreshold={0.35}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={isLoadingOlder ? (
          <View style={styles.paginationLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
      />
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
      edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to chats"
          hitSlop={10}
          onPress={() => router.back()}
          style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }}
            size={24}
            color={theme.colors.primary}
          />
        </Pressable>
        <Avatar name={name} uri={avatarUri} size={38} />
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          <View style={styles.subtitleRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: realtimeState === 'connected' ? theme.colors.online : theme.colors.warning },
              ]}
            />
            <AppText variant="micro" tone="secondary">{headerSubtitle}</AppText>
          </View>
        </View>
        <Pressable accessibilityLabel="Conversation options" hitSlop={10} style={styles.roundButton}>
          <AppIcon
            name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }}
            size={22}
            color={theme.colors.textSecondary}
          />
        </Pressable>
      </View>

      {isLoadingSummary ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <AppText variant="caption" tone="secondary">Opening conversation…</AppText>
        </View>
      ) : summaryError || !summary ? (
        <View style={styles.centerState}>
          <EmptyState
            icon={{ ios: 'exclamationmark.bubble', android: 'chat_error', web: 'chat_error' }}
            title="Conversation unavailable"
            description={summaryError ?? 'This conversation is unavailable.'}
          />
          <View style={styles.actionWidth}>
            <AppButton label="Try again" variant="secondary" onPress={() => void loadSummary()} />
          </View>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatBody}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.messages}>{renderMessages()}</View>

          {loadError && messages.length > 0 ? (
            <View style={[styles.inlineError, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppText variant="micro" tone="danger">{loadError}</AppText>
            </View>
          ) : null}

          <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <Pressable
              disabled
              accessibilityLabel="Attachments arrive in Phase 12"
              style={[styles.iconButton, { backgroundColor: theme.colors.surfaceMuted, opacity: 0.55 }]}>
              <AppIcon
                name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }}
                size={22}
                color={theme.colors.textTertiary}
              />
            </Pressable>

            <View style={[styles.inputShell, { backgroundColor: theme.colors.surfaceMuted }]}>
              <TextInput
                multiline
                value={draft}
                onChangeText={setDraft}
                maxLength={MAX_TEXT_MESSAGE_LENGTH}
                placeholder="Message"
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.input, theme.typography.body, { color: theme.colors.text }]}
                accessibilityLabel="Message"
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!canSend}
              onPress={sendDraft}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: canSend ? theme.colors.primary : theme.colors.surfaceMuted,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}>
              <AppIcon
                name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }}
                size={21}
                color={canSend ? '#FFFFFF' : theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 9,
  },
  roundButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  chatBody: { flex: 1 },
  messages: { flex: 1 },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingBottom: 40,
    gap: 18,
  },
  actionWidth: { width: '100%', maxWidth: 260 },
  messageListContent: { paddingHorizontal: 12, paddingVertical: 14 },
  messageRow: { paddingVertical: 3 },
  paginationLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  inlineError: { marginHorizontal: 10, marginBottom: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  inputShell: {
    flex: 1,
    minHeight: 44,
    maxHeight: 128,
    borderRadius: 22,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  input: { minHeight: 42, maxHeight: 116, paddingTop: 10, paddingBottom: 9, textAlignVertical: 'center' },
  sendButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});

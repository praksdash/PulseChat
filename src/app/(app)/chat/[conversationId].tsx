import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AppButton,
  AppIcon,
  AppText,
  AttachmentPickerModal,
  Avatar,
  EmptyState,
  MediaMessageBubble,
  MediaViewer,
  MessageActionsModal,
  MessageBubble,
} from '@/components/ui';
import { useAuth } from '@/hooks/use-auth';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { usePeerPresence } from '@/hooks/use-peer-presence';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { getConversationSummary } from '@/services/conversation-service';
import { chooseChatImageFromLibrary, takeChatPhoto } from '@/services/media-service';
import { MAX_TEXT_MESSAGE_LENGTH } from '@/services/message-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { useAppTheme } from '@/theme';
import type { ConversationSummary } from '@/types/conversation';
import type { ChatMessage, ReplyPreview, SupportedReaction } from '@/types/message';

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatLastSeen(iso: string | null) {
  if (!iso) return 'offline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'offline';

  const now = new Date();
  const differenceMs = now.getTime() - date.getTime();
  if (differenceMs >= 0 && differenceMs < 60_000) return 'last seen just now';

  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  if (date.toDateString() === now.toDateString()) return `last seen at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;

  const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  return `last seen ${day} at ${time}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function getReplyText(reply: ReplyPreview | ChatMessage | null | undefined) {
  if (!reply) return 'Message';
  const deletedAt = 'deleted_at' in reply ? reply.deleted_at : reply.deletedAt;
  const messageType = 'message_type' in reply ? reply.message_type : reply.messageType;
  if (deletedAt) return 'Message deleted';
  if (messageType === 'image') return 'Photo';

  const body = reply.body;
  return body?.trim() || 'Message';
}

export default function ConversationScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    name?: string | string[];
  }>();

  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const fallbackName = Array.isArray(params.name) ? params.name[0] : params.name;

  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ uri: string; caption: string | null } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const {
    messages,
    isInitialLoading,
    isLoadingOlder,
    hasMore,
    loadError,
    actionError,
    realtimeState,
    reload,
    loadOlder,
    queueTextMessage,
    queueImageMessage,
    retryMessage,
    editMessageContent,
    deleteMessageForEveryone,
    toggleReaction,
    clearActionError,
  } = useConversationMessages(conversationId, user?.id);

  const isDirectConversation = summary?.kind === 'direct';
  const peerPresence = usePeerPresence(
    isDirectConversation ? summary?.peer_user_id : undefined,
    Boolean(isDirectConversation),
  );
  const { peerTyping, updateTyping, stopTyping } = useTypingIndicator({
    conversationId,
    currentUserId: user?.id,
    enabled: Boolean(isDirectConversation),
  });

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
    } catch (error) {
      console.warn('Unable to load conversation:', error);
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
  const normalizedDraft = draft.trim();
  const originalEditBody = editingMessage?.body?.trim() ?? '';
  const canSaveEdit = Boolean(
    editingMessage
    && user?.id
    && normalizedDraft !== originalEditBody
    && (editingMessage.message_type === 'image' || normalizedDraft.length > 0),
  );
  const canSend = editingMessage
    ? canSaveEdit
    : Boolean(summary && user?.id && normalizedDraft.length > 0);
  const canAttach = Boolean(summary && user?.id && !editingMessage);

  const headerSubtitle = useMemo(() => {
    if (realtimeState !== 'connected') return 'Reconnecting…';
    if (isDirectConversation && peerTyping) return 'typing…';
    if (isDirectConversation && peerPresence.online) return 'online';
    if (isDirectConversation) return formatLastSeen(peerPresence.lastSeenAt);
    return summary?.kind === 'group' ? 'group' : (summary?.username ? `@${summary.username}` : 'direct chat');
  }, [
    isDirectConversation,
    peerPresence.lastSeenAt,
    peerPresence.online,
    peerTyping,
    realtimeState,
    summary?.kind,
    summary?.username,
  ]);

  const finishComposerContext = () => {
    setReplyTarget(null);
    setEditingMessage(null);
  };

  const sendDraft = async () => {
    if (!canSend) return;
    stopTyping();
    clearActionError();

    if (editingMessage) {
      const saved = await editMessageContent(editingMessage.id, draft);
      if (saved) {
        setDraft('');
        setEditingMessage(null);
      }
      return;
    }

    const accepted = queueTextMessage(draft, replyTarget);
    if (accepted) {
      setDraft('');
      setReplyTarget(null);
    }
  };

  const choosePhoto = async () => {
    setAttachmentMenuVisible(false);
    setMediaError(null);
    stopTyping();

    try {
      const asset = await chooseChatImageFromLibrary();
      if (asset && queueImageMessage(asset, replyTarget)) setReplyTarget(null);
    } catch (error) {
      setMediaError(getErrorMessage(error));
    }
  };

  const takePhoto = async () => {
    setAttachmentMenuVisible(false);
    setMediaError(null);
    stopTyping();

    try {
      const asset = await takeChatPhoto();
      if (asset && queueImageMessage(asset, replyTarget)) setReplyTarget(null);
    } catch (error) {
      setMediaError(getErrorMessage(error));
    }
  };

  const openMessageActions = (message: ChatMessage) => {
    if (message.isOptimistic || message.deleted_at || message.localState === 'failed') return;
    clearActionError();
    setSelectedMessage(message);
  };

  const startReply = () => {
    if (!selectedMessage) return;
    setReplyTarget(selectedMessage);
    setEditingMessage(null);
    setSelectedMessage(null);
  };

  const startEdit = () => {
    if (!selectedMessage || selectedMessage.sender_id !== user?.id) return;
    if (selectedMessage.message_type !== 'text' && selectedMessage.message_type !== 'image') return;
    setEditingMessage(selectedMessage);
    setReplyTarget(null);
    setDraft(selectedMessage.body ?? '');
    setSelectedMessage(null);
  };

  const performDelete = async (target: ChatMessage) => {
    if (isDeletingMessage) return;

    setIsDeletingMessage(true);
    clearActionError();
    try {
      const deleted = await deleteMessageForEveryone(target.id);
      if (!deleted) return;

      if (replyTarget?.id === target.id) setReplyTarget(null);
      if (editingMessage?.id === target.id) {
        setEditingMessage(null);
        setDraft('');
      }
    } finally {
      setIsDeletingMessage(false);
    }
  };

  const confirmDelete = () => {
    const target = selectedMessage;
    setSelectedMessage(null);
    if (!target || target.sender_id !== user?.id || isDeletingMessage) return;

    const title = 'Delete message?';
    const message = 'This message will be removed for everyone in this conversation.';

    if (Platform.OS === 'web') {
      const browserConfirm = (globalThis as typeof globalThis & { confirm?: (value?: string) => boolean }).confirm;
      if (typeof browserConfirm === 'function' && browserConfirm(`${title}\n\n${message}`)) {
        void performDelete(target);
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void performDelete(target) },
    ]);
  };

  const reactFromActions = (emoji: SupportedReaction) => {
    const target = selectedMessage;
    setSelectedMessage(null);
    if (target) void toggleReaction(target.id, emoji);
  };

  const replyLabel = (reply: ReplyPreview | null | undefined) => {
    if (!reply) return null;
    if (reply.senderId === user?.id) return 'You';
    return name;
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const outgoing = item.sender_id === user?.id;
    const repliedToLabel = replyLabel(item.replyPreview);
    const repliedToText = item.replyPreview ? getReplyText(item.replyPreview) : null;

    if (item.deleted_at) {
      return (
        <View style={styles.messageRow}>
          <MessageBubble
            text="Message deleted"
            time={formatMessageTime(item.created_at)}
            outgoing={outgoing}
            status={outgoing ? (item.localState ?? 'sent') : undefined}
          />
        </View>
      );
    }

    if (item.message_type === 'image') {
      const mediaUri = item.attachment?.signedUrl ?? item.localMediaUri ?? null;
      const width = item.attachment?.width ?? item.pendingImageAsset?.width ?? null;
      const height = item.attachment?.height ?? item.pendingImageAsset?.height ?? null;

      return (
        <View style={styles.messageRow}>
          <MediaMessageBubble
            uri={mediaUri}
            width={width}
            height={height}
            caption={item.body}
            time={formatMessageTime(item.created_at)}
            outgoing={outgoing}
            status={outgoing ? (item.localState ?? 'sent') : undefined}
            mediaStage={item.mediaSendStage}
            edited={Boolean(item.edited_at)}
            replySenderLabel={repliedToLabel}
            replyText={repliedToText}
            reactions={item.reactions}
            myReaction={item.myReaction}
            onReactionPress={(emoji) => void toggleReaction(item.id, emoji)}
            onLongPress={() => openMessageActions(item)}
            onOpen={mediaUri ? () => setViewer({ uri: mediaUri, caption: item.body }) : undefined}
            onRetry={item.localState === 'failed' ? () => retryMessage(item.client_message_id) : undefined}
          />
        </View>
      );
    }

    const body = item.body ?? (item.message_type === 'file' ? 'File' : 'Message');
    return (
      <View style={styles.messageRow}>
        <MessageBubble
          text={body}
          time={formatMessageTime(item.created_at)}
          outgoing={outgoing}
          status={outgoing ? (item.localState ?? 'sent') : undefined}
          edited={Boolean(item.edited_at)}
          replySenderLabel={repliedToLabel}
          replyText={repliedToText}
          reactions={item.reactions}
          myReaction={item.myReaction}
          onReactionPress={(emoji) => void toggleReaction(item.id, emoji)}
          onLongPress={() => openMessageActions(item)}
          onRetry={item.localState === 'failed' ? () => retryMessage(item.client_message_id) : undefined}
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
            description="Send text or a photo. Long-press a delivered message to reply, edit, delete or react."
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

  const contextMessage = editingMessage ?? replyTarget;
  const contextTitle = editingMessage
    ? (editingMessage.message_type === 'image' ? 'Edit photo caption' : 'Edit message')
    : replyTarget
      ? `Replying to ${replyTarget.sender_id === user?.id ? 'yourself' : name}`
      : null;
  const contextText = contextMessage ? getReplyText(contextMessage) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" hitSlop={10} onPress={() => router.back()} style={styles.roundButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} color={theme.colors.primary} />
        </Pressable>
        <Avatar name={name} uri={avatarUri} size={38} online={isDirectConversation && peerPresence.online} />
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          <View style={styles.subtitleRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: realtimeState !== 'connected'
                    ? theme.colors.warning
                    : (isDirectConversation && peerPresence.online ? theme.colors.online : theme.colors.textTertiary),
                },
              ]}
            />
            <AppText variant="micro" tone="secondary">{headerSubtitle}</AppText>
          </View>
        </View>
        <Pressable accessibilityLabel="Conversation options" hitSlop={10} style={styles.roundButton}>
          <AppIcon name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={22} color={theme.colors.textSecondary} />
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
        <KeyboardAvoidingView style={styles.chatBody} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.messages}>{renderMessages()}</View>

          {(loadError && messages.length > 0) || mediaError || actionError ? (
            <Pressable
              onPress={() => {
                setMediaError(null);
                clearActionError();
              }}
              style={[styles.inlineError, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppText variant="micro" tone="danger">{actionError ?? mediaError ?? loadError}</AppText>
            </Pressable>
          ) : null}

          {contextTitle && contextText ? (
            <View style={[styles.composerContext, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
              <View style={[styles.contextAccent, { backgroundColor: theme.colors.primary }]} />
              <View style={styles.contextCopy}>
                <AppText variant="captionStrong" style={{ color: theme.colors.primary }}>{contextTitle}</AppText>
                <AppText variant="caption" tone="secondary" numberOfLines={1}>{contextText}</AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply or edit"
                hitSlop={8}
                onPress={() => {
                  finishComposerContext();
                  if (editingMessage) setDraft('');
                }}
                style={styles.contextClose}>
                <AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={19} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}

          <View style={[styles.composer, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
            <Pressable
              accessibilityRole="button"
              disabled={!canAttach}
              accessibilityLabel="Attach photo"
              onPress={() => {
                setMediaError(null);
                setAttachmentMenuVisible(true);
              }}
              style={({ pressed }) => [
                styles.iconButton,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  opacity: !canAttach ? 0.5 : (pressed ? 0.72 : 1),
                },
              ]}>
              <AppIcon name={{ ios: 'paperclip', android: 'attach_file', web: 'attach_file' }} size={22} color={canAttach ? theme.colors.primary : theme.colors.textTertiary} />
            </Pressable>

            <View style={[styles.inputShell, { backgroundColor: theme.colors.surfaceMuted }]}>
              <TextInput
                multiline
                value={draft}
                onChangeText={(value) => {
                  setDraft(value);
                  if (!editingMessage) updateTyping(value);
                }}
                maxLength={editingMessage?.message_type === 'image' ? 1000 : MAX_TEXT_MESSAGE_LENGTH}
                placeholder={editingMessage ? 'Edit message' : 'Message'}
                placeholderTextColor={theme.colors.textTertiary}
                style={[styles.input, theme.typography.body, { color: theme.colors.text }]}
                accessibilityLabel={editingMessage ? 'Edit message' : 'Message'}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={editingMessage ? 'Save edit' : 'Send message'}
              disabled={!canSend}
              onPress={() => void sendDraft()}
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: canSend ? theme.colors.primary : theme.colors.surfaceMuted,
                  opacity: pressed ? 0.78 : 1,
                },
              ]}>
              <AppIcon
                name={editingMessage
                  ? { ios: 'checkmark', android: 'check', web: 'check' }
                  : { ios: 'paperplane.fill', android: 'send', web: 'send' }}
                size={21}
                color={canSend ? '#FFFFFF' : theme.colors.textTertiary}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      <AttachmentPickerModal
        visible={attachmentMenuVisible}
        onClose={() => setAttachmentMenuVisible(false)}
        onChoosePhoto={() => void choosePhoto()}
        onTakePhoto={() => void takePhoto()}
      />

      <MediaViewer visible={Boolean(viewer)} uri={viewer?.uri} caption={viewer?.caption} onClose={() => setViewer(null)} />

      <MessageActionsModal
        visible={Boolean(selectedMessage)}
        canEdit={Boolean(
          selectedMessage
          && selectedMessage.sender_id === user?.id
          && (selectedMessage.message_type === 'text' || selectedMessage.message_type === 'image'),
        )}
        canDelete={Boolean(selectedMessage && selectedMessage.sender_id === user?.id)}
        onClose={() => setSelectedMessage(null)}
        onReply={startReply}
        onEdit={startEdit}
        onDelete={confirmDelete}
        onReaction={reactFromActions}
      />
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
  composerContext: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 9,
  },
  contextAccent: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  contextCopy: { flex: 1, gap: 1 },
  contextClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
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

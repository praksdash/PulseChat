import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  ReportModal,
} from '@/components/ui';
import {
  MESSAGE_LIST_INITIAL_RENDER,
  MESSAGE_LIST_MAX_TO_RENDER_PER_BATCH,
  MESSAGE_LIST_UPDATE_BATCH_MS,
  MESSAGE_LIST_WINDOW_SIZE,
} from '@/config/performance-config';
import { useAuth } from '@/hooks/use-auth';
import { useConnectivity } from '@/hooks/use-connectivity';
import { useConversationMessages } from '@/hooks/use-conversation-messages';
import { usePeerPresence } from '@/hooks/use-peer-presence';
import { useTypingIndicator } from '@/hooks/use-typing-indicator';
import { getConversationSummary } from '@/services/conversation-service';
import { subscribeToGroupMembershipEvents } from '@/services/group-membership-events';
import { getGroupAvatarPublicUrl } from '@/services/group-service';
import { chooseChatImageFromLibrary, takeChatPhoto } from '@/services/media-service';
import { MAX_TEXT_MESSAGE_LENGTH } from '@/services/message-service';
import { cacheConversationSummary, loadCachedConversationSummary } from '@/services/offline-cache-service';
import { setActivePushConversation } from '@/services/push-notification-service';
import { getMyConversationNotificationState, setMyConversationMuted } from '@/services/settings-service';
import { getAvatarPublicUrl } from '@/services/profile-service';
import { getUserRelationshipState, reportUserOrMessage } from '@/services/privacy-service';
import { useAppTheme } from '@/theme';
import type { ConversationSummary } from '@/types/conversation';
import type { ChatMessage, ReplyPreview, SupportedReaction } from '@/types/message';
import type { ReportReason, UserRelationshipState } from '@/types/privacy';

const messageTimeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const lastSeenTimeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const lastSeenDayFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });

function formatMessageTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return messageTimeFormatter.format(date);
}

function formatLastSeen(iso: string | null) {
  if (!iso) return 'offline';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'offline';

  const now = new Date();
  const differenceMs = now.getTime() - date.getTime();
  if (differenceMs >= 0 && differenceMs < 60_000) return 'last seen just now';

  const time = lastSeenTimeFormatter.format(date);
  if (date.toDateString() === now.toDateString()) return `last seen at ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`;

  const day = lastSeenDayFormatter.format(date);
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
  const userId = user?.id;
  const { isOnline } = useConnectivity();
  const params = useLocalSearchParams<{
    conversationId?: string | string[];
    name?: string | string[];
    focusMessageId?: string | string[];
  }>();

  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const fallbackName = Array.isArray(params.name) ? params.name[0] : params.name;
  const requestedFocusMessageId = Array.isArray(params.focusMessageId) ? params.focusMessageId[0] : params.focusMessageId;

  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [attachmentMenuVisible, setAttachmentMenuVisible] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [muteError, setMuteError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isUpdatingMute, setIsUpdatingMute] = useState(false);
  const [viewer, setViewer] = useState<{ uri: string; caption: string | null } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [reportTarget, setReportTarget] = useState<ChatMessage | null>(null);
  const [relationship, setRelationship] = useState<UserRelationshipState | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(requestedFocusMessageId ?? null);
  const messageListRef = useRef<FlatList<ChatMessage> | null>(null);
  const wasOnlineRef = useRef(isOnline);
  const mountedRef = useRef(true);
  const summaryLoadSequenceRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      summaryLoadSequenceRef.current += 1;
    };
  }, []);

  const {
    messages,
    isInitialLoading,
    isLoadingOlder,
    hasMore,
    isSearchWindow,
    loadError,
    actionError,
    realtimeState,
    reload,
    loadOlder,
    loadMessageSearchWindow,
    exitMessageSearchWindow,
    queueTextMessage,
    queueImageMessage,
    retryMessage,
    editMessageContent,
    deleteMessageForEveryone,
    toggleReaction,
    clearActionError,
  } = useConversationMessages(conversationId, userId);

  const isDirectConversation = summary?.kind === 'direct';
  const directMessagingAvailable = !isDirectConversation
    || relationship?.messaging_available === true
    || (!isOnline && relationship === null);
  const canObservePeerActivity = Boolean(isDirectConversation && relationship?.can_view_activity);
  const peerPresence = usePeerPresence(
    isDirectConversation ? summary?.peer_user_id : undefined,
    canObservePeerActivity,
  );
  const { peerTyping, updateTyping, stopTyping } = useTypingIndicator({
    conversationId,
    currentUserId: userId,
    enabled: Boolean(isOnline && isDirectConversation && relationship?.messaging_available),
  });

  const loadSummary = useCallback(async () => {
    const requestSequence = ++summaryLoadSequenceRef.current;
    const isLatestRequest = () => (
      mountedRef.current && summaryLoadSequenceRef.current === requestSequence
    );

    if (!conversationId) {
      setSummaryError('This conversation link is invalid.');
      setIsLoadingSummary(false);
      return;
    }

    setIsLoadingSummary(true);
    setSummaryError(null);

    if (!isOnline) {
      const cached = userId ? await loadCachedConversationSummary(userId, conversationId) : null;
      if (!isLatestRequest()) return;
      if (cached?.data) {
        setSummary(cached.data);
        setRelationship(null);
        setSummaryError(null);
      } else {
        setSummaryError('You are offline and this conversation has not been saved on this device yet.');
      }
      setIsLoadingSummary(false);
      return;
    }

    try {
      const data = await getConversationSummary(conversationId);
      if (!isLatestRequest()) return;
      setSummary(data);
      if (!data) {
        setRelationship(null);
        setSummaryError('This conversation is unavailable or you are no longer a member.');
      } else {
        if (userId) void cacheConversationSummary(userId, conversationId, data);
        if (data.kind === 'direct' && data.peer_user_id) {
          try {
            const nextRelationship = await getUserRelationshipState(data.peer_user_id);
            if (isLatestRequest()) setRelationship(nextRelationship);
          } catch (relationshipError) {
            console.warn('Unable to load direct privacy state:', relationshipError);
            if (isLatestRequest()) setRelationship(null);
          }
        } else {
          setRelationship(null);
        }
      }
    } catch (error) {
      console.warn('Unable to load conversation:', error);
      const cached = userId ? await loadCachedConversationSummary(userId, conversationId) : null;
      if (!isLatestRequest()) return;
      if (cached?.data) {
        setSummary(cached.data);
        setRelationship(null);
        setSummaryError(null);
      } else {
        setSummaryError('Unable to load this conversation right now.');
      }
    } finally {
      if (isLatestRequest()) setIsLoadingSummary(false);
    }
  }, [conversationId, isOnline, userId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  useEffect(() => {
    const wasOnline = wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (!wasOnline && isOnline) void loadSummary();
  }, [isOnline, loadSummary]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId || !isOnline) return undefined;
      let active = true;
      void getMyConversationNotificationState(conversationId)
        .then((state) => {
          if (active) setIsMuted(state.is_muted);
        })
        .catch((error) => {
          if (active) setMuteError(error instanceof Error ? error.message : 'Unable to read notification state.');
        });
      return () => {
        active = false;
      };
    }, [conversationId, isOnline]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return undefined;
      setActivePushConversation(conversationId);
      return () => setActivePushConversation(null);
    }, [conversationId]),
  );

  useEffect(() => subscribeToGroupMembershipEvents((event) => {
    if (!conversationId || event.conversationId !== conversationId) return;
    if (event.changeType === 'removed' || event.changeType === 'left') {
      router.replace('/chats');
      return;
    }
    void loadSummary();
  }), [conversationId, loadSummary]);

  useEffect(() => {
    setFocusedMessageId(requestedFocusMessageId ?? null);
  }, [requestedFocusMessageId]);

  useEffect(() => {
    if (!focusedMessageId || !conversationId || !userId || isInitialLoading) return undefined;
    let cancelled = false;

    void loadMessageSearchWindow(focusedMessageId).then((found) => {
      if (!cancelled && !found) setFocusedMessageId(null);
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, focusedMessageId, isInitialLoading, loadMessageSearchWindow, userId]);

  useEffect(() => {
    if (!focusedMessageId || !isSearchWindow) return;
    const index = messages.findIndex((message) => message.id === focusedMessageId);
    if (index < 0) return;

    const timer = setTimeout(() => {
      messageListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 });
    }, 80);
    return () => clearTimeout(timer);
  }, [focusedMessageId, isSearchWindow, messages]);

  const returnToLatest = useCallback(() => {
    setFocusedMessageId(null);
    void exitMessageSearchWindow();
  }, [exitMessageSearchWindow]);

  const name = summary?.display_name ?? fallbackName ?? 'Conversation';
  const avatarUri = summary?.kind === 'group'
    ? getGroupAvatarPublicUrl(summary.avatar_path)
    : getAvatarPublicUrl(summary?.avatar_path);
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
    : Boolean(summary && user?.id && directMessagingAvailable && normalizedDraft.length > 0);
  const canAttach = Boolean(summary && user?.id && directMessagingAvailable && !editingMessage);

  const headerSubtitle = useMemo(() => {
    if (!isOnline) return 'Offline · messages will queue';
    if (realtimeState !== 'connected') return 'Reconnecting…';
    if (isDirectConversation && !relationship) return 'Checking privacy…';
    if (isDirectConversation && relationship?.blocked_by_me) return 'Blocked';
    if (isDirectConversation && relationship?.messaging_available === false) return 'Messaging unavailable';
    if (isDirectConversation && !relationship?.can_view_activity) return 'Activity hidden';
    if (isDirectConversation && peerTyping) return 'typing…';
    if (isDirectConversation && peerPresence.online) return 'online';
    if (isDirectConversation) return formatLastSeen(peerPresence.lastSeenAt);
    return summary?.kind === 'group'
      ? `${summary.member_count} member${summary.member_count === 1 ? '' : 's'}`
      : (summary?.username ? `@${summary.username}` : 'direct chat');
  }, [
    isDirectConversation,
    isOnline,
    peerPresence.lastSeenAt,
    peerPresence.online,
    peerTyping,
    realtimeState,
    relationship,
    summary?.kind,
    summary?.member_count,
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

  const openMessageActions = useCallback((message: ChatMessage) => {
    if (message.isOptimistic || message.deleted_at || message.localState === 'failed') return;
    clearActionError();
    setSelectedMessage(message);
  }, [clearActionError]);

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

  const reportFromActions = () => {
    if (!selectedMessage || !selectedMessage.sender_id || selectedMessage.sender_id === user?.id) return;
    setReportTarget(selectedMessage);
    setSelectedMessage(null);
  };

  const submitMessageReport = async (reason: ReportReason, details: string) => {
    if (!reportTarget?.sender_id) return;
    await reportUserOrMessage({
      userId: reportTarget.sender_id,
      reason,
      details,
      messageId: reportTarget.id,
    });
    setReportTarget(null);
  };

  const replyLabel = useCallback((reply: ReplyPreview | null | undefined) => {
    if (!reply) return null;
    if (reply.senderId === userId) return 'You';
    if (summary?.kind === 'group') return reply.senderDisplayName ?? 'Group member';
    return name;
  }, [name, summary?.kind, userId]);

  const frameGroupIncoming = useCallback((item: ChatMessage, content: ReactNode) => {
    const outgoing = item.sender_id === userId;
    if (summary?.kind !== 'group' || outgoing) return content;

    const senderName = item.senderDisplayName ?? 'Group member';
    return (
      <View style={styles.groupIncomingRow}>
        <Avatar name={senderName} uri={getAvatarPublicUrl(item.senderAvatarPath)} size={28} />
        <View style={styles.groupIncomingContent}>
          <AppText variant="micro" tone="primary" numberOfLines={1} style={styles.groupSenderName}>
            {senderName}
          </AppText>
          {content}
        </View>
      </View>
    );
  }, [summary?.kind, userId]);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const outgoing = item.sender_id === userId;
    const repliedToLabel = replyLabel(item.replyPreview);
    const repliedToText = item.replyPreview ? getReplyText(item.replyPreview) : null;

    if (item.deleted_at) {
      const bubble = (
        <MessageBubble
          text="Message deleted"
          time={formatMessageTime(item.created_at)}
          outgoing={outgoing}
          status={outgoing ? (item.localState ?? 'sent') : undefined}
        />
      );
      return (
        <View style={[styles.messageRow, item.id === focusedMessageId && { backgroundColor: theme.colors.primarySoft }]}>
          {frameGroupIncoming(item, bubble)}
        </View>
      );
    }

    if (item.message_type === 'image') {
      const mediaUri = item.attachment?.signedUrl ?? item.localMediaUri ?? null;
      const width = item.attachment?.width ?? item.pendingImageAsset?.width ?? null;
      const height = item.attachment?.height ?? item.pendingImageAsset?.height ?? null;

      const bubble = (
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
      );
      return (
        <View style={[styles.messageRow, item.id === focusedMessageId && { backgroundColor: theme.colors.primarySoft }]}>
          {frameGroupIncoming(item, bubble)}
        </View>
      );
    }

    const body = item.body ?? (item.message_type === 'file' ? 'File' : 'Message');
    const bubble = (
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
    );
    return (
        <View style={[styles.messageRow, item.id === focusedMessageId && { backgroundColor: theme.colors.primarySoft }]}> 
          {frameGroupIncoming(item, bubble)}
        </View>
      );
  }, [
    focusedMessageId,
    frameGroupIncoming,
    openMessageActions,
    replyLabel,
    retryMessage,
    theme.colors.primarySoft,
    toggleReaction,
    userId,
  ]);

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
        ref={messageListRef}
        data={messages}
        inverted
        initialNumToRender={MESSAGE_LIST_INITIAL_RENDER}
        maxToRenderPerBatch={MESSAGE_LIST_MAX_TO_RENDER_PER_BATCH}
        updateCellsBatchingPeriod={MESSAGE_LIST_UPDATE_BATCH_MS}
        windowSize={MESSAGE_LIST_WINDOW_SIZE}
        removeClippedSubviews={Platform.OS === 'android'}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        onEndReached={() => {
          if (hasMore) void loadOlder();
        }}
        onEndReachedThreshold={0.35}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={styles.messageListContent}
        showsVerticalScrollIndicator={false}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => messageListRef.current?.scrollToIndex({ index, animated: false, viewPosition: 0.5 }), 120);
        }}
        ListFooterComponent={isLoadingOlder ? (
          <View style={styles.paginationLoader}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
      />
    );
  };

  const toggleConversationMute = async () => {
    if (!conversationId || isUpdatingMute) return;
    if (!isOnline) {
      setMuteError('Connect to the internet to change notification settings.');
      return;
    }
    const nextMuted = !isMuted;
    setIsUpdatingMute(true);
    setMuteError(null);
    try {
      const state = await setMyConversationMuted(conversationId, nextMuted);
      setIsMuted(state.is_muted);
    } catch (error) {
      setMuteError(error instanceof Error ? error.message : 'Unable to update notification state.');
    } finally {
      setIsUpdatingMute(false);
    }
  };

  const contextMessage = editingMessage ?? replyTarget;
  const contextTitle = editingMessage
    ? (editingMessage.message_type === 'image' ? 'Edit photo caption' : 'Edit message')
    : replyTarget
      ? `Replying to ${replyTarget.sender_id === user?.id
        ? 'yourself'
        : (summary?.kind === 'group' ? (replyTarget.senderDisplayName ?? 'group member') : name)}`
      : null;
  const contextText = contextMessage ? getReplyText(contextMessage) : null;
  const peerUserId = summary?.kind === 'direct' ? summary.peer_user_id : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" hitSlop={10} onPress={() => router.back()} style={styles.roundButton}>
          <AppIcon name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={24} color={theme.colors.primary} />
        </Pressable>
        <Avatar name={name} uri={avatarUri} size={38} online={canObservePeerActivity && peerPresence.online} />
        <View style={styles.headerCopy}>
          <AppText variant="bodyStrong" numberOfLines={1}>{name}</AppText>
          <View style={styles.subtitleRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: !isOnline || realtimeState !== 'connected'
                    ? theme.colors.warning
                    : (canObservePeerActivity && peerPresence.online ? theme.colors.online : theme.colors.textTertiary),
                },
              ]}
            />
            <AppText variant="micro" tone="secondary">{headerSubtitle}</AppText>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute this chat' : 'Mute this chat'}
          accessibilityState={{ disabled: isUpdatingMute }}
          disabled={!summary || isUpdatingMute}
          hitSlop={10}
          onPress={() => void toggleConversationMute()}
          style={styles.roundButton}>
          {isUpdatingMute ? (
            <ActivityIndicator size="small" color={theme.colors.textSecondary} />
          ) : (
            <AppIcon
              name={isMuted
                ? { ios: 'bell.slash.fill', android: 'notifications_off', web: 'notifications_off' }
                : { ios: 'bell.fill', android: 'notifications', web: 'notifications' }}
              size={20}
              color={isMuted ? theme.colors.textTertiary : theme.colors.textSecondary}
            />
          )}
        </Pressable>
        <Pressable
          accessibilityLabel={summary?.kind === 'group' ? 'Open group info' : 'Conversation options'}
          hitSlop={10}
          onPress={summary?.kind === 'group' && conversationId
            ? () => router.push({ pathname: '/groups/[conversationId]', params: { conversationId } })
            : peerUserId
              ? () => router.push({ pathname: '/users/[userId]', params: { userId: peerUserId } })
              : undefined}
          style={styles.roundButton}>
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
          {isDirectConversation && relationship?.messaging_available === false ? (
            <View style={[styles.privacyBanner, { backgroundColor: theme.colors.surfaceMuted, borderBottomColor: theme.colors.border }]}>
              <View style={styles.privacyBannerCopy}>
                <AppText variant="captionStrong">{relationship.blocked_by_me ? 'You blocked this user' : 'Direct messaging unavailable'}</AppText>
                <AppText variant="micro" tone="secondary">
                  {relationship.blocked_by_me ? 'Unblock from the profile to resume direct messages.' : 'You can still read your existing conversation history.'}
                </AppText>
              </View>
              {summary?.peer_user_id ? (
                <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/users/[userId]', params: { userId: summary.peer_user_id! } })} hitSlop={8}>
                  <AppText variant="captionStrong" tone="primary">Manage</AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {isSearchWindow ? (
            <View style={[styles.searchResultBanner, { backgroundColor: theme.colors.primarySoft, borderBottomColor: theme.colors.border }]}>
              <View style={styles.searchResultCopy}>
                <AppText variant="captionStrong" tone="primary">Search result</AppText>
                <AppText variant="micro" tone="secondary">Showing messages around the match</AppText>
              </View>
              <Pressable accessibilityRole="button" onPress={returnToLatest} hitSlop={8}>
                <AppText variant="captionStrong" tone="primary">Back to latest</AppText>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.messages}>{renderMessages()}</View>

          {(loadError && messages.length > 0) || mediaError || actionError || muteError ? (
            <Pressable
              onPress={() => {
                setMediaError(null);
                setMuteError(null);
                clearActionError();
              }}
              style={[styles.inlineError, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppText variant="micro" tone="danger">{actionError ?? mediaError ?? muteError ?? loadError}</AppText>
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
                editable={Boolean(editingMessage || directMessagingAvailable)}
                placeholder={editingMessage ? 'Edit message' : (directMessagingAvailable ? 'Message' : 'Messaging unavailable')}
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
        canReport={Boolean(selectedMessage?.sender_id && selectedMessage.sender_id !== user?.id && !selectedMessage.deleted_at)}
        onClose={() => setSelectedMessage(null)}
        onReply={startReply}
        onEdit={startEdit}
        onDelete={confirmDelete}
        onReport={reportFromActions}
        onReaction={reactFromActions}
      />

      <ReportModal
        visible={Boolean(reportTarget)}
        targetLabel={reportTarget?.senderDisplayName ?? (isDirectConversation ? name : 'this user')}
        messageReport
        onClose={() => setReportTarget(null)}
        onSubmit={submitMessageReport}
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
  messageRow: { paddingVertical: 3, borderRadius: 12, paddingHorizontal: 3 },
  groupIncomingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 7, maxWidth: '92%' },
  groupIncomingContent: { flex: 1, alignItems: 'flex-start', gap: 2 },
  groupSenderName: { paddingLeft: 4, maxWidth: 220 },
  paginationLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 16 },
  inlineError: { marginHorizontal: 10, marginBottom: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  privacyBanner: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  privacyBannerCopy: { flex: 1, gap: 1 },
  searchResultBanner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchResultCopy: { flex: 1, gap: 1 },
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

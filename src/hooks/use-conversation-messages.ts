import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  deleteMessage,
  editMessage,
  setMessageReaction,
} from '@/services/message-action-service';
import { sendImageMessage } from '@/services/media-service';
import {
  createClientMessageId,
  getMessageDetail,
  listConversationMessages,
  MESSAGE_PAGE_SIZE,
  sendTextMessage,
  subscribeToConversationMessages,
} from '@/services/message-service';
import { markConversationRead } from '@/services/receipt-service';
import type { Message } from '@/types/database';
import type {
  ChatAttachment,
  ChatMessage,
  MediaSendStage,
  MessageCursor,
  MessageDeliveryStatus,
  MessagePageRow,
  MessageReactionSummary,
  PendingImageAsset,
  ReceiptCursorEvent,
  ReplyPreview,
  SupportedReaction,
} from '@/types/message';
import { SUPPORTED_REACTIONS } from '@/types/message';

type RealtimeState = 'connecting' | 'connected' | 'reconnecting';
type ServerMessage = Message | MessagePageRow;

function compareNewestFirst(a: ChatMessage, b: ChatMessage) {
  const timeDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (timeDifference !== 0) return timeDifference;
  return b.id.localeCompare(a.id);
}

function toMessageRecord(message: ServerMessage): Message {
  const {
    delivery_status: _deliveryStatus,
    attachment_id: _attachmentId,
    attachment_storage_bucket: _attachmentStorageBucket,
    attachment_storage_path: _attachmentStoragePath,
    attachment_mime_type: _attachmentMimeType,
    attachment_file_name: _attachmentFileName,
    attachment_file_size: _attachmentFileSize,
    attachment_width: _attachmentWidth,
    attachment_height: _attachmentHeight,
    attachment_duration_ms: _attachmentDurationMs,
    signed_media_url: _signedMediaUrl,
    reply_sender_id: _replySenderId,
    reply_message_type: _replyMessageType,
    reply_body: _replyBody,
    reply_deleted_at: _replyDeletedAt,
    reaction_counts: _reactionCounts,
    my_reaction: _myReaction,
    ...record
  } = message as MessagePageRow;
  return record as Message;
}

function getDeliveryStatus(message: ServerMessage): MessageDeliveryStatus | null {
  const status = (message as MessagePageRow).delivery_status;
  return status === 'sent' || status === 'delivered' || status === 'read' ? status : null;
}

function getAttachment(message: ServerMessage): ChatAttachment | null {
  const row = message as MessagePageRow;
  if (!row.attachment_id || !row.attachment_storage_path || !row.attachment_mime_type) return null;

  return {
    id: row.attachment_id,
    storageBucket: row.attachment_storage_bucket ?? 'chat-media',
    storagePath: row.attachment_storage_path,
    mimeType: row.attachment_mime_type,
    fileName: row.attachment_file_name ?? null,
    fileSize: row.attachment_file_size ?? null,
    width: row.attachment_width ?? null,
    height: row.attachment_height ?? null,
    durationMs: row.attachment_duration_ms ?? null,
    signedUrl: row.signed_media_url ?? null,
  };
}

function getReplyPreview(message: ServerMessage): ReplyPreview | null {
  const row = message as MessagePageRow;
  if (!row.reply_to_message_id || !row.reply_message_type) return null;

  return {
    messageId: row.reply_to_message_id,
    senderId: row.reply_sender_id ?? null,
    messageType: row.reply_message_type,
    body: row.reply_body ?? null,
    deletedAt: row.reply_deleted_at ?? null,
  };
}

function isSupportedReaction(value: unknown): value is SupportedReaction {
  return typeof value === 'string' && SUPPORTED_REACTIONS.includes(value as SupportedReaction);
}

function getReactionCounts(message: ServerMessage): MessageReactionSummary[] {
  const raw = (message as MessagePageRow).reaction_counts;
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    const emoji = candidate.emoji;
    const count = candidate.count;
    if (!isSupportedReaction(emoji) || typeof count !== 'number' || count < 1) return [];
    return [{ emoji, count: Math.trunc(count) }];
  });
}

function normalizeServerMessage(message: ServerMessage, currentUserId: string): ChatMessage {
  const record = toMessageRecord(message);
  const attachment = record.deleted_at ? null : getAttachment(message);
  const row = message as MessagePageRow;

  return {
    ...record,
    isOptimistic: false,
    attachment,
    replyPreview: getReplyPreview(message),
    reactions: record.deleted_at ? [] : getReactionCounts(message),
    myReaction: record.deleted_at || !isSupportedReaction(row.my_reaction) ? null : row.my_reaction,
    mediaSendStage: record.message_type === 'image' && attachment ? 'ready' : undefined,
    localState: record.sender_id === currentUserId
      ? (getDeliveryStatus(message) ?? 'sent')
      : undefined,
  };
}

function mergeServerMessage(
  current: ChatMessage[],
  incoming: ServerMessage,
  currentUserId: string,
): ChatMessage[] {
  const record = toMessageRecord(incoming);
  const existing = current.find((message) => (
    message.id === record.id
    || (
      message.sender_id === record.sender_id
      && message.client_message_id === record.client_message_id
    )
  ));
  let normalized = normalizeServerMessage(incoming, currentUserId);
  const incomingPage = incoming as MessagePageRow;

  // Generic INSERT Broadcasts contain the messages row but not Phase 12/13
  // projections. Preserve optimistic attachment/reply/reaction context until the
  // authoritative detail/page reconciliation arrives.
  if (record.message_type === 'image' && !normalized.attachment && existing && !record.deleted_at) {
    normalized = {
      ...normalized,
      attachment: existing.attachment,
      localMediaUri: existing.localMediaUri,
      pendingImageAsset: existing.pendingImageAsset,
      mediaSendStage: existing.mediaSendStage,
    };
  }

  if (record.reply_to_message_id && !normalized.replyPreview && existing?.replyPreview) {
    normalized = { ...normalized, replyPreview: existing.replyPreview };
  }

  if (incomingPage.reaction_counts === undefined && existing) {
    normalized = {
      ...normalized,
      reactions: existing.reactions,
      myReaction: existing.myReaction,
    };
  }

  const withoutDuplicate = current.filter((message) => {
    if (message.id === record.id) return false;
    return !(
      message.sender_id === record.sender_id
      && message.client_message_id === record.client_message_id
    );
  });

  return [normalized, ...withoutDuplicate].sort(compareNewestFirst);
}

function mergeServerMessages(
  current: ChatMessage[],
  incoming: ServerMessage[],
  currentUserId: string,
): ChatMessage[] {
  return incoming.reduce(
    (messages, message) => mergeServerMessage(messages, message, currentUserId),
    current,
  );
}

function applyReceiptCursor(
  current: ChatMessage[],
  event: ReceiptCursorEvent,
  currentUserId: string,
): ChatMessage[] {
  const cutoff = new Date(event.throughCreatedAt).getTime();
  if (Number.isNaN(cutoff)) return current;

  return current.map((message) => {
    if (
      message.sender_id !== currentUserId
      || message.isOptimistic
      || message.localState === 'failed'
      || message.localState === 'sending'
      || new Date(message.created_at).getTime() > cutoff
    ) {
      return message;
    }

    if (event.type === 'read') return { ...message, localState: 'read' as const };
    if (message.localState === 'read') return message;
    return { ...message, localState: 'delivered' as const };
  });
}

function makeReplyPreview(message: ChatMessage): ReplyPreview {
  return {
    messageId: message.id,
    senderId: message.sender_id,
    messageType: message.message_type,
    body: message.body,
    deletedAt: message.deleted_at,
  };
}

export function useConversationMessages(
  conversationId: string | undefined,
  currentUserId: string | undefined,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const markRead = useCallback(async () => {
    if (!conversationId || !currentUserId || AppState.currentState !== 'active') return;
    try {
      await markConversationRead(conversationId);
    } catch (error) {
      console.warn('Unable to mark conversation read:', error);
    }
  }, [conversationId, currentUserId]);

  const loadInitial = useCallback(async () => {
    if (!conversationId || !currentUserId) {
      setMessages([]);
      setHasMore(false);
      setIsInitialLoading(false);
      return;
    }

    setIsInitialLoading(true);
    setLoadError(null);
    try {
      const page = await listConversationMessages(conversationId);
      if (!mountedRef.current) return;
      setMessages((current) => mergeServerMessages(current, page, currentUserId));
      setHasMore(page.length >= MESSAGE_PAGE_SIZE);
      void markRead();
    } catch (error) {
      console.warn('Unable to load messages:', error);
      if (mountedRef.current) setLoadError('Unable to load messages right now.');
    } finally {
      if (mountedRef.current) setIsInitialLoading(false);
    }
  }, [conversationId, currentUserId, markRead]);

  const refreshLatest = useCallback(async () => {
    if (!conversationId || !currentUserId) return;
    try {
      const page = await listConversationMessages(conversationId);
      if (!mountedRef.current) return;
      setMessages((current) => mergeServerMessages(current, page, currentUserId));
      setLoadError(null);
      void markRead();
    } catch (error) {
      console.warn('Unable to reconcile latest messages:', error);
    }
  }, [conversationId, currentUserId, markRead]);

  const refreshOne = useCallback(async (messageId: string) => {
    if (!currentUserId) return;
    try {
      const detail = await getMessageDetail(messageId);
      if (!detail || !mountedRef.current) return;
      setMessages((current) => mergeServerMessage(current, detail, currentUserId));
    } catch (error) {
      console.warn('Unable to refresh changed message:', error);
    }
  }, [currentUserId]);

  useEffect(() => {
    setMessages([]);
    setHasMore(true);
    setRealtimeState('connecting');
    void loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (!conversationId || !currentUserId) return undefined;

    return subscribeToConversationMessages({
      conversationId,
      onMessage: (message) => {
        setMessages((current) => mergeServerMessage(current, message, currentUserId));
        if (message.reply_to_message_id) void refreshOne(message.id);
        if (message.sender_id !== currentUserId) void markRead();
      },
      onReceiptState: (event) => {
        setMessages((current) => applyReceiptCursor(current, event, currentUserId));
        void refreshLatest();
      },
      onMediaReady: (messageId) => {
        if (messageId) void refreshOne(messageId);
        else void refreshLatest();
      },
      onMessageChanged: (messageId) => {
        void refreshOne(messageId);
      },
      onStateChange: (state) => {
        setRealtimeState(state);
        if (state === 'connected') void refreshLatest();
      },
      onError: (error) => console.warn('Realtime conversation channel:', error),
    });
  }, [conversationId, currentUserId, markRead, refreshLatest, refreshOne]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshLatest();
    });
    return () => subscription.remove();
  }, [refreshLatest]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !currentUserId || isLoadingOlder || !hasMore) return;

    const oldestServerMessage = [...messages].reverse().find((message) => !message.isOptimistic);
    if (!oldestServerMessage) {
      setHasMore(false);
      return;
    }

    const cursor: MessageCursor = {
      createdAt: oldestServerMessage.created_at,
      id: oldestServerMessage.id,
    };

    setIsLoadingOlder(true);
    try {
      const page = await listConversationMessages(conversationId, cursor);
      if (!mountedRef.current) return;
      setMessages((current) => mergeServerMessages(current, page, currentUserId));
      setHasMore(page.length >= MESSAGE_PAGE_SIZE);
    } catch (error) {
      console.warn('Unable to load older messages:', error);
    } finally {
      if (mountedRef.current) setIsLoadingOlder(false);
    }
  }, [conversationId, currentUserId, hasMore, isLoadingOlder, messages]);

  const queueTextMessage = useCallback((rawBody: string, replyTo?: ChatMessage | null) => {
    if (!conversationId || !currentUserId) return false;
    const body = rawBody.trim();
    if (!body) return false;

    const clientMessageId = createClientMessageId();
    const replyToMessageId = replyTo && !replyTo.deleted_at ? replyTo.id : null;
    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      client_message_id: clientMessageId,
      message_type: 'text',
      body,
      reply_to_message_id: replyToMessageId,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      isOptimistic: true,
      localState: 'sending',
      replyPreview: replyToMessageId && replyTo ? makeReplyPreview(replyTo) : null,
      reactions: [],
      myReaction: null,
    };

    setMessages((current) => [optimistic, ...current].sort(compareNewestFirst));

    void sendTextMessage({
      conversationId,
      senderId: currentUserId,
      clientMessageId,
      body,
      replyToMessageId,
    })
      .then((savedMessage) => {
        if (!mountedRef.current) return;
        setMessages((current) => mergeServerMessage(current, savedMessage, currentUserId));
        if (replyToMessageId) void refreshOne(savedMessage.id);
      })
      .catch((error) => {
        console.warn('Unable to send message:', error);
        if (!mountedRef.current) return;
        setMessages((current) => current.map((message) => (
          message.client_message_id === clientMessageId
            ? { ...message, localState: 'failed' as const }
            : message
        )));
      });

    return true;
  }, [conversationId, currentUserId, refreshOne]);

  const sendPendingImage = useCallback((
    clientMessageId: string,
    asset: PendingImageAsset,
    replyToMessageId?: string | null,
  ) => {
    if (!conversationId || !currentUserId) return;

    void sendImageMessage({
      conversationId,
      userId: currentUserId,
      clientMessageId,
      asset,
      replyToMessageId: replyToMessageId ?? null,
      onStage: (stage: Exclude<MediaSendStage, 'ready' | 'failed'>) => {
        if (!mountedRef.current) return;
        setMessages((current) => current.map((message) => (
          message.client_message_id === clientMessageId
            ? { ...message, mediaSendStage: stage, localState: 'sending' as const }
            : message
        )));
      },
    })
      .then((savedMessage) => {
        if (!mountedRef.current) return;
        setMessages((current) => mergeServerMessage(current, savedMessage, currentUserId));
      })
      .catch((error) => {
        console.warn('Unable to send image:', error);
        if (!mountedRef.current) return;
        setMessages((current) => current.map((message) => (
          message.client_message_id === clientMessageId
            ? { ...message, localState: 'failed' as const, mediaSendStage: 'failed' as const }
            : message
        )));
      });
  }, [conversationId, currentUserId]);

  const queueImageMessage = useCallback((asset: PendingImageAsset, replyTo?: ChatMessage | null) => {
    if (!conversationId || !currentUserId) return false;

    const clientMessageId = createClientMessageId();
    const replyToMessageId = replyTo && !replyTo.deleted_at ? replyTo.id : null;
    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      client_message_id: clientMessageId,
      message_type: 'image',
      body: null,
      reply_to_message_id: replyToMessageId,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      isOptimistic: true,
      localState: 'sending',
      localMediaUri: asset.uri,
      pendingImageAsset: asset,
      mediaSendStage: 'preparing',
      replyPreview: replyToMessageId && replyTo ? makeReplyPreview(replyTo) : null,
      reactions: [],
      myReaction: null,
    };

    setMessages((current) => [optimistic, ...current].sort(compareNewestFirst));
    sendPendingImage(clientMessageId, asset, replyToMessageId);
    return true;
  }, [conversationId, currentUserId, sendPendingImage]);

  const retryMessage = useCallback((clientMessageId: string) => {
    if (!conversationId || !currentUserId) return;
    const target = messages.find(
      (message) => message.client_message_id === clientMessageId && message.localState === 'failed',
    );
    if (!target) return;

    if (target.message_type === 'image' && target.pendingImageAsset) {
      setMessages((current) => current.map((message) => (
        message.client_message_id === clientMessageId
          ? { ...message, localState: 'sending' as const, mediaSendStage: 'preparing' as const }
          : message
      )));
      sendPendingImage(clientMessageId, target.pendingImageAsset, target.reply_to_message_id);
      return;
    }

    if (!target.body) return;
    setMessages((current) => current.map((message) => (
      message.client_message_id === clientMessageId
        ? { ...message, localState: 'sending' as const }
        : message
    )));

    void sendTextMessage({
      conversationId,
      senderId: currentUserId,
      clientMessageId,
      body: target.body,
      replyToMessageId: target.reply_to_message_id,
    })
      .then((savedMessage) => {
        if (!mountedRef.current) return;
        setMessages((current) => mergeServerMessage(current, savedMessage, currentUserId));
        if (target.reply_to_message_id) void refreshOne(savedMessage.id);
      })
      .catch((error) => {
        console.warn('Message retry failed:', error);
        if (!mountedRef.current) return;
        setMessages((current) => current.map((message) => (
          message.client_message_id === clientMessageId
            ? { ...message, localState: 'failed' as const }
            : message
        )));
      });
  }, [conversationId, currentUserId, messages, refreshOne, sendPendingImage]);

  const editMessageContent = useCallback(async (messageId: string, body: string) => {
    setActionError(null);
    try {
      await editMessage(messageId, body);
      await refreshOne(messageId);
      return true;
    } catch (error) {
      console.warn('Unable to edit message:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to edit this message.');
      return false;
    }
  }, [refreshOne]);

  const deleteMessageForEveryone = useCallback(async (messageId: string) => {
    setActionError(null);
    try {
      await deleteMessage(messageId);

      // The server has already committed the soft delete at this point. Update
      // the local timeline immediately so the action feels deterministic even
      // if the follow-up fetch or Realtime event is briefly delayed.
      const deletedAt = new Date().toISOString();
      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? {
              ...message,
              body: null,
              edited_at: null,
              deleted_at: deletedAt,
              attachment: null,
              localMediaUri: null,
              reactions: [],
              myReaction: null,
            }
          : message
      )));

      await refreshOne(messageId);
      return true;
    } catch (error) {
      console.warn('Unable to delete message:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to delete this message.');
      return false;
    }
  }, [refreshOne]);

  const toggleReaction = useCallback(async (messageId: string, emoji: SupportedReaction) => {
    const target = messages.find((message) => message.id === messageId);
    if (!target || target.deleted_at || target.isOptimistic) return false;

    setActionError(null);
    const nextReaction = target.myReaction === emoji ? null : emoji;
    try {
      await setMessageReaction(messageId, nextReaction);
      await refreshOne(messageId);
      return true;
    } catch (error) {
      console.warn('Unable to react to message:', error);
      setActionError(error instanceof Error ? error.message : 'Unable to update reaction.');
      return false;
    }
  }, [messages, refreshOne]);

  return useMemo(() => ({
    messages,
    isInitialLoading,
    isLoadingOlder,
    hasMore,
    loadError,
    actionError,
    realtimeState,
    reload: loadInitial,
    loadOlder,
    queueTextMessage,
    queueImageMessage,
    retryMessage,
    editMessageContent,
    deleteMessageForEveryone,
    toggleReaction,
    clearActionError: () => setActionError(null),
  }), [
    actionError,
    deleteMessageForEveryone,
    editMessageContent,
    hasMore,
    isInitialLoading,
    isLoadingOlder,
    loadError,
    loadInitial,
    loadOlder,
    messages,
    queueImageMessage,
    queueTextMessage,
    realtimeState,
    retryMessage,
    toggleReaction,
  ]);
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  createClientMessageId,
  listConversationMessages,
  MESSAGE_PAGE_SIZE,
  sendTextMessage,
  subscribeToConversationMessages,
} from '@/services/message-service';
import { markConversationRead } from '@/services/receipt-service';
import type { Message } from '@/types/database';
import type {
  ChatMessage,
  MessageCursor,
  MessageDeliveryStatus,
  MessagePageRow,
  ReceiptCursorEvent,
} from '@/types/message';

type RealtimeState = 'connecting' | 'connected' | 'reconnecting';
type ServerMessage = Message | MessagePageRow;

function compareNewestFirst(a: ChatMessage, b: ChatMessage) {
  const timeDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (timeDifference !== 0) return timeDifference;
  return b.id.localeCompare(a.id);
}

function toMessageRecord(message: ServerMessage): Message {
  const { delivery_status: _deliveryStatus, ...record } = message as MessagePageRow;
  return record as Message;
}

function getDeliveryStatus(message: ServerMessage): MessageDeliveryStatus | null {
  const status = (message as MessagePageRow).delivery_status;
  return status === 'sent' || status === 'delivered' || status === 'read' ? status : null;
}

function normalizeServerMessage(message: ServerMessage, currentUserId: string): ChatMessage {
  const record = toMessageRecord(message);
  return {
    ...record,
    isOptimistic: false,
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
  const normalized = normalizeServerMessage(incoming, currentUserId);
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

    if (event.type === 'read') {
      return { ...message, localState: 'read' as const };
    }

    if (message.localState === 'read') return message;
    return { ...message, localState: 'delivered' as const };
  });
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
      // A receipt failure must never block reading/sending the conversation.
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
      if (!mountedRef.current) return;
      setLoadError('Unable to load messages right now.');
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
        if (message.sender_id !== currentUserId) {
          void markRead();
        }
      },
      onReceiptState: (event) => {
        // Cursor application makes the tick update instant for current direct
        // chats. A reconciliation fetch then remains the authoritative fallback.
        setMessages((current) => applyReceiptCursor(current, event, currentUserId));
        void refreshLatest();
      },
      onStateChange: (state) => {
        setRealtimeState(state);
        if (state === 'connected') {
          // PostgreSQL is authoritative. Reconcile after each successful join so
          // reconnects cannot leave message or receipt gaps.
          void refreshLatest();
        }
      },
      onError: (error) => console.warn('Realtime conversation channel:', error),
    });
  }, [conversationId, currentUserId, markRead, refreshLatest]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshLatest();
      }
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

  const queueTextMessage = useCallback((rawBody: string) => {
    if (!conversationId || !currentUserId) return false;

    const body = rawBody.trim();
    if (!body) return false;

    const clientMessageId = createClientMessageId();
    const optimistic: ChatMessage = {
      id: clientMessageId,
      conversation_id: conversationId,
      sender_id: currentUserId,
      client_message_id: clientMessageId,
      message_type: 'text',
      body,
      reply_to_message_id: null,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      isOptimistic: true,
      localState: 'sending',
    };

    setMessages((current) => [optimistic, ...current].sort(compareNewestFirst));

    void sendTextMessage({
      conversationId,
      senderId: currentUserId,
      clientMessageId,
      body,
    })
      .then((savedMessage) => {
        if (!mountedRef.current) return;
        setMessages((current) => mergeServerMessage(current, savedMessage, currentUserId));
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
  }, [conversationId, currentUserId]);

  const retryMessage = useCallback((clientMessageId: string) => {
    if (!conversationId || !currentUserId) return;

    const target = messages.find(
      (message) => message.client_message_id === clientMessageId && message.localState === 'failed',
    );

    if (!target?.body) return;

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
    })
      .then((savedMessage) => {
        if (!mountedRef.current) return;
        setMessages((current) => mergeServerMessage(current, savedMessage, currentUserId));
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
  }, [conversationId, currentUserId, messages]);

  return useMemo(() => ({
    messages,
    isInitialLoading,
    isLoadingOlder,
    hasMore,
    loadError,
    realtimeState,
    reload: loadInitial,
    loadOlder,
    queueTextMessage,
    retryMessage,
  }), [
    hasMore,
    isInitialLoading,
    isLoadingOlder,
    loadError,
    loadInitial,
    loadOlder,
    messages,
    queueTextMessage,
    realtimeState,
    retryMessage,
  ]);
}

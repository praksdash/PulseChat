import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  createClientMessageId,
  listConversationMessages,
  MESSAGE_PAGE_SIZE,
  sendTextMessage,
  subscribeToConversationMessages,
} from '@/services/message-service';
import type { Message } from '@/types/database';
import type { ChatMessage, MessageCursor } from '@/types/message';

type RealtimeState = 'connecting' | 'connected' | 'reconnecting';

function compareNewestFirst(a: ChatMessage, b: ChatMessage) {
  const timeDifference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  if (timeDifference !== 0) return timeDifference;
  return b.id.localeCompare(a.id);
}

function normalizeServerMessage(message: Message, currentUserId: string): ChatMessage {
  return {
    ...message,
    isOptimistic: false,
    localState: message.sender_id === currentUserId ? 'sent' : undefined,
  };
}

function mergeServerMessage(
  current: ChatMessage[],
  incoming: Message,
  currentUserId: string,
): ChatMessage[] {
  const normalized = normalizeServerMessage(incoming, currentUserId);
  const withoutDuplicate = current.filter((message) => {
    if (message.id === incoming.id) return false;

    return !(
      message.sender_id === incoming.sender_id
      && message.client_message_id === incoming.client_message_id
    );
  });

  return [normalized, ...withoutDuplicate].sort(compareNewestFirst);
}

function mergeServerMessages(
  current: ChatMessage[],
  incoming: Message[],
  currentUserId: string,
): ChatMessage[] {
  return incoming.reduce(
    (messages, message) => mergeServerMessage(messages, message, currentUserId),
    current,
  );
}

export function useConversationMessages(conversationId: string | undefined, currentUserId: string | undefined) {
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
    } catch (error) {
      console.warn('Unable to load messages:', error);
      if (!mountedRef.current) return;
      setLoadError('Unable to load messages right now.');
    } finally {
      if (mountedRef.current) setIsInitialLoading(false);
    }
  }, [conversationId, currentUserId]);

  const refreshLatest = useCallback(async () => {
    if (!conversationId || !currentUserId) return;

    try {
      const page = await listConversationMessages(conversationId);
      if (!mountedRef.current) return;
      setMessages((current) => mergeServerMessages(current, page, currentUserId));
      setLoadError(null);
    } catch (error) {
      console.warn('Unable to reconcile latest messages:', error);
    }
  }, [conversationId, currentUserId]);

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
      },
      onStateChange: (state) => {
        setRealtimeState(state);
        if (state === 'connected') {
          // PostgreSQL is authoritative. Reconcile after each successful join so
          // reconnects cannot leave a permanent gap if WebSocket events were missed.
          void refreshLatest();
        }
      },
      onError: (error) => console.warn('Realtime conversation channel:', error),
    });
  }, [conversationId, currentUserId, refreshLatest]);

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

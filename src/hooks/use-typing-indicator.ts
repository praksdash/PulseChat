import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import { createTypingChannel } from '@/services/typing-service';

const TYPING_REFRESH_MS = 1_800;
const TYPING_IDLE_MS = 1_400;

export function useTypingIndicator({
  conversationId,
  currentUserId,
  enabled,
}: {
  conversationId?: string;
  currentUserId?: string;
  enabled: boolean;
}) {
  const [peerTyping, setPeerTyping] = useState(false);
  const controllerRef = useRef<ReturnType<typeof createTypingChannel> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const localTypingRef = useRef(false);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = null;
  };

  const stopTyping = useCallback(() => {
    clearIdleTimer();
    if (!localTypingRef.current) return;
    localTypingRef.current = false;
    lastTypingSentAtRef.current = 0;
    void controllerRef.current?.send(false).catch((error) => {
      console.warn('Unable to clear typing state:', error);
    });
  }, []);

  const updateTyping = useCallback((draft: string) => {
    if (!enabled || !draft.trim() || (Platform.OS !== 'web' && AppState.currentState !== 'active')) {
      stopTyping();
      return;
    }

    const now = Date.now();
    if (!localTypingRef.current || now - lastTypingSentAtRef.current >= TYPING_REFRESH_MS) {
      localTypingRef.current = true;
      lastTypingSentAtRef.current = now;
      void controllerRef.current?.send(true).catch((error) => {
        console.warn('Unable to send typing state:', error);
      });
    }

    clearIdleTimer();
    idleTimerRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [enabled, stopTyping]);

  useEffect(() => {
    if (!enabled || !conversationId || !currentUserId) {
      setPeerTyping(false);
      return undefined;
    }

    const controller = createTypingChannel({
      conversationId,
      currentUserId,
      onPeerTyping: setPeerTyping,
    });
    controllerRef.current = controller;

    const appStateSubscription = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state !== 'active') stopTyping();
        });

    return () => {
      stopTyping();
      appStateSubscription?.remove();
      controller.dispose();
      controllerRef.current = null;
      setPeerTyping(false);
    };
  }, [conversationId, currentUserId, enabled, stopTyping]);

  return { peerTyping, updateTyping, stopTyping };
}

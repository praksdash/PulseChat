import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type TypingEvent = {
  senderId: string;
  isTyping: boolean;
  sentAt: string;
};

type TypingController = {
  send: (isTyping: boolean) => Promise<void>;
  dispose: () => void;
};

function parseTypingEvent(event: unknown): TypingEvent | null {
  if (!event || typeof event !== 'object') return null;
  const root = event as Record<string, unknown>;
  const payload = root.payload;
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;

  if (
    typeof record.sender_id !== 'string'
    || typeof record.is_typing !== 'boolean'
    || typeof record.sent_at !== 'string'
  ) {
    return null;
  }

  return {
    senderId: record.sender_id,
    isTyping: record.is_typing,
    sentAt: record.sent_at,
  };
}

export function createTypingChannel({
  conversationId,
  currentUserId,
  onPeerTyping,
}: {
  conversationId: string;
  currentUserId: string;
  onPeerTyping: (typing: boolean) => void;
}): TypingController {
  let disposed = false;
  let subscribed = false;
  let channel: RealtimeChannel | null = null;
  let peerExpiryTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingLocalTyping: boolean | null = null;

  const clearPeerTimer = () => {
    if (peerExpiryTimer) clearTimeout(peerExpiryTimer);
    peerExpiryTimer = null;
  };

  const applyPeerEvent = (typingEvent: TypingEvent) => {
    if (typingEvent.senderId === currentUserId || disposed) return;
    clearPeerTimer();
    onPeerTyping(typingEvent.isTyping);

    if (typingEvent.isTyping) {
      // If a final false event is lost, never leave "typing…" stuck forever.
      peerExpiryTimer = setTimeout(() => {
        peerExpiryTimer = null;
        if (!disposed) onPeerTyping(false);
      }, 4_000);
    }
  };

  void (async () => {
    try {
      await supabase.realtime.setAuth();
      if (disposed) return;

      channel = supabase
        .channel(`typing:${conversationId}`, {
          config: { private: true, broadcast: { ack: true } },
        })
        .on('broadcast', { event: 'typing' }, (event: unknown) => {
          const parsed = parseTypingEvent(event);
          if (parsed) applyPeerEvent(parsed);
        })
        .subscribe((status: string, error?: Error) => {
          if (disposed) return;
          subscribed = status === 'SUBSCRIBED';

          if (status === 'SUBSCRIBED' && pendingLocalTyping !== null) {
            const desired = pendingLocalTyping;
            pendingLocalTyping = null;
            void channel?.send({
              type: 'broadcast',
              event: 'typing',
              payload: {
                sender_id: currentUserId,
                is_typing: desired,
                sent_at: new Date().toISOString(),
              },
            }).then((response) => {
              if (response !== 'ok') console.warn('PulseChat queued typing Broadcast:', response);
            }).catch((sendError) => {
              console.warn('Unable to flush queued typing state:', sendError);
            });
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('PulseChat typing channel:', status, error ?? 'No error details');
          }
        });
    } catch (error) {
      if (!disposed) console.warn('Unable to start typing channel:', error);
    }
  })();

  return {
    async send(isTyping: boolean) {
      if (disposed) return;
      if (!subscribed || !channel) {
        // Preserve the latest desired state while channel authorization/join
        // is still in flight. This prevents the user's first keystroke from
        // being silently discarded during initial subscription.
        pendingLocalTyping = isTyping;
        return;
      }

      const response = await channel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          sender_id: currentUserId,
          is_typing: isTyping,
          sent_at: new Date().toISOString(),
        },
      });

      if (response !== 'ok') {
        console.warn('Unexpected typing Broadcast response:', response);
      }
    },
    dispose() {
      disposed = true;
      pendingLocalTyping = null;
      clearPeerTimer();
      onPeerTyping(false);
      if (channel) void supabase.removeChannel(channel);
    },
  };
}

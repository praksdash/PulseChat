export type ConversationActivityEvent = {
  type: 'message' | 'read';
  conversationId?: string;
};

type ConversationActivityListener = (event: ConversationActivityEvent) => void;

const listeners = new Set<ConversationActivityListener>();
let pendingEvent: ConversationActivityEvent | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flushConversationActivity() {
  flushTimer = null;
  const event = pendingEvent;
  pendingEvent = null;
  if (!event) return;

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('PulseChat conversation activity listener failed:', error);
    }
  });
}

export function emitConversationActivity(event: ConversationActivityEvent) {
  // Coalesce message bursts so 20 incoming messages do not cause 20 duplicate
  // Chats-list/unread RPCs. The authoritative message flow is unaffected.
  if (pendingEvent && pendingEvent.conversationId !== event.conversationId) {
    pendingEvent = { type: event.type };
  } else {
    pendingEvent = event;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(flushConversationActivity, 120);
  }
}

export function subscribeToConversationActivity(listener: ConversationActivityListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

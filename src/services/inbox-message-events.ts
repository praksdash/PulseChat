export type InboxMessageEvent = {
  conversationId: string;
  messageId: string;
  senderId: string | null;
  createdAt: string;
};

type InboxMessageListener = (event: InboxMessageEvent) => void;

const listeners = new Set<InboxMessageListener>();

export function emitInboxMessage(event: InboxMessageEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('PulseChat inbox-message listener failed:', error);
    }
  });
}

export function subscribeToInboxMessages(listener: InboxMessageListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

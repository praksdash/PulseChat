export type GroupMembershipEvent = {
  conversationId: string;
  changeType: string;
};

type Listener = (event: GroupMembershipEvent) => void;
const listeners = new Set<Listener>();

export function emitGroupMembershipEvent(event: GroupMembershipEvent) {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn('Group membership listener failed:', error);
    }
  });
}

export function subscribeToGroupMembershipEvents(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

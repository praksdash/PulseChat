import type { RealtimeChannel } from '@supabase/supabase-js';

import { emitConversationActivity } from '@/services/conversation-events';
import { emitGroupMembershipEvent } from '@/services/group-membership-events';
import { markAllPendingDelivered, markConversationDelivered } from '@/services/receipt-service';
import { supabase } from '@/lib/supabase';

type InboxMessageEvent = {
  conversationId: string;
  messageId: string;
  senderId: string | null;
  createdAt: string;
};

function extractPayload(event: unknown): Record<string, unknown> | null {
  if (!event || typeof event !== 'object') return null;
  const root = event as Record<string, unknown>;
  const payload = root.payload;
  return payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
}

function parseInboxMessage(event: unknown): InboxMessageEvent | null {
  const payload = extractPayload(event);
  if (!payload) return null;

  const conversationId = payload.conversation_id;
  const messageId = payload.message_id;
  const senderId = payload.sender_id;
  const createdAt = payload.created_at;

  if (
    typeof conversationId !== 'string'
    || typeof messageId !== 'string'
    || (senderId !== null && typeof senderId !== 'string')
    || typeof createdAt !== 'string'
  ) {
    return null;
  }

  return {
    conversationId,
    messageId,
    senderId,
    createdAt,
  };
}

export function subscribeToUserInbox(userId: string) {
  let disposed = false;
  let channel: RealtimeChannel | null = null;
  const deliveryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  void (async () => {
    try {
      await supabase.realtime.setAuth();
      if (disposed) return;

      channel = supabase
        .channel(`user:${userId}`, {
          config: { private: true },
        })
        .on('broadcast', { event: 'inbox_message' }, (event: unknown) => {
          const inboxMessage = parseInboxMessage(event);
          if (!inboxMessage || disposed) return;

          // Refresh local chat-list/unread UI immediately. Delivery state is then
          // persisted server-side; if that network call fails, reconnect/startup
          // reconciliation calls mark_all_pending_delivered again.
          emitConversationActivity({
            type: 'message',
            conversationId: inboxMessage.conversationId,
          });

          if (!deliveryTimers.has(inboxMessage.conversationId)) {
            const timer = setTimeout(() => {
              deliveryTimers.delete(inboxMessage.conversationId);
              void markConversationDelivered(inboxMessage.conversationId).catch((error) => {
                console.warn('Unable to mark incoming message delivered:', error);
              });
            }, 80);
            deliveryTimers.set(inboxMessage.conversationId, timer);
          }
        })
        .on('broadcast', { event: 'group_membership_changed' }, (event: unknown) => {
          const payload = extractPayload(event);
          const conversationId = payload?.conversation_id;
          const changeType = payload?.change_type;
          if (disposed) return;

          emitConversationActivity({
            type: 'message',
            conversationId: typeof conversationId === 'string' ? conversationId : undefined,
          });
          if (typeof conversationId === 'string' && typeof changeType === 'string') {
            emitGroupMembershipEvent({ conversationId, changeType });
          }
        })
        .on('broadcast', { event: 'inbox_message_changed' }, (event: unknown) => {
          const payload = extractPayload(event);
          const conversationId = payload?.conversation_id;
          if (typeof conversationId !== 'string' || disposed) return;

          emitConversationActivity({
            type: 'message',
            conversationId,
          });
        })
        .subscribe((status: string, error?: Error) => {
          if (disposed) return;

          if (status === 'SUBSCRIBED') {
            // Messages received while the app was closed/offline were persisted,
            // but no WebSocket existed to mark them delivered. Reconcile now.
            void markAllPendingDelivered()
              .then(() => {
                emitConversationActivity({ type: 'message' });
              })
              .catch((markError) => {
                console.warn('Unable to reconcile pending deliveries:', markError);
              });
            return;
          }

          if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && error) {
            console.warn('PulseChat inbox Realtime channel:', error);
          }
        });
    } catch (error) {
      if (!disposed) {
        console.warn('Unable to subscribe to PulseChat inbox:', error);
      }
    }
  })();

  return () => {
    disposed = true;
    deliveryTimers.forEach((timer) => clearTimeout(timer));
    deliveryTimers.clear();
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}

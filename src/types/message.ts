import type { Database, Message } from '@/types/database';

export type MessagePageRow =
  Database['public']['Functions']['list_conversation_messages']['Returns'][number];

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';
export type MessageLocalState = 'sending' | MessageDeliveryStatus | 'failed';

export type ChatMessage = Message & {
  isOptimistic?: boolean;
  localState?: MessageLocalState;
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

export type ReceiptCursorEvent = {
  type: 'delivered' | 'read';
  conversationId: string;
  recipientUserId: string;
  throughCreatedAt: string;
};

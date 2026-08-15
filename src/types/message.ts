import type { Database, Message } from '@/types/database';

export type MessagePageRow =
  Database['public']['Functions']['list_conversation_messages']['Returns'][number];

export type MessageLocalState = 'sending' | 'sent' | 'failed';

export type ChatMessage = Message & {
  isOptimistic?: boolean;
  localState?: MessageLocalState;
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

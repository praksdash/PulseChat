import type { Database } from '@/types/database';

export type ConversationListItem =
  Database['public']['Functions']['list_my_conversations']['Returns'][number];

export type ConversationSummary =
  Database['public']['Functions']['get_conversation_summary']['Returns'][number];

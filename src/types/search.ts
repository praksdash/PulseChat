import type { Database } from '@/types/database';

export type ConversationSearchResult =
  Database['public']['Functions']['search_my_conversations']['Returns'][number];

export type MessageSearchResult =
  Database['public']['Functions']['search_my_messages']['Returns'][number];

export type SearchMessageCursor = {
  createdAt: string;
  id: string;
};

export type GlobalSearchSection = 'all' | 'people' | 'chats' | 'messages';

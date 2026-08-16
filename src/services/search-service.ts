import { supabase } from '@/lib/supabase';
import type { ConversationSearchResult, MessageSearchResult, SearchMessageCursor } from '@/types/search';

export const GLOBAL_SEARCH_MIN_LENGTH = 2;
export const GLOBAL_SEARCH_MAX_LENGTH = 100;
export const MESSAGE_SEARCH_PAGE_SIZE = 20;

function normalizeQuery(query: string) {
  return query.trim().slice(0, GLOBAL_SEARCH_MAX_LENGTH);
}

export async function searchMyConversations(
  query: string,
  limit = 12,
): Promise<ConversationSearchResult[]> {
  const searchTerm = normalizeQuery(query);
  if (searchTerm.length < GLOBAL_SEARCH_MIN_LENGTH) return [];

  const { data, error } = await supabase.rpc('search_my_conversations', {
    search_term: searchTerm,
    result_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as ConversationSearchResult[];
}

export async function searchMyMessages(
  query: string,
  cursor?: SearchMessageCursor | null,
  limit = MESSAGE_SEARCH_PAGE_SIZE,
): Promise<MessageSearchResult[]> {
  const searchTerm = normalizeQuery(query);
  if (searchTerm.length < GLOBAL_SEARCH_MIN_LENGTH) return [];

  const { data, error } = await supabase.rpc('search_my_messages', {
    search_term: searchTerm,
    before_created_at: cursor?.createdAt ?? null,
    before_id: cursor?.id ?? null,
    result_limit: limit,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as MessageSearchResult[];
}

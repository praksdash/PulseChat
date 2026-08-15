import { supabase } from '@/lib/supabase';
import type { ConversationListItem, ConversationSummary } from '@/types/conversation';

const DEFAULT_CONVERSATION_LIMIT = 50;

export async function createOrGetDirectConversation(targetUserId: string): Promise<string> {
  if (!targetUserId) {
    throw new Error('A PulseChat user is required to start a conversation.');
  }

  const { data, error } = await supabase.rpc('create_or_get_direct_conversation', {
    target_user_id: targetUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error('PulseChat could not create this conversation.');
  }

  return data;
}

export async function listMyConversations(
  limit = DEFAULT_CONVERSATION_LIMIT,
): Promise<ConversationListItem[]> {
  const { data, error } = await supabase.rpc('list_my_conversations', {
    result_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function getConversationSummary(
  conversationId: string,
): Promise<ConversationSummary | null> {
  if (!conversationId) return null;

  const { data, error } = await supabase.rpc('get_conversation_summary', {
    target_conversation_id: conversationId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.[0] ?? null;
}
export async function getMyTotalUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('get_my_total_unread_count', {});

  if (error) {
    throw new Error(error.message);
  }

  return typeof data === 'number' && Number.isFinite(data) ? data : 0;
}


import { emitConversationActivity } from '@/services/conversation-events';
import { supabase } from '@/lib/supabase';

function asCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export async function markConversationDelivered(conversationId: string): Promise<number> {
  if (!conversationId) return 0;

  const { data, error } = await supabase.rpc('mark_conversation_delivered', {
    target_conversation_id: conversationId,
  });

  if (error) throw new Error(error.message);
  return asCount(data);
}

export async function markConversationRead(conversationId: string): Promise<number> {
  if (!conversationId) return 0;

  const { data, error } = await supabase.rpc('mark_conversation_read', {
    target_conversation_id: conversationId,
  });

  if (error) throw new Error(error.message);

  const count = asCount(data);
  if (count > 0) {
    emitConversationActivity({ type: 'read', conversationId });
  }

  return count;
}

export async function markAllPendingDelivered(): Promise<number> {
  const { data, error } = await supabase.rpc('mark_all_pending_delivered', {});
  if (error) throw new Error(error.message);
  return asCount(data);
}

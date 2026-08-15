import { supabase } from '@/lib/supabase';
import { CHAT_MEDIA_BUCKET } from '@/services/media-service';
import type { SupportedReaction } from '@/types/message';

export async function editMessage(messageId: string, body: string) {
  const { error } = await supabase.rpc('edit_message', {
    target_message_id: messageId,
    target_body: body,
  });

  if (error) throw new Error(error.message);
}

export async function deleteMessage(messageId: string) {
  const { data, error } = await supabase.rpc('delete_message', {
    target_message_id: messageId,
  });

  if (error) throw new Error(error.message);

  const result = data?.[0];
  if (result?.storage_bucket === CHAT_MEDIA_BUCKET && result.storage_path) {
    const { error: storageError } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .remove([result.storage_path]);

    // The DB record is already safely redacted at this point. Failure to delete
    // the physical object does not make it readable because Phase 13 Storage RLS
    // requires a live attachment row, but report it so cleanup can be retried.
    if (storageError) {
      console.warn('Message deleted but media cleanup failed:', storageError.message);
    }
  }
}

export async function setMessageReaction(
  messageId: string,
  emoji: SupportedReaction | null,
) {
  const { error } = await supabase.rpc('set_message_reaction', {
    target_message_id: messageId,
    target_emoji: emoji,
  });

  if (error) throw new Error(error.message);
}

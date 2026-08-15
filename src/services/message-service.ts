import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/database';
import type { MessageCursor, MessagePageRow, ReceiptCursorEvent } from '@/types/message';

export const MESSAGE_PAGE_SIZE = 30;
export const MAX_TEXT_MESSAGE_LENGTH = 10_000;

export function createClientMessageId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function listConversationMessages(
  conversationId: string,
  cursor?: MessageCursor | null,
  limit = MESSAGE_PAGE_SIZE,
): Promise<MessagePageRow[]> {
  const { data, error } = await supabase.rpc('list_conversation_messages', {
    target_conversation_id: conversationId,
    before_created_at: cursor?.createdAt ?? null,
    before_id: cursor?.id ?? null,
    result_limit: limit,
  });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function sendTextMessage(input: {
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  body: string;
}): Promise<Message> {
  const body = input.body.trim();

  if (!body) {
    throw new Error('Message cannot be empty.');
  }

  if (body.length > MAX_TEXT_MESSAGE_LENGTH) {
    throw new Error(`Messages can contain at most ${MAX_TEXT_MESSAGE_LENGTH.toLocaleString()} characters.`);
  }

  const payload = {
    conversation_id: input.conversationId,
    sender_id: input.senderId,
    client_message_id: input.clientMessageId,
    message_type: 'text' as const,
    body,
    reply_to_message_id: null,
  };

  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select('*')
    .single();

  if (!error && data) {
    return data as Message;
  }

  // If PostgreSQL committed the request but the network response was lost,
  // retrying with the same client_message_id hits the unique constraint. Fetch
  // the existing durable row instead of creating a duplicate.
  if (error?.code === '23505') {
    const { data: existing, error: existingError } = await supabase
      .from('messages')
      .select('*')
      .eq('sender_id', input.senderId)
      .eq('client_message_id', input.clientMessageId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);
    if (existing) return existing as Message;
  }

  throw new Error(error?.message ?? 'Unable to send this message.');
}

type RealtimeState = 'connecting' | 'connected' | 'reconnecting';

type SubscribeOptions = {
  conversationId: string;
  onMessage: (message: Message) => void;
  onReceiptState?: (event: ReceiptCursorEvent) => void;
  onStateChange?: (state: RealtimeState) => void;
  onError?: (error: unknown) => void;
};

function asMessageRecord(value: unknown): Message | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Partial<Message>;
  if (
    typeof candidate.id !== 'string'
    || typeof candidate.conversation_id !== 'string'
    || typeof candidate.client_message_id !== 'string'
    || typeof candidate.message_type !== 'string'
    || typeof candidate.created_at !== 'string'
  ) {
    return null;
  }

  return candidate as Message;
}

function extractBroadcastMessage(event: unknown): Message | null {
  if (!event || typeof event !== 'object') return null;

  const root = event as Record<string, unknown>;
  const firstPayload = root.payload;

  if (firstPayload && typeof firstPayload === 'object') {
    const payloadObject = firstPayload as Record<string, unknown>;
    const directRecord = asMessageRecord(payloadObject.record);
    if (directRecord) return directRecord;

    const nestedPayload = payloadObject.payload;
    if (nestedPayload && typeof nestedPayload === 'object') {
      const nestedRecord = asMessageRecord((nestedPayload as Record<string, unknown>).record);
      if (nestedRecord) return nestedRecord;
    }
  }

  return asMessageRecord(root.record);
}

function extractReceiptCursor(
  event: unknown,
  type: ReceiptCursorEvent['type'],
): ReceiptCursorEvent | null {
  if (!event || typeof event !== 'object') return null;
  const root = event as Record<string, unknown>;
  const payload = root.payload;
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const conversationId = record.conversation_id;
  const recipientUserId = record.recipient_user_id;
  const throughCreatedAt = record.through_created_at;

  if (
    typeof conversationId !== 'string'
    || typeof recipientUserId !== 'string'
    || typeof throughCreatedAt !== 'string'
  ) {
    return null;
  }

  return {
    type,
    conversationId,
    recipientUserId,
    throughCreatedAt,
  };
}

export function subscribeToConversationMessages({
  conversationId,
  onMessage,
  onReceiptState,
  onStateChange,
  onError,
}: SubscribeOptions) {
  let disposed = false;
  let channel: RealtimeChannel | null = null;

  onStateChange?.('connecting');

  void (async () => {
    try {
      // Private Realtime Authorization requires the current auth JWT.
      await supabase.realtime.setAuth();
      if (disposed) return;

      channel = supabase
        .channel(`conversation:${conversationId}`, {
          config: { private: true },
        })
        .on('broadcast', { event: 'INSERT' }, (event: unknown) => {
          const message = extractBroadcastMessage(event);
          if (!message || message.conversation_id !== conversationId) return;
          onMessage(message);
        })
        .on('broadcast', { event: 'receipt_delivered' }, (event: unknown) => {
          const receipt = extractReceiptCursor(event, 'delivered');
          if (!receipt || receipt.conversationId !== conversationId) return;
          onReceiptState?.(receipt);
        })
        .on('broadcast', { event: 'receipt_read' }, (event: unknown) => {
          const receipt = extractReceiptCursor(event, 'read');
          if (!receipt || receipt.conversationId !== conversationId) return;
          onReceiptState?.(receipt);
        })
        .subscribe((status: string, error?: Error) => {
          if (disposed) return;

          if (status === 'SUBSCRIBED') {
            onStateChange?.('connected');
            return;
          }

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            onStateChange?.('reconnecting');
            if (error) onError?.(error);
          }
        });
    } catch (error) {
      if (disposed) return;
      onStateChange?.('reconnecting');
      onError?.(error);
    }
  })();

  return () => {
    disposed = true;
    if (channel) {
      void supabase.removeChannel(channel);
    }
  };
}

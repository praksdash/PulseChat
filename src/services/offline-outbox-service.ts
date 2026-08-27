import { localVaultGet, localVaultRemove, localVaultSet } from '@/services/local-vault-service';

import type { ReplyPreview } from '@/types/message';

const OUTBOX_PREFIX = 'pulsechat.outbox.v1';

export type PendingTextOutboxMessage = {
  userId: string;
  conversationId: string;
  clientMessageId: string;
  body: string;
  replyToMessageId: string | null;
  replyPreview: ReplyPreview | null;
  createdAt: string;
  attempts: number;
  lastError: string | null;
};

let mutationQueue: Promise<unknown> = Promise.resolve();

function outboxKey(userId: string) {
  return `${OUTBOX_PREFIX}:${userId}`;
}

async function readOutbox(userId: string): Promise<PendingTextOutboxMessage[]> {
  try {
    const raw = await localVaultGet(outboxKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as PendingTextOutboxMessage[] : [];
  } catch (error) {
    console.warn('Unable to read PulseChat outbox:', error);
    return [];
  }
}

function mutateOutbox<T>(operation: () => Promise<T>): Promise<T> {
  const next = mutationQueue.catch(() => undefined).then(operation);
  mutationQueue = next.then(() => undefined, () => undefined);
  return next;
}

export async function listPendingTextMessages(userId: string, conversationId?: string) {
  const items = await readOutbox(userId);
  return conversationId ? items.filter((item) => item.conversationId === conversationId) : items;
}

export function enqueuePendingTextMessage(message: PendingTextOutboxMessage) {
  return mutateOutbox(async () => {
    const current = await readOutbox(message.userId);
    const withoutDuplicate = current.filter((item) => item.clientMessageId !== message.clientMessageId);
    await localVaultSet(outboxKey(message.userId), JSON.stringify([...withoutDuplicate, message]));
  });
}

export function removePendingTextMessage(userId: string, clientMessageId: string) {
  return mutateOutbox(async () => {
    const current = await readOutbox(userId);
    const next = current.filter((item) => item.clientMessageId !== clientMessageId);
    if (next.length === current.length) return;
    await localVaultSet(outboxKey(userId), JSON.stringify(next));
  });
}

export function updatePendingTextFailure(userId: string, clientMessageId: string, errorMessage: string) {
  return mutateOutbox(async () => {
    const current = await readOutbox(userId);
    const next = current.map((item) => item.clientMessageId === clientMessageId
      ? { ...item, attempts: item.attempts + 1, lastError: errorMessage }
      : item);
    await localVaultSet(outboxKey(userId), JSON.stringify(next));
  });
}

export function clearPendingTextMessages(userId: string) {
  return mutateOutbox(async () => {
    await localVaultRemove(outboxKey(userId));
  });
}

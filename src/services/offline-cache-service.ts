import {
  localVaultGet,
  localVaultGetAllKeys,
  localVaultMultiRemove,
  localVaultSet,
} from '@/services/local-vault-service';

import type { ConversationListItem, ConversationSummary } from '@/types/conversation';
import type { MessagePageRow } from '@/types/message';

const CACHE_PREFIX = 'pulsechat.cache.v1';
const MAX_CACHED_CONVERSATIONS = 60;
const MAX_CACHED_MESSAGES = 60;
const MAX_WRITE_FINGERPRINTS = 160;
const lastWrittenPayload = new Map<string, string>();
const writeQueueByKey = new Map<string, Promise<void>>();

type CacheEnvelope<T> = {
  savedAt: string;
  data: T;
};

function conversationListKey(userId: string) {
  return `${CACHE_PREFIX}:conversations:${userId}`;
}

function messageListKey(userId: string, conversationId: string) {
  return `${CACHE_PREFIX}:messages:${userId}:${conversationId}`;
}

function conversationSummaryKey(userId: string, conversationId: string) {
  return `${CACHE_PREFIX}:summary:${userId}:${conversationId}`;
}

async function readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
  try {
    const raw = await localVaultGet(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn('Unable to read PulseChat offline cache:', error);
    return null;
  }
}

function rememberWrittenPayload(key: string, payload: string) {
  lastWrittenPayload.delete(key);
  if (lastWrittenPayload.size >= MAX_WRITE_FINGERPRINTS) {
    const oldestKey = lastWrittenPayload.keys().next().value as string | undefined;
    if (oldestKey) lastWrittenPayload.delete(oldestKey);
  }
  lastWrittenPayload.set(key, payload);
}

function writeEnvelope<T>(key: string, data: T) {
  const serializedData = JSON.stringify(data);
  const previousWrite = writeQueueByKey.get(key) ?? Promise.resolve();

  // Serialize each cache key so overlapping refreshes cannot finish out of
  // order and overwrite a newer snapshot with an older one.
  const operation = previousWrite.catch(() => undefined).then(async () => {
    try {
      if (lastWrittenPayload.get(key) === serializedData) return;
      const savedAt = JSON.stringify(new Date().toISOString());
      await localVaultSet(key, `{"savedAt":${savedAt},"data":${serializedData}}`);
      rememberWrittenPayload(key, serializedData);
    } catch (error) {
      console.warn('Unable to write PulseChat offline cache:', error);
    }
  });

  writeQueueByKey.set(key, operation);
  return operation.finally(() => {
    if (writeQueueByKey.get(key) === operation) writeQueueByKey.delete(key);
  });
}

export async function cacheConversationList(userId: string, conversations: ConversationListItem[]) {
  if (!userId) return;
  await writeEnvelope(conversationListKey(userId), conversations.slice(0, MAX_CACHED_CONVERSATIONS));
}

export async function loadCachedConversationList(userId: string) {
  if (!userId) return null;
  return readEnvelope<ConversationListItem[]>(conversationListKey(userId));
}


export async function cacheConversationSummary(
  userId: string,
  conversationId: string,
  summary: ConversationSummary,
) {
  if (!userId || !conversationId) return;
  await writeEnvelope(conversationSummaryKey(userId, conversationId), summary);
}

export async function loadCachedConversationSummary(userId: string, conversationId: string) {
  if (!userId || !conversationId) return null;
  return readEnvelope<ConversationSummary>(conversationSummaryKey(userId, conversationId));
}

export async function cacheConversationMessages(
  userId: string,
  conversationId: string,
  messages: MessagePageRow[],
) {
  if (!userId || !conversationId) return;
  // Signed URLs are bearer-style delivery artifacts. Persist only the durable
  // attachment path; an authorized online client must mint a fresh URL.
  const durableRows = messages.slice(0, MAX_CACHED_MESSAGES).map((message) => ({
    ...message,
    signed_media_url: null,
  }));
  await writeEnvelope(messageListKey(userId, conversationId), durableRows);
}

export async function loadCachedConversationMessages(userId: string, conversationId: string) {
  if (!userId || !conversationId) return null;
  return readEnvelope<MessagePageRow[]>(messageListKey(userId, conversationId));
}

export async function clearUserOfflineCache(userId: string) {
  if (!userId) return;
  try {
    const belongsToUser = (key: string) => (
      key === conversationListKey(userId)
      || key.startsWith(`${CACHE_PREFIX}:messages:${userId}:`)
      || key.startsWith(`${CACHE_PREFIX}:summary:${userId}:`)
    );

    const pendingWrites = [...writeQueueByKey.entries()]
      .filter(([key]) => belongsToUser(key))
      .map(([, operation]) => operation);
    if (pendingWrites.length > 0) await Promise.all(pendingWrites);

    const keys = await localVaultGetAllKeys();
    const userKeys = keys.filter(belongsToUser);
    if (userKeys.length > 0) {
      await localVaultMultiRemove(userKeys);
      userKeys.forEach((key: string) => lastWrittenPayload.delete(key));
    }
  } catch (error) {
    console.warn('Unable to clear PulseChat offline cache:', error);
  }
}

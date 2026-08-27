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

async function writeEnvelope<T>(key: string, data: T) {
  try {
    const envelope: CacheEnvelope<T> = { savedAt: new Date().toISOString(), data };
    await localVaultSet(key, JSON.stringify(envelope));
  } catch (error) {
    console.warn('Unable to write PulseChat offline cache:', error);
  }
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
  await writeEnvelope(messageListKey(userId, conversationId), messages.slice(0, MAX_CACHED_MESSAGES));
}

export async function loadCachedConversationMessages(userId: string, conversationId: string) {
  if (!userId || !conversationId) return null;
  return readEnvelope<MessagePageRow[]>(messageListKey(userId, conversationId));
}

export async function clearUserOfflineCache(userId: string) {
  if (!userId) return;
  try {
    const keys = await localVaultGetAllKeys();
    const userKeys = keys.filter((key: string) => (
      key === conversationListKey(userId)
      || key.startsWith(`${CACHE_PREFIX}:messages:${userId}:`)
      || key.startsWith(`${CACHE_PREFIX}:summary:${userId}:`)
    ));
    if (userKeys.length > 0) await localVaultMultiRemove(userKeys);
  } catch (error) {
    console.warn('Unable to clear PulseChat offline cache:', error);
  }
}

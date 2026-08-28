import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { MEDIA_SIGNED_URL_CACHE_MAX_ENTRIES, MEDIA_SIGNED_URL_MEMORY_TTL_MS } from '@/config/performance-config';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { MediaSendStage, MessagePageRow, PendingImageAsset } from '@/types/message';

export const CHAT_MEDIA_BUCKET = 'chat-media';
export const CHAT_IMAGE_MAX_DIMENSION = 1600;
export const CHAT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_MEDIA_SIGNED_URL_SECONDS = 60 * 60;

type SignedUrlCacheEntry = { url: string; expiresAt: number };
const signedUrlMemoryCache = new Map<string, SignedUrlCacheEntry>();
const signedUrlInFlight = new Map<string, Promise<string | null>>();
let signedUrlCacheGeneration = 0;

function getCachedSignedUrl(path: string) {
  const cached = signedUrlMemoryCache.get(path);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    signedUrlMemoryCache.delete(path);
    return null;
  }
  return cached.url;
}

function rememberSignedUrl(path: string, url: string, generation = signedUrlCacheGeneration) {
  if (generation !== signedUrlCacheGeneration) return;

  // Refresh insertion order so eviction behaves like a small LRU cache.
  signedUrlMemoryCache.delete(path);
  if (signedUrlMemoryCache.size >= MEDIA_SIGNED_URL_CACHE_MAX_ENTRIES) {
    const oldestKey = signedUrlMemoryCache.keys().next().value as string | undefined;
    if (oldestKey) signedUrlMemoryCache.delete(oldestKey);
  }
  signedUrlMemoryCache.set(path, {
    url,
    expiresAt: Date.now() + MEDIA_SIGNED_URL_MEMORY_TTL_MS,
  });
}

function trackSignedUrlRequest(path: string, request: Promise<string | null>) {
  signedUrlInFlight.set(path, request);
  const cleanup = () => {
    if (signedUrlInFlight.get(path) === request) signedUrlInFlight.delete(path);
  };
  void request.then(cleanup, cleanup);
  return request;
}

export function clearChatMediaSignedUrlCache() {
  signedUrlCacheGeneration += 1;
  signedUrlMemoryCache.clear();
  signedUrlInFlight.clear();
}

type CreateImageMessageRow =
  Database['public']['Functions']['create_image_message']['Returns'][number];

type StorageErrorLike = {
  message?: string;
  error?: string;
  statusCode?: string | number;
  status?: string | number;
};

function asPendingAsset(asset: ImagePicker.ImagePickerAsset): PendingImageAsset {
  return {
    uri: asset.uri,
    width: Math.max(1, asset.width || 1),
    height: Math.max(1, asset.height || 1),
    fileName: asset.fileName ?? null,
  };
}

export async function chooseChatImageFromLibrary(): Promise<PendingImageAsset | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo access is required to send an image.');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return asPendingAsset(result.assets[0]);
}

export async function takeChatPhoto(): Promise<PendingImageAsset | null> {
  if (Platform.OS === 'web') {
    throw new Error('Camera capture is available in the Android/iOS app.');
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Camera access is required to take a photo.');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  });

  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return asPendingAsset(result.assets[0]);
}

function getTargetSize(width: number, height: number) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const largest = Math.max(safeWidth, safeHeight);

  if (largest <= CHAT_IMAGE_MAX_DIMENSION) {
    return { width: safeWidth, height: safeHeight };
  }

  const scale = CHAT_IMAGE_MAX_DIMENSION / largest;
  return {
    width: Math.max(1, Math.round(safeWidth * scale)),
    height: Math.max(1, Math.round(safeHeight * scale)),
  };
}

async function prepareImage(asset: PendingImageAsset) {
  const target = getTargetSize(asset.width, asset.height);
  const context = ImageManipulator.ImageManipulator.manipulate(asset.uri);

  if (target.width !== asset.width || target.height !== asset.height) {
    context.resize({ width: target.width, height: target.height });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  const response = await fetch(result.uri);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 1 || bytes.byteLength > CHAT_IMAGE_MAX_BYTES) {
    throw new Error('The prepared image is too large to send.');
  }

  return {
    bytes,
    width: result.width,
    height: result.height,
    fileSize: bytes.byteLength,
  };
}

function isDuplicateObjectError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as StorageErrorLike;
  const status = Number(candidate.statusCode ?? candidate.status);
  const message = `${candidate.error ?? ''} ${candidate.message ?? ''}`.toLowerCase();
  return status === 409 || message.includes('duplicate') || message.includes('already exists');
}

export function getChatMediaPath(input: {
  conversationId: string;
  userId: string;
  clientMessageId: string;
}) {
  return `${input.conversationId}/${input.userId}/${input.clientMessageId}.jpg`;
}

export async function createChatMediaSignedUrl(path: string) {
  const cached = getCachedSignedUrl(path);
  if (cached) return cached;

  const inFlight = signedUrlInFlight.get(path);
  if (inFlight) {
    const pendingUrl = await inFlight;
    if (!pendingUrl) throw new Error('Unable to create the media preview URL.');
    return pendingUrl;
  }

  const generation = signedUrlCacheGeneration;
  const request = (async () => {
    const { data, error } = await supabase.storage
      .from(CHAT_MEDIA_BUCKET)
      .createSignedUrl(path, CHAT_MEDIA_SIGNED_URL_SECONDS);

    if (error) throw new Error(error.message);
    rememberSignedUrl(path, data.signedUrl, generation);
    return data.signedUrl;
  })();

  const signedUrl = await trackSignedUrlRequest(path, request);
  if (!signedUrl) throw new Error('Unable to create the media preview URL.');
  return signedUrl;
}

export async function hydrateMessageMediaUrls(rows: MessagePageRow[]): Promise<MessagePageRow[]> {
  const paths = Array.from(new Set(
    rows
      .map((row) => row.attachment_storage_path)
      .filter((value): value is string => Boolean(value)),
  ));

  if (paths.length === 0) return rows;

  const signedByPath = new Map<string, string>();
  const missingPaths: string[] = [];
  const pendingRequests: Promise<void>[] = [];
  for (const path of paths) {
    const cached = getCachedSignedUrl(path);
    if (cached) signedByPath.set(path, cached);
    else {
      const inFlight = signedUrlInFlight.get(path);
      if (inFlight) {
        pendingRequests.push(inFlight.then((url) => {
          if (url) signedByPath.set(path, url);
        }).catch((error) => {
          console.warn('Unable to sign chat media URL:', error);
        }));
      } else {
        missingPaths.push(path);
      }
    }
  }

  if (missingPaths.length > 0) {
    const generation = signedUrlCacheGeneration;
    const batchRequest = (async () => {
      const urls = new Map<string, string>();
      const { data, error } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrls(missingPaths, CHAT_MEDIA_SIGNED_URL_SECONDS);

      if (error) {
        console.warn('Unable to sign chat media URLs:', error.message);
        return urls;
      }

      for (const entry of data ?? []) {
        const candidate = entry as { path?: string | null; signedUrl?: string | null };
        if (candidate.path && candidate.signedUrl) {
          urls.set(candidate.path, candidate.signedUrl);
          rememberSignedUrl(candidate.path, candidate.signedUrl, generation);
        }
      }
      return urls;
    })();

    missingPaths.forEach((path) => {
      const request = batchRequest.then((urls) => urls.get(path) ?? null);
      trackSignedUrlRequest(path, request);
      pendingRequests.push(request.then((url) => {
        if (url) signedByPath.set(path, url);
      }));
    });
  }

  await Promise.all(pendingRequests);

  return rows.map((row) => ({
    ...row,
    signed_media_url: row.attachment_storage_path
      ? (signedByPath.get(row.attachment_storage_path) ?? row.signed_media_url ?? null)
      : null,
  }));
}

export async function sendImageMessage(input: {
  conversationId: string;
  userId: string;
  clientMessageId: string;
  asset: PendingImageAsset;
  caption?: string | null;
  replyToMessageId?: string | null;
  onStage?: (stage: Exclude<MediaSendStage, 'ready' | 'failed'>) => void;
}): Promise<MessagePageRow> {
  input.onStage?.('preparing');
  const prepared = await prepareImage(input.asset);
  const storagePath = getChatMediaPath(input);

  input.onStage?.('uploading');
  const { error: uploadError } = await supabase.storage
    .from(CHAT_MEDIA_BUCKET)
    .upload(storagePath, prepared.bytes, {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });

  // Retry safety: if the Storage upload succeeded but the response/DB commit was
  // interrupted, the canonical object already exists. Continue to the idempotent
  // database RPC instead of uploading another copy.
  if (uploadError && !isDuplicateObjectError(uploadError)) {
    throw new Error(uploadError.message);
  }
  const uploadedByThisAttempt = !uploadError;

  input.onStage?.('committing');
  const { data, error } = await supabase.rpc('create_image_message', {
    target_conversation_id: input.conversationId,
    target_client_message_id: input.clientMessageId,
    target_storage_path: storagePath,
    target_file_name: input.asset.fileName,
    target_file_size: prepared.fileSize,
    target_width: prepared.width,
    target_height: prepared.height,
    target_caption: input.caption?.trim() || null,
    target_reply_to_message_id: input.replyToMessageId ?? null,
  });

  if (error) {
    // A failed commit must not leave a newly uploaded, unattached object. Do
    // not remove a duplicate object because it may belong to an earlier retry
    // whose durable database response was lost.
    if (uploadedByThisAttempt) {
      const { error: cleanupError } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .remove([storagePath]);
      if (cleanupError) console.warn('Unable to clean up rejected chat media:', cleanupError.message);
    }
    throw new Error(error.message);
  }
  const row = (data?.[0] ?? null) as CreateImageMessageRow | null;
  if (!row) throw new Error('The image message was not created.');

  let signedUrl: string | null = null;
  try {
    signedUrl = await createChatMediaSignedUrl(storagePath);
  } catch (signError) {
    console.warn('Image sent but preview URL could not be created:', signError);
  }

  return {
    ...row,
    signed_media_url: signedUrl,
  } as MessagePageRow;
}

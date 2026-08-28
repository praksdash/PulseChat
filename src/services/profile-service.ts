import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';
const AVATAR_SIZE = 512;

export function getAvatarPublicUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function isUsernameAvailable(username: string) {
  const { data, error } = await supabase.rpc('is_username_available', {
    candidate: username,
  });

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function updateMyProfile(input: {
  displayName: string;
  username: string | null;
  bio: string | null;
  avatarPath: string | null;
}) {
  const { error } = await supabase.rpc('update_my_profile', {
    target_display_name: input.displayName.trim(),
    target_username: input.username?.trim() || null,
    target_bio: input.bio?.trim() || null,
    target_avatar_path: input.avatarPath,
  });

  if (error) throw new Error(error.message);
}

export async function uploadAvatar(userId: string, localUri: string) {
  const context = ImageManipulator.ImageManipulator.manipulate(localUri);
  context.resize({ width: AVATAR_SIZE, height: AVATAR_SIZE });

  const renderedImage = await context.renderAsync();
  const result = await renderedImage.saveAsync({
    base64: true,
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('Unable to prepare the selected image for upload.');
  }

  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, decode(result.base64), {
      cacheControl: '3600',
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

export async function deleteAvatar(path: string | null | undefined) {
  if (!path) return;

  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) {
    // A failed cleanup must not make an already-saved profile unusable.
    console.warn('Unable to remove old avatar:', error.message);
  }
}

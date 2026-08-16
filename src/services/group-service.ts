import { decode } from 'base64-arraybuffer';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { GroupAvatarSelection, GroupMember, GroupRole } from '@/types/group';

const GROUP_AVATAR_BUCKET = 'group-avatars';
const GROUP_AVATAR_SIZE = 512;

export function getGroupAvatarPublicUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase.storage.from(GROUP_AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function chooseGroupAvatar(): Promise<GroupAvatarSelection | null> {
  if (Platform.OS !== 'web') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new Error('Photo access is required to choose a group picture.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });

  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, width: asset.width || 1, height: asset.height || 1 };
}

export async function uploadGroupAvatar(conversationId: string, localUri: string) {
  const context = ImageManipulator.ImageManipulator.manipulate(localUri);
  context.resize({ width: GROUP_AVATAR_SIZE, height: GROUP_AVATAR_SIZE });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({
    base64: true,
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  if (!result.base64) throw new Error('Unable to prepare the group picture.');

  const path = `${conversationId}/avatar-${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from(GROUP_AVATAR_BUCKET)
    .upload(path, decode(result.base64), {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw new Error(error.message);
  return path;
}

export async function removeGroupAvatarObject(path: string | null | undefined) {
  if (!path) return;
  const { error } = await supabase.storage.from(GROUP_AVATAR_BUCKET).remove([path]);
  if (error) console.warn('Unable to remove old group avatar:', error.message);
}

export async function createGroupConversation(title: string, memberUserIds: string[]) {
  const { data, error } = await supabase.rpc('create_group_conversation', {
    group_title: title.trim(),
    member_user_ids: memberUserIds,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('PulseChat could not create this group.');
  return data;
}

export async function listGroupMembers(conversationId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase.rpc('list_group_members', {
    target_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function addGroupMembers(conversationId: string, userIds: string[]) {
  const { data, error } = await supabase.rpc('add_group_members', {
    target_conversation_id: conversationId,
    new_user_ids: userIds,
  });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function removeGroupMember(conversationId: string, userId: string) {
  const { error } = await supabase.rpc('remove_group_member', {
    target_conversation_id: conversationId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function setGroupMemberRole(
  conversationId: string,
  userId: string,
  role: Exclude<GroupRole, 'owner'>,
) {
  const { error } = await supabase.rpc('set_group_member_role', {
    target_conversation_id: conversationId,
    target_user_id: userId,
    target_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function transferGroupOwnership(conversationId: string, userId: string) {
  const { error } = await supabase.rpc('transfer_group_ownership', {
    target_conversation_id: conversationId,
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
}

export async function leaveGroupConversation(conversationId: string) {
  const { error } = await supabase.rpc('leave_group_conversation', {
    target_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
}

export async function updateGroupProfile(input: {
  conversationId: string;
  title: string;
  avatarPath: string | null;
}) {
  const { error } = await supabase.rpc('update_group_profile', {
    target_conversation_id: input.conversationId,
    target_title: input.title.trim(),
    target_avatar_path: input.avatarPath,
  });
  if (error) throw new Error(error.message);
}

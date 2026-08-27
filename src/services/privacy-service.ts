import { supabase } from '@/lib/supabase';
import type {
  BlockedUser,
  PrivacySettings,
  ReportReason,
  UserRelationshipState,
} from '@/types/privacy';

export async function getMyPrivacySettings(): Promise<PrivacySettings> {
  const { data, error } = await supabase.rpc('get_my_privacy_settings');
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as PrivacySettings | undefined;
  return row ?? {
    discoverable_by_search: true,
    allow_new_direct_messages: true,
    show_activity_status: true,
  };
}

export async function updateMyPrivacySettings(settings: PrivacySettings): Promise<PrivacySettings> {
  const { data, error } = await supabase.rpc('update_my_privacy_settings', {
    target_discoverable_by_search: settings.discoverable_by_search,
    target_allow_new_direct_messages: settings.allow_new_direct_messages,
    target_show_activity_status: settings.show_activity_status,
  });
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as PrivacySettings | undefined) ?? settings;
}

export async function getUserRelationshipState(userId: string): Promise<UserRelationshipState> {
  const { data, error } = await supabase.rpc('get_user_relationship_state', {
    target_user_id: userId,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0] as UserRelationshipState | undefined;
  if (!row) throw new Error('Unable to load privacy state for this user.');
  return row;
}

export async function blockUser(userId: string) {
  const { error } = await supabase.rpc('block_user', { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function unblockUser(userId: string) {
  const { error } = await supabase.rpc('unblock_user', { target_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function listMyBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('list_my_blocked_users');
  if (error) throw new Error(error.message);
  return (data ?? []) as BlockedUser[];
}

export async function reportUserOrMessage(input: {
  userId: string;
  reason: ReportReason;
  details?: string | null;
  messageId?: string | null;
}) {
  const { data, error } = await supabase.rpc('report_user_or_message', {
    target_user_id: input.userId,
    target_reason: input.reason,
    target_details: input.details?.trim() || null,
    target_message_id: input.messageId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

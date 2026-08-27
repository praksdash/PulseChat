import { supabase } from '@/lib/supabase';
import type { ConversationNotificationState, NotificationPreferences } from '@/types/settings';

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  direct_messages: true,
  group_messages: true,
  show_message_preview: true,
  browser_notifications: true,
};

let cachedNotificationPreferences: NotificationPreferences | null = null;
const preferenceListeners = new Set<(preferences: NotificationPreferences) => void>();

function publishNotificationPreferences(preferences: NotificationPreferences) {
  cachedNotificationPreferences = preferences;
  for (const listener of preferenceListeners) listener(preferences);
}

export function getCachedNotificationPreferences() {
  return cachedNotificationPreferences;
}

export function subscribeToNotificationPreferences(
  listener: (preferences: NotificationPreferences) => void,
) {
  preferenceListeners.add(listener);
  if (cachedNotificationPreferences) listener(cachedNotificationPreferences);
  return () => {
    preferenceListeners.delete(listener);
  };
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc('get_my_notification_preferences', {});
  if (error) throw new Error(error.message);
  const preferences = (data?.[0] as NotificationPreferences | undefined) ?? DEFAULT_NOTIFICATION_PREFERENCES;
  publishNotificationPreferences(preferences);
  return preferences;
}

export async function updateMyNotificationPreferences(
  preferences: NotificationPreferences,
): Promise<NotificationPreferences> {
  const { data, error } = await supabase.rpc('update_my_notification_preferences', {
    target_direct_messages: preferences.direct_messages,
    target_group_messages: preferences.group_messages,
    target_show_message_preview: preferences.show_message_preview,
    target_browser_notifications: preferences.browser_notifications,
  });
  if (error) throw new Error(error.message);
  const saved = (data?.[0] as NotificationPreferences | undefined) ?? preferences;
  publishNotificationPreferences(saved);
  return saved;
}

export async function getMyConversationNotificationState(
  conversationId: string,
): Promise<ConversationNotificationState> {
  if (!conversationId) throw new Error('Conversation is required.');
  const { data, error } = await supabase.rpc('get_my_conversation_notification_state', {
    target_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
  return (data?.[0] as ConversationNotificationState | undefined) ?? { muted_until: null, is_muted: false };
}

export async function setMyConversationMuted(
  conversationId: string,
  muted: boolean,
): Promise<ConversationNotificationState> {
  if (!conversationId) throw new Error('Conversation is required.');
  const { data, error } = await supabase.rpc('set_my_conversation_muted', {
    target_conversation_id: conversationId,
    target_muted: muted,
  });
  if (error) throw new Error(error.message);
  return (data?.[0] as ConversationNotificationState | undefined) ?? { muted_until: null, is_muted: muted };
}

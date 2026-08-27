export type NotificationPreferences = {
  direct_messages: boolean;
  group_messages: boolean;
  show_message_preview: boolean;
  browser_notifications: boolean;
};

export type ConversationNotificationState = {
  muted_until: string | null;
  is_muted: boolean;
};

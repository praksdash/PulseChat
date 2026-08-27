export type PrivacySettings = {
  discoverable_by_search: boolean;
  allow_new_direct_messages: boolean;
  show_activity_status: boolean;
};

export type UserRelationshipState = {
  blocked_by_me: boolean;
  has_direct_conversation: boolean;
  can_start_direct: boolean;
  messaging_available: boolean;
  can_view_activity: boolean;
};

export type BlockedUser = {
  user_id: string;
  display_name: string;
  username: string | null;
  avatar_path: string | null;
  blocked_at: string;
};

export const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'sexual_content', label: 'Sexual content' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'other', label: 'Other' },
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number]['value'];

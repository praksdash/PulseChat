export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          bio: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          username?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          username?: string | null;
          avatar_path?: string | null;
          bio?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_presence: {
        Row: {
          user_id: string;
          last_seen_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_privacy_settings: {
        Row: {
          user_id: string;
          discoverable_by_search: boolean;
          allow_new_direct_messages: boolean;
          show_activity_status: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          discoverable_by_search?: boolean;
          allow_new_direct_messages?: boolean;
          show_activity_status?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          discoverable_by_search?: boolean;
          allow_new_direct_messages?: boolean;
          show_activity_status?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          direct_messages: boolean;
          group_messages: boolean;
          show_message_preview: boolean;
          browser_notifications: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          direct_messages?: boolean;
          group_messages?: boolean;
          show_message_preview?: boolean;
          browser_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          direct_messages?: boolean;
          group_messages?: boolean;
          show_message_preview?: boolean;
          browser_notifications?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      blocked_users: {
        Row: {
          blocker_id: string;
          blocked_user_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_user_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          reported_user_id: string;
          conversation_id: string | null;
          message_id: string | null;
          reason: 'spam' | 'harassment' | 'impersonation' | 'sexual_content' | 'violence' | 'scam' | 'other';
          details: string | null;
          status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          reported_user_id: string;
          conversation_id?: string | null;
          message_id?: string | null;
          reason: 'spam' | 'harassment' | 'impersonation' | 'sexual_content' | 'violence' | 'scam' | 'other';
          details?: string | null;
          status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          reported_user_id?: string;
          conversation_id?: string | null;
          message_id?: string | null;
          reason?: 'spam' | 'harassment' | 'impersonation' | 'sexual_content' | 'violence' | 'scam' | 'other';
          details?: string | null;
          status?: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          kind: 'direct' | 'group';
          direct_key: string | null;
          title: string | null;
          avatar_path: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          last_message_at: string;
        };
        Insert: {
          id?: string;
          kind: 'direct' | 'group';
          direct_key?: string | null;
          title?: string | null;
          avatar_path?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Update: {
          id?: string;
          kind?: 'direct' | 'group';
          direct_key?: string | null;
          title?: string | null;
          avatar_path?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          last_message_at?: string;
        };
        Relationships: [];
      };
      conversation_members: {
        Row: {
          conversation_id: string;
          user_id: string;
          role: 'member' | 'admin' | 'owner';
          joined_at: string;
          last_read_at: string;
          muted_until: string | null;
        };
        Insert: {
          conversation_id: string;
          user_id: string;
          role?: 'member' | 'admin' | 'owner';
          joined_at?: string;
          last_read_at?: string;
          muted_until?: string | null;
        };
        Update: {
          conversation_id?: string;
          user_id?: string;
          role?: 'member' | 'admin' | 'owner';
          joined_at?: string;
          last_read_at?: string;
          muted_until?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_id: string | null;
          client_message_id: string;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string | null;
          reply_to_message_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_id?: string | null;
          client_message_id: string;
          message_type?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body?: string | null;
          reply_to_message_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_id?: string | null;
          client_message_id?: string;
          message_type?: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body?: string | null;
          reply_to_message_id?: string | null;
          created_at?: string;
          edited_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      message_receipts: {
        Row: {
          message_id: string;
          user_id: string;
          delivered_at: string | null;
          read_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          delivered_at?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          delivered_at?: string | null;
          read_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          emoji?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          expo_push_token: string;
          platform: 'android' | 'ios';
          device_name: string | null;
          app_version: string | null;
          enabled: boolean;
          last_registered_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          expo_push_token: string;
          platform: 'android' | 'ios';
          device_name?: string | null;
          app_version?: string | null;
          enabled?: boolean;
          last_registered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          expo_push_token?: string;
          platform?: 'android' | 'ios';
          device_name?: string | null;
          app_version?: string | null;
          enabled?: boolean;
          last_registered_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_delivery_log: {
        Row: {
          id: number;
          message_id: string;
          user_id: string;
          expo_push_token: string;
          status: 'claimed' | 'sent' | 'error';
          ticket_id: string | null;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          message_id: string;
          user_id: string;
          expo_push_token: string;
          status?: 'claimed' | 'sent' | 'error';
          ticket_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          message_id?: string;
          user_id?: string;
          expo_push_token?: string;
          status?: 'claimed' | 'sent' | 'error';
          ticket_id?: string | null;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attachments: {
        Row: {
          id: string;
          message_id: string;
          uploader_id: string | null;
          storage_bucket: string;
          storage_path: string;
          mime_type: string;
          file_name: string | null;
          file_size: number | null;
          width: number | null;
          height: number | null;
          duration_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          uploader_id?: string | null;
          storage_bucket?: string;
          storage_path: string;
          mime_type: string;
          file_name?: string | null;
          file_size?: number | null;
          width?: number | null;
          height?: number | null;
          duration_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          uploader_id?: string | null;
          storage_bucket?: string;
          storage_path?: string;
          mime_type?: string;
          file_name?: string | null;
          file_size?: number | null;
          width?: number | null;
          height?: number | null;
          duration_ms?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      get_my_notification_preferences: {
        Args: Record<string, never>;
        Returns: Array<{
          direct_messages: boolean;
          group_messages: boolean;
          show_message_preview: boolean;
          browser_notifications: boolean;
        }>;
      };
      update_my_notification_preferences: {
        Args: {
          target_direct_messages: boolean;
          target_group_messages: boolean;
          target_show_message_preview: boolean;
          target_browser_notifications: boolean;
        };
        Returns: Array<{
          direct_messages: boolean;
          group_messages: boolean;
          show_message_preview: boolean;
          browser_notifications: boolean;
        }>;
      };
      get_my_conversation_notification_state: {
        Args: { target_conversation_id: string };
        Returns: Array<{
          muted_until: string | null;
          is_muted: boolean;
        }>;
      };
      set_my_conversation_muted: {
        Args: { target_conversation_id: string; target_muted: boolean };
        Returns: Array<{
          muted_until: string | null;
          is_muted: boolean;
        }>;
      };
      register_my_push_token: {
        Args: {
          target_expo_push_token: string;
          target_platform: string;
          target_device_name?: string | null;
          target_app_version?: string | null;
        };
        Returns: string;
      };
      disable_my_push_token: {
        Args: { target_expo_push_token: string };
        Returns: boolean;
      };
      touch_my_last_seen: {
        Args: Record<string, never>;
        Returns: string;
      };
      get_user_last_seen: {
        Args: { target_user_id: string };
        Returns: string | null;
      };
      is_username_available: {
        Args: { candidate: string };
        Returns: boolean;
      };
      search_profiles: {
        Args: { search_term: string; result_limit?: number };
        Returns: Array<{
          id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          bio: string | null;
        }>;
      };
      get_public_profile: {
        Args: { target_user_id: string };
        Returns: Array<{
          id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          bio: string | null;
        }>;
      };
      get_my_privacy_settings: {
        Args: Record<string, never>;
        Returns: Array<{
          discoverable_by_search: boolean;
          allow_new_direct_messages: boolean;
          show_activity_status: boolean;
        }>;
      };
      update_my_privacy_settings: {
        Args: {
          target_discoverable_by_search: boolean;
          target_allow_new_direct_messages: boolean;
          target_show_activity_status: boolean;
        };
        Returns: Array<{
          discoverable_by_search: boolean;
          allow_new_direct_messages: boolean;
          show_activity_status: boolean;
        }>;
      };
      get_user_relationship_state: {
        Args: { target_user_id: string };
        Returns: Array<{
          blocked_by_me: boolean;
          has_direct_conversation: boolean;
          can_start_direct: boolean;
          messaging_available: boolean;
          can_view_activity: boolean;
        }>;
      };
      block_user: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      unblock_user: {
        Args: { target_user_id: string };
        Returns: undefined;
      };
      list_my_blocked_users: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          blocked_at: string;
        }>;
      };
      report_user_or_message: {
        Args: {
          target_user_id: string;
          target_reason: 'spam' | 'harassment' | 'impersonation' | 'sexual_content' | 'violence' | 'scam' | 'other';
          target_details?: string | null;
          target_message_id?: string | null;
        };
        Returns: string;
      };
      create_or_get_direct_conversation: {
        Args: { target_user_id: string };
        Returns: string;
      };
      list_my_conversations: {
        Args: { result_limit?: number };
        Returns: Array<{
          conversation_id: string;
          kind: 'direct' | 'group';
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          peer_user_id: string | null;
          member_count: number;
          my_role: 'member' | 'admin' | 'owner';
          last_message_preview: string | null;
          last_message_sender_id: string | null;
          last_message_sender_name: string | null;
          last_message_created_at: string | null;
          last_activity_at: string;
          unread_count: number;
        }>;
      };
      get_conversation_summary: {
        Args: { target_conversation_id: string };
        Returns: Array<{
          conversation_id: string;
          kind: 'direct' | 'group';
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          peer_user_id: string | null;
          member_count: number;
          my_role: 'member' | 'admin' | 'owner';
          created_at: string;
          last_activity_at: string;
        }>;
      };
      list_conversation_messages: {
        Args: {
          target_conversation_id: string;
          before_created_at?: string | null;
          before_id?: string | null;
          result_limit?: number;
        };
        Returns: Array<{
          id: string;
          conversation_id: string;
          sender_id: string | null;
          sender_display_name: string | null;
          sender_avatar_path: string | null;
          client_message_id: string;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string | null;
          reply_to_message_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          delivery_status: 'sent' | 'delivered' | 'read' | null;
          attachment_id: string | null;
          attachment_storage_bucket: string | null;
          attachment_storage_path: string | null;
          attachment_mime_type: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          attachment_width: number | null;
          attachment_height: number | null;
          attachment_duration_ms: number | null;
          reply_sender_id: string | null;
          reply_sender_display_name: string | null;
          reply_message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system' | null;
          reply_body: string | null;
          reply_deleted_at: string | null;
          reaction_counts: Json;
          my_reaction: string | null;
        }>;
      };
      get_message_detail: {
        Args: { target_message_id: string };
        Returns: Array<{
          id: string;
          conversation_id: string;
          sender_id: string | null;
          sender_display_name: string | null;
          sender_avatar_path: string | null;
          client_message_id: string;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string | null;
          reply_to_message_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          delivery_status: 'sent' | 'delivered' | 'read' | null;
          attachment_id: string | null;
          attachment_storage_bucket: string | null;
          attachment_storage_path: string | null;
          attachment_mime_type: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          attachment_width: number | null;
          attachment_height: number | null;
          attachment_duration_ms: number | null;
          reply_sender_id: string | null;
          reply_sender_display_name: string | null;
          reply_message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system' | null;
          reply_body: string | null;
          reply_deleted_at: string | null;
          reaction_counts: Json;
          my_reaction: string | null;
        }>;
      };
      create_image_message: {
        Args: {
          target_conversation_id: string;
          target_client_message_id: string;
          target_storage_path: string;
          target_file_name?: string | null;
          target_file_size?: number | null;
          target_width?: number | null;
          target_height?: number | null;
          target_caption?: string | null;
          target_reply_to_message_id?: string | null;
        };
        Returns: Array<{
          id: string;
          conversation_id: string;
          sender_id: string | null;
          sender_display_name: string | null;
          sender_avatar_path: string | null;
          client_message_id: string;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string | null;
          reply_to_message_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          delivery_status: 'sent' | 'delivered' | 'read' | null;
          attachment_id: string | null;
          attachment_storage_bucket: string | null;
          attachment_storage_path: string | null;
          attachment_mime_type: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          attachment_width: number | null;
          attachment_height: number | null;
          attachment_duration_ms: number | null;
          reply_sender_id: string | null;
          reply_sender_display_name: string | null;
          reply_message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system' | null;
          reply_body: string | null;
          reply_deleted_at: string | null;
          reaction_counts: Json;
          my_reaction: string | null;
        }>;
      };
      edit_message: {
        Args: { target_message_id: string; target_body: string };
        Returns: undefined;
      };
      delete_message: {
        Args: { target_message_id: string };
        Returns: Array<{
          message_id: string;
          conversation_id: string;
          storage_bucket: string | null;
          storage_path: string | null;
        }>;
      };
      set_message_reaction: {
        Args: { target_message_id: string; target_emoji?: string | null };
        Returns: string | null;
      };

      create_group_conversation: {
        Args: { group_title: string; member_user_ids?: string[] };
        Returns: string;
      };
      list_group_members: {
        Args: { target_conversation_id: string };
        Returns: Array<{
          user_id: string;
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          role: 'member' | 'admin' | 'owner';
          joined_at: string;
          is_self: boolean;
        }>;
      };
      add_group_members: {
        Args: { target_conversation_id: string; new_user_ids: string[] };
        Returns: number;
      };
      remove_group_member: {
        Args: { target_conversation_id: string; target_user_id: string };
        Returns: undefined;
      };
      set_group_member_role: {
        Args: { target_conversation_id: string; target_user_id: string; target_role: 'member' | 'admin' };
        Returns: undefined;
      };
      transfer_group_ownership: {
        Args: { target_conversation_id: string; target_user_id: string };
        Returns: undefined;
      };
      leave_group_conversation: {
        Args: { target_conversation_id: string };
        Returns: undefined;
      };
      update_group_profile: {
        Args: { target_conversation_id: string; target_title: string; target_avatar_path?: string | null };
        Returns: undefined;
      };
      search_my_conversations: {
        Args: { search_term: string; result_limit?: number };
        Returns: Array<{
          conversation_id: string;
          kind: 'direct' | 'group';
          display_name: string;
          username: string | null;
          avatar_path: string | null;
          peer_user_id: string | null;
          member_count: number;
          my_role: 'member' | 'admin' | 'owner';
          last_message_preview: string | null;
          last_message_sender_id: string | null;
          last_message_sender_name: string | null;
          last_message_created_at: string | null;
          last_activity_at: string;
          unread_count: number;
        }>;
      };
      search_my_messages: {
        Args: {
          search_term: string;
          before_created_at?: string | null;
          before_id?: string | null;
          result_limit?: number;
        };
        Returns: Array<{
          message_id: string;
          conversation_id: string;
          conversation_kind: 'direct' | 'group';
          conversation_display_name: string;
          conversation_avatar_path: string | null;
          sender_id: string | null;
          sender_display_name: string | null;
          sender_avatar_path: string | null;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string;
          match_snippet: string;
          created_at: string;
          edited_at: string | null;
        }>;
      };
      get_message_window: {
        Args: { focus_message_id: string; before_count?: number; after_count?: number };
        Returns: Array<{
          id: string;
          conversation_id: string;
          sender_id: string | null;
          sender_display_name: string | null;
          sender_avatar_path: string | null;
          client_message_id: string;
          message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system';
          body: string | null;
          reply_to_message_id: string | null;
          created_at: string;
          edited_at: string | null;
          deleted_at: string | null;
          delivery_status: 'sent' | 'delivered' | 'read' | null;
          attachment_id: string | null;
          attachment_storage_bucket: string | null;
          attachment_storage_path: string | null;
          attachment_mime_type: string | null;
          attachment_file_name: string | null;
          attachment_file_size: number | null;
          attachment_width: number | null;
          attachment_height: number | null;
          attachment_duration_ms: number | null;
          reply_sender_id: string | null;
          reply_sender_display_name: string | null;
          reply_message_type: 'text' | 'image' | 'video' | 'audio' | 'voice' | 'file' | 'system' | null;
          reply_body: string | null;
          reply_deleted_at: string | null;
          reaction_counts: Json;
          my_reaction: string | null;
        }>;
      };
      get_my_total_unread_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      mark_conversation_delivered: {
        Args: { target_conversation_id: string };
        Returns: number;
      };
      mark_conversation_read: {
        Args: { target_conversation_id: string };
        Returns: number;
      };
      mark_all_pending_delivered: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type UserPresence = Database['public']['Tables']['user_presence']['Row'];
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type ConversationMember = Database['public']['Tables']['conversation_members']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type MessageReceipt = Database['public']['Tables']['message_receipts']['Row'];
export type MessageReaction = Database['public']['Tables']['message_reactions']['Row'];
export type Attachment = Database['public']['Tables']['attachments']['Row'];

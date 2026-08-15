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
          last_message_preview: string | null;
          last_message_sender_id: string | null;
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
        };
        Returns: Array<{
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
export type Attachment = Database['public']['Tables']['attachments']['Row'];

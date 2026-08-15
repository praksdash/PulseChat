import type { Database, Message } from '@/types/database';

export type MessagePageDatabaseRow =
  Database['public']['Functions']['list_conversation_messages']['Returns'][number];

export type MessagePageRow = MessagePageDatabaseRow & {
  signed_media_url?: string | null;
};

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';
export type MessageLocalState = 'sending' | MessageDeliveryStatus | 'failed';
export type MediaSendStage = 'preparing' | 'uploading' | 'committing' | 'ready' | 'failed';
export type SupportedReaction = '👍' | '❤️' | '😂' | '😮' | '😢' | '🙏';

export const SUPPORTED_REACTIONS: SupportedReaction[] = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export type MessageReactionSummary = {
  emoji: SupportedReaction;
  count: number;
};

export type ReplyPreview = {
  messageId: string;
  senderId: string | null;
  messageType: Message['message_type'];
  body: string | null;
  deletedAt: string | null;
};

export type ChatAttachment = {
  id: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string;
  fileName: string | null;
  fileSize: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  signedUrl: string | null;
};

export type PendingImageAsset = {
  uri: string;
  width: number;
  height: number;
  fileName: string | null;
};

export type ChatMessage = Message & {
  isOptimistic?: boolean;
  localState?: MessageLocalState;
  attachment?: ChatAttachment | null;
  localMediaUri?: string | null;
  mediaSendStage?: MediaSendStage;
  pendingImageAsset?: PendingImageAsset;
  replyPreview?: ReplyPreview | null;
  reactions?: MessageReactionSummary[];
  myReaction?: SupportedReaction | null;
};

export type MessageCursor = {
  createdAt: string;
  id: string;
};

export type ReceiptCursorEvent = {
  type: 'delivered' | 'read';
  conversationId: string;
  recipientUserId: string;
  throughCreatedAt: string;
};

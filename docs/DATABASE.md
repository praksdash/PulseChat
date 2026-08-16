# PulseChat Database

## Core model

```text
auth.users
   │
   ├── profiles
   ├── conversation_members ─── conversations
   └── messages ────────────────┬── message_receipts
                                └── attachments
```

## `public.messages`
Durable message source of truth. Important guarantees:
- `UNIQUE(sender_id, client_message_id)` for retry idempotency
- `(conversation_id, created_at DESC, id DESC)` for cursor pagination
- member-only read RLS
- sender-self/member-only insert RLS

## `public.message_receipts`
One row per message recipient.

Fields:
- `message_id`
- `user_id` recipient
- `delivered_at`
- `read_at`
- audit timestamps

Rules:
- sender does not get their own receipt row
- read requires delivered
- one row per `(message_id, user_id)`
- `message_receipts_user_unread_idx` accelerates own unread lookup

Phase 10 `create_message_receipts` trigger populates recipient rows after message insert and the migration backfills prior Phase 9 messages.

## Phase 10 RPCs

### `list_conversation_messages(...)`
Returns the Phase 9 page plus `delivery_status` for caller-owned outgoing messages:
- `sent`
- `delivered`
- `read`

For multiple recipients, delivered/read becomes true only when every receipt row reaches that state.

### `list_my_conversations(result_limit)`
Returns the existing conversation summary plus `unread_count` calculated from current-user receipt rows where `read_at IS NULL`.

### `get_my_total_unread_count()`
Lightweight total unread count for the Chats tab badge.

### `mark_conversation_delivered(conversation_id)`
Batch-fills current user's pending `delivered_at` values and emits one receipt cursor event.

### `mark_conversation_read(conversation_id)`
Batch-fills delivered/read, advances current membership `last_read_at`, and emits one read cursor event.

### `mark_all_pending_delivered()`
Startup/reconnect reconciliation for messages persisted while no WebSocket session existed.

## Realtime
Message INSERT remains durable first. The Phase 9 trigger is extended in Phase 10 to additionally send minimal `inbox_message` events to each recipient's private `user:<uuid>` topic.

## Phase 11 — Presence

`public.user_presence` stores only durable `last_seen_at` and `updated_at` timestamps. It does not store an `is_online` flag because online/offline is ephemeral and comes from Supabase Realtime Presence.

Direct table access is revoked from mobile roles. The app uses `touch_my_last_seen()` for its own heartbeat and `get_user_last_seen(target_user_id)` only for users that share a conversation with the caller.

## Phase 12 attachment/media architecture

`public.attachments` is now active for image messages. One Phase 12 image message has one attachment row with:
- `message_id`
- uploader
- private `chat-media` bucket/path
- MIME type
- original file name
- compressed byte size
- width/height

The durable database stores only the private object path, never a permanent public URL. `list_conversation_messages` projects the attachment fields alongside each message; the client then requests a temporary signed URL through Storage RLS.

Image DB creation is performed by `create_image_message`, which uses the existing `(sender_id, client_message_id)` uniqueness guarantee for idempotent retry.

## Phase 13 message actions

### message_reactions

One active reaction per user per message:
- `message_id` → messages
- `user_id` → auth.users
- `emoji`
- `created_at`
- `updated_at`

Primary key: `(message_id, user_id)`.
Allowed MVP reactions: 👍 ❤️ 😂 😮 😢 🙏.

### Message mutation RPCs

- `edit_message(message_id, body)` — derives actor from `auth.uid()` and permits only the sender.
- `delete_message(message_id)` — sender-only soft delete, clears content and attachment metadata.
- `set_message_reaction(message_id, emoji)` — current-user reaction set/remove.
- `get_message_detail(message_id)` — one-row authorized projection for realtime reconciliation.

`list_conversation_messages` now returns reply preview and aggregate reaction state with each row.

## Phase 14 group chats

Groups reuse the existing `conversations` + `conversation_members` model; there is no duplicate group-message table.

- `conversations.kind = 'group'`
- `conversations.title` stores the group name
- `conversations.avatar_path` stores the `group-avatars` object path
- `conversation_members.role` is `owner`, `admin`, or `member`

Group mutations use narrow authenticated RPCs rather than direct membership INSERT/DELETE privileges:
- `create_group_conversation`
- `list_group_members`
- `add_group_members`
- `remove_group_member`
- `set_group_member_role`
- `transfer_group_ownership`
- `leave_group_conversation`
- `update_group_profile`

The message projection now includes sender display name/avatar and reply-sender display name so group bubbles can identify incoming authors without exposing auth email data.

Phase 10 receipt rows were already group-ready: every non-sender member receives one receipt row for messages created while they are a member. Removing/leaving a group deletes that user's receipt rows for the group so aggregate sender status reflects remaining recipients.

## Phase 15 push notifications

### `public.push_tokens`
One row per Expo push token. Important fields: `user_id`, `expo_push_token`, `platform`, `device_name`, `app_version`, `enabled`, `last_registered_at`.

Direct writes are denied. `register_my_push_token()` derives ownership from `auth.uid()` and safely moves a token to the currently authenticated account if the same installation changes account. `disable_my_push_token()` can disable only the caller's own token.

### `public.push_delivery_log`
Server-only idempotency/ticket ledger. `UNIQUE(message_id, expo_push_token)` prevents a Database Webhook retry from generating duplicate notifications for the same physical registration.

### Service-only RPCs
- `claim_push_deliveries(message_id, deliveries_json)` atomically claims only enabled token/recipient pairs that have a real message receipt.
- `get_push_unread_counts(user_ids)` returns aggregate durable unread counts for notification badges.

Clients cannot execute these two dispatcher RPCs.

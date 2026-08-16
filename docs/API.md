# PulseChat API / Data Access

## Profile/discovery RPCs
- `is_username_available`
- `search_profiles`
- `get_public_profile`

## Conversation RPCs
- `create_or_get_direct_conversation`
- `list_my_conversations` — now includes `unread_count`
- `get_conversation_summary`
- `get_my_total_unread_count`

## Message RPC
### `list_conversation_messages(...)`
Phase 10 output includes `delivery_status` for the current sender's outgoing rows while retaining stable cursor pagination and message-table RLS.

## Receipt RPCs
### `mark_conversation_delivered(target_conversation_id)`
Marks the authenticated recipient's pending receipt rows delivered.

### `mark_conversation_read(target_conversation_id)`
Marks pending receipt rows delivered/read and advances `last_read_at`.

### `mark_all_pending_delivered()`
Marks persisted messages delivered when the authenticated app reconnects/starts.

## Direct message write
The client still inserts text messages through `public.messages` with Phase 6 column privileges/RLS and `client_message_id` idempotency.

## Realtime topics
### `conversation:<uuid>`
Private. Membership-authorized. Events:
- `INSERT` — committed new message
- `receipt_delivered`
- `receipt_read`

### `user:<uuid>`
Private. Self-authorized only. Event:
- `inbox_message` — minimal notification that one of the user's conversations received a durable message

## Phase 11 RPCs

### `touch_my_last_seen()`
Updates only the authenticated user's durable `last_seen_at` timestamp.

### `get_user_last_seen(target_user_id uuid)`
Returns a last-seen timestamp only for self or a user sharing a conversation with the caller.

### Realtime topics
- `presence:<user_uuid>` — Presence online/offline state.
- `typing:<conversation_uuid>` — ephemeral typing Broadcast.

## Phase 12 image media

### `create_image_message(...)`
Authenticated `SECURITY DEFINER` RPC. Derives the sender from `auth.uid()`, verifies conversation membership, requires the canonical private Storage path, and idempotently creates/reuses one `image` message plus its `attachments` row.

### `list_conversation_messages(...)`
Phase 12 extends each row with the first attachment's ID, private storage path, MIME type, original file name, size and dimensions. The private object URL is not stored in PostgreSQL; clients generate temporary signed URLs after RLS-authorized history access.

### Storage bucket `chat-media`
Private. Object format:
`<conversation_uuid>/<uploader_uuid>/<client_message_uuid>.jpg`

Members may read objects for their conversations. Upload/delete requires the object's uploader folder to match `auth.uid()`.

### Realtime event `media_message_ready`
Private `conversation:<uuid>` Broadcast sent after image attachment metadata commits. Clients reconcile message history so the ordinary message INSERT event cannot race attachment creation.

## Phase 13 RPCs

### edit_message
Inputs: `target_message_id`, `target_body`.
Sender-only edit of text/image caption.

### delete_message
Input: `target_message_id`.
Returns message/conversation plus optional media storage path for uploader cleanup.

### set_message_reaction
Inputs: `target_message_id`, optional `target_emoji`.
Null removes the caller's reaction.

### get_message_detail
Input: `target_message_id`.
Returns the authorized Phase 13 message projection used after mutation Broadcast events.

## Phase 14 RPCs

- `create_group_conversation(group_title, member_user_ids)` → group UUID
- `list_group_members(conversation_id)` → safe public member projection
- `add_group_members(conversation_id, user_ids)` → added count
- `remove_group_member(conversation_id, user_id)`
- `set_group_member_role(conversation_id, user_id, member|admin)`
- `transfer_group_ownership(conversation_id, user_id)`
- `leave_group_conversation(conversation_id)`
- `update_group_profile(conversation_id, title, avatar_path)`

No RPC accepts an acting-user ID; authorization always derives the actor from `auth.uid()`.

## Phase 15 RPC/API surface

### Authenticated client RPCs
`register_my_push_token(target_expo_push_token, target_platform, target_device_name, target_app_version)` registers/reassigns the current installation to `auth.uid()`.

`disable_my_push_token(target_expo_push_token)` disables only the caller-owned registration.

### Server-only RPCs
`claim_push_deliveries(target_message_id, target_deliveries)` atomically deduplicates push work.

`get_push_unread_counts(target_user_ids)` supplies per-user badge counts to the Edge Function.

### Edge Function
`send-message-push` accepts only the Supabase Database Webhook POST payload for `public.messages` INSERT and requires the private `x-pulsechat-webhook-secret` header.


## Phase 16 search RPCs
- `search_my_conversations(search_term, result_limit)` — authenticated chat search.
- `search_my_messages(search_term, before_created_at, before_id, result_limit)` — authenticated message search with cursor pagination.
- `get_message_window(focus_message_id, before_count, after_count)` — authorized context window for jump-to-message.

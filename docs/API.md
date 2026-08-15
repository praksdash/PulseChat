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

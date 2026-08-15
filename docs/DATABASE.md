# PulseChat Database

## Phase 6 relational model

```text
auth.users
   │
   ├────────────── 1:1 ──────────────► profiles
   │
   ├────────────── 1:N ──────────────► conversation_members
   │                                      │
   │                                      ▼
   │                                  conversations
   │                                      │
   ├────────────── 1:N ──────────────► messages
   │                                      │
   │                                      ├────────► message_receipts
   │                                      └────────► attachments
   │
   └──────────────────────────────────────► receipt/member ownership
```

## `public.profiles`
Created in Phase 4 and expanded in Phase 5.

- `id uuid` — PK/FK to `auth.users(id)`
- `display_name text` — required, 2–60 characters
- `username text` — optional, globally unique, lowercase `a-z0-9_`, 3–32 characters
- `avatar_path text` — optional avatar object path owned by the profile UUID folder
- `bio text` — optional, max 160 characters
- `created_at timestamptz`
- `updated_at timestamptz`

Phase 7 adds controlled authenticated discovery through narrow database functions while normal profile-table SELECT remains self-only.

### Phase 7 discovery API

`public.search_profiles(search_term, result_limit)` searches only display name/username and returns safe public fields. It requires at least 2 characters and caps output at 20 rows.

`public.get_public_profile(target_user_id)` returns the same safe fields for one profile route. Neither function exposes auth email or metadata.

Trigram GIN indexes on lowercase `display_name` and `username` support substring discovery without changing profile RLS.

## `public.conversations`
One row per direct or group conversation.

- `id uuid` — primary key
- `kind` — `direct` or `group`
- `direct_key` — canonical sorted UUID pair for direct-chat uniqueness
- `title` — required only for groups
- `avatar_path` — future group avatar
- `created_by` — auth user who created the conversation; nullable after account deletion
- `created_at`
- `updated_at`
- `last_message_at` — cached activity timestamp for fast chat-list ordering

A partial unique index on `direct_key` prevents duplicate direct conversations for the same canonical pair. Phase 8 will be the only normal app path that creates direct conversations and memberships.

## `public.conversation_members`
Normalized many-to-many membership table.

Primary key: `(conversation_id, user_id)`.

- `role` — `member`, `admin`, or `owner`
- `joined_at`
- `last_read_at` — read cursor used for unread-count queries
- `muted_until` — nullable local notification/mute state

Direct conversations are limited to two `member` rows by a defensive trigger. Client roles do not receive INSERT/DELETE privileges on membership rows.

## `public.messages`
Durable source of truth for messages.

- `id uuid` — server-generated primary key
- `conversation_id`
- `sender_id` — set null if the user account is removed, preserving conversation history
- `client_message_id` — client-generated retry/idempotency key
- `message_type` — `text`, `image`, `video`, `audio`, `voice`, `file`, `system`
- `body` — max 10,000 characters; required for non-deleted text messages
- `reply_to_message_id` — optional reply target
- `created_at` — server timestamp
- `edited_at`
- `deleted_at` — future soft-delete support

Unique `(sender_id, client_message_id)` prevents duplicate inserts caused by retries/reconnects.

The self-referencing composite foreign key `(reply_to_message_id, conversation_id)` guarantees that a reply cannot point at a message from a different conversation.

### Message pagination index

```text
(conversation_id, created_at DESC, id DESC)
```

This supports cursor pagination without repeatedly fetching an entire conversation.

## `public.message_receipts`
Per-user delivery and read state.

Primary key: `(message_id, user_id)`.

- `delivered_at`
- `read_at`
- `created_at`
- `updated_at`

`read_at` cannot exist unless `delivered_at` exists and cannot be earlier than delivery.

The recipient updates only their own row. Conversation members can read receipts so senders can display delivered/read state.

## `public.attachments`
Metadata foundation created now so later media support does not require redesigning messages.

- `id`
- `message_id`
- `uploader_id`
- `storage_bucket` — currently constrained to future `chat-media`
- `storage_path`
- `mime_type`
- `file_name`
- `file_size`
- `width`, `height`
- `duration_ms`
- `created_at`

The `chat-media` Storage bucket and attachment-write privileges are intentionally deferred to Phase 12.

## Activity trigger
A successful message INSERT advances `conversations.last_message_at`. This keeps chat-list ordering cheap without duplicating message text into the conversation row.

## Direct-conversation lifecycle
Phase 6 creates the uniqueness primitive (`direct_key`) but does not expose conversation creation to the client.

Phase 8 will add a narrow transactional database function that:

1. validates the target user,
2. computes the canonical pair key,
3. returns an existing direct conversation if present,
4. otherwise creates one conversation,
5. creates exactly two member rows,
6. returns the conversation id.

That avoids a race where two devices create duplicate direct chats.

## Future migrations
- Phase 7: controlled user discovery ✅
- Phase 8: direct-chat creation RPC and real chat list
- Phase 9: text-message service + Realtime Broadcast
- Phase 10: delivery/read service
- Phase 12: `chat-media` Storage + attachment writes
- Phase 13: edit/delete/reactions
- Phase 14: group creation/member administration

# PulseChat Architecture

## Current application architecture

```text
Expo / React Native / TypeScript
        │
        ├── Expo Router
        ├── AuthProvider
        ├── UI/theme
        ├── profile/discovery services
        ├── conversation service
        ├── message + receipt services
        ├── authenticated inbox Realtime service
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 │      ├── profiles/discovery
                 │      ├── conversations/members
                 │      ├── durable messages
                 │      └── per-recipient receipts
                 ├── Supabase Realtime Broadcast
                 │      ├── conversation:<uuid>
                 │      └── user:<uuid>
                 └── Supabase Storage
                        └── avatars
```

## Phase 10 message lifecycle

```text
A taps Send
   ↓
optimistic message
   ↓
INSERT public.messages
   ↓
receipt trigger creates B receipt (null/null)
   ↓
commit
   ├── conversation:<uuid> INSERT broadcast
   └── user:<B uuid> inbox_message broadcast
                         ↓
                     B app connected
                         ↓
               mark_conversation_delivered
                         ↓
                receipt.delivered_at
                         ↓
        conversation:<uuid> receipt_delivered
                         ↓
                    A shows ✓✓

B opens chat while app active
   ↓
mark_conversation_read
   ↓
receipt.read_at + member.last_read_at
   ↓
conversation:<uuid> receipt_read
   ↓
A shows read-colored ✓✓
```

## Source of truth
PostgreSQL remains authoritative for both message content and receipt state. Realtime events are hints for low-latency UI updates. Message/history refetches restore state after reconnect or app restart.

## Inbox topic
`user:<auth uid>` is a private database-Broadcast topic. Only that authenticated user may subscribe. It contains only minimal message identifiers/timestamps, not another user's private profile/auth data.

## Conversation topic
`conversation:<conversation uuid>` remains private and membership-authorized. It carries committed message inserts plus receipt cursor events.

## Receipt cursor events
Receipt updates are broadcast as a monotonic `through_created_at` cursor instead of one WebSocket event per message. The client updates visible ticks immediately and then reconciles latest PostgreSQL state.

## Unread state
`message_receipts.read_at IS NULL` is the authoritative unread source. `conversation_members.last_read_at` is also maintained as a useful conversation read cursor for later query/UX features.

## Deferred
- Phase 11: presence/typing/last seen
- Phase 12: chat media
- Phase 13: reply/edit/delete/reactions
- Phase 14: group UI/admin semantics

## Phase 12 image send flow

```text
pick/capture image
      ↓
resize to max 1600px + JPEG compress
      ↓
optimistic local photo bubble
      ↓
private Storage upload
conversation/user/client-message.jpg
      ↓
create_image_message RPC
      ├─ durable messages row
      └─ attachments metadata row
      ↓
media_message_ready private Broadcast
      ↓
peer reconciles message history
      ↓
Storage SELECT RLS + temporary signed URL
      ↓
image bubble / full-screen viewer
```

The Storage bucket is private. PostgreSQL remains the source of truth for message/attachment metadata; Storage owns the binary object; Realtime only accelerates reconciliation.

## Phase 13 message mutation flow

```text
Long-press message
      ↓
Reply / Edit / Delete / React
      ↓
PostgreSQL validates auth.uid(), ownership and membership
      ↓
Durable mutation
      ↓
private conversation:<uuid> Broadcast
      ↓
peer fetches get_message_detail(message_id)
      ↓
visible bubble reconciles without full-history reload
```

Edit/delete also fan out a minimal `inbox_message_changed` event to private `user:<uuid>` topics so the Chats preview refreshes when the latest message changes.

Replies use the existing `(reply_to_message_id, conversation_id)` foreign key, guaranteeing that a reply cannot target another conversation.

Deleted image messages remove attachment metadata and are no longer eligible for new Storage signed URLs. Physical object deletion is then attempted by the sender client under uploader-only Storage RLS.

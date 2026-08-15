# PulseChat Architecture

## Current application architecture

```text
Expo / React Native / TypeScript
        │
        ├── Expo Router
        ├── AuthProvider
        ├── reusable UI/theme
        ├── profile + discovery services
        ├── conversation service
        ├── message service + conversation-message hook
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 │      ├── profiles/discovery
                 │      ├── conversations/members
                 │      └── durable messages
                 ├── Supabase Realtime
                 │      └── private conversation:<uuid> Broadcast
                 └── Supabase Storage
                        └── avatars
```

## Phase 9 send flow

```text
User taps Send
      ↓
client generates client_message_id UUID
      ↓
optimistic bubble appears immediately
      ↓
INSERT public.messages
      ↓
Phase 6 RLS verifies sender == auth.uid() + membership
      ↓
UNIQUE(sender_id, client_message_id) prevents retry duplicates
      ↓
PostgreSQL commits durable row
      ├── touch conversation.last_message_at
      └── Phase 9 AFTER INSERT trigger
                 ↓
        realtime.broadcast_changes()
                 ↓
       private topic conversation:<uuid>
                 ↓
      authorized conversation members
```

The application never treats a WebSocket event as durable storage. Initial load and reconnect reconciliation always read PostgreSQL.

## Realtime authorization

Clients subscribe with:

```text
conversation:<conversation UUID>
private = true
```

A SELECT policy on `realtime.messages` permits Broadcast reception only when `auth.uid()` has a matching row in `public.conversation_members` for that topic. Phase 9 does not grant app clients INSERT permission into Realtime Broadcast topics; sends happen through durable `public.messages` INSERTs.

## Message history

```text
Newest 30
   ↓ user scrolls upward
cursor = oldest server (created_at, id)
   ↓
previous 30
```

`public.list_conversation_messages` is `SECURITY INVOKER`, so normal `messages` RLS remains active. The existing `(conversation_id, created_at DESC, id DESC)` index supports the ordering/cursor.

## Optimistic retry

```text
optimistic client_message_id X
        ↓
request reaches DB but network response is lost
        ↓
retry uses X again
        ↓
UNIQUE violation instead of duplicate row
        ↓
client fetches committed row for X
        ↓
optimistic bubble becomes server bubble
```

## Deferred responsibilities
- Phase 10: delivery/read receipts + unread/read cursor UI
- Phase 11: typing/presence
- Phase 12: media storage/messages
- Phase 13: replies/edit/delete/reactions
- Phase 14: group management

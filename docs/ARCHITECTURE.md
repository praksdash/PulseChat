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
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 │      ├── self-only profile table access
                 │      ├── controlled discovery RPCs
                 │      ├── messaging schema/RLS
                 │      └── Phase 8 conversation RPCs
                 └── Supabase Storage (avatars)
```

## Phase 8 direct-chat flow

```text
Discovered user profile
        │
        ▼
Start chat
        │
        ▼
conversation-service
        │
        ▼
public.create_or_get_direct_conversation(target_user_id)
        │
        ├── require auth.uid()
        ├── reject self-chat
        ├── validate target profile
        ├── compute canonical direct_key
        ├── INSERT conversation ON CONFLICT DO NOTHING
        ├── create exactly two member rows if new
        └── return conversation UUID
                │
                ▼
       /chat/[conversationId]
```

The partial unique index on `conversations.direct_key` is the database-level race-condition boundary. Two clients can request the same pair concurrently, but only one direct-conversation row can commit.

## Real Chats list

```text
Chats tab focus / pull refresh
        │
        ▼
listMyConversations()
        │
        ▼
public.list_my_conversations()
        │
        ├── filters by auth.uid() membership
        ├── joins only safe peer profile fields
        ├── returns latest message preview metadata
        └── orders by conversation activity
                │
                ▼
              ChatRow
```

`public.profiles` remains self-only through normal table RLS. The security-definer conversation RPC exposes only the peer fields the chat UI needs.

## Conversation route protection
`get_conversation_summary` returns a row only when the caller has a `conversation_members` row for the target UUID. Knowing a conversation UUID is not sufficient to retrieve its header context.

## Message lifecycle prepared for Phase 9

```text
client creates client_message_id
        ↓
optimistic message
        ↓
INSERT public.messages
        ↓
RLS sender/member check
        ↓
unique(sender_id, client_message_id) dedupe
        ↓
server created_at ordering
        ↓
conversation.last_message_at trigger
        ↓
Realtime Broadcast after commit (Phase 9)
```

## Deferred responsibilities
- Phase 9: text messaging + Realtime Broadcast + pagination
- Phase 10: delivery/read UI and service
- Phase 11: typing/presence
- Phase 12: media storage
- Phase 14: group management

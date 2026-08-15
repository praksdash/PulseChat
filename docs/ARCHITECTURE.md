# PulseChat Architecture

## Current application architecture

```text
Expo / React Native / TypeScript
        │
        ├── Expo Router
        ├── AuthProvider
        ├── reusable UI/theme
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 └── Supabase Storage (avatars)
```

## Phase 6 database architecture

```text
Mobile client
    │
    │ publishable key + authenticated JWT
    ▼
Supabase Data API
    │
    ├── PostgreSQL grants
    └── Row Level Security
            │
            ▼
    conversation_members
            │
      authorization root
       /      |       \
      ▼       ▼        ▼
conversations messages receipts
                    │
                    ▼
                attachments
```

`conversation_members` is the authorization root for messaging. Membership checks live in non-exposed PulseChat-private database helpers to avoid recursive RLS policies.

## Message lifecycle prepared by Phase 6

```text
client creates client_message_id
        ↓
INSERT messages
        ↓
RLS checks sender + membership
        ↓
PostgreSQL uniqueness deduplicates retries
        ↓
server created_at establishes durable ordering
        ↓
trigger advances conversation.last_message_at
        ↓
Phase 9 will Broadcast the committed event
```

Realtime is intentionally not enabled in Phase 6. Durable database persistence remains the source of truth; Realtime will be an event-delivery layer, not a replacement for the database.

## Type safety
`src/types/database.ts` contains the Phase 6 Supabase schema types, and `src/lib/supabase.ts` now creates a typed Supabase client. This lets later chat services compile against explicit message/conversation shapes.

## Deferred responsibilities
- Phase 7: user discovery
- Phase 8: transactional direct-chat creation
- Phase 9: database-backed chat list/text messaging and Realtime Broadcast
- Phase 10: delivery/read UI and service
- Phase 12: media storage
- Phase 14: group management

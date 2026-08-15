# PulseChat Architecture

## Current application architecture

```text
Expo / React Native / TypeScript
        │
        ├── Expo Router
        ├── AuthProvider
        ├── reusable UI/theme
        ├── profile + discovery services
        └── typed Supabase client
                 │
                 ├── Supabase Auth
                 ├── PostgreSQL + RLS
                 │      ├── self-only profile table access
                 │      ├── controlled discovery RPCs
                 │      └── messaging schema/RLS
                 └── Supabase Storage (avatars)
```

## Phase 7 discovery architecture

```text
Search input
    │
    ├── minimum 2 characters
    └── 350 ms debounce
            │
            ▼
user-discovery-service
            │
            ▼
public.search_profiles RPC
            │
            ├── authenticated only
            ├── max 20 results
            ├── excludes auth.uid()
            ├── searches name/username
            └── returns safe fields only
                    │
                    ▼
               Search results
                    │
                    ▼
             /users/[userId]
                    │
                    ▼
public.get_public_profile RPC
```

The app does not broaden `public.profiles` RLS for discovery. A client that directly queries the table still sees only its own row. Narrow `SECURITY DEFINER` RPCs provide the public discovery projection without exposing email or auth metadata.

## Phase 6 messaging architecture

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

`conversation_members` remains the authorization root for messaging. Membership checks live in non-exposed PulseChat-private database helpers to avoid recursive RLS policies.

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

## Type safety
`src/types/database.ts` includes typed profile-discovery RPCs and Phase 6 table shapes. `src/lib/supabase.ts` creates the typed Supabase client used by profile, discovery and future chat services.

## Deferred responsibilities
- Phase 8: transactional direct-chat creation + real chat list
- Phase 9: text messaging + Realtime Broadcast
- Phase 10: delivery/read UI and service
- Phase 11: typing/presence
- Phase 12: media storage
- Phase 14: group management

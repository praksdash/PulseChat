# PulseChat API / Data Access

## Profile/discovery RPCs

### `public.is_username_available(candidate text)`
Authenticated Phase 5 boolean RPC.

### `public.search_profiles(search_term text, result_limit integer default 20)`
Authenticated Phase 7 discovery RPC. Returns only safe public profile fields and never returns auth email/metadata.

### `public.get_public_profile(target_user_id uuid)`
Authenticated Phase 7 public-profile lookup.

## Phase 8 conversation RPCs

### `public.create_or_get_direct_conversation(target_user_id uuid) returns uuid`
Authenticated-only transactional entry point for direct-chat creation.

Behavior:
- rejects unauthenticated callers
- rejects self-chat
- validates target profile
- computes the canonical sorted pair key
- inserts a direct conversation if absent
- relies on the partial unique `direct_key` index to resolve concurrent races
- creates exactly two membership rows for a new direct chat
- returns the existing conversation UUID when the pair already has a chat

Clients do not receive INSERT privileges on conversations or conversation membership tables.

### `public.list_my_conversations(result_limit integer default 50)`
Authenticated-only chat-list projection.

Returns:
- conversation UUID and kind
- safe peer display name/username/avatar path
- peer user UUID for direct chats
- safe latest-message preview metadata
- last activity timestamp

The result limit is clamped to 1–100 server-side.

### `public.get_conversation_summary(target_conversation_id uuid)`
Authenticated-only route/header projection. Returns a row only if `auth.uid()` is a member of the requested conversation.

## Phase 9
The message service will use existing RLS-protected INSERT access on `public.messages`, cursor pagination and conversation-scoped Supabase Realtime Broadcast. Database rows remain the durable source of truth.

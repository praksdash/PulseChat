# PulseChat API / Data Access

## Profile APIs

### `public.is_username_available(candidate text)`
Authenticated Phase 5 RPC returning only a boolean.

### `public.search_profiles(search_term text, result_limit integer default 20)`
Authenticated Phase 7 discovery RPC.

Behavior:
- minimum 2-character search term
- input truncated server-side to 50 characters
- result count clamped to 1–20
- searches display name and username
- excludes the caller's own profile
- returns only safe public fields: `id`, `display_name`, `username`, `avatar_path`, `bio`
- never returns email, phone, auth metadata or tokens

### `public.get_public_profile(target_user_id uuid)`
Authenticated Phase 7 RPC used by `/users/[userId]`.

Returns the same five safe public profile fields for one UUID. Normal direct table SELECT on `public.profiles` remains self-only.

## Phase 6 messaging access
Authenticated clients have RLS-backed access only to messaging rows allowed by conversation membership. Conversation/member creation remains unavailable directly from the app.

## Planned Phase 8 RPC
A transactional `get_or_create_direct_conversation(other_user_id)`-style function will create or return a unique direct conversation and its two memberships. The disabled Start Chat button on public profiles will be wired to that RPC.

## Planned Phase 9 realtime
Committed message changes will be delivered through conversation-scoped Supabase Realtime Broadcast. Database rows remain the durable source of truth.

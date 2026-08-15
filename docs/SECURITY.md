# PulseChat Security

## Authentication
Supabase Auth is the identity authority. Native auth sessions are persisted with encrypted storage and protected Expo SecureStore key material.

## Client keys
Only the Supabase Project URL and publishable key belong in `EXPO_PUBLIC_*` variables. Never place service-role/secret credentials in the app.

## Profiles/discovery
Normal `public.profiles` SELECT/UPDATE remains self-only through RLS. Discovery uses narrow authenticated-only security-definer RPCs that return safe public fields only.

## Phase 8 direct-chat security
Clients cannot directly INSERT conversations or memberships. They must call `create_or_get_direct_conversation`.

The function:
- requires a real authenticated `auth.uid()`
- rejects self-chat
- validates the target user through `public.profiles`
- computes the pair key server-side
- never accepts a client-supplied `direct_key`, creator UUID or membership role
- creates only `member` roles for direct chats
- relies on a unique index to prevent duplicate pair conversations under races
- returns only the resulting conversation UUID

## Conversation-list privacy
`list_my_conversations` is a security-definer RPC because normal profile RLS intentionally prevents direct reading of another user's profile row. The function explicitly filters memberships by `auth.uid()` and returns only chat-safe peer profile fields.

No email, password data, auth metadata or token is exposed.

## Conversation-route authorization
`get_conversation_summary` requires an actual membership row for the caller. A guessed/leaked conversation UUID does not reveal participant details.

## Security-definer rules
Phase 8 RPCs use `search_path = ''`, fully-qualified relation names, and explicit function EXECUTE grants. Execute is revoked from `public` and `anon`, then granted to `authenticated` only.

## Messaging RLS
Phase 6 RLS remains the database authorization boundary for future message reads/writes. Membership is required regardless of client UI state.

## Future hardening
Phase 21 will add dedicated abuse/rate-limit review, blocks/reports integration, account deletion behavior, media validation, dependency review and monitoring.

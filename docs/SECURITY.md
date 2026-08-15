# PulseChat Security

## Authentication
Supabase Auth remains the identity authority. Native auth sessions are persisted with an encrypted payload and the encryption key is kept in Expo SecureStore.

## Client keys
Only the Supabase Project URL and publishable key belong in `EXPO_PUBLIC_*` variables. Never put a service-role/secret key in the mobile app.

## Profile authorization
RLS remains enabled on `public.profiles`.

Normal table access remains:
- SELECT: own profile only
- UPDATE: own profile only
- direct app INSERT/DELETE: revoked

Phase 7 does **not** broaden the profiles SELECT policy to all authenticated users. Discovery instead uses two narrow authenticated-only `SECURITY DEFINER` functions with `search_path = ''`.

## Discovery privacy boundary
`search_profiles` and `get_public_profile` return only:
- profile UUID
- display name
- username
- avatar object path
- bio

They never read or return `auth.users.email`, raw user metadata, credentials, tokens or private authentication data.

Discovery controls:
- authenticated callers only
- minimum 2 search characters
- maximum 20 results per request
- own account excluded from search results
- wildcard characters escaped server-side
- no list-all/suggested-users endpoint

The 2-character/20-row controls reduce casual directory enumeration but are not a substitute for production abuse controls. Rate limiting and anti-automation remain part of Phase 21 production hardening.

## Avatar privacy
The `avatars` bucket is public-read because profile photos are part of public discovery. Upload/update/delete remain restricted by Storage RLS to the authenticated user's own UUID folder.

## Messaging authorization boundary
Phase 6 messaging RLS remains unchanged: knowing a conversation or message UUID is insufficient to access it without membership.

## Security-definer rules
Discovery RPCs and Phase 6 authorization helpers use an empty `search_path` and fully-qualified relation names. Execute privileges on discovery RPCs are revoked from `public` and `anon`, then granted only to `authenticated`.

## Dedicated production review
Phase 21 remains the full security review, including abuse controls, search throttling, blocks/reports interaction, account deletion, media validation, dependency review and secrets.

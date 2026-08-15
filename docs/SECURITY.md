# PulseChat Security

## Authentication
Supabase Auth is the identity authority. Native auth sessions are persisted with an encrypted payload and the encryption key is kept in Expo SecureStore.

## Profile authorization
- RLS remains enabled on `public.profiles`.
- An authenticated user can SELECT and UPDATE only the row whose `id = auth.uid()`.
- Direct client INSERT/DELETE remains revoked.
- Username uniqueness is enforced by PostgreSQL, not only by client validation.
- `is_username_available()` exposes only a boolean, not another user's profile data.

## Avatar storage
The avatar bucket is intentionally public-read because avatars are public profile identity data. Public read does **not** grant write access.

Writes/deletes are protected by Storage RLS:
- bucket must be `avatars`
- first folder segment must equal the authenticated user's UUID

`profiles.avatar_path` is additionally constrained to the profile owner's UUID folder, preventing one account from assigning another account's stored avatar path to itself.

## Client keys
Only the Supabase Project URL and publishable key belong in `EXPO_PUBLIC_*` variables. Never put a service-role/secret key in the app.

## Later security work
Phase 6+ adds conversation membership authorization. Phase 21 performs the dedicated production security review.

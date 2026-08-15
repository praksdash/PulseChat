# PulseChat API Surface

The mobile app currently talks directly to Supabase through `@supabase/supabase-js` under RLS.

## Auth
- `auth.signUp()`
- `auth.signInWithPassword()`
- `auth.signOut({ scope: 'local' })`
- persisted session restore and token auto-refresh

## Profiles
- own profile SELECT
- own profile UPDATE
- `rpc('is_username_available', { candidate })`

## Storage
- `avatars.upload()` into `<auth.uid()>/...`
- `avatars.remove()` for own objects
- `avatars.getPublicUrl()` for profile display

No service-role operations are performed by the client.

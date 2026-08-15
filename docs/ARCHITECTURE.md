# PulseChat Architecture

## Client
React Native + Expo SDK 57 + TypeScript + Expo Router.

## Authentication boundary
`AuthProvider` owns the Supabase session. The root navigator uses `Stack.Protected`:

- unauthenticated -> `(auth)`
- authenticated -> `(app)`

No screen-level redirect is trusted as authorization. Route protection is UX/navigation only; database authorization remains enforced by Supabase RLS.

## Auth persistence
On native platforms Supabase Auth storage uses an encrypted large-value adapter:

1. Generate an AES-256 key.
2. Store that key in Expo SecureStore.
3. Encrypt the Supabase session payload.
4. Store only encrypted payload bytes in AsyncStorage.
5. Start token auto-refresh while the app is active and stop it in the background.

Web falls back to Supabase's browser storage behavior.

## Backend
Supabase provides:
- Auth
- PostgreSQL
- RLS
- Realtime (later phases)
- Storage (later phases)
- Edge Functions (later phases)

## Profile lifecycle
Signup -> `auth.users` row -> database trigger -> `public.profiles` row.

The client never needs a privileged key and cannot insert arbitrary profile rows during Phase 4.

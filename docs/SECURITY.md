# PulseChat Security

## Phase 4 controls
- Mobile app uses only the Supabase Project URL and publishable key.
- Never place `service_role`, secret keys, database passwords or signing secrets in Expo environment variables.
- `.env` is ignored by Git.
- Native auth session payload is encrypted before being placed in AsyncStorage; the encryption key is stored in Expo SecureStore.
- Auth tokens refresh only while the native app is active.
- Protected Expo Router groups keep signed-out users out of app screens.
- PostgreSQL RLS remains the real authorization boundary.
- `profiles` is RLS-enabled.
- Users can read/update only their own profile in Phase 4.
- Profile creation is server-side via a security-definer trigger.

## Important
`EXPO_PUBLIC_*` values are bundled into the client. Only use values designed to be public, such as the Supabase publishable key. RLS must protect every user-owned table added in later phases.

# PulseChat Architecture

## Mobile
React Native + Expo SDK 57 + TypeScript + Expo Router.

## Authentication
Supabase Auth, persisted encrypted native sessions, protected `(auth)` and `(app)` route groups.

## Profile feature
`EditProfileScreen` owns form state and UX validation. Database/storage operations are delegated to Supabase and `src/services/profile-service.ts`.

Flow:

`Profile → Edit profile → validate → optional username RPC → optional image compress/upload → RLS-backed profile UPDATE → remove obsolete avatar → refresh AuthProvider profile → Profile`

The profile row is authoritative. Auth `user_metadata` is not used for authorization.

## Avatar pipeline

`ImagePicker → square crop → ImageManipulator 512×512 JPEG (~82% quality) → base64 → ArrayBuffer → Supabase Storage → avatar_path in profile → public URL via getPublicUrl()`

## Boundaries
Phase 5 intentionally does not expose all profiles. Phase 7 introduces controlled user discovery. Phase 6 establishes messaging tables/RLS before any real chat traffic.

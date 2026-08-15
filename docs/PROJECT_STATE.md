# PulseChat Project State

## Current phase
Phase 4 — Supabase Authentication

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 authentication implementation in source

## Phase 4 working target
- Supabase client configured from `.env`
- Email/password account creation
- Email/password sign-in
- Session persistence across app restarts
- Encrypted native session storage (AES payload in AsyncStorage, encryption key in Expo SecureStore)
- Expo Router protected auth/app route groups
- Automatic `profiles` row creation from `auth.users`
- Own-profile RLS
- Authenticated profile display
- Sign-out
- Friendly validation and common auth errors

## Still requires developer verification
1. Create/select a Supabase project.
2. Run `supabase/migrations/202608150001_phase4_auth_profiles.sql` in SQL Editor.
3. Create `.env` with Project URL and publishable key.
4. Install Phase 4 dependencies.
5. Rebuild Android development client because SecureStore/AsyncStorage are native dependencies.
6. Verify signup, login, persistence, RLS-backed profile read and logout on a physical/emulated Android device.

## Intentionally not implemented yet
- Username/avatar editing (Phase 5)
- Conversation/message database schema (Phase 6 onward)
- User search (Phase 7)
- Realtime messaging
- Media upload
- Push notifications

## Known bugs
None known in Phase 4 source. Runtime verification against the developer's Supabase project is still required.

## Database migrations
- `202608150001_phase4_auth_profiles.sql` — pending developer execution

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add Supabase authentication`

## Next task
Phase 5 — User profile: username, avatar, bio and profile editing.

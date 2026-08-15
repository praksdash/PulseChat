# PulseChat Project State

## Current phase
Phase 7 — User Discovery

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 Supabase email/password authentication, persisted sessions, protected routes, profile trigger/RLS and working local sign-out
- Phase 5 editable profile, unique username, bio and avatar Storage flow
- Phase 6 production messaging database schema and messaging RLS foundation
- Phase 7 controlled authenticated user discovery packaged

## Phase 7 user-discovery foundation
- real Supabase-backed search replacing local demo people
- search by display name or username
- 2-character minimum query
- 20-result server-side cap
- 350 ms client debounce
- stale-request protection so older searches cannot overwrite newer results
- loading, empty, no-match and retry states
- authenticated-only `search_profiles` RPC
- authenticated-only `get_public_profile` RPC
- discovery exposes only `id`, `display_name`, `username`, `avatar_path`, `bio`
- auth email and auth metadata remain private
- own account excluded from search results
- public profile details screen
- avatar URL rendering through existing public avatar bucket
- trigram search indexes for name/username substring search
- `public.profiles` normal SELECT policy remains self-only

## Developer verification required
1. Ensure migrations through Phase 6 have already been run.
2. Run `supabase/migrations/202608150004_phase7_user_discovery.sql` in Supabase SQL Editor.
3. Run `supabase/phase7_verify.sql` and confirm both RPCs, search indexes and profile RLS.
4. Start Expo once so typed routes include `/users/[userId]`.
5. Run `npm run typecheck` locally.
6. Test discovery with at least two real PulseChat accounts.

## Intentionally not implemented yet
- Starting a direct conversation from a discovered user (Phase 8)
- Database-backed chat list (Phase 8)
- Realtime text delivery (Phase 9)
- Delivery/read UI logic (Phase 10)
- Typing/presence (Phase 11)
- Chat-media Storage writes (Phase 12)
- Message edit/delete/reactions (Phase 13)
- Group creation/member management (Phase 14)

## Known limitations
- Global discovery is intentionally authenticated-only and capped, but full abuse/rate-limit controls remain part of later production hardening.
- Users without a username can still be found by display name.
- Presence is not shown because online/offline status belongs to Phase 11.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add secure user discovery`

## Next task
Phase 8 — transactional direct-chat creation and real chat list.

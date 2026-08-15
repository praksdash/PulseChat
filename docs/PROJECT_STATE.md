# PulseChat Project State

## Current phase
Phase 6 — Database Architecture

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 Supabase email/password authentication, persisted sessions, protected routes, profile trigger/RLS and working local sign-out
- Phase 5 editable profile, unique username, bio and avatar Storage flow
- Phase 6 production messaging database schema packaged

## Phase 6 database foundation
- `conversations` supporting direct/group shapes
- unique `direct_key` primitive for duplicate-direct-chat prevention
- normalized `conversation_members`
- roles: member/admin/owner
- `last_read_at` read cursor and `muted_until`
- durable `messages`
- `client_message_id` retry deduplication
- same-conversation reply integrity
- server timestamps and pagination index
- `message_receipts` for delivered/read state
- attachment metadata foundation for Phase 12
- conversation activity trigger (`last_message_at`)
- membership-based RLS on all messaging tables
- least-privilege table/column grants
- non-exposed RLS authorization helpers
- TypeScript database schema types / typed Supabase client

## Developer verification required
1. Ensure Phase 5 migration has already been run.
2. Run `supabase/migrations/202608150003_phase6_messaging_schema.sql` in Supabase SQL Editor.
3. Run `supabase/phase6_verify.sql` and confirm five Phase 6 tables plus RLS/policies/indexes.
4. Run `npm run typecheck` locally.
5. Run the Android app and perform the Phase 5 regression test.

## Intentionally not implemented yet
- Global user search/discovery (Phase 7)
- Real direct-chat creation (Phase 8)
- Database-backed chat list (Phase 8/9)
- Realtime text delivery (Phase 9)
- Delivery/read UI logic (Phase 10)
- Typing/presence (Phase 11)
- Chat-media Storage writes (Phase 12)
- Message edit/delete/reactions (Phase 13)
- Group creation/member management (Phase 14)

## Known bugs
No new runtime UI behavior is introduced by Phase 6. Database migration must be verified against the developer's Supabase project.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add production messaging database schema`

## Next task
Phase 7 — controlled global user search/discovery.

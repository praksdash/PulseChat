# PulseChat Project State

## Current phase
Phase 8 — Chat Creation

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 Supabase email/password authentication, persisted sessions, protected routes, profile trigger/RLS and working sign-out
- Phase 5 editable profiles, unique usernames, bios and avatar Storage flow
- Phase 6 production messaging database schema and messaging RLS foundation
- Phase 7 secure real-user discovery
- Phase 8 transactional direct-chat creation and real Chats list packaged

## Phase 8 implementation
- `create_or_get_direct_conversation(target_user_id)` authenticated RPC
- canonical `direct_key` uniqueness reused as concurrency/idempotency boundary
- exactly two members are created for each new direct chat
- repeat Start Chat calls return the existing conversation
- `list_my_conversations(result_limit)` authenticated RPC
- conversation list exposes only safe peer profile fields plus last-message preview metadata
- `get_conversation_summary(target_conversation_id)` authenticated RPC
- Start Chat enabled on discovered-user profile
- real Chats tab replaces demo conversations
- Chats refresh automatically whenever the tab gains focus
- pull-to-refresh
- local chat-list search by safe display name/username
- real avatar/name rendering
- conversation screen verifies membership via server-side summary RPC
- messaging composer remains disabled until Phase 9

## Developer verification required
1. Ensure migrations through Phase 7 are already run.
2. Run `supabase/migrations/202608150005_phase8_direct_chat_creation.sql`.
3. Run `supabase/phase8_verify.sql`.
4. Start Expo with `npx expo start -c`.
5. Run `npm run typecheck`.
6. Test with two real users and verify repeated Start Chat calls reuse one conversation.
7. Verify the database has one direct conversation and exactly two member rows for the pair.

## Intentionally not implemented yet
- Text-message sending and Realtime Broadcast (Phase 9)
- Delivery/read UI logic (Phase 10)
- Typing/presence (Phase 11)
- Chat-media Storage writes (Phase 12)
- Message edit/delete/reactions (Phase 13)
- Group creation/member management (Phase 14)

## Known limitations
- Chat-list search is local over the most recent 50 conversations. Server-side chat search can be added later if needed.
- There are no realtime chat-list updates yet. The tab refreshes on focus and supports pull-to-refresh until Phase 9.
- Empty conversations intentionally show a Phase 9 messaging notice.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`
- `202608150005_phase8_direct_chat_creation.sql`

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add direct chat creation and real chat list`

## Next task
Phase 9 — real text messages, optimistic sending, pagination and Supabase Realtime Broadcast.

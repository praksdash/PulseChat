# PulseChat Project State

## Current phase
Phase 9 — Realtime One-to-One Text Messaging

## Completed
- Phase 1 development environment and Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system and polished messenger UI
- Phase 4 Supabase email/password authentication, persisted sessions, protected routes, profile trigger/RLS and working sign-out
- Phase 5 editable profiles, unique usernames, bios and avatar Storage flow
- Phase 6 production messaging database schema and messaging RLS foundation
- Phase 7 secure real-user discovery
- Phase 8 transactional direct-chat creation and real Chats list
- Phase 9 durable text messages + private Realtime Broadcast packaged

## Phase 9 implementation
- real text-message INSERT into `public.messages`
- optimistic outgoing bubbles
- stable `client_message_id` generated before every send
- retry reuses the same client ID, so the Phase 6 unique constraint prevents duplicates
- failed messages remain visible with tap-to-retry
- server timestamps replace optimistic timestamps after acknowledgement
- `list_conversation_messages` cursor-paginated history RPC
- 30-message pages; database function clamps to maximum 50
- newest-first stable `(created_at, id)` cursor
- private `conversation:<uuid>` Supabase Realtime channel
- Realtime Authorization checks actual `conversation_members` membership
- database trigger uses `realtime.broadcast_changes()` after message INSERT
- clients never broadcast message contents directly
- PostgreSQL remains source of truth
- latest-page reconciliation after every successful channel subscription/reconnect
- channel cleanup when conversation screen unmounts
- message composer enabled for text only
- attachment button remains disabled until Phase 12
- Chats list continues to show real latest-message preview on focus/pull refresh

## Developer verification required
1. Ensure migrations through Phase 8 are already applied.
2. Run `supabase/migrations/202608150006_phase9_realtime_text_messaging.sql`.
3. Run `supabase/phase9_verify.sql`.
4. Confirm Realtime service is enabled in Supabase Realtime Settings.
5. Start Expo with `npx expo start -c`.
6. Run `npm run typecheck`.
7. Test live messaging with Account A and Account B on two sessions/devices.
8. Test temporary network failure and failed-message retry.
9. Send 35+ messages and verify older-history pagination.

## Intentionally not implemented yet
- Delivered/read receipts UI (Phase 10)
- Typing indicators and user presence (Phase 11)
- Image/file/media messages (Phase 12)
- Message reply/edit/delete/reactions (Phase 13)
- Group creation/member management (Phase 14)
- Push notifications (Phase 15)

## Known limitations
- Phase 9 displays only a single-check sent state. Delivered/read states begin in Phase 10.
- The Chats tab refreshes latest previews on focus/pull-to-refresh; a global realtime chat-list subscription is not required for the Phase 9 milestone.
- Text messages are capped at 10,000 characters by both client and database validation.
- Presence is not implemented; the header realtime dot represents the conversation channel connection, not whether the peer is online.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`
- `202608150005_phase8_direct_chat_creation.sql`
- `202608150006_phase9_realtime_text_messaging.sql`

## Environment variables
Required locally in `.env` (never commit):
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add realtime one-to-one text messaging`

## Next task
Phase 10 — delivered/read receipts, read cursor/unread count, and message-status UI.

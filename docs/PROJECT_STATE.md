# PulseChat Project State

## Current phase
Phase 11 — Typing & Presence

## Completed
- Phase 1 development environment + Android development build
- Phase 2 Expo Router navigation skeleton
- Phase 3 reusable design system
- Phase 4 Supabase authentication + persisted sessions
- Phase 5 editable profiles/usernames/bios/avatars
- Phase 6 production messaging schema + RLS
- Phase 7 secure user discovery
- Phase 8 transactional direct-chat creation + real Chats list
- Phase 9 durable realtime one-to-one text messaging
- Phase 10 delivered/read receipts + unread counters
- Phase 11 typing indicators + online/offline presence + last seen packaged

## Phase 11 implementation
- `user_presence` durable last-seen table
- self-only `touch_my_last_seen` heartbeat RPC
- conversation-authorized `get_user_last_seen` RPC
- app-level `presence:<user_uuid>` private Realtime Presence channel
- owner-only Presence publishing authorization
- conversation-peer Presence observation authorization
- Presence untracks when React Native app backgrounds
- Presence retracks/reconnects when app returns active
- 60-second durable last-seen heartbeat while active
- `typing:<conversation_uuid>` private Broadcast channel
- only conversation members may send/receive typing events
- typing true refresh is throttled rather than sent on every keystroke
- typing false after local idle delay
- receiver-side 4-second expiry prevents stuck typing indicators
- direct chat header shows typing -> online -> last seen priority
- avatar online badge reflects peer Presence

## Developer verification required
1. Apply migrations through Phase 10 first.
2. Run `supabase/migrations/202608150008_phase11_typing_presence.sql`.
3. Run `supabase/phase11_verify.sql`.
4. Start Expo with `npx expo start -c`.
5. Run `npm run typecheck`.
6. Test two accounts with both apps foregrounded: both should show online.
7. Type in A without sending: B should show `typing…`, then clear after idle.
8. Background A: B should change from online to last seen.
9. Foreground A: B should return to online.
10. Kill A unexpectedly and confirm Presence eventually leaves; last seen remains approximately the most recent heartbeat.

## Intentionally not implemented yet
- image/file/media messages (Phase 12)
- reply/edit/delete/reactions (Phase 13)
- groups (Phase 14)
- push notifications (Phase 15)

## Known limitations
- Online is app-session presence, not device push reachability.
- Last seen is intentionally approximate after an abrupt OS/process kill; active sessions persist a heartbeat every 60 seconds and background transitions update immediately.
- Presence/typing UI is optimized for direct chats. Group-specific typing participant semantics arrive in Phase 14.
- Presence is intentionally not subscribed for every Chats-list row to avoid unnecessary Presence fan-out.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`
- `202608150005_phase8_direct_chat_creation.sql`
- `202608150006_phase9_realtime_text_messaging.sql`
- `202608150007_phase10_delivery_read_unread.sql`
- `202608150008_phase11_typing_presence.sql`

## Environment variables
Local `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add typing indicators and user presence`

## Next task
Phase 12 — image/file/media messages.

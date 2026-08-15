PulseChat Phase 9 — Realtime One-to-One Text Messaging

WHAT CHANGED
- The conversation composer now sends real text messages.
- Messages are stored in public.messages and survive app restarts.
- Outgoing messages appear optimistically before the network round-trip finishes.
- Every send gets a client_message_id before network I/O.
- Retry reuses the same client_message_id so duplicate rows cannot be created.
- Failed messages show a tap-to-retry state.
- Message history loads in 30-row cursor-paginated pages.
- New committed messages are broadcast through a private conversation:<uuid> Supabase Realtime channel.
- Realtime Authorization permits only conversation members to receive that topic.
- PostgreSQL remains the source of truth; the app reconciles latest rows after reconnect.

INSTALL
1. Copy this package over the existing PulseChat project without deleting .env or .git.
2. Run supabase/migrations/202608150006_phase9_realtime_text_messaging.sql in Supabase SQL Editor.
3. Run supabase/phase9_verify.sql.
4. Confirm Supabase Realtime service is enabled.
5. Start Expo: npx expo start -c
6. In another terminal: npm run typecheck
7. Test the same conversation using two accounts/sessions.

NO NATIVE REBUILD REQUIRED
Phase 9 adds no native package and does not change app.json native configuration.

TEST
- A sends -> bubble appears immediately -> B receives live.
- B replies -> A receives live.
- Close/reopen chat -> messages remain.
- Disable network -> send -> failed state -> reconnect -> tap retry -> exactly one DB row.
- Send 35+ messages -> scroll upward -> older page loads.

NOT YET IMPLEMENTED
- Delivered/read status and unread count (Phase 10)
- Typing/presence (Phase 11)
- Media messages (Phase 12)

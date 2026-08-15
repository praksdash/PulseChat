PulseChat Phase 10 — Delivered / Read Receipts + Unread Counters

WHAT CHANGED
- Every message now gets one receipt row per non-sender conversation member.
- Existing Phase 9 messages are backfilled with receipt rows.
- A private user:<uuid> Realtime inbox topic notifies an authenticated app about new messages even when that chat route is not open.
- Opening/foregrounding the app reconciles pending delivered receipts.
- Opening a conversation marks its incoming messages read while the app is active.
- Outgoing bubbles now progress: sending -> sent -> delivered -> read.
- Receipt cursor events update the sender live over the private conversation:<uuid> topic.
- Chats now display real unread badges and a total unread badge on the Chats tab.
- list_my_conversations returns unread_count.
- list_conversation_messages returns delivery_status.
- last_read_at advances when the current user marks a conversation read.

INSTALL
1. Copy this package over the existing PulseChat project without deleting .env or .git.
2. Run supabase/migrations/202608150007_phase10_delivery_read_unread.sql in Supabase SQL Editor.
3. Run supabase/phase10_verify.sql.
4. Start Expo: npx expo start -c
5. In another terminal: npm run typecheck
6. Test using two accounts/devices/sessions.

NO NATIVE REBUILD REQUIRED
Phase 10 adds no native dependency and does not change app.json native configuration.

CORE TEST
- Keep B app closed/offline. A sends -> A shows one sent check.
- Open B app but stay outside chat -> A upgrades to delivered/double check.
- Open the A/B conversation on B -> A upgrades to read (blue/primary double check).
- While B stays outside that chat, A sends -> Chats row/tab show unread count.
- Open the chat on B -> unread count clears.
- Close/reopen both apps -> statuses/unread remain correct from PostgreSQL.

NOT YET IMPLEMENTED
- Typing + online/offline presence (Phase 11)
- Media messages (Phase 12)
- Reply/edit/delete/reactions (Phase 13)

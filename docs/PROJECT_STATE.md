# PulseChat Project State

## Current phase
Phase 10 — Message Delivery / Read Status

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
- Phase 10 delivered/read receipts + unread counters packaged

## Phase 10 implementation
- receipt row created for every non-sender member after every message insert
- backfill for existing Phase 9 messages
- `mark_conversation_delivered` batch RPC
- `mark_conversation_read` batch RPC
- `mark_all_pending_delivered` startup/reconnect reconciliation RPC
- `get_my_total_unread_count` lightweight tab-badge RPC
- `list_my_conversations` now returns authoritative `unread_count`
- `list_conversation_messages` now returns sender-visible `delivery_status`
- private `user:<uuid>` inbox Broadcast topic
- inbox topic authorized only to that authenticated user
- private `conversation:<uuid>` remains membership-authorized
- incoming inbox event marks pending receipt delivered
- open active conversation marks pending receipts read
- `conversation_members.last_read_at` advances on read
- outgoing UI supports sending/sent/delivered/read/failed
- Chats row unread badges and Chats-tab total badge
- local conversation activity event bridge keeps tab/list counters fresh

## Developer verification required
1. Apply migrations through Phase 9 first.
2. Run `supabase/migrations/202608150007_phase10_delivery_read_unread.sql`.
3. Run `supabase/phase10_verify.sql`.
4. Start Expo with `npx expo start -c`.
5. Run `npm run typecheck`.
6. Test sent -> delivered -> read using Account A and Account B.
7. Verify unread badge appears when B has not opened the conversation.
8. Verify unread clears when B opens the conversation.
9. Close/reopen apps and confirm durable status restoration.

## Intentionally not implemented yet
- typing indicators + online/offline presence (Phase 11)
- image/file/media messages (Phase 12)
- reply/edit/delete/reactions (Phase 13)
- groups (Phase 14)
- push notifications (Phase 15)

## Known limitations
- Delivery currently means the authenticated PulseChat app session is connected/reconciled; background OS push delivery is Phase 15.
- Read is marked only while the conversation is open and the app is active.
- Phase 10 UI is focused on direct chats; the receipt table/aggregate history design is already group-compatible, with group-specific semantics finalized in Phase 14.

## Database migrations
- `202608150001_phase4_auth_profiles.sql`
- `202608150002_phase5_profiles_avatars.sql`
- `202608150003_phase6_messaging_schema.sql`
- `202608150004_phase7_user_discovery.sql`
- `202608150005_phase8_direct_chat_creation.sql`
- `202608150006_phase9_realtime_text_messaging.sql`
- `202608150007_phase10_delivery_read_unread.sql`

## Environment variables
Local `.env`:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Git checkpoint
After verification:
`feat: add delivered read receipts and unread counters`

## Next task
Phase 11 — typing indicators, online/offline presence and last seen.

# PulseChat Project State

## Current phase
Phase 16 — search

## Completed
- Phase 0 product scope/architecture
- Phase 1 development environment
- Phase 2 navigation
- Phase 3 design system
- Phase 4 Supabase authentication
- Phase 5 profiles/usernames/avatars
- Phase 6 messaging database + RLS
- Phase 7 user discovery
- Phase 8 direct-chat creation + real Chats list
- Phase 9 realtime text messaging
- Phase 10 delivered/read receipts + unread counters
- Phase 11 typing/presence/last seen
- Phase 12 secure image messaging
- Phase 13 reply/edit/delete/reactions
- Phase 14 group chats
- Phase 15 push notifications + Android/web notification diagnostics
- Phase 16 global search

## Phase 15 implementation
- `expo-notifications` SDK 57 integration
- Android `messages` notification channel
- permission request + ExpoPushToken acquisition using EAS `projectId`
- per-installation token registration in `public.push_tokens`
- token rotation reconciliation
- sign-out token disable + native unregister
- server-only `push_delivery_log` idempotency ledger
- `send-message-push` Supabase Edge Function
- authenticated Database Webhook using a dedicated shared secret header
- Expo Push Service enhanced-security access token support
- new-message notifications for direct and group conversations
- text/photo/generic media notification previews
- conversation mute (`muted_until`) respected by dispatcher
- sender excluded from push recipients
- multi-device support per recipient
- 100-token Expo batching
- immediate invalid-token disable on `DeviceNotRegistered` ticket errors
- notification badge count from durable unread receipts
- foreground suppression while the exact conversation is open
- notification tap opens the exact direct/group conversation
- membership re-check before notification navigation
- cold-start notification response handling

## Migration
`supabase/migrations/202608160013_phase15_push_notifications.sql`

## Edge Function
`supabase/functions/send-message-push/index.ts`

## Verification
`supabase/phase15_verify.sql`

## Required external configuration
- Firebase Android app for `com.prakashdash.pulsechat`
- project-root `google-services.json`
- FCM V1 service-account credential uploaded to EAS
- Expo access token with Enhanced Push Security enabled
- Supabase Edge Function secrets: `PUSH_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`
- Database Webhook: `public.messages` → INSERT → `send-message-push`

## Client environment variables
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Known limitations
- Phase 15 sends notifications for newly inserted messages only; edits/deletes/reactions do not create a second push.
- Expo push receipts are not polled asynchronously yet; immediate ticket failures are logged/handled. Receipt polling and operational alerting belong in Phase 26 hardening.
- Notification preference/mute UI is deferred to Phase 18; the dispatcher already honors `conversation_members.muted_until` if set.
- iOS client code is included, but iOS credentials/device testing remain part of the later iOS production phase.

## Git checkpoint
`feat: add secure push notifications`

## Next task
Phase 17 — block/report/privacy.
- Phase 15 hotfix: Android notification channel no longer passes `sound: "default"` as a custom sound filename; system notification sound behavior is used instead.

## Phase 15 notification completion fix
- Profile > Notifications is now a real settings/diagnostics screen.
- Android exposes permission, token registration, local test, and authenticated remote server test.
- Web uses the browser Notification API for realtime alerts while the PulseChat tab is open/backgrounded.
- Expo Notifications is native-only; closed-browser Web Push is intentionally not claimed in Phase 15.


## Phase 16 implementation
- Search tab now covers People / Chats / Messages / All.
- `search_my_conversations()` is membership-scoped and searches direct peer names/usernames plus group titles.
- `search_my_messages()` searches only non-deleted message bodies/image captions in conversations the caller currently belongs to.
- `get_message_window()` securely returns a small timeline window around an old search hit for jump-to-message UX.
- Message/group-title substring search uses pg_trgm GIN indexes.
- Search results are debounced, paginated for messages, and stale responses cannot replace newer queries.
- Tapping a message result opens the exact conversation, highlights the target, and provides Back to latest.

## Migration
`supabase/migrations/202608160014_phase16_search.sql`

## Verification
`supabase/phase16_verify.sql`

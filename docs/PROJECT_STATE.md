# PulseChat Project State

## Current phase
Phase 15 — push notifications

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
- Phase 15 implementation packaged; Firebase/EAS credentials, Edge Function deployment, Database Webhook and two-device verification required

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
Phase 16 — search.
- Phase 15 hotfix: Android notification channel no longer passes `sound: "default"` as a custom sound filename; system notification sound behavior is used instead.

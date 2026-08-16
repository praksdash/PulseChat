# PulseChat Project State

## Current phase
Phase 14 — Group chats

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
- Phase 14 group chats packaged; migration/device verification required

## Phase 14 implementation
- transactional `create_group_conversation()` RPC
- group owner/admin/member roles
- secure member enumeration
- admin add/remove member operations
- owner promote/demote admin operations
- ownership transfer
- non-owner leave-group flow
- 100-member prototype safety limit
- group avatar Storage bucket with admin-only write RLS
- validated group metadata RPC; direct client metadata update privilege revoked
- group rows in Chats with title/avatar/member count/unread state
- group sender name in chat-list preview
- group conversation header with member count
- incoming group message sender name + avatar
- reply preview preserves group sender identity
- Phase 10 receipt model reused for per-recipient group delivered/read state
- membership changes refresh affected users through private `user:<uuid>` Broadcasts
- removed users are redirected out of an open group in the official client

## Migration
`supabase/migrations/202608150012_phase14_group_chats.sql`

## Verification
`supabase/phase14_verify.sql`

## Environment variables
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Known limitations
- Group avatar objects are public-read like profile avatars; write/update/delete remains admin-authorized.
- Group typing indicators are intentionally deferred; Phase 11 typing remains direct-chat only.
- A malicious already-connected removed client may retain an authorized Realtime socket until channel rejoin; durable database/RPC access is revoked immediately. The official PulseChat client disconnects by leaving the route as soon as its private membership event arrives. Security hardening is revisited in Phase 21.
- Group media currently supports the existing Phase 12 image flow; video/audio/document composer flows remain deferred.

## Git checkpoint
`feat: add group chats and member administration`

## Next task
Phase 15 — push notifications.

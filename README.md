# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 14 — group chats and member administration.

Implemented through Phase 14:
- Android Expo development build
- navigation + reusable messenger design system
- Supabase email/password auth + persisted sessions
- editable profiles, usernames, bios and avatars
- production conversation/member/message/receipt/attachment schema
- secure user discovery
- idempotent direct-chat creation
- real Supabase-backed Chats list
- durable text messaging + optimistic retry
- cursor-paginated message history
- private conversation-scoped Realtime Broadcast
- delivered/read receipt persistence + unread counters
- online/offline Presence + durable last seen
- private typing Broadcast with debounce/expiry
- private image messaging with compression + signed Storage URLs
- reply to text/photo messages
- sender-only message/caption editing
- sender-only delete-for-everyone soft deletion
- server-authoritative emoji reactions
- real group creation with owner/admin/member roles
- group member add/remove/promote/demote/ownership transfer
- group sender names/avatars and group-aware receipts

## Phase 14 interaction
Use the group button in Chats to create a group. Open the group header options to manage members, roles, name and picture.

See `PHASE14_README.txt` and `docs/PROJECT_STATE.md`.

Next: Phase 15 — push notifications.

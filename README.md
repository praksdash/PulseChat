# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 18 — settings (implementation ready; verification pending).

Verified through Phase 17; Phase 18 implementation adds:
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
- authenticated device push-token registration
- server-side direct/group message push notifications
- notification tap → exact conversation navigation
- push deduplication, unread badges and token rotation handling

## Phase 15 setup
Phase 15 requires Firebase FCM V1 credentials, `google-services.json`, the Supabase Edge Function and a Database Webhook. See `PHASE15_README.txt`, `docs/PROJECT_STATE.md` and the Phase 15 delivery instructions.

### Phase 16
Global authenticated search is available for people, direct/group chats and message text/image captions, including secure jump-to-message context.

### Phase 17
Server-enforced blocks, private moderation reports, people-search visibility, new-direct-chat privacy, activity visibility and blocked-user management are implemented.

### Phase 18
Settings now include persistent System/Light/Dark appearance, account-wide notification preferences, per-chat mute, account/session controls and server-side account deletion.

After Phase 18 verification: Phase 19 — offline/error handling.

# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 13 — reply, edit, delete and emoji reactions.

Implemented through Phase 13:
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

## Phase 13 interaction
Long-press a durable, non-deleted message to open the message-actions sheet.

Supported reactions for the MVP:
`👍 ❤️ 😂 😮 😢 🙏`

See `PHASE13_README.txt` and `docs/PROJECT_STATE.md`.

Next: Phase 14 — group chats.

# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 10 — real delivery/read receipts and unread counters.

Implemented:
- Android Expo development build
- navigation + reusable messenger design system
- Supabase email/password auth + persisted sessions
- editable profiles, usernames, bios and avatars
- production conversation/member/message/receipt/attachment schema
- secure user discovery
- idempotent direct-chat creation
- real Supabase-backed Chats list
- durable text messaging + optimistic retry
- cursor-paginated history
- private conversation-scoped Realtime Broadcast
- private authenticated user inbox Broadcast
- delivered/read receipt persistence
- live sent/delivered/read ticks
- per-conversation unread badges + Chats tab total
- read cursor (`last_read_at`) updates

Typing/presence begins in Phase 11.

See `PHASE10_README.txt` and `docs/PROJECT_STATE.md`.

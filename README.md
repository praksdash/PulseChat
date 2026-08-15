# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 11 — typing indicators, online/offline presence, and last seen.

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
- delivered/read receipt persistence + unread counters
- app-level Realtime Presence for online/offline
- durable last-seen heartbeat
- private conversation-member typing Broadcast
- typing debounce/expiry and background-safe presence handling

Media messages begin in Phase 12.

See `PHASE11_README.txt` and `docs/PROJECT_STATE.md`.

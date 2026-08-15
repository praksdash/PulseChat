# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 9 — real realtime one-to-one text messaging.

Implemented:
- Android Expo development build
- navigation and reusable messenger design system
- Supabase email/password auth + persisted sessions
- editable profiles, usernames, bios and avatars
- production conversation/member/message/receipt/attachment schema
- secure user discovery
- idempotent direct-chat creation
- real Supabase-backed Chats list
- durable text-message sending
- optimistic message bubbles + failed-send retry
- cursor-paginated message history
- private conversation-scoped Supabase Realtime Broadcast
- membership-based Realtime Authorization
- reconnect reconciliation against PostgreSQL

Delivered/read states intentionally begin in Phase 10.

See `PHASE9_README.txt` and `docs/PROJECT_STATE.md`.

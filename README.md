# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 8 — real direct-chat creation and database-backed Chats list.

Implemented so far:
- Android Expo development build
- navigation skeleton and reusable messenger design system
- Supabase email/password authentication
- persisted sessions and protected routes
- editable profiles, usernames, bios and avatars
- avatar Storage RLS
- production conversation/member/message/receipt/attachment schema
- membership-based messaging RLS and dedupe/pagination primitives
- real authenticated user discovery
- safe public profile details
- transactional create-or-get direct conversation RPC
- one direct conversation per canonical user pair
- real Supabase-backed Chats list
- membership-protected conversation summary route
- chat-list loading/error/empty/pull-to-refresh states

Text message sending and realtime delivery remain intentionally deferred to Phase 9.

See `PHASE8_README.txt` and `docs/PROJECT_STATE.md`.

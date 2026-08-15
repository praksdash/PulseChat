# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 6 — production messaging database architecture.

Implemented so far:
- Android Expo development build
- navigation skeleton
- reusable messenger design system
- Supabase email/password authentication
- persisted sessions and protected routes
- editable profiles, usernames, bios and avatars
- avatar Storage RLS
- production conversation/member/message/receipt/attachment schema
- membership-based messaging RLS and least-privilege grants
- dedupe and pagination database primitives
- typed Supabase database client

The visible chat list remains mock data intentionally. Real user discovery begins in Phase 7, direct-chat creation in Phase 8 and realtime text messaging in Phase 9.

See `PHASE6_README.txt` for the exact setup/test sequence and `docs/PROJECT_STATE.md` for project state.

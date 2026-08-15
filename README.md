# PulseChat

Telegram-inspired messaging application built with React Native, Expo Router, TypeScript and Supabase.

## Current milestone
Phase 7 — secure real-user discovery.

Implemented so far:
- Android Expo development build
- navigation skeleton and reusable messenger design system
- Supabase email/password authentication
- persisted sessions and protected routes
- editable profiles, usernames, bios and avatars
- avatar Storage RLS
- production conversation/member/message/receipt/attachment schema
- membership-based messaging RLS and dedupe/pagination primitives
- real authenticated user search by display name/username
- private discovery RPCs that expose only safe public profile fields
- public profile details route
- search debounce, loading/error/empty states and stale-request protection

The chat list remains mock data intentionally. Phase 8 creates real direct conversations and replaces the mock chat list; Phase 9 adds realtime text messaging.

See `PHASE7_README.txt` and `docs/PROJECT_STATE.md`.

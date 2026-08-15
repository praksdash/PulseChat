PulseChat Phase 11 — Typing + Presence

Adds:
- app-level Realtime Presence for online/offline
- durable last-seen heartbeat in public.user_presence
- presence is untracked when the app backgrounds
- foreground reconnect/track handling for React Native
- direct-chat peer online indicator + avatar badge
- last-seen subtitle when offline
- typing indicator through a separate private Broadcast topic
- throttled typing refresh + idle false event + receiver expiry safety
- RLS authorization for presence:<user_uuid> and typing:<conversation_uuid>

Install:
1. Copy this PulseChat folder over the existing Phase 10 project, preserving local .env/.git/android/node_modules.
2. Run supabase/migrations/202608150008_phase11_typing_presence.sql in Supabase SQL Editor.
3. Run supabase/phase11_verify.sql.
4. npx expo start -c
5. npm run typecheck
6. Test with two accounts/devices.

No new npm or native dependency is introduced in Phase 11.


PHASE 11.1 FIX
- Explicitly enables Presence on the publisher and observer channels.
- Keeps web pages online while open so two side-by-side browser profiles can be tested.
- Native Android/iOS still go offline when backgrounded.
- Queues the first typing state until the private Broadcast channel is subscribed.
- Enables Broadcast acknowledgements and stronger channel error logging.

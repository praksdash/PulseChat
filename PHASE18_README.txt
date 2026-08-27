PulseChat Phase 18 — Settings
=============================

Base: Phase 17 BackNavigationFix (Phase 17 accepted).

Implemented
-----------
1. Settings hub
   Profile -> Settings -> Appearance / Notifications / Privacy & security / Account.

2. Appearance
   - System / Light / Dark
   - app-wide ThemeProvider
   - AsyncStorage persistence
   - no backend/native dependency change

3. Notification preferences
   - direct-message notifications
   - group-message notifications
   - message-preview privacy
   - web browser notification preference
   - server-side enforcement in send-message-push

4. Per-chat mute
   - bell control in every direct/group conversation
   - durable conversation_members.muted_until
   - secure caller-scoped get/set RPCs
   - Android remote push + web browser alerts honor mute

5. Account
   - email/session view
   - sign out
   - permanent account deletion
   - server-side delete-account Edge Function
   - group-owner handoff / empty-group cleanup
   - avatar cleanup

Database
--------
Run:
  supabase/migrations/202608270016_phase18_settings.sql
Then verify:
  supabase/phase18_verify.sql

Edge Functions
--------------
Redeploy the changed push dispatcher:
  npx supabase functions deploy send-message-push --no-verify-jwt
Deploy account deletion:
  npx supabase functions deploy delete-account --no-verify-jwt

No new Edge Function secrets are required. Existing Supabase server credentials are supplied by the Edge Function runtime. Existing Phase 15 PUSH_WEBHOOK_SECRET / EXPO_ACCESS_TOKEN remain unchanged.

Client
------
No new npm/native package is introduced in Phase 18. Preserve your currently synced package-lock.json, .env and google-services.json when copying this package.

Acceptance
----------
Run npm run typecheck and the Phase 18 tests in docs/TESTING.md. Do not mark Phase 18 complete until at least appearance persistence, global notification preferences, one per-chat mute, and account settings have been verified on your test environment.

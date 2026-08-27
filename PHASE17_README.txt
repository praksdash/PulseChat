PulseChat Phase 17 — Block / Report / Privacy

Run after Phase 16:
  supabase/migrations/202608160015_phase17_block_report_privacy.sql

Verify:
  supabase/phase17_verify.sql

Client features:
- Profile > Privacy & security
- Search visibility toggle
- Allow-new-direct-chat toggle
- Online/last-seen visibility toggle
- Block/unblock from user profile
- Blocked-user management
- Report user
- Report incoming message
- Direct chat composer/privacy banner after block

Server enforcement:
- direct text/image sends
- media upload authorization
- direct chat creation
- people discovery
- presence/last seen
- typing and direct conversation Broadcast
- direct push dispatch

Deploy updated Edge Function after the SQL migration:
  npx supabase functions deploy send-message-push --no-verify-jwt

No new npm/native dependency is introduced in Phase 17.

PulseChat Phase 12 Hotfix

Fixes
1. Image send failure: column reference "sender_id" is ambiguous.
   The RPC now targets the named PostgreSQL uniqueness constraint:
   ON CONFLICT ON CONSTRAINT messages_sender_client_unique DO NOTHING.

2. Presence warning in React/Web development:
   cannot add `presence` callbacks ... after `subscribe()`.
   Supabase currently returns an existing channel for the same topic. React
   development remounts can briefly leave the old channel registered, so the
   service now fully removes stale same-topic Presence channels before creating
   and registering a fresh subscription.

Existing Phase 12 users
1. Copy the fixed package over the project.
2. Run supabase/migrations/202608150010_phase12_hotfix.sql in Supabase SQL Editor.
3. Run supabase/phase12_hotfix_verify.sql. It should return true.
4. Run npm run typecheck.
5. Restart Metro with npx expo start -c.
6. Test image send and Presence again.

No npm install, prebuild, or Android native rebuild is required for this hotfix.

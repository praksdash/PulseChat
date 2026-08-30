PulseChat Phase 27.2 — call-session database tables and RLS
===========================================================

Outcome
-------
This package adds only the secure Supabase call metadata foundation:
- call_sessions
- call_participants
- direct-conversation/two-party structural validation
- bounded lifecycle transition validation
- participant seeding
- party-only SELECT RLS
- no anonymous access or direct client writes

It does not add LiveKit, an Edge Function, app permissions, call buttons,
ringing, or media behavior.

Files
-----
- supabase/migrations/202608300020_phase27_2_one_to_one_calls.sql
- supabase/phase27_2_verify.sql
- tests/phase27-2-call-schema.test.mjs
- docs/PHASE27_2_ACCEPTANCE.md
- docs/ROADMAP.md
- PHASE27_2_README.txt

Local verification
------------------
Run:
  npm run typecheck
  npm run lint
  npm run test:unit
  npm run release:audit:source
  npm run ops:audit:source

Owner Supabase step
-------------------
1. Open the PulseChat Supabase project SQL Editor.
2. Paste and run the complete migration file first.
3. Paste and run supabase/phase27_2_verify.sql second.
4. Confirm the final five result columns are true.
5. Save a screenshot/result as Phase 27.2 evidence.

Do not run the verification before the migration. Do not expose a service-role
key or create LiveKit secrets yet.

Expected final verification row
-------------------------------
call_sessions_exists                 true
call_participants_exists             true
authenticated_can_read_own_sessions  true
authenticated_cannot_insert_directly true
anonymous_cannot_read_calls          true

Recommended commit
------------------
feat(calls): add Phase 27.2 call schema and RLS


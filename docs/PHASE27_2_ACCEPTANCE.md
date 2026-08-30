# PulseChat Phase 27.2 — call-session schema acceptance

Status: **SOURCE COMPLETE — LIVE SUPABASE VERIFICATION REQUIRED**

## Objective

Add only the durable one-to-one call-session and participant schema, structural
guards, state-machine validation, RLS, and least-privilege grants required by
the Phase 27.1 decision.

## Why this is needed

Calling needs one server-authoritative record that both Android phones can
reconcile. Media-room state alone cannot safely decide who may call, who is the
caller/callee, whether a call is still ringing, or which terminal result should
later appear in call history.

## Files changed

- `supabase/migrations/202608300020_phase27_2_one_to_one_calls.sql`
- `supabase/phase27_2_verify.sql`
- `tests/phase27-2-call-schema.test.mjs`
- `docs/PHASE27_2_ACCEPTANCE.md`
- `docs/ROADMAP.md`
- `PHASE27_2_README.txt`

No application source, dependency, lockfile, Edge Function, Android permission,
LiveKit credential, Firebase setting, package name, or existing Phase 26 table
is changed.

## Security boundary

- A call must reference an existing direct conversation and its exact two
  current members.
- Caller and callee are different authenticated users.
- Participant rows are seeded by a database trigger and must match the declared
  caller/callee roles.
- Authenticated clients can select only sessions in which they are caller or
  callee, plus the two participant rows for those sessions.
- Anonymous access is revoked.
- Authenticated direct INSERT/UPDATE/DELETE privileges and policies are absent.
- Later call mutations must use narrow caller-bound RPCs.
- Terminal states are immutable and state transitions are server-validated.
- Call metadata contains no audio, video, transcript, recording, token, LiveKit
  secret, IP address, or raw provider payload.

## Lifecycle recorded by the schema

`ringing -> accepted -> active -> ended`

Bounded alternatives are `declined`, `cancelled`, `missed`, and `failed`.
Only one unfinished call may exist per direct conversation. Cross-conversation
call serialization and call-waiting rejection belong to the later caller-bound
RPC/security phases.

## Acceptance criteria

- [x] migration creates `call_sessions` and `call_participants`;
- [x] only direct-chat parties can be represented;
- [x] caller/callee participant rows are automatically seeded;
- [x] lifecycle transitions and terminal immutability are enforced;
- [x] RLS is enabled on both tables;
- [x] authenticated users receive party-only SELECT access;
- [x] anonymous and direct authenticated write access remain revoked;
- [x] focused static tests and existing source regressions pass;
- [ ] migration is applied to the owner Supabase project;
- [ ] `supabase/phase27_2_verify.sql` returns all `true`; and
- [ ] the owner approves Phase 27.2 before Phase 27.3 begins.

## Explicitly not delivered

There is no callable create/answer/end RPC, LiveKit room/token, Realtime
publication, incoming push, Android permission, call button, or call UI in this
phase. The app should behave exactly like the verified Phase 26 baseline.


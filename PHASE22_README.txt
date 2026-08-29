PulseChat Phase 22 V1 — End-to-End QA Candidate
================================================

Objective
---------
Turn the Phase 21 source into a repeatable Prototype V1 acceptance candidate,
fix reproducible correctness blockers, and make the remaining owner/device gate
explicit. Phase 22 does not add calls, E2EE, files, channels, bots, stories, or
other post-V1 scope.

Correctness fixes
-----------------
- Conversation-scoped async results cannot merge into another chat after rapid
  navigation. This covers older pages, message-search windows, outbox flushes,
  text sends, image sends, and media stage updates.
- A response row is checked against the active conversation before rendering.
- Only the newest unread-count request may update the Chats tab badge.
- Stale profile responses cannot replace the next signed-in account's profile.
- Notification preferences from the previous account are ignored until the
  current account's authoritative settings load.
- Concurrent first-time native session writes share one SecureStore key
  initialization, preventing an encrypted-session/key mismatch.

QA tooling
----------
- `npm run qa:preflight:source` validates the shareable source package while
  allowing the intentionally excluded private environment files.
- `npm run qa:preflight` is the strict owner/device check. It requires a valid
  `.env` and a Firebase `google-services.json` whose Android package is
  `com.prakashdash.pulsechat`.
- `npm run qa:automated` runs the security/source gate.
- `npm run qa:phase22` runs the automated gate plus Android and Web exports.
- Preflight parsing/configuration behavior is covered by four new unit tests;
  the full unit suite now contains ten tests.

Owner deployment gate
---------------------
1. Apply `supabase/migrations/202608280017_phase21_security_hardening.sql`.
2. Run `supabase/phase21_verify.sql` and require:
   `Phase 21 security verification passed.`
3. Redeploy:
   `npx supabase functions deploy send-message-push --no-verify-jwt`
   `npx supabase functions deploy delete-account --no-verify-jwt`
4. Add the real `.env` and private `google-services.json`.
5. Run `npm run qa:preflight`; zero failures are allowed.
6. Produce/install the same development or preview build on both Android phones.

Prototype V1 device gate
------------------------
Use `docs/PHASE22_ACCEPTANCE.md` to record build identity, both phones, backend
deployment evidence, every test result, and any reproducible defect. Core V1
acceptance covers two accounts/profiles, discovery, direct realtime text and
images, unread plus sent/delivered/read, push/tap routing, a small group,
offline replay without duplicates, and restart persistence.

Status
------
Source fixes and local automated verification are complete. Phase 22 remains
`READY FOR OWNER/DEVICE QA`, not accepted, until the linked Supabase project and
two physical Android phones pass the signed checklist.

Recommended commit
------------------
fix: harden Phase 22 Prototype V1 acceptance

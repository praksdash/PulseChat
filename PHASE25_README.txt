PulseChat Phase 25 — Play Store internal-beta readiness
=======================================================

Outcome
-------
The source-owned Play Store package is prepared for the existing Prototype V1.
It does not add product features or widen the V1 scope.

Included
--------
- accurate privacy-policy and account-deletion page templates;
- Data safety and content-rating working answers;
- English store listing copy and release notes;
- reviewed 512 px icon and 1024 x 500 feature graphic;
- phone-screenshot capture specification and two authentic phone screenshots;
- internal-track upload, pre-launch, beta, rollback, and sign-off runbooks;
- an automated source/configured Play readiness audit.

Run the source gate
-------------------
  npm ci
  npm run qa:phase25

Owner inputs required before Play Console submission
----------------------------------------------------
1. Copy release/play-store/owner-inputs.example.json to
   release/play-store/owner-inputs.json.
2. Fill the real support email, developer name, and public HTTPS URLs. The real
   file is ignored and must not contain reviewer passwords or service keys.
3. Review the two included authentic phone screenshots against the exact signed
   candidate; replace them only if the released UI materially differs.
4. Run:
     npm run play:audit
     npm run play:render-public
5. Host the generated privacy, deletion, and support pages at the configured
   public URLs.
6. Complete the accepted Phase 24 signed-build/device evidence before uploading
   that exact production AAB to Play internal testing.

Boundary
--------
No Play Console upload, public policy hosting, signed EAS AAB, pre-launch
report, or controlled-beta evidence is claimed by this source package. Those
remain owner-environment acceptance gates in docs/PHASE25_ACCEPTANCE.md.

Recommended commit
------------------
chore(play): prepare Phase 25 internal beta package

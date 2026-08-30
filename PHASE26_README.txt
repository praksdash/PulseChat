PulseChat Phase 26 — Production hardening and observability
===========================================================

Outcome
-------
Prototype V1 now has privacy-safe client crash/startup/API diagnostics, an
asynchronous Expo receipt worker, invalid-token cleanup, private operational
alerts/dashboards, bounded retention, and operator recovery runbooks.

Included
--------
- metadata-only authenticated diagnostics with bounded buffering and sampling;
- accessible app-level render-crash recovery screen;
- Supabase request timing/error classification without URLs, bodies or content;
- Expo ticket -> receipt lifecycle and DeviceNotRegistered cleanup;
- five-minute receipt-worker contract with secret-separated authentication;
- private crash/API/startup/push/job/storage/rate-limit operational signals;
- 30-day diagnostics/push retention and 90-day resolved-alert retention;
- backup/restore, incident, monitoring and acceptance runbooks;
- automated source/configured Phase 26 audit.

Run the source gate
-------------------
  npm ci
  npm run qa:phase26

The committed lockfile is verified with both npm 10.9.4 and npm 11.9.0. See
PHASE26_NPM_CI_FIX_README.txt for the cross-npm EAS peer-lock compatibility fix.

Owner work required
-------------------
1. Apply migration 202608290019_phase26_observability.sql.
2. Redeploy send-message-push and deploy poll-push-receipts.
3. Create a new PUSH_RECEIPT_SECRET; do not reuse PUSH_WEBHOOK_SECRET.
4. Schedule poll-push-receipts every five minutes and connect alert monitoring.
5. Run supabase/phase26_verify.sql and the Phase 26 device/incident tests.
6. Confirm database plus private Storage backup coverage and complete a restore
   drill in an isolated project.
7. Fill the ignored release/operations/owner-inputs.json and run npm run ops:audit.
8. Complete docs/PHASE26_ACCEPTANCE.md before accepting the phase.

Boundary
--------
This package does not claim the migration/function deployment, live schedule,
external alert channel, backup availability, restore drill, production AAB, or
physical-device evidence. It adds no post-V1 product feature.

Recommended commit
------------------
feat(ops): add Phase 26 observability and recovery controls

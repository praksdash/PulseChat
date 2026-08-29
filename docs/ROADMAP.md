# PulseChat Prototype V1 roadmap

## Current

Phase 22 — End-to-end QA candidate. Source review, correctness fixes, and local
automation are complete. Owner Supabase deployment and the signed two-phone
acceptance sheet remain before Phase 22 can be accepted.

## Next phases

### Phase 23 — UI/UX and accessibility polish

- Fix inconsistent loading, empty, error, keyboard, and permission states.
- Verify screen-reader labels, touch targets, contrast, font scaling, and dark mode.
- Polish V1 navigation and first-run/setup guidance without adding product scope.
- Exit gate: no critical accessibility issue or confusing V1 dead end.

### Phase 24 — Android release engineering

- Finalize application ID, version/build numbers, adaptive icon, splash, signing, Firebase config, and EAS profiles.
- Produce reproducible signed internal/preview builds.
- Validate upgrade, clean install, permissions, background push, and release configuration.
- Exit gate: installable signed Android release candidate from a clean source package.

### Phase 25 — Play Store internal beta readiness

- Prepare privacy policy, support contact, store listing assets, content rating, and Data safety answers.
- Upload to the Play Console internal-testing track and resolve pre-launch findings.
- Run a small controlled beta and fix release-blocking defects only.
- Exit gate: V1 approved for internal beta distribution.

### Phase 26 — Production hardening and observability

- Add crash reporting, startup/API latency telemetry, asynchronous Expo push-receipt polling, invalid-token cleanup, alerts, and operational runbooks.
- Add backup/restore checks, rate-limit/Storage dashboards, dependency review cadence, and incident diagnostics.
- Exit gate: failures are detectable, attributable, and recoverable before wider release.

## Post-V1 backlog

The following remain deliberately uncommitted and must not delay Prototype V1: iOS production release, desktop/multi-device synchronization, voice/video calls, secret-chat E2EE, audio/video/files, stories, bots, channels, broadcasts, and Telegram-scale infrastructure.

Do not begin Phase 23 until `docs/PHASE22_ACCEPTANCE.md` is completed and the
Phase 22 exit gate passes. Automated exports alone do not satisfy that gate.

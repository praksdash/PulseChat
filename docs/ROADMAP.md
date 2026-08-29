# PulseChat Prototype V1 roadmap

## Current

Phase 23 — UI/UX and accessibility candidate. Source polish and local automation
are complete. Physical Android TalkBack/font-scale evidence remains before
Phase 23 can be accepted. Phase 22's signed two-phone acceptance also remains
open; Phase 23 proceeded because the owner explicitly requested the next phase.

## Next phases

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

Do not mark Phase 23 accepted until `docs/PHASE23_ACCEPTANCE.md` is signed.
Phase 22 remains independently unaccepted until `docs/PHASE22_ACCEPTANCE.md` is
completed; automated exports alone satisfy neither physical-device gate.

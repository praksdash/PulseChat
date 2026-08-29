# PulseChat Prototype V1 roadmap

## Current

Phase 24 — Android release candidate source. Release identity, PulseChat assets,
EAS profiles, private Firebase injection, remote-signing policy, native smoke
tests, owner runbooks, Windows Metro compatibility, and the forward limiter
ambiguity fix are complete. The owner must apply/verify the migration. A signed
preview APK plus clean-install, upgrade, push, and two-phone evidence remain
before Phase 24 can be accepted.
Phase 22 and Phase 23 also remain open until their physical-device records are
signed; later source work does not waive those gates.

## Next phases

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

Do not mark Phase 24 accepted until `docs/PHASE24_ACCEPTANCE.md` is signed for a
clean-source EAS preview APK. Phase 22 and Phase 23 remain independently
unaccepted until their records are completed; automated exports, native
prebuilds, and an unsigned package satisfy no physical-device gate.

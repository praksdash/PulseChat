# PulseChat Prototype V1 roadmap

## Current

Phase 25 — Play Store internal-beta readiness. Source-owned privacy/deletion
templates, Data safety/content-rating answers, listing copy, Play icon/feature
graphic, authentic screenshot specification, beta runbook, acceptance sheet and
automated audit are complete. Owner contact/URLs, hosted public pages, authentic
candidate screenshots, Play Console upload, pre-launch report and beta evidence
remain before Phase 25 can be accepted.

Phase 22, Phase 23 and Phase 24 physical/signed-build records remain open; later
source work does not waive those gates.

## Next phase

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

Do not mark Phase 25 accepted from source artifacts. Its exact production AAB,
Play policy forms, internal-track/pre-launch evidence and controlled beta must
be recorded in `docs/PHASE25_ACCEPTANCE.md`.

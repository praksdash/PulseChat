# PulseChat Prototype V1 roadmap

## Current

Phase 26 — Production hardening and observability. Source-owned privacy-safe
crash/startup/API diagnostics, Expo receipt polling, invalid-token cleanup,
private alerts/dashboards, bounded retention, automated audits, and recovery
runbooks are complete. Deployment, scheduling, external monitoring, backup and
restore-drill evidence remain before Phase 26 can be accepted.

Phase 22–25 physical/signed-build/Play records remain open; later source work
does not waive those gates. The two authentic phone screenshots are now present,
but Phase 25 still requires the exact AAB, Play forms and controlled-beta proof.

## Next milestone

Phase 27.1 selected the narrow Android one-to-one call scope and LiveKit Cloud
media provider. Phase 27.2 is the current micro-phase: call-session/participant
tables, structural validation, RLS, and least-privilege grants only. Phase 26
remains the stable application baseline.

Phase 27.3 must not start until the Phase 27.2 migration is applied to the owner
Supabase project and `supabase/phase27_2_verify.sql` passes.

No later Phase 27 micro-phase starts automatically. Complete and review each
small objective independently, while continuing to track every open Phase
22–26 owner acceptance row before any wider Play rollout.

## Post-V1 backlog

Except for the narrowly documented Android one-to-one calling decision in
Phase 27.1, the following remain deliberately uncommitted and must not delay
Prototype V1: iOS production release, desktop/multi-device synchronization,
group calls, secret-chat E2EE, audio/video/files, stories, bots, channels,
broadcasts, and Telegram-scale infrastructure.

Do not mark Phase 24 accepted until `docs/PHASE24_ACCEPTANCE.md` is signed for a
clean-source EAS preview APK. Phase 22 and Phase 23 remain independently
unaccepted until their records are completed; automated exports, native
prebuilds, and an unsigned package satisfy no physical-device gate.

Do not mark Phase 25 accepted from source artifacts. Its exact production AAB,
Play policy forms, internal-track/pre-launch evidence and controlled beta must
be recorded in `docs/PHASE25_ACCEPTANCE.md`.

Do not mark Phase 26 accepted until its deployed receipt worker/schedule,
external alert path, database plus private-Storage backup, isolated restore
drill, incident exercise and physical candidate evidence are recorded in
`docs/PHASE26_ACCEPTANCE.md`.

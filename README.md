# PulseChat

PulseChat is a Telegram-inspired messaging prototype built with React Native, Expo Router, TypeScript, Supabase Auth/PostgreSQL/Realtime/Storage, and Expo Notifications.

## Current milestone

Phase 24 — Prototype V1 Android release candidate. Reproducible release source,
PulseChat brand assets, EAS profiles, and release/native audits are implemented;
the owner-signed EAS preview APK and physical two-phone acceptance remain open.

## Prototype V1 success scope

The milestone is complete when PulseChat can be installed on two Android phones and both users can:

- create email/password accounts and profiles;
- find each other and open a direct conversation;
- exchange realtime text and image messages;
- see unread counts and sent/delivered/read state;
- receive push notifications;
- create a small group and exchange group messages; and
- close and reopen the app without losing conversations.

Existing reply/edit/delete/reaction, privacy, settings, search, typing, and presence work is retained, but it must not delay V1 acceptance.

## Intentionally postponed beyond V1

- voice/video calls;
- end-to-end encrypted secret chats;
- stories, bots, channels, and advanced broadcasts;
- multi-device synchronization and desktop clients;
- audio, voice-note, video, and general file-message expansion;
- Telegram-scale infrastructure or paid observability.

## Phase 20 fixes

- bounded FlatList render windows and stable render callbacks;
- safe component memoization without stale interaction handlers;
- keyed, trailing request coalescing for active conversation refreshes;
- stale-response guards for chat lists, summaries, message pages, and details;
- in-flight private-media URL deduplication, bounded memory caching, and cache clearing between accounts;
- ordered offline-cache writes with duplicate-payload suppression;
- AsyncStorage v3 API compatibility;
- reproducible dependencies through `package-lock.json`;
- working TypeScript, ESLint, focused unit-test, and Android export commands; and
- conditional Firebase config for local checks before `google-services.json` is supplied.

## Phase 21 hardening

- server-side fixed-window limits for message creation, report submissions, profile writes, and remote push diagnostics;
- RPC-only profile updates with caller ownership and avatar-object metadata checks;
- canonical private image paths plus authoritative Storage object MIME/size validation before message commit;
- AES-256-GCM authentication for native session/cache/outbox envelopes with Phase 19 migration support;
- memory-only browser message cache/outbox plus session-only browser auth persistence;
- signed media URLs removed from persistent offline snapshots;
- cleanup of newly uploaded objects when image-message commit is rejected;
- generic Edge Function failure responses and constant-time webhook-secret comparison;
- secret scanning and a high/critical dependency audit gate; and
- explicit account/message/media deletion semantics.

## Phase 22 QA hardening

- active user/conversation guards prevent older pages, search windows, outbox
  rows, and send results from appearing in another chat after navigation;
- the Chats badge accepts only the newest unread-count response;
- profile and notification preference state is isolated during account changes;
- native first-session key initialization is concurrency-safe;
- global-search pagination cannot append an old query's page to a new query;
- strict and source-only configuration preflights validate the V1 build inputs;
- the clean acceptance command covers security checks, ten unit tests, Android
  export, and Web export; and
- a two-phone evidence sheet defines the only valid physical acceptance path.

## Phase 23 UX/accessibility polish

- semantic action/text colors meet the automated 4.5:1 contrast gate in light and dark modes;
- shared text, inputs, buttons, switches, search, and row components expose scaling, names, hints, and state;
- dialogs avoid nested interactive web controls and isolate modal focus;
- known small back/close/filter/reaction targets meet the 44-point minimum;
- deep-linked routes have deterministic back fallbacks;
- keyboard, progress, error, permission, privacy-load, and blocked-user recovery states are explicit; and
- a static accessibility audit plus three tests prevent regressions in these V1 fixes.

## Phase 24 Android release engineering

- fixed Android identity at `com.prakashdash.pulsechat`, version `1.0.0`,
  versionCode `24`;
- source-controlled local versioning and exact EAS CLI 22.0.0;
- PulseChat launcher, adaptive/themed, splash, notification, and Web artwork;
- fail-closed Firebase release config with EAS secret file injection;
- remote-signed development/preview APK and production AAB profiles;
- release-identity/asset audit and generated-native Android smoke test; and
- a signed-artifact runbook plus clean-install, upgrade, push, and two-phone
  acceptance record.

## Local setup

1. Install Node.js and npm supported by Expo SDK 57.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add the Supabase URL and publishable key.
4. Apply the Supabase migrations in order, including the Phase 24 rate-limiter fix.
5. For real Android push notifications, add your Firebase `google-services.json` at the project root and complete `PHASE15_SETUP.md`.
6. Run `supabase/phase21_verify.sql` and `supabase/phase24_verify.sql`, then
   redeploy `send-message-push` plus `delete-account`.
7. Run `npm run qa:preflight`; correct every failure before building for devices.
8. Run `npm run qa:phase24` from the clean source package.
9. Restore owner-only private inputs and run `npm run release:gate:configured`.
10. Follow `docs/PHASE24_RELEASE_RUNBOOK.md` to build and install the same
    signed EAS preview APK on both phones.

## Verification commands

```bash
npm run verify
npm run verify:security
npm run qa:preflight
npm run audit:accessibility
npm run release:audit:source
npm run check:android:native:source
npm run qa:phase24
```

The Android export and native prebuild validate source/generated configuration,
not signing or installation. A signed EAS preview APK plus physical devices is
still required to verify upgrades, TalkBack/font scaling, FCM delivery, OS
permissions, and complete V1 acceptance.

See `PHASE24_README.txt`, `docs/PHASE24_RELEASE_RUNBOOK.md`,
`docs/PHASE24_ACCEPTANCE.md`, `docs/PHASE24_RELEASE_REPORT.md`,
`docs/PHASE23_ACCEPTANCE.md`, `docs/PHASE22_ACCEPTANCE.md`,
`docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, and `docs/TESTING.md` for the exact
handoff state.

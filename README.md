# PulseChat

PulseChat is a Telegram-inspired messaging prototype built with React Native, Expo Router, TypeScript, Supabase Auth/PostgreSQL/Realtime/Storage, and Expo Notifications.

## Current milestone

Phase 21 — Prototype V1 security hardening is implemented. Automated local verification passes; the new Supabase migration/Edge Function deployment and final two-device acceptance test remain environment-dependent.

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

## Local setup

1. Install Node.js and npm supported by Expo SDK 57.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and add the Supabase URL and publishable key.
4. Apply the Supabase migrations in order, including Phase 21.
5. For real Android push notifications, add your Firebase `google-services.json` at the project root and complete `PHASE15_SETUP.md`.
6. Run `supabase/phase21_verify.sql`, and redeploy `send-message-push` plus `delete-account`.
7. Run `npm run verify:security`.
8. Start with `npx expo start -c`.

## Verification commands

```bash
npm run verify
npm run verify:security
npm run check:android
```

`check:android` validates the JavaScript Android bundle. A real development/preview build plus two physical devices is still required to verify FCM delivery, background notifications, camera/gallery permissions, realtime receipts, and restart persistence.

See `PHASE21_README.txt`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/SECURITY.md`, `docs/PHASE21_SECURITY_REVIEW.md`, and `docs/TESTING.md` for the exact handoff state.

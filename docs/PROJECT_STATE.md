# PulseChat Project State

## Current phase
Phase 26 — Production hardening and observability (source engineering complete;
owner backend deployment, live schedule/alerts, backup/restore drill and device
evidence pending)

## Implemented
- Phase 0 product scope/architecture
- Phase 1 development environment
- Phase 2 navigation
- Phase 3 design system
- Phase 4 Supabase authentication
- Phase 5 profiles/usernames/avatars
- Phase 6 messaging database + RLS
- Phase 7 user discovery
- Phase 8 direct-chat creation + real Chats list
- Phase 9 realtime text messaging
- Phase 10 delivered/read receipts + unread counters
- Phase 11 typing/presence/last seen
- Phase 12 secure image messaging
- Phase 13 reply/edit/delete/reactions
- Phase 14 group chats
- Phase 15 push notifications + Android/web notification diagnostics
- Phase 16 global search
- Phase 17 block/report/privacy
- Phase 18 settings/account controls
- Phase 19 offline/error handling
- Phase 20 Prototype V1 performance/correctness fixes
- Phase 21 Prototype V1 security hardening
- Phase 22 Prototype V1 QA/correctness hardening candidate
- Phase 23 Prototype V1 UX/accessibility polish candidate
- Phase 24 Prototype V1 Android release engineering candidate
- Phase 25 Prototype V1 Play Store internal-beta readiness candidate
- Phase 26 Prototype V1 production hardening and observability candidate

## Acceptance status
- Phase 26 source diagnostics, receipt polling, alert/dashboard, retention and
  recovery controls are complete. Deployment, scheduling, external monitoring,
  backup/restore and incident/device evidence remain owner-side requirements.
- Phase 25 policy/listing sources, two authentic phone screenshots and automated
  readiness audit are complete. Real support/public URLs, Play forms/upload,
  pre-launch and beta evidence remain owner-side requirements.
- Phase 24 release identity, assets, EAS profiles, private-config boundary, and native Android generation are source-controlled. The final clean Phase 24 gate is recorded at handoff.
- No signed EAS artifact is claimed: the implementation environment had no EAS login/token or Android SDK. Owner EAS build provenance and physical-device evidence remain required.
- Phase 23 TypeScript, ESLint, unit tests (13/13), accessibility audit, and source preflight passed during implementation on 2026-08-29 UTC.
- Phase 23 physical TalkBack/font-scale/device acceptance is not claimed complete.
- Phase 21 migration/RLS verification, Edge Function deployment, Firebase/FCM setup, strict preflight, and the final two-Android-device acceptance test remain owner-environment checks.
- Phase 20's physical acceptance gate was not claimed complete; Phase 21 proceeded only because the owner explicitly approved the next phase.

## Phase 15 implementation
- `expo-notifications` SDK 57 integration
- Android `messages` notification channel
- permission request + ExpoPushToken acquisition using EAS `projectId`
- per-installation token registration in `public.push_tokens`
- token rotation reconciliation
- sign-out token disable + native unregister
- server-only `push_delivery_log` idempotency ledger
- `send-message-push` Supabase Edge Function
- authenticated Database Webhook using a dedicated shared secret header
- Expo Push Service enhanced-security access token support
- new-message notifications for direct and group conversations
- text/photo/generic media notification previews
- conversation mute (`muted_until`) respected by dispatcher
- sender excluded from push recipients
- multi-device support per recipient
- 100-token Expo batching
- immediate invalid-token disable on `DeviceNotRegistered` ticket errors
- notification badge count from durable unread receipts
- foreground suppression while the exact conversation is open
- notification tap opens the exact direct/group conversation
- membership re-check before notification navigation
- cold-start notification response handling

## Migration
`supabase/migrations/202608160013_phase15_push_notifications.sql`

## Edge Function
`supabase/functions/send-message-push/index.ts`

## Verification
`supabase/phase15_verify.sql`

## Required external configuration
- Firebase Android app for `com.prakashdash.pulsechat`
- project-root `google-services.json`
- FCM V1 service-account credential uploaded to EAS
- Expo access token with Enhanced Push Security enabled
- Supabase Edge Function secrets: `PUSH_WEBHOOK_SECRET`, `EXPO_ACCESS_TOKEN`
- Database Webhook: `public.messages` → INSERT → `send-message-push`

## Client environment variables
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Known limitations
- Phase 15 sends notifications for newly inserted messages only; edits/deletes/reactions do not create a second push.
- Expo push receipts are not polled asynchronously yet; immediate ticket failures are logged/handled. Receipt polling and operational alerting belong in Phase 26 hardening.
- Phase 18 now exposes account-wide notification preferences and secure per-chat mute controls; the dispatcher enforces both.
- iOS client code is included, but iOS credentials/device testing remain part of the later iOS production phase.

## Git checkpoint
Recommended: `build(android): prepare Phase 24 release candidate`

- Phase 15 hotfix: Android notification channel no longer passes `sound: "default"` as a custom sound filename; system notification sound behavior is used instead.

## Phase 15 notification completion fix
- Profile > Notifications is now a real settings/diagnostics screen.
- Android exposes permission, token registration, local test, and authenticated remote server test.
- Web uses the browser Notification API for realtime alerts while the PulseChat tab is open/backgrounded.
- Expo Notifications is native-only; closed-browser Web Push is intentionally not claimed in Phase 15.


## Phase 16 implementation
- Search tab now covers People / Chats / Messages / All.
- `search_my_conversations()` is membership-scoped and searches direct peer names/usernames plus group titles.
- `search_my_messages()` searches only non-deleted message bodies/image captions in conversations the caller currently belongs to.
- `get_message_window()` securely returns a small timeline window around an old search hit for jump-to-message UX.
- Message/group-title substring search uses pg_trgm GIN indexes.
- Search results are debounced, paginated for messages, and stale responses cannot replace newer queries.
- Tapping a message result opens the exact conversation, highlights the target, and provides Back to latest.

## Migration
`supabase/migrations/202608160014_phase16_search.sql`

## Verification
`supabase/phase16_verify.sql`


## Phase 17 implementation
- `user_privacy_settings` stores people-search visibility, new-direct-chat permission and activity visibility.
- `blocked_users` stores directional blocks; a block in either direction closes direct messaging for the pair.
- Direct text/image sends are enforced at PostgreSQL/RLS/trigger boundaries, not only in the UI.
- Blocked direct pairs cannot create/reopen a direct chat through the creation RPC, exchange typing, observe online/last-seen, or receive new direct-message push delivery.
- People discovery excludes users when either side has blocked the other and respects `discoverable_by_search`.
- Existing direct history remains readable after blocking. Shared groups remain intact and group history continues to follow group membership.
- `reports` is a private moderation table; normal authenticated clients cannot browse or directly insert into it.
- Users can report a profile or a specific incoming message through `report_user_or_message()`.
- Profile > Privacy & security exposes all privacy switches plus blocked-user management.
- Public profile and group member views provide access to block/report controls.

## Phase 17 migration
`supabase/migrations/202608160015_phase17_block_report_privacy.sql`

## Phase 17 verification
`supabase/phase17_verify.sql`


## Phase 18 implementation
- Settings hub with Appearance, Notifications, Privacy & security, and Account.
- Device-local System/Light/Dark theme preference via `ThemeProvider` + AsyncStorage.
- `notification_preferences` table and caller-scoped get/update RPCs.
- Server-enforced direct/group notification switches and message-preview privacy.
- Web browser alerts use the same preferences.
- Per-chat bell control backed by secure `conversation_members.muted_until` RPCs.
- Permanent account deletion through `delete-account`, including owned-group repair and avatar cleanup.

## Phase 18 migration
`supabase/migrations/202608270016_phase18_settings.sql`

## Phase 18 verification
`supabase/phase18_verify.sql`

## Phase 18 Edge Functions
- redeploy `send-message-push`
- deploy `delete-account`

## Phase 19 implementation
- Backend connectivity provider with online/offline health probes and foreground rechecks.
- Global offline status banner and manual connection retry.
- Recent Chats/conversation/message cache for graceful offline reads.
- Native cache and text outbox encrypted before AsyncStorage persistence with key material in Expo SecureStore.
- Durable offline text outbox automatically flushes on reconnect using the existing `client_message_id` dedup contract.
- Offline/session image queue retries automatically when connectivity returns; image URI persistence across killed app processes is intentionally not claimed.
- Retryable network failures return outgoing messages to queued state; server authorization/validation failures remain explicit failures.
- Network-required message mutations provide clear user-facing errors.
- Account deletion clears local offline state.

## Phase 19 migration
None.

## Phase 19 verification
Run `npm run typecheck`, then perform the offline/reconnect acceptance test in `docs/TESTING.md` on a real Android device and web.

## Phase 20 implementation
- Chats and message FlatLists now use bounded initial render counts, batch sizes and virtualization windows.
- ChatRow, Avatar, MessageBubble and MediaMessageBubble are memoized around visual, state, and interaction props.
- The message render callback remains stable during composer and unrelated screen-state updates.
- Chat/message timestamp formatters are reused rather than allocated per row render.
- Active-chat latest reconciliation is keyed by user + conversation, coalesced with the newest trailing authoritative refresh, and covered by unit tests.
- Stale chat-list, summary, message-page, and message-detail responses cannot overwrite a newer route/request.
- Chat-list activity bursts are coalesced before summary refresh.
- Private Storage signed URLs use a bounded 50-minute in-memory cache, batch signing, per-path in-flight deduplication, and account-change invalidation.
- Encrypted offline cache writes are serialized per key and skip identical payloads.
- AsyncStorage v3 cache deletion uses `removeMany`.
- Initial online mount no longer triggers a duplicate reconnect refresh in Chats/conversation summary flows.
- Dependencies are locked; TypeScript, ESLint, unit-test, and Android export commands are reproducible.

## Phase 20 migration
None.

## Phase 20 verification
Automated local verification completed with `npm run verify` and `npm run check:android`. Run `npx expo start -c`, then complete the Phase 20 V1 tests in `docs/TESTING.md` on two configured Android devices.

## Phase 21 implementation
- Private bounded rate-limit state and server-side limits for messages, reports, profile changes, and push diagnostics.
- Idempotent message retries bypass fresh rate-limit consumption when the sender/client-message pair already exists.
- Direct profile UPDATE is revoked; `update_my_profile()` derives the actor and validates profile input plus referenced avatar metadata.
- New private chat-image paths must match the canonical conversation/uploader/client-message JPEG shape.
- `create_image_message()` verifies the actual Storage object exists and its recorded MIME/size matches before committing metadata.
- Rejected image commits remove objects uploaded by the current attempt; duplicate retry objects remain protected.
- Native auth/cache/outbox persistence uses authenticated AES-256-GCM envelopes and upgrades readable Phase 19 AES-CTR values.
- Web auth uses session storage; browser message caches/outboxes are memory-only and Phase 19 plaintext keys are removed when touched.
- Offline message snapshots no longer persist signed media URLs.
- Push webhook secrets use constant-time comparison, remote push tests are bounded, and Edge Function 500 responses do not expose internal errors.
- Empty groups removed during account deletion also attempt group-avatar cleanup; shared messages/photos remain anonymized conversation history.
- A committed-secret scan and high/critical npm advisory gate are part of verification.

## Phase 21 migration
`supabase/migrations/202608280017_phase21_security_hardening.sql`

## Phase 21 verification
Run `npm run verify:security`, `npm run check:android`, a Web export, then apply the migration and run `supabase/phase21_verify.sql`. Redeploy `send-message-push` and `delete-account` before manual testing.

## Phase 22 implementation
- Active user/conversation guards cover initial/latest/older/search message reads,
  Realtime callbacks, queued-text flushes, text sends, image sends, and media
  progress so a slow chat-A operation cannot update chat B.
- Server page/send rows are checked against the requested conversation.
- Route transitions reset conversation loading/search/error state.
- Only the newest unread-count response can update the Chats tab badge.
- Delayed profile responses cannot replace the current account's profile.
- Previous-account notification settings are ignored until the new account's
  authoritative preferences load.
- Native auth encryption deduplicates first-time key initialization per storage
  key.
- Global-search pagination is bound to the initiating query sequence.
- Strict/source-only preflight commands validate source files, app/EAS settings,
  public Supabase client configuration, and Firebase package matching.
- The unit suite contains ten tests and `npm run qa:phase22` runs the complete
  local security, source, Android, and Web gate.

## Phase 22 migration
None. Phase 22 requires the existing Phase 21 migration to be applied and
verified in the owner project.

## Phase 22 verification
Clean `npm ci` and `npm run qa:phase22` passed on 2026-08-28 UTC. Complete
`docs/PHASE22_ACCEPTANCE.md` on the deployed backend and two Android phones;
local automation does not mark the phase accepted.

## Phase 23 implementation
- Light/dark semantic foreground pairs meet the automated 4.5:1 contrast gate.
- Shared text, fields, buttons, search, rows, settings switches, and progress/error
  states expose names, hints, scaling, checked, disabled, and busy semantics.
- Report/message-action modals use sibling backdrop controls and modal focus
  isolation, avoiding nested interactive elements on Web.
- Known back, close, filter, and reaction controls meet the 44-point minimum.
- Every route using `router.back()` has a deterministic refresh/deep-link fallback.
- V1 form/search/member flows adjust for and dismiss the keyboard consistently.
- Privacy and blocked-user initial-load failures show explicit retry paths.
- `npm run audit:accessibility` and three new tests protect the fixed source
  invariants; `npm run qa:phase23` adds fresh Android and Web exports.

## Phase 23 migration
None.

## Phase 23 verification
Local TypeScript, ESLint, 13 unit tests, and the static accessibility audit pass.
Complete `docs/PHASE23_ACCEPTANCE.md` on the configured Android build; automation
does not claim TalkBack, large-font, permission-dialog, or physical-device
acceptance.

## Phase 24 implementation
- Android identity is fixed at `com.prakashdash.pulsechat`, version `1.0.0`,
  versionCode `24`, with source-controlled versioning.
- PulseChat launcher, adaptive, monochrome, splash, notification, and favicon
  assets replace the generic Expo artwork; reviewed hashes are locked.
- EAS CLI 22.0.0 is an exact development dependency and is enforced by
  `eas.json`.
- Development and preview produce internal APKs; production produces a store
  AAB. All profiles use owner-controlled remote signing credentials.
- Release builds fail closed without private Firebase configuration and support
  `GOOGLE_SERVICES_JSON` as an EAS secret file variable.
- `.easignore` excludes local configuration, Firebase/service-account files,
  signing material, dependency/native output, and prior build artifacts.
- Release and native-prebuild audits verify identity, configuration, generated
  Gradle/manifest/resources, private-config behavior, and reviewed asset bytes.
- The release runbook and evidence sheet define the only valid signed-build,
  clean-install, upgrade, notification, and two-phone acceptance route.

## Phase 24 migration
`supabase/migrations/202608290018_phase24_rate_limit_ambiguity_fix.sql`

This forward migration preserves the Phase 21 private limiter signature and
privileges while removing the `actor_user_id` parameter/column ambiguity from
its conflict-update path.

## Phase 24 verification
Run `npm ci` and `npm run qa:phase24` from the clean Phase 24 package. Apply the
Phase 24 migration and run `supabase/phase24_verify.sql`. Restore owner private
inputs and run `npm run release:gate:configured`, then create the
signed preview APK with `npm run build:android:preview`. Complete
`docs/PHASE24_ACCEPTANCE.md`; local automation does not claim EAS signing,
installability, upgrade continuity, FCM delivery, or physical-device behavior.

## Phase 25 implementation
- Accurate privacy, account-deletion and support HTML templates.
- Data safety declarations grounded in the deployed V1 data model, including
  service providers, anonymized shared-history retention and no E2EE claim.
- Adult internal-beta content-rating/UGC working answers.
- Play-compliant listing copy, 512 px icon and 1024 × 500 opaque feature graphic.
- Two authentic phone screenshots are included with personal identity replaced
  by generic test data; the app UI itself remains the captured candidate UI.
- Owner-only contact/URL/app-access configuration remains ignored from source.
- Configured renderer produces public pages only after owner inputs validate.
- Source/configured Play readiness audits validate identity, character limits,
  policy facts, asset dimensions, screenshots and owner confirmations.
- Internal track, pre-launch, controlled beta, rollback and sign-off runbooks.

## Phase 25 migration
None.

## Phase 25 verification
Run `npm ci` and `npm run qa:phase25`. Source-only readiness may report the
expected owner-input warning. Before submission, provide the ignored owner
inputs, run `npm run play:audit` and
`npm run play:render-public`, host the pages, build the exact production AAB and
complete `docs/PHASE25_ACCEPTANCE.md` in Play Console.

## Phase 26 implementation
- Bounded, authenticated crash/startup/API diagnostic ingestion that accepts no
  message/profile content, URL/body, token or raw stack.
- Root render-error recovery UI, global JS error capture attempt and sampled
  slow/error Supabase request timing by sanitized operation.
- Expo tickets are recorded as `ticketed`; a separate secret-protected worker
  polls receipts, marks delivery, bounds retries and disables only invalid tokens.
- Private job/alert ledgers and rate-limit/Storage aggregate dashboards.
- Automated 30-day diagnostics/push retention, 90-day resolved-alert retention,
  and explicit monitoring, backup/restore and incident runbooks.

## Phase 26 migration and verification
Migration: `supabase/migrations/202608290019_phase26_observability.sql`  
Verification: `supabase/phase26_verify.sql`

Run `npm ci` and `npm run qa:phase26`. Apply the migration, redeploy the push
dispatcher, deploy/schedule the receipt worker, configure the external alert
path, complete the isolated database/private-Storage restore drill, then finish
`docs/PHASE26_ACCEPTANCE.md`.

## Next task
Complete every still-open Phase 22–26 owner acceptance gate. No wider Play
rollout is authorized by source completion alone.

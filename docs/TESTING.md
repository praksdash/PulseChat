# PulseChat Testing

## Phase 10 migration verification
Run `supabase/phase10_verify.sql` after the migration.

Verify:
- new receipt/read/unread RPCs exist
- receipt creation trigger is enabled
- private Realtime policy exists
- receipt unread index exists
- receipt backfill missing-row query returns 0 rows
- sender-own-receipt query returns 0 rows

## Sent → delivered → read happy path
1. Login A and B on separate clients.
2. Keep A inside the A/B conversation.
3. Keep B signed out/closed or disconnected.
4. A sends a message; it reaches `sent` only.
5. Open B and let the authenticated app connect without opening the chat.
6. A should upgrade to `delivered` (double check).
7. Open A/B chat on B while the app is active.
8. A should upgrade to `read` (primary/read-colored double check).

## Unread counters
1. Keep B outside the A/B chat.
2. A sends 3 messages.
3. B Chats row should show 3 unread; Chats tab badge should include those 3.
4. Open the conversation on B.
5. Return to Chats; row badge should be gone and total tab badge decremented.

## Persistence/reconnect
1. Produce sent/delivered/read states.
2. Close both apps.
3. Reopen A and conversation.
4. Status must be restored from PostgreSQL.
5. Send to B while B is offline.
6. Reopen B; pending delivery reconciliation should move A to delivered.

## Read correctness
- Incoming messages must not be marked read merely because the chat route exists while the app is backgrounded.
- They should become read when the app becomes active with that conversation open.

## Security
- Account C cannot subscribe to `conversation:<A/B uuid>`.
- Account C cannot subscribe to `user:<A uuid>`.
- A cannot ask mark/read RPCs to modify B receipts; acting user is always derived server-side.
- anon cannot execute Phase 10 public RPCs.

## Regression
Auth, persistent session, profile/avatar, discovery, chat creation, message send/retry, pagination and realtime receive must still work.

## Phase 10 historical boundary
Typing/presence was added in Phase 11 and image media in Phase 12; their regression suites follow below.

## Phase 11 manual tests

1. Two authenticated users open the same direct chat: both see the peer as online.
2. A types continuously: B sees `typing…`; event volume is throttled and does not send for every character.
3. A stops typing: B clears `typing…` after the idle event; if the false event is lost, B clears after the receiver expiry.
4. A backgrounds PulseChat: B sees offline/last-seen rather than a false online state.
5. A foregrounds PulseChat: Realtime reconnects if needed and A becomes online again.
6. A non-member must be denied subscription to another conversation's typing topic.
7. A user may publish Presence only to `presence:<their own uuid>`.

## Phase 12 image media tests

1. Run `supabase/phase12_verify.sql`; `chat-media` must be private and anon execute on `create_image_message` must be false.
2. A chooses a library photo; an optimistic preview should appear immediately and progress through preparing/uploading/sending.
3. B should receive the image without manually refreshing the conversation.
4. B taps the image and gets a full-screen preview.
5. Delivered/read ticks for the image must follow the Phase 10 behavior.
6. Restart both apps; image history must reload with a newly signed private URL.
7. Test camera capture on Android/iOS.
8. Turn network off before sending; the local image should fail visibly. Restore network and tap retry. One durable message and one Storage object must exist.
9. Repeated/retried send must reuse the same `client_message_id` and canonical object path.
10. Account C, not in the conversation, must be unable to read the private object or sign it through the Storage API.
11. Verify text, receipts, typing and presence still work after the Phase 12 migration.

## Phase 13 manual tests

1. A long-presses B's text → Reply → sends text; both devices show reply preview.
2. A replies to B's photo with a text; restart and verify reply remains.
3. A replies to B's text with a photo; receiver gets it realtime.
4. A edits own text; B sees updated text without refresh and `edited` appears.
5. A cannot edit B's message.
6. A edits own photo caption, including removing caption.
7. A deletes own text; both sides show `Message deleted`.
8. A deletes own image; image becomes unavailable and message shows deleted.
9. B cannot delete A's message via normal client UI/API RPC.
10. A and B react with different emojis; counts aggregate realtime.
11. Tapping the same reaction again removes the user's reaction.
12. Changing reaction replaces the prior reaction for that user.
13. Close/reopen app; edits/deletes/reactions/replies persist.
14. Edit/delete the latest message while peer is on Chats tab; preview refreshes.

## Phase 14 group-chat manual tests

1. Login as A, search/select B and C, create a named group.
2. A/B/C Chats screens show one group row; no duplicate group is created by UI retries.
3. A sends text and image; B/C receive them realtime.
4. Incoming group bubbles show the sender's name/avatar.
5. B and C read the message; A's receipt advances according to all recipient receipts.
6. A promotes B to admin; B can add/remove regular members but cannot remove A or change admin roles.
7. A demotes B; B immediately loses admin management ability on reload/event.
8. A removes C; C's official client leaves the group route and the group disappears from Chats.
9. A transfers ownership to B; A becomes admin, B becomes owner.
10. A (now admin) leaves the group successfully.
11. Change group title/avatar; all members see the updated Chats row after private membership/activity refresh.
12. Account outside the group cannot call `list_group_members`, message-history RPCs, or group-management RPCs successfully.
13. Run `supabase/phase14_verify.sql`; malformed-owner and oversized-group queries return 0 rows.
14. Regression: direct chats, image messages, replies, edits, deletes, reactions, receipts and direct typing/presence still work.

## Phase 15 push-notification manual tests

1. Run `supabase/phase15_verify.sql`; both push tables must have RLS enabled, anon cannot register, authenticated clients cannot claim server deliveries.
2. On each Android test installation, login and allow notification permission. Confirm an enabled row appears in `public.push_tokens` for that account.
3. Keep B on the Chats screen/backgrounded; A sends a direct text. B receives one notification with A's display name and text preview.
4. Tap B's notification. PulseChat opens the exact A/B conversation and durable unread/read state reconciles.
5. Background/terminate B, send another A→B message, and verify the OS still presents it. (Do not Android force-stop the app from Settings; that disables delivery until reopened.)
6. Keep B actively focused inside the A/B conversation while A sends. The live Realtime bubble appears but the duplicate foreground OS banner is suppressed.
7. Create A/B/C group. A sends one message. B and C each receive a group notification whose title is the group name and body begins with A's display name.
8. Send one photo. Receiver notification shows a photo preview label/caption and opens the correct chat.
9. Retry the same Database Webhook/message: `push_delivery_log` unique `(message_id, expo_push_token)` must prevent a second push.
10. Sign B out. B's token row becomes disabled and the native registration is unregistered; messages to B must not expose previews on the signed-out installation.
11. Remove C from a group, then tap an older group notification on C. Membership re-check must refuse navigation.
12. Verify message delivery/read ticks, Realtime, images, replies/edits/deletes/reactions and group administration still work.

## Phase 15 acceptance tests
1. Android Profile > Notifications shows permission=granted and registered devices >= 1.
2. "Test notification on this phone" shows an immediate local notification.
3. "Test remote push from server" returns accepted and the phone receives PulseChat test.
4. Put Android app in background; another account sends a message; notification appears; tapping opens the chat.
5. Web Profile > Notifications -> enable browser alerts -> test notification appears.
6. Leave PulseChat web open in a background tab; another account sends a message; browser notification appears and click opens the conversation.


## Phase 16 search manual tests
1. Run `supabase/phase16_verify.sql`; both trigram indexes and all three RPCs must exist, authenticated execute must be true, anon execute false.
2. Search an existing profile by display name/username; People result opens the public-profile route.
3. Search a direct peer name/username and a group title; Chats results open the correct conversations.
4. Search a word from a recent and an old text message; both can be found.
5. Search text contained in an image caption; the image result appears with Photo label.
6. Tap an old message result; the conversation opens around the exact hit, target row is highlighted, and Back to latest returns to current messages.
7. In Messages filter, load more results and confirm no duplicate message IDs.
8. Delete a message that matched the query; rerun search and confirm it disappears.
9. Remove a user from a group and confirm old group message results/window access are denied on a fresh search/open.
10. Regression: people discovery, direct/group chat, realtime, media, replies/edits/deletes/reactions, receipts, presence and push notifications still operate.


## Phase 17 block/report/privacy manual tests
1. Run `supabase/phase17_verify.sql`; all three tables exist with RLS, authenticated RPC execute is true, anon execute is false, and clients cannot browse reports.
2. Account A searches B, opens B's profile and blocks B. Confirm B disappears from A's people search and A disappears from B's people search.
3. In the existing A/B direct chat, both clients can read history but neither can send a new text or image. The composer shows the privacy state.
4. While blocked, confirm typing and online/last-seen are not exposed between A and B.
5. Background B, attempt/direct-message race around the block and confirm no new direct push is delivered after the block.
6. A unblocks B from Profile > Privacy & security > Blocked users. Existing A/B chat can send again.
7. B disables “Allow new direct chats”. A user with no existing direct conversation cannot create one; an existing direct conversation remains usable.
8. B disables “Appear in people search”. A user without a shared conversation cannot discover B through People search; users already sharing a conversation can still access the safe profile through the conversation.
9. B disables “Show online & last seen”. A shared-conversation peer sees activity hidden and cannot read B's last-seen through the RPC.
10. Report a profile and an incoming message. Confirm submission succeeds, duplicate submission is idempotent, and authenticated clients cannot query `public.reports` directly.
11. Put A and B in the same group, block one another, and confirm group history/group messages still work for both while direct messaging remains closed.
12. Regression: search, direct/group chat, media, replies/edits/deletes/reactions, receipts, notifications and group administration still work.

## Phase 18 settings manual tests
1. Run `supabase/phase18_verify.sql`; notification preference table/RLS and four settings RPC checks should pass.
2. Profile → Settings → Appearance: switch System → Dark → Light. The full app changes immediately; restart PulseChat and confirm the chosen mode persists.
3. Set Appearance=System, change the OS/browser color scheme and confirm PulseChat follows it.
4. Disable Direct messages in Notifications. Background the Android receiver and send a direct message from another account; no remote notification should arrive, while the durable message/unread count still appears in-app.
5. Re-enable Direct messages and disable Group messages. Send a group message; no group push should arrive.
6. Disable Message previews, send a background message and confirm the notification only says PulseChat / New message (or New group message), without sender/message preview content.
7. On web, disable Browser notifications. Leave PulseChat in a background tab and send a message; no browser alert should appear. Re-enable it and verify the alert returns.
8. Open a direct conversation, tap the bell to mute it, background the receiver and send a message; no notification should arrive for that chat. Unmute and verify delivery resumes.
9. Repeat per-chat mute with a group containing 3+ members. Confirm only the current user's membership is muted; other members still receive notifications according to their own settings.
10. Refresh/reopen a muted group and confirm the bell state remains muted.
11. Profile → Settings → Account → Sign out; the authenticated app is left and push registration is disabled as before.
12. With a disposable test account, create/own a group with another member, then Delete account. Confirm the account can no longer sign in, its profile is gone, and the group remains with another owner. If the deleted account was the only group member, the empty group should be removed.
13. Regression: direct/group messaging, images, replies, edits, deletes, reactions, search, block/report/privacy, receipts, presence and push tests continue to work.

## Phase 19 offline/error-handling manual tests

1. Warm the cache by opening Chats and a conversation online, then disable network connectivity.
2. Confirm the global Offline banner appears and the cached Chats list remains usable.
3. Open the previously visited conversation and confirm cached recent messages render instead of an empty fatal state.
4. Send two text messages offline. Both must appear immediately as `Waiting for connection…`.
5. Navigate away/back (or restart the app where practical) while still offline; persisted text outbox messages must be restored.
6. Restore network. Queued text must automatically reconcile to sent/delivered/read without duplicate messages.
7. Simulate a lost response/retry and confirm the existing `client_message_id` constraint reconciles to one durable row.
8. Queue an image offline, keep the app process alive, restore network, and confirm automatic upload. Then document that killing the app may require reselecting the image.
9. While offline, try edit, delete, reaction, old-message search and load-older; each must show a clear connection-required state and must not corrupt local data.
10. Restore network and confirm Realtime state, read receipts and the Chats preview reconcile.
11. Delete a disposable account and verify its local cache/outbox entries are removed best-effort after successful server deletion.
12. Regression: direct/group text, images, reply/edit/delete/reactions, search, privacy, mute and push behavior still function online.

## Phase 20 performance manual tests
### Automated gate

1. Run `npm ci` from a clean checkout/package extraction.
2. Run `npm run verify`; TypeScript, ESLint, and all three coalescer tests must pass.
3. Run `npm run check:android`; Metro must export the Android bundle.
4. Confirm the expected Firebase file is present before a native push-enabled build: `google-services.json` at project root.

### Prototype V1 two-device gate

1. Install a development/preview build on Android phones A and B.
2. Create two email/password accounts, set both profiles, discover the other user, and create one direct conversation.
3. Exchange realtime text and images in both directions.
4. Verify unread counts plus sent/delivered/read transitions.
5. Background and terminate B normally (do not Android force-stop), send from A, receive one push, and tap it into the exact chat.
6. Create a small group and exchange group messages.
7. Close/reopen both apps and confirm conversation/message persistence.

### Performance/correctness regression

1. Open Chats with 20+ conversations if available; type/clear local search while scrolling. No stale row, incorrect avatar, flicker, or wrong tap target may appear.
2. Open a chat with 100+ messages, scroll through older pages repeatedly, and confirm no duplicate rows or stuck pagination.
3. Send/receive a burst. Active messages update immediately and Chats preview/unread state reconciles without repeated spinners.
4. Navigate from chat A to chat B while A is reconciling on a slow connection. A's result must never appear in B or prevent B's refresh.
5. Open an image-heavy chat twice. Cached images must render correctly and repeated concurrent refreshes must not cause loading churn.
6. Sign out, sign in as another test account on the same app process, and confirm no media from the first account appears from memory cache.
7. Go offline, send two texts, reconnect, and confirm one durable row per `client_message_id`.
8. While a failed message is visible, transition offline → online and tap Retry. The current connectivity state must be used.
9. Edit/delete/react, toggle theme, and confirm memoized rows still update correctly.
10. Regression: notifications, mute, search, groups, block/report/privacy, account deletion, and realtime receipts remain functional.

Do not mark Phase 20 accepted until the Prototype V1 two-device gate passes. Automated export alone does not verify FCM, OS permissions, background delivery, Supabase RLS, or physical-device persistence.

## Phase 21 security tests

### Automated and deployment gate

1. Run `npm ci`.
2. Run `npm run verify:security`; typecheck, lint, six unit tests, committed-secret scan, and the high/critical dependency gate must pass.
3. Run `npm run check:android` and `npx expo export --platform web --output-dir dist-phase21-web-check`.
4. Apply `supabase/migrations/202608280017_phase21_security_hardening.sql` after Phase 18.
5. Run `supabase/phase21_verify.sql` in the same project; it must return `Phase 21 security verification passed.`
6. Redeploy `send-message-push` and `delete-account` with their existing `--no-verify-jwt` configuration. Keep all existing server secrets configured.

### Authorization and abuse checks

1. Confirm an authenticated direct `UPDATE public.profiles` fails, while saving Profile → Edit through `update_my_profile()` succeeds.
2. With a modified request, reference a missing avatar object or another user's avatar path; the profile RPC must reject it.
3. Send normal direct/group text and image messages. Then generate more than 60 fresh message IDs inside one minute for a disposable account; excess inserts must return `Too many requests` without weakening RLS/block checks.
4. Retry an already committed `client_message_id`; it must still reconcile to the existing durable message rather than create a duplicate.
5. Upload a chat object, then call `create_image_message()` with a different size, MIME, path, conversation, or user folder; every mismatch must fail.
6. Force a fresh image commit failure in the official client and confirm its newly uploaded object is removed. A duplicate-path retry must not remove the prior valid object.
7. Submit a report twice for the same target; the existing report id remains idempotent. More than 10 distinct fresh reports in an hour must be limited.
8. Trigger five authenticated remote push diagnostics, then confirm the next request is limited while normal message pushes remain unaffected.
9. Repeat Phase 17 block tests: a modified client cannot send direct text/image, typing/presence remains hidden, reports remain unreadable, and shared group messages still work.

### Local-data and deletion checks

1. On native, warm cache/session/outbox data, restart, and confirm restore. Modify one encrypted AsyncStorage envelope and confirm it is rejected rather than rendered.
2. Upgrade a Phase 20 native install and confirm a readable legacy session/cache still restores, then is rewritten in the Phase 21 envelope on use.
3. On Web, sign in and warm a conversation, then close the browser session. Confirm the auth session and message cache/outbox do not persist into a new browser session.
4. Inspect a cached message snapshot and confirm `signed_media_url` is null while the durable attachment path remains.
5. Delete an image message. Its body/attachment metadata must be redacted immediately and another member must be unable to mint a new signed URL, even if best-effort physical cleanup is delayed.
6. Delete a disposable account. Confirm auth/profile/membership/settings/token data is gone, group ownership is repaired, an empty owned group and its avatar are removed best-effort, and retained messages/photos show as anonymized history.

### Combined Prototype V1 gate

Repeat the Phase 20 two-device gate after Phase 21 deployment. Do not mark Phase 21 accepted until both the SQL verification and the real-device V1 flow pass.

## Phase 22 end-to-end QA

### Automated candidate gate

1. Run `npm ci` from a clean extraction.
2. Run `npm run qa:phase22`.
3. Require TypeScript, ESLint, ten unit tests, secret scan, high/critical
   dependency gate, source preflight, Android export, and Web export to pass.
4. Add the private `.env` and `google-services.json`, then run
   `npm run qa:preflight`; zero failures are allowed for connected device QA.

### Physical acceptance

Apply/verify Phase 21 and redeploy both changed Edge Functions before testing.
Complete every environment, core V1, route-race, safety-regression, defect, and
sign-off row in `docs/PHASE22_ACCEPTANCE.md` using the same build on two Android
phones and two accounts.

Do not mark Phase 22 accepted from local automation. Supabase deployment,
Database Webhook/secrets, Firebase push, Android permissions, and real restart
persistence require owner-environment evidence.

## Phase 23 UX/accessibility tests

### Automated gate

1. Run `npm ci` from a clean Phase 23 package.
2. Run `npm run qa:preflight`; the configured private Supabase/Firebase inputs
   must pass with zero failures.
3. Run `npm run qa:phase23`; TypeScript, ESLint, 13 unit tests, secret scanning,
   the high/critical dependency gate, source preflight, accessibility audit,
   Android export, and Web export must all pass.
4. Run `npm run audit:accessibility` independently when changing theme tokens,
   shared controls, modals, back navigation, or target sizes.

### Android accessibility gate

Use `docs/PHASE23_ACCEPTANCE.md` as the signed record.

1. Test Login/Register, Chats/Search, direct/group Chat, group management,
   Profile/Settings, and every V1 modal with TalkBack enabled before launch.
2. Repeat the screen matrix in Light and Dark at normal and largest practical
   Android Font/Display size. No primary action may clip, overlap, or disappear.
3. Verify shared inputs announce labels/errors/password state, buttons announce
   disabled/busy state, switches/radios/tabs announce checked/selected state,
   and conversation/message rows announce meaningful context.
4. Verify message actions are discoverable without sight, failed-send Retry is
   reachable, and modal focus stays inside the open sheet/dialog.
5. Open V1 routes from a notification/deep link or browser refresh and confirm
   Back reaches Chats, Search/Profile, Settings, Privacy, or Login as documented.
6. Exercise keyboard entry at large text for authentication, profile, search,
   group creation/info, and chat composer. The focused field and submission
   action must remain reachable.
7. Deny notification, camera, and photo permission; go offline; and force
   privacy/blocked-user load errors. Each state must be truthful and recoverable.
8. Repeat the Phase 22 two-phone Prototype V1 path to ensure the polish did not
   regress realtime text/images, receipts/unread, push routing, groups, offline
   replay, or restart persistence.

Do not mark Phase 23 accepted from static checks or exports. TalkBack spoken
output, focus order, physical font/display sizing, OS dialogs, and device
behavior require signed manual evidence.

## Phase 24 Android release tests

### Clean-source gate

1. Extract the Phase 24 source package into a clean directory.
2. Confirm no `.env`, `google-services.json`, service-account file, keystore,
   `.expo`, native directory, or prior export is present.
3. Run `npm ci` and `npm run qa:phase24`.
4. Require TypeScript, ESLint, 18 unit tests, secret scan, high/critical runtime
   dependency audit, source preflight, accessibility audit, release audit,
   source-only native Android prebuild, and Android/Web exports to pass.
5. Confirm the release audit reports `com.prakashdash.pulsechat`, `1.0.0` (24),
   and EAS CLI 22.0.0 with no failure.

### Configured and signed-build gate

1. Apply `202608290018_phase24_rate_limit_ambiguity_fix.sql` and run
   `supabase/phase24_verify.sql`; require `Phase 24 verification passed.`
2. Restore owner `.env` and `google-services.json` outside source control.
3. Run `npm run release:gate:configured`; zero failures are allowed.
4. Configure the matching values as EAS development/preview/production project
   environment variables, using a secret file variable named
   `GOOGLE_SERVICES_JSON`.
5. Configure/reuse the owner remote Android keystore and FCM V1 credential.
6. Run `npm run build:android:preview` from the same clean source.
7. Record the EAS build ID/URL, APK SHA-256, `1.0.0` / `24`, and signing
   certificate SHA-256 in `docs/PHASE24_ACCEPTANCE.md`.

### Physical release gate

1. Clean-install the exact preview APK on phones A and B.
2. Upgrade a retained-state installation with that APK; a signature mismatch or
   lost session/cache is blocking.
3. Verify launcher/themed icon, splash, app label, notification small icon, and
   contextual camera/notification permissions.
4. Repeat the Prototype V1 two-account path: authentication, profiles,
   discovery, direct text/images, receipts/unread, background and normally
   terminated push, exact notification routing, group chat, offline text replay,
   and restart persistence.
5. Repeat TalkBack, largest practical font/display, light/dark, deep-link/back,
   and failure recovery regressions from Phase 23.
6. Sign every required Phase 24 acceptance row against the same APK digest.

Do not mark Phase 24 accepted from a successful source gate, native prebuild, or
EAS build alone. Acceptance requires signed artifact provenance plus clean
install, upgrade, push, and two-phone physical evidence.

### Windows Metro regression

1. On Windows, install from the clean lockfile with `npm ci`.
2. Run `npx expo start -c`, then press `w`.
3. Web and server-render bundles must load the local
   `src/vendor/noble-ciphers-runtime.js` file without asking Metro to resolve a
   noble-ciphers package subpath.
4. Open the native development build from the same Metro server and verify that
   encrypted auth/cache startup completes without a red screen.

### Phase 24 rate-limiter regression

1. Apply the Phase 24 migration after Phase 21.
2. Run `supabase/phase24_verify.sql`; require `Phase 24 verification passed.`
3. On Web, send a fresh text message and allow a previously queued message to
   retry. Neither path may return an ambiguous `actor_user_id` error.
4. Send two different messages rapidly; both must insert once, and the private
   rate-limit row must update without client access to that table.

### Windows JWT clock recovery

1. Enable Windows **Set time automatically** and **Set time zone automatically**,
   then select **Sync now**.
2. Close every PulseChat localhost tab. Clear only the localhost PulseChat
   session storage and reopen the app.
3. Sign in again and load Profile. `JWT issued at future` must not recur.

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

## Deferred
Typing/presence is Phase 11; media is Phase 12.

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

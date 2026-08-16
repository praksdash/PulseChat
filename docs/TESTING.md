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

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

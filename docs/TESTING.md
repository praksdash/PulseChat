# PulseChat Testing

## Phase 9 migration verification
After `202608150006_phase9_realtime_text_messaging.sql`, run `supabase/phase9_verify.sql`.

Verify:
- `list_conversation_messages` exists and is not SECURITY DEFINER
- authenticated execute = true; anon execute = false
- `broadcast_new_message` is an AFTER INSERT trigger on `public.messages`
- `pulsechat_members_receive_conversation_broadcasts` exists on `realtime.messages`
- Phase 6 message indexes still exist

## Happy path — two live clients
1. Login as Account A on client/device A.
2. Login as Account B on client/device B.
3. Open the same direct conversation on both.
4. Send `Hello from A` on A.
5. The outgoing bubble appears immediately on A.
6. The message becomes sent after PostgreSQL acknowledgement.
7. B receives it without manually refreshing.
8. Send a reply from B and verify A receives it live.
9. Close/reopen the chat and confirm history is loaded from PostgreSQL.

## Retry/idempotency
1. Disable network.
2. Send a message.
3. The optimistic bubble should become `Not sent · Tap to retry`.
4. Restore network.
5. Tap the failed state to retry.
6. Exactly one message row must exist for that `client_message_id`.

## Pagination
1. Produce at least 35 messages in one conversation.
2. Reopen the conversation.
3. Initial page should load quickly.
4. Scroll upward to load older history.
5. No duplicate rows should appear at the page boundary.

## Realtime authorization security
- Account C, not a member of the A/B conversation, must not be able to join its private `conversation:<uuid>` Broadcast topic.
- Account C must not be able to read A/B rows through `list_conversation_messages` or normal message SELECT.
- Anon must not execute `list_conversation_messages`.

## Reconnect/source-of-truth test
1. Open chat on B.
2. Temporarily interrupt B's connection.
3. Send one or more messages from A.
4. Restore B's connection.
5. After the channel reconnects, latest-page reconciliation should fill any missed rows from PostgreSQL.

## Regression
Authentication, persisted sessions, profile edit/avatar, sign-out, discovery, direct-chat creation, Chats list and Phase 6 RLS behavior must continue to work.

## Intentionally deferred
Delivered/read receipts and unread counters are Phase 10; typing/presence is Phase 11.

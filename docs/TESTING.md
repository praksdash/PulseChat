# PulseChat Testing

## Phase 8 migration verification
After running `202608150005_phase8_direct_chat_creation.sql`, run `supabase/phase8_verify.sql`.

Verify:
- all three Phase 8 RPCs exist
- each is `SECURITY DEFINER`
- authenticated can execute them
- anon/public cannot execute them
- the unique direct-key index exists
- no existing direct conversation has a member count other than 2

## Happy-path test — two accounts
Use Account A and Account B.

1. Login as A.
2. Search for B and open B's public profile.
3. Tap Start chat.
4. A real conversation route opens.
5. Return to Chats; B is listed.
6. Return to B's profile and tap Start chat again.
7. Confirm the same conversation UUID is reused.
8. Login as B and open Chats or pull to refresh.
9. Confirm the same conversation appears for B.

Database check:
- exactly one `public.conversations` row exists for A/B
- exactly two `public.conversation_members` rows exist for that conversation

## Failure-path tests
- Disable network and tap Start chat: an inline error should appear without navigation.
- Disable network on Chats: retry state appears when no cached list exists.
- Restore network and retry/pull-to-refresh.
- Navigate to an unknown conversation UUID: the screen must show Conversation unavailable.

## Concurrency/idempotency test
From A and B, trigger Start chat for each other as close together as practical. Then query the database. There must still be only one canonical direct conversation for the pair.

## Security tests
- An anon call to any Phase 8 RPC must fail execute permission.
- A signed-in user cannot obtain `get_conversation_summary` for a conversation they do not belong to.
- A client cannot directly insert `public.conversations` or `public.conversation_members` because table privileges remain revoked.
- Phase 8 RPC responses contain no email/auth metadata.

## Regression
Authentication, persisted sessions, profile edit/avatar, sign-out, user discovery and all Phase 6 RLS behavior must continue to work.

## Intentionally deferred
The composer is disabled. Real text messages and Realtime Broadcast begin in Phase 9.

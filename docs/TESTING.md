# PulseChat Testing

## Phase 6 database migration verification
After running `202608150003_phase6_messaging_schema.sql`, run `supabase/phase6_verify.sql` in Supabase SQL Editor.

Expected tables:
- `conversations`
- `conversation_members`
- `messages`
- `message_receipts`
- `attachments`

Each Phase 6 table must report `rls_enabled = true`.

## Metadata checks
Verify the policy list includes membership-gated SELECT policies and self-only receipt/read-state policies.

Verify important indexes exist for:
- direct-key uniqueness
- memberships by `user_id`
- message cursor pagination
- sender/client-message deduplication
- receipt lookup
- attachment lookup

## Application regression test
Because Phase 6 does not change active UI behavior:
1. Launch Android app.
2. Existing authenticated session restores.
3. Profile screen loads.
4. Edit Profile still works.
5. Avatar still loads.
6. Sign out still returns to Login.
7. Sign in again succeeds.

The Chats screen is still intentionally mock data until Phase 8/9.

## Security tests scheduled with feature activation
When Phase 8/9 adds real chat access, test with at least three accounts:
- User A and B belong to conversation AB.
- User C must not SELECT conversation AB.
- User C must not SELECT messages from AB even with known UUIDs.
- User A must not INSERT a message with `sender_id = B`.
- A retry with the same `(sender_id, client_message_id)` must not create a duplicate.
- A reply must not reference a message in another conversation.

## Later automated tests
Add pgTAP database authorization tests once the Supabase local-development/test harness is introduced. Manual SQL metadata verification is sufficient for this schema-only phase.

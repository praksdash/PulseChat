# PulseChat Security

## Authentication
Supabase Auth remains the identity authority. Native auth sessions are persisted with an encrypted payload and the encryption key is kept in Expo SecureStore.

## Client keys
Only the Supabase Project URL and publishable key belong in `EXPO_PUBLIC_*` variables. Never put a service-role/secret key in the mobile app.

## Profile authorization
Phase 4/5 rules remain in force:
- RLS is enabled on `public.profiles`.
- Users can SELECT/UPDATE only their own profile at this phase.
- Direct client INSERT/DELETE is revoked.
- Username uniqueness is enforced by PostgreSQL.
- Avatar writes are restricted to the signed-in user's UUID folder.

## Messaging authorization boundary
Every Phase 6 messaging table has RLS enabled.

### Conversations
- SELECT: only conversation members.
- UPDATE: only group admin/owner, and PostgreSQL column grants restrict client updates to `title` and `avatar_path`.
- INSERT/DELETE: not granted to the mobile client.

### Conversation members
- SELECT: only members of that conversation.
- UPDATE: a user may update only their own `last_read_at` and `muted_until` columns.
- Membership creation/removal and role changes are not client-writable.

### Messages
- SELECT: only conversation members.
- INSERT: sender must equal `auth.uid()` and caller must be a conversation member.
- UPDATE/DELETE: not granted in Phase 6.
- Duplicate retries are blocked by `(sender_id, client_message_id)` uniqueness.

### Message receipts
- SELECT: only members of the parent conversation.
- INSERT/UPDATE: only the receipt row whose `user_id = auth.uid()` for an accessible message.

### Attachments
- SELECT: follows access to the parent message.
- INSERT/UPDATE/DELETE: intentionally not granted until Phase 12.

## Private authorization helpers
Membership checks are implemented as narrowly scoped `SECURITY DEFINER` helpers under the non-exposed `pulsechat_private` schema. They use an empty `search_path` and fully qualified relation names.

The client role receives only the minimum schema usage/function execution necessary for PostgreSQL to evaluate RLS; the `pulsechat_private` schema is not intended to be added to Supabase Data API exposed schemas.

## Defense in depth
RLS is not the only control. Phase 6 also uses:
- table/column-level PostgreSQL grants,
- foreign keys,
- unique constraints,
- check constraints,
- direct-member-count validation,
- same-conversation reply integrity,
- indexed membership lookups.

A guessed conversation UUID or message UUID is therefore insufficient to read data.

## Realtime security
Phase 6 does not enable a database-change publication. Phase 9 will use private conversation-scoped Realtime Broadcast topics with membership authorization rather than exposing a broad global message stream.

## Dedicated production review
Phase 21 remains the full production security review, including abuse controls, rate limits, account deletion, report/block interactions, media validation, secrets and dependency review.

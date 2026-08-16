# PulseChat Security

## Authentication and client keys
Only Supabase Project URL + publishable key are exposed through `EXPO_PUBLIC_*`. Secret/service-role credentials must never be embedded in the mobile app.

## Message authorization
A conversation UUID is not authorization. Existing RLS requires conversation membership for message access and requires `sender_id = auth.uid()` for client inserts.

## Phase 10 receipt mutation boundary
Public Phase 10 receipt RPCs are narrow `SECURITY DEFINER` functions with `search_path = ''` and fully qualified relations. They:
- derive the acting user from `auth.uid()`
- verify conversation membership
- update only that authenticated user's recipient receipts
- choose server timestamps themselves
- never accept another recipient user ID from the client

## Private Realtime topics
Authorized receive topics are now:
- `conversation:<uuid>` only when caller is a conversation member
- `user:<uuid>` only when that UUID equals `auth.uid()`

The `realtime.messages` policy is SELECT-only for the app. Database triggers/RPCs send Broadcast events; clients are not granted generic Broadcast INSERT permission.

## Minimal inbox payload
The user inbox event contains only conversation/message/sender IDs and creation timestamp. Message body remains available through normal message access/RLS and conversation Broadcast.

## Source-of-truth safety
Realtime is not durable application state. Messages and receipts are recovered from PostgreSQL after restart/reconnect.

## Future hardening
Phase 21 will add rate limiting/abuse review, block/report enforcement, deletion semantics, media validation, dependency review and monitoring.

## Phase 11 Realtime authorization

- `presence:<user_uuid>` Presence INSERT is owner-only.
- Presence SELECT is allowed only to the owner or authenticated users sharing a conversation with that user.
- `typing:<conversation_uuid>` Broadcast SELECT/INSERT is limited to conversation members.
- Typing uses a separate topic from database-originated `conversation:<uuid>` message/receipt events so clients cannot gain write access to trusted durable-message events.
- `user_presence` is not directly queryable by authenticated mobile clients.

## Phase 12 private chat media

- `chat-media` is private; it is never exposed through `getPublicUrl`.
- Storage SELECT requires current conversation membership.
- Storage INSERT/DELETE additionally requires the second path segment to equal `auth.uid()`.
- The client cannot choose another `sender_id` in `create_image_message`; the function derives the sender server-side.
- The DB RPC requires the exact canonical path `conversation/user/client-message.jpg`.
- Direct client inserts into `public.messages` are now RLS-restricted to `message_type = 'text'`; image messages must use the media RPC.
- Signed URLs are short-lived delivery artifacts and are not persisted in database rows.
- No service-role/secret key is present in the mobile client.

## Phase 13 message action security

- Clients have no direct UPDATE/DELETE privilege on `messages`; edits/deletes use narrow security-definer RPCs.
- RPCs derive the actor from `auth.uid()` and verify sender ownership + conversation membership.
- Reaction writes are RPC-only. `message_reactions` direct access is SELECT-only and RLS-filtered.
- Deleted message bodies are redacted from history projections.
- Deleted image attachment metadata is removed.
- `chat-media` reads now require a live attachment linked to a non-deleted message; folder membership alone is no longer enough for reads.
- Mutation broadcasts stay on private conversation/user topics governed by existing Realtime Authorization policies.

## Phase 14 group security

- Group membership changes are server-authoritative RPCs bound to `auth.uid()`.
- Owner/admin authorization is checked in PostgreSQL, not inferred from UI state.
- Admins can remove regular members only; only the owner can promote/demote admins or transfer ownership.
- Direct table INSERT/DELETE privileges for `conversation_members` remain unavailable to mobile clients.
- Direct update privilege for group title/avatar is revoked; `update_group_profile()` validates role and Storage path.
- `group-avatars` is public-read for display parity with profile avatars, but object writes/deletes require an owner/admin membership check against the conversation UUID in the object path.
- Message/RPC access still requires active conversation membership.

## Phase 15 push security
- Expo push tokens are stored separately from public profile data and are readable only by their owner; direct writes are revoked.
- Registration and disable RPCs derive the actor from `auth.uid()`.
- The sender never chooses push recipients; the Edge Function derives recipients from current `conversation_members` and message receipts.
- The Edge Function is invoked by a Database Webhook carrying `x-pulsechat-webhook-secret`; requests without the matching secret are rejected.
- `SUPABASE_SERVICE_ROLE_KEY`/secret keys remain only inside Supabase Edge Functions and must never be copied into `.env` used by the React Native client.
- `EXPO_ACCESS_TOKEN` is a server secret and is required by the dispatcher; enable Expo Enhanced Push Security.
- Firebase service-account JSON is private and is ignored by repository patterns. `google-services.json` contains client Firebase identifiers and is used by the Android build.
- A notification tap does not blindly trust payload data: PulseChat calls the authorized conversation-summary RPC before navigating, so a user removed from a group cannot reopen it from an old notification.
- Sign-out disables the stored server token and unregisters the native push installation.

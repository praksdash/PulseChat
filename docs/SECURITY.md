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


## Phase 16 search security
- Message/chat search is performed through narrow authenticated RPCs; clients are not granted broad cross-conversation table reads.
- Every conversation/message search result is constrained by a live `conversation_members` row for `auth.uid()`.
- `get_message_window()` repeats the membership check before returning timeline context, so a stale search result cannot reopen a group after removal.
- Deleted messages are excluded from `search_my_messages()`.
- LIKE wildcard characters in caller input are escaped server-side and search length/result counts are bounded.
- Search never returns auth email, phone, push token, or other private account metadata.


## Phase 17 block/report/privacy security
- Block enforcement is server-side. A modified client cannot bypass a block by directly inserting a text message or calling the image-message RPC.
- New chat creation rejects blocked pairs and respects the target user's new-direct-chat preference.
- Private Realtime presence/typing and direct conversation Broadcast authorization deny blocked pairs.
- Last-seen RPC access respects activity visibility and pair blocks.
- Chat-media uploads require the caller to still be allowed to send in that conversation; historical media reads remain membership-authorized.
- People discovery filters blocks and non-discoverable profiles server-side.
- Report rows are not client-readable and cannot be directly inserted by authenticated clients. The reporting RPC derives the reporter from `auth.uid()` and verifies message membership/sender identity.
- The push dispatcher checks direct blocks immediately before delivery as defense in depth against block/message webhook races.

## Phase 18 settings security

- Notification preferences are server-enforced by `send-message-push`; hiding a client switch cannot bypass them.
- Message-preview privacy is applied inside the Edge Function before payloads are sent to Expo. When previews are disabled, the push payload contains no message body/sender preview text.
- Per-chat mute RPCs derive the user from `auth.uid()` and never accept a target user ID.
- Web notifications re-check both account notification preferences and the caller's per-chat mute state before using the browser Notification API.
- Account deletion is performed by `delete-account`, a server-side Edge Function. It validates the caller's bearer token, never accepts another user ID, and uses the service-role credential only inside the function runtime.
- If a deleted account owns groups, the function captures those groups before auth deletion and assigns a remaining admin/longest-standing member as owner, or removes an empty group.

## Phase 19 local/offline security

- Native cached chat/message payloads and queued text are encrypted before being written to AsyncStorage; the local vault key is stored in Expo SecureStore.
- Offline cache keys are namespaced by authenticated user ID, preventing account A's cached data from being surfaced to account B by normal app flows.
- Local queued messages never bypass server authorization. Reconnect still executes the ordinary Supabase insert/RLS/direct-block checks.
- `client_message_id` remains the retry idempotency boundary. Retrying a request after an uncertain network response cannot intentionally create a second message row.
- Authorization/validation failures are not treated as connectivity failures and do not enter an automatic retry loop.
- Permanent account deletion clears the deleted user's cached data and durable outbox on the device.
- Browser offline storage is protected by browser origin isolation rather than Expo SecureStore; this will be reviewed again during Phase 21 security review.

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

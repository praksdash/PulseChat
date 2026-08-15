# PulseChat Security

## Authentication and client keys
Supabase Auth is the identity authority. Only the Project URL and publishable key are used in `EXPO_PUBLIC_*`. Never embed secret/service-role credentials in the mobile app.

## Message table authorization
`public.messages` remains protected by Phase 6 RLS:
- read requires conversation membership
- insert requires `sender_id = auth.uid()`
- insert target must be a conversation the caller belongs to
- table privileges expose only the columns required to send messages

A conversation UUID alone is never authorization.

## Phase 9 Realtime Authorization
Phase 9 uses private Broadcast channels named:

```text
conversation:<uuid>
```

The `realtime.messages` SELECT policy checks a private security-definer helper which compares the requested topic to the signed-in user's actual `conversation_members` rows. Only a member can join and receive Broadcast events for that conversation.

The client does not receive INSERT permission for Broadcast. Durable message INSERTs are written to `public.messages`; the database trigger emits the event after the insert succeeds.

## Security-definer rules
Private helpers:
- live in `pulsechat_private`
- use `search_path = ''`
- fully qualify relation names
- have explicit grants/revokes

The public message-history function is intentionally `SECURITY INVOKER` so table RLS is not bypassed.

## Idempotency / replay safety
`client_message_id` is generated before network I/O. Retrying reuses the same ID. The unique `(sender_id, client_message_id)` constraint makes duplicate sends fail safely and the client resolves the already-committed row.

## Realtime is not the source of truth
Missed/disconnected WebSocket events cannot permanently remove messages from the UI because the app refetches the latest PostgreSQL page after successful channel subscription/reconnection.

## Future hardening
Phase 21 will add abuse/rate-limit review, blocks/reports integration, account deletion behavior, media validation, dependency review and monitoring.

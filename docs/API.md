# PulseChat API / Data Access

## Existing callable database API

### `public.is_username_available(candidate text)`
Authenticated Phase 5 RPC returning only a boolean.

## Phase 6 direct table access
Phase 6 creates the schema and safe grants but does not yet wire messaging screens to it.

Authenticated clients may eventually use RLS-backed operations for:
- SELECT accessible conversations
- SELECT accessible conversation members
- SELECT accessible messages
- INSERT a message as themselves into a conversation they belong to
- SELECT message receipts
- INSERT/UPDATE their own receipt rows
- UPDATE their own membership read/mute state

Conversation/member creation remains unavailable directly from the app.

## Planned Phase 8 RPC
A transactional `get_or_create_direct_conversation(other_user_id)`-style function will create or return a unique direct conversation and its two memberships.

## Planned Phase 9 realtime
Committed message changes will be delivered through conversation-scoped Supabase Realtime Broadcast. Database rows remain the durable source of truth.

## Planned Phase 12 media API
A controlled chat-media upload flow will create Storage objects and `attachments` metadata only after message/conversation authorization is verified.

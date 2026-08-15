# PulseChat API / Data Access

## Existing profile/discovery RPCs
- `public.is_username_available(candidate text)`
- `public.search_profiles(search_term text, result_limit integer default 20)`
- `public.get_public_profile(target_user_id uuid)`

## Existing conversation RPCs
- `public.create_or_get_direct_conversation(target_user_id uuid)`
- `public.list_my_conversations(result_limit integer default 50)`
- `public.get_conversation_summary(target_conversation_id uuid)`

## Phase 9 message history RPC

### `public.list_conversation_messages(...)`
Arguments:
- `target_conversation_id uuid`
- `before_created_at timestamptz default null`
- `before_id uuid default null`
- `result_limit integer default 30`

Behavior:
- `SECURITY INVOKER`
- RLS-protected
- newest-first stable cursor pagination
- server limit capped to 50

## Phase 9 direct table write

### INSERT `public.messages`
The client sends only:
- `conversation_id`
- `sender_id`
- `client_message_id`
- `message_type = text`
- `body`
- optional future `reply_to_message_id`

RLS and table-column grants enforce the boundary.

## Phase 9 Realtime
Topic:

```text
conversation:<conversation UUID>
```

Channel config:

```text
private: true
```

The client listens for Broadcast event `INSERT`. Database triggers generate the event only after a durable message insert.

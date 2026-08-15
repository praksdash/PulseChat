# PulseChat Database

## Core model

```text
auth.users
   │
   ├── profiles
   ├── conversation_members ─── conversations
   └── messages ────────────────┬── message_receipts
                                └── attachments
```

## `public.messages`
Durable source of truth for messages.

Important fields:
- `id uuid` server primary key
- `conversation_id uuid`
- `sender_id uuid`
- `client_message_id uuid` generated before network send
- `message_type`
- `body`
- `created_at`
- future `reply_to_message_id`, `edited_at`, `deleted_at`

Critical constraints/indexes:
- `UNIQUE(sender_id, client_message_id)` — retry idempotency
- `(conversation_id, created_at DESC, id DESC)` — stable history pagination
- text body max 10,000 characters
- RLS: SELECT only for conversation members; INSERT only as `auth.uid()` into one of the caller's conversations

## Phase 9 history function

`public.list_conversation_messages(target_conversation_id, before_created_at, before_id, result_limit)`

- `SECURITY INVOKER`
- therefore message-table RLS remains active
- returns newest first
- uses `(created_at, id)` as stable cursor
- default 30 rows, server cap 50
- a non-member gets no accessible messages

## Phase 9 database Broadcast

An `AFTER INSERT` trigger on `public.messages` calls:

```text
realtime.broadcast_changes(
  conversation:<conversation UUID>,
  INSERT,
  ...
)
```

The database event is private and conversation-scoped. Clients do not need to enable Postgres Changes publication for this architecture.

## `public.message_receipts`
Already exists from Phase 6 but Phase 9 intentionally does not use it for UI state. Delivered/read implementation begins in Phase 10.

## Future migrations
- Phase 9: text messaging + Realtime Broadcast ✅
- Phase 10: delivery/read service and unread/read behavior
- Phase 12: `chat-media` Storage + attachment writes
- Phase 13: edit/delete/reactions
- Phase 14: group creation/member administration

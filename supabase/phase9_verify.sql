-- PulseChat Phase 9 verification. Run after the Phase 9 migration.

-- 1) Message-history function exists with SECURITY INVOKER.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'list_conversation_messages';

-- Expected: one row, security_definer = false.

-- 2) Authenticated may execute message-history RPC; anon may not.
select
  has_function_privilege(
    'authenticated',
    'public.list_conversation_messages(uuid,timestamptz,uuid,integer)',
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'anon',
    'public.list_conversation_messages(uuid,timestamptz,uuid,integer)',
    'EXECUTE'
  ) as anon_can_execute;

-- Expected: true / false.

-- 3) Database Broadcast trigger exists on messages.
select
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table = 'messages'
  and trigger_name = 'broadcast_new_message';

-- Expected: AFTER INSERT.

-- 4) Conversation-scoped Realtime Authorization policy exists.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname = 'pulsechat_members_receive_conversation_broadcasts';

-- Expected: one SELECT policy for authenticated.

-- 5) Critical message indexes from Phase 6 still exist.
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'messages'
  and indexname in (
    'messages_conversation_page_idx',
    'messages_sender_created_at_idx'
  )
order by indexname;

-- 6) Inspect message counts only; empty is valid before the first Phase 9 send.
select
  count(*) as total_messages,
  count(distinct conversation_id) as conversations_with_messages
from public.messages;

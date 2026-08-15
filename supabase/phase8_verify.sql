-- PulseChat Phase 8 verification queries.
-- Run after 202608150005_phase8_direct_chat_creation.sql.

-- 1) Required RPCs must exist.
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_or_get_direct_conversation',
    'list_my_conversations',
    'get_conversation_summary'
  )
order by p.proname;

-- 2) Authenticated may execute; anon/public must not.
select
  p.proname as function_name,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  coalesce(array_to_string(p.proacl, ','), '') as acl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'create_or_get_direct_conversation',
    'list_my_conversations',
    'get_conversation_summary'
  )
order by p.proname;

-- 3) Direct-key uniqueness index must exist.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'conversations'
  and indexname = 'conversations_direct_key_unique_idx';

-- 4) Existing direct chats, if any, should have exactly two members.
select
  c.id,
  c.direct_key,
  count(cm.user_id) as member_count
from public.conversations c
left join public.conversation_members cm on cm.conversation_id = c.id
where c.kind = 'direct'
group by c.id, c.direct_key
having count(cm.user_id) <> 2;

-- Expected result for query #4: zero rows.

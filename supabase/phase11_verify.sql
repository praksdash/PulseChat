-- PulseChat Phase 11 verification

-- 1) Durable presence table + RLS.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'user_presence';

-- 2) Phase 11 public RPCs.
select
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('touch_my_last_seen', 'get_user_last_seen')
order by p.proname;

-- 3) Realtime policies for Presence + typing.
select policyname, cmd
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname in (
    'pulsechat_users_receive_presence',
    'pulsechat_users_publish_own_presence',
    'pulsechat_members_receive_typing',
    'pulsechat_members_send_typing'
  )
order by policyname;

-- 4) There should be at most one durable row per profile because user_id is PK.
select user_id, count(*)
from public.user_presence
group by user_id
having count(*) > 1;
-- Expected: 0 rows.

-- PulseChat Phase 10 verification. Run AFTER the Phase 10 migration.

-- 1) Required functions and their security mode.
select
  n.nspname as schema_name,
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('public', 'list_conversation_messages'),
  ('public', 'list_my_conversations'),
  ('public', 'get_my_total_unread_count'),
  ('public', 'mark_conversation_delivered'),
  ('public', 'mark_conversation_read'),
  ('public', 'mark_all_pending_delivered'),
  ('pulsechat_private', 'create_message_receipts'),
  ('pulsechat_private', 'can_receive_pulsechat_broadcast'),
  ('pulsechat_private', 'broadcast_new_message')
)
order by schema_name, function_name;

-- 2) Receipt creation trigger must exist and be enabled.
select
  tgname as trigger_name,
  tgenabled as enabled
from pg_trigger
where tgrelid = 'public.messages'::regclass
  and not tgisinternal
  and tgname in ('create_message_receipts', 'broadcast_new_message', 'touch_conversation_after_message')
order by tgname;

-- 3) Realtime SELECT policy should be the Phase 10 private-topic policy.
select
  policyname,
  cmd,
  roles,
  qual
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname = 'pulsechat_users_receive_private_broadcasts';

-- 4) Useful receipt indexes.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'message_receipts'
order by indexname;

-- 5) Every existing non-sender member should now have a receipt row.
with expected as (
  select m.id as message_id, cm.user_id
  from public.messages m
  join public.conversation_members cm on cm.conversation_id = m.conversation_id
  where m.sender_id is null or cm.user_id <> m.sender_id
)
select e.message_id, e.user_id
from expected e
left join public.message_receipts r
  on r.message_id = e.message_id
 and r.user_id = e.user_id
where r.message_id is null;
-- Expected: 0 rows.

-- 6) No sender should have a receipt for their own message.
select r.message_id, r.user_id
from public.message_receipts r
join public.messages m on m.id = r.message_id
where m.sender_id = r.user_id;
-- Expected: 0 rows.

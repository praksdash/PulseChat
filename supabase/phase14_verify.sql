-- PulseChat Phase 14 verification (read-only).

select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'group-avatars';

select routine_name, security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_group_conversation', 'list_group_members', 'add_group_members',
    'remove_group_member', 'set_group_member_role', 'transfer_group_ownership',
    'leave_group_conversation', 'update_group_profile'
  )
order by routine_name;

select
  has_function_privilege('authenticated', 'public.create_group_conversation(text,uuid[])', 'EXECUTE') as authenticated_can_create_group,
  has_function_privilege('anon', 'public.create_group_conversation(text,uuid[])', 'EXECUTE') as anon_can_create_group,
  has_function_privilege('authenticated', 'public.add_group_members(uuid,uuid[])', 'EXECUTE') as authenticated_can_add_members,
  has_function_privilege('authenticated', 'public.remove_group_member(uuid,uuid)', 'EXECUTE') as authenticated_can_remove_members;

select policyname, cmd, roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'pulsechat_group_admin_%'
order by policyname;

-- Every group should have exactly one owner.
select c.id as malformed_group_id, count(*) filter (where cm.role = 'owner') as owner_count
from public.conversations c
left join public.conversation_members cm on cm.conversation_id = c.id
where c.kind = 'group'
group by c.id
having count(*) filter (where cm.role = 'owner') <> 1;

-- Prototype safety limit.
select c.id as oversized_group_id, count(cm.user_id) as member_count
from public.conversations c
join public.conversation_members cm on cm.conversation_id = c.id
where c.kind = 'group'
group by c.id
having count(cm.user_id) > 100;

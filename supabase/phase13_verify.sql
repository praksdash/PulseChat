-- PulseChat Phase 13 verification. Read-only checks.

select to_regclass('public.message_reactions') as message_reactions_table;

select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.message_reactions'::regclass;

select proname, prosecdef as security_definer
from pg_proc
where proname in (
  'edit_message',
  'delete_message',
  'set_message_reaction',
  'get_message_detail',
  'create_image_message'
)
order by proname;

select
  has_function_privilege('authenticated', 'public.edit_message(uuid,text)', 'EXECUTE') as authenticated_can_edit,
  has_function_privilege('authenticated', 'public.delete_message(uuid)', 'EXECUTE') as authenticated_can_delete,
  has_function_privilege('authenticated', 'public.set_message_reaction(uuid,text)', 'EXECUTE') as authenticated_can_react,
  has_function_privilege('anon', 'public.edit_message(uuid,text)', 'EXECUTE') as anon_can_edit,
  has_function_privilege('anon', 'public.delete_message(uuid)', 'EXECUTE') as anon_can_delete,
  has_function_privilege('anon', 'public.set_message_reaction(uuid,text)', 'EXECUTE') as anon_can_react;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'message_reactions'
order by indexname;

select policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename = 'message_reactions';

-- Should be zero: reactions must never point to soft-deleted messages.
select count(*) as reactions_on_deleted_messages
from public.message_reactions r
join public.messages m on m.id = r.message_id
where m.deleted_at is not null;

-- Should be zero: deleted messages should no longer have attachment metadata.
select count(*) as attachments_on_deleted_messages
from public.attachments a
join public.messages m on m.id = a.message_id
where m.deleted_at is not null;

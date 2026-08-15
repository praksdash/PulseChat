-- PulseChat Phase 12 verification. Read-only checks.

select id, name, public, file_size_limit, allowed_mime_types
from storage.buckets
where id = 'chat-media';

select proname, prosecdef
from pg_proc
where proname in ('create_image_message', 'list_conversation_messages', 'can_access_chat_media_object')
order by proname;

select policyname, cmd, roles
from pg_policies
where (schemaname = 'storage' and tablename = 'objects' and policyname like 'pulsechat%chat_media%')
order by policyname;

select has_function_privilege(
  'authenticated',
  'public.create_image_message(uuid,uuid,text,text,bigint,integer,integer,text)',
  'EXECUTE'
) as authenticated_can_create_image_message;

select has_function_privilege(
  'anon',
  'public.create_image_message(uuid,uuid,text,text,bigint,integer,integer,text)',
  'EXECUTE'
) as anon_can_create_image_message;

-- Should return 0 rows. Every image message should have attachment metadata once
-- the Phase 12 client reports a successful send.
select m.id, m.conversation_id, m.created_at
from public.messages m
left join public.attachments a on a.message_id = m.id
where m.message_type = 'image'
  and a.id is null;

-- Should return 0 rows. Canonical Phase 12 chat-media paths are conversation/user/client.jpg.
select a.id, a.storage_path
from public.attachments a
join public.messages m on m.id = a.message_id
where a.storage_bucket = 'chat-media'
  and a.storage_path <> (
    m.conversation_id::text || '/' || a.uploader_id::text || '/' || m.client_message_id::text || '.jpg'
  );

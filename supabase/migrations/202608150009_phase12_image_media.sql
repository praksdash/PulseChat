-- PulseChat Phase 12: secure image messages + private Supabase Storage.
-- Run AFTER 202608150008_phase11_typing_presence.sql.
--
-- Phase 12 keeps chat media private. Storage object paths are canonical:
--   <conversation_uuid>/<uploader_uuid>/<client_message_uuid>.jpg
-- Only conversation members may read; only the authenticated uploader may write
-- inside their own folder.

-- -----------------------------------------------------------------------------
-- Private chat-media bucket. Images are compressed client-side before upload.
-- -----------------------------------------------------------------------------

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'chat-media',
  'chat-media',
  false,
  10485760,
  array['image/jpeg']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- Storage authorization helper. It never casts user-controlled path text to a
-- UUID; instead it compares path segments against canonical UUID strings.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_access_chat_media_object(
  target_name text,
  require_own_uploader_folder boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.user_id = (select auth.uid())
      and (storage.foldername(target_name))[1] = cm.conversation_id::text
      and (
        not require_own_uploader_folder
        or (storage.foldername(target_name))[2] = (select auth.uid())::text
      )
  );
$$;

revoke all on function pulsechat_private.can_access_chat_media_object(text, boolean)
  from public, anon, authenticated;
grant execute on function pulsechat_private.can_access_chat_media_object(text, boolean)
  to authenticated;

-- Private reads: membership in the conversation encoded in folder #1.
drop policy if exists "pulsechat_members_read_chat_media" on storage.objects;
create policy "pulsechat_members_read_chat_media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and pulsechat_private.can_access_chat_media_object(name, false)
);

-- Uploads: membership plus authenticated user's own folder #2.
drop policy if exists "pulsechat_members_upload_own_chat_media" on storage.objects;
create policy "pulsechat_members_upload_own_chat_media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and pulsechat_private.can_access_chat_media_object(name, true)
);

-- Deletion is uploader-only. Phase 13 will connect this to message deletion.
drop policy if exists "pulsechat_uploaders_delete_own_chat_media" on storage.objects;
create policy "pulsechat_uploaders_delete_own_chat_media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-media'
  and pulsechat_private.can_access_chat_media_object(name, true)
);

-- Direct client inserts remain text-only. Image rows must pass through the
-- transactional RPC below so a client cannot create attachment-less fake media
-- messages or impersonate future system/media types.
drop policy if exists "messages_insert_member_as_self" on public.messages;
create policy "messages_insert_member_as_self"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and message_type = 'text'
  and pulsechat_private.is_conversation_member(conversation_id)
);

-- -----------------------------------------------------------------------------
-- Transactional DB half of an image send.
-- The Storage upload happens first; this RPC then atomically creates/reuses the
-- durable message and attachment metadata. client_message_id makes retries
-- idempotent even if the original database response was lost.
-- -----------------------------------------------------------------------------

create or replace function public.create_image_message(
  target_conversation_id uuid,
  target_client_message_id uuid,
  target_storage_path text,
  target_file_name text default null,
  target_file_size bigint default null,
  target_width integer default null,
  target_height integer default null,
  target_caption text default null
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  client_message_id uuid,
  message_type text,
  body text,
  reply_to_message_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  delivery_status text,
  attachment_id uuid,
  attachment_storage_bucket text,
  attachment_storage_path text,
  attachment_mime_type text,
  attachment_file_name text,
  attachment_file_size bigint,
  attachment_width integer,
  attachment_height integer,
  attachment_duration_ms integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  expected_path text;
  saved_message public.messages%rowtype;
  saved_attachment public.attachments%rowtype;
  normalized_caption text := nullif(btrim(coalesce(target_caption, '')), '');
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_conversation_id is null or target_client_message_id is null then
    raise exception using errcode = '22023', message = 'Conversation and client message IDs are required.';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  if normalized_caption is not null and char_length(normalized_caption) > 1000 then
    raise exception using errcode = '22001', message = 'Photo captions can contain at most 1000 characters.';
  end if;

  if target_file_size is null or target_file_size < 1 or target_file_size > 10485760 then
    raise exception using errcode = '22023', message = 'Prepared image size must be between 1 byte and 10 MB.';
  end if;

  if target_width is null or target_width < 1 or target_width > 10000
     or target_height is null or target_height < 1 or target_height > 10000 then
    raise exception using errcode = '22023', message = 'Prepared image dimensions are invalid.';
  end if;

  expected_path := target_conversation_id::text
    || '/' || current_user_id::text
    || '/' || target_client_message_id::text
    || '.jpg';

  if target_storage_path is distinct from expected_path then
    raise exception using errcode = '22023', message = 'Invalid chat-media storage path.';
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    client_message_id,
    message_type,
    body,
    reply_to_message_id
  )
  values (
    target_conversation_id,
    current_user_id,
    target_client_message_id,
    'image',
    normalized_caption,
    null
  )
  on conflict on constraint messages_sender_client_unique do nothing
  returning * into saved_message;

  if saved_message.id is null then
    select m.*
      into saved_message
    from public.messages m
    where m.sender_id = current_user_id
      and m.client_message_id = target_client_message_id;
  end if;

  if saved_message.id is null
     or saved_message.conversation_id <> target_conversation_id
     or saved_message.message_type <> 'image' then
    raise exception using errcode = '23505', message = 'Client message ID is already used by a different message.';
  end if;

  insert into public.attachments (
    message_id,
    uploader_id,
    storage_bucket,
    storage_path,
    mime_type,
    file_name,
    file_size,
    width,
    height,
    duration_ms
  )
  values (
    saved_message.id,
    current_user_id,
    'chat-media',
    target_storage_path,
    'image/jpeg',
    left(nullif(target_file_name, ''), 255),
    target_file_size,
    target_width,
    target_height,
    null
  )
  on conflict (storage_bucket, storage_path) do nothing
  returning * into saved_attachment;

  if saved_attachment.id is null then
    select a.*
      into saved_attachment
    from public.attachments a
    where a.storage_bucket = 'chat-media'
      and a.storage_path = target_storage_path;
  end if;

  if saved_attachment.id is null or saved_attachment.message_id <> saved_message.id then
    raise exception using errcode = '23505', message = 'Chat-media object is already attached to another message.';
  end if;

  -- The generic message INSERT trigger may reach peers before attachment metadata
  -- exists. This explicit event tells subscribed clients to reconcile the row.
  perform realtime.send(
    jsonb_build_object(
      'conversation_id', target_conversation_id,
      'message_id', saved_message.id
    ),
    'media_message_ready',
    'conversation:' || target_conversation_id::text,
    true
  );

  return query
  select
    saved_message.id,
    saved_message.conversation_id,
    saved_message.sender_id,
    saved_message.client_message_id,
    saved_message.message_type,
    saved_message.body,
    saved_message.reply_to_message_id,
    saved_message.created_at,
    saved_message.edited_at,
    saved_message.deleted_at,
    case
      when receipt_state.recipient_count = 0 then 'sent'
      when receipt_state.read_count = receipt_state.recipient_count then 'read'
      when receipt_state.delivered_count = receipt_state.recipient_count then 'delivered'
      else 'sent'
    end,
    saved_attachment.id,
    saved_attachment.storage_bucket,
    saved_attachment.storage_path,
    saved_attachment.mime_type,
    saved_attachment.file_name,
    saved_attachment.file_size,
    saved_attachment.width,
    saved_attachment.height,
    saved_attachment.duration_ms
  from (
    select
      count(*)::integer as recipient_count,
      count(*) filter (where r.delivered_at is not null)::integer as delivered_count,
      count(*) filter (where r.read_at is not null)::integer as read_count
    from public.message_receipts r
    where r.message_id = saved_message.id
  ) receipt_state;
end;
$$;

revoke all on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text
) from public, anon;
grant execute on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- Message history now includes one attachment projection for image messages.
-- The bucket stays private; the client converts storage_path values to short-
-- lived signed URLs only after normal message/RLS access has succeeded.
-- -----------------------------------------------------------------------------

drop function if exists public.list_conversation_messages(uuid, timestamptz, uuid, integer);

create function public.list_conversation_messages(
  target_conversation_id uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  result_limit integer default 30
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  client_message_id uuid,
  message_type text,
  body text,
  reply_to_message_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  delivery_status text,
  attachment_id uuid,
  attachment_storage_bucket text,
  attachment_storage_path text,
  attachment_mime_type text,
  attachment_file_name text,
  attachment_file_size bigint,
  attachment_width integer,
  attachment_height integer,
  attachment_duration_ms integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    m.client_message_id,
    m.message_type,
    m.body,
    m.reply_to_message_id,
    m.created_at,
    m.edited_at,
    m.deleted_at,
    case
      when m.sender_id is distinct from (select auth.uid()) then null
      when receipt_state.recipient_count = 0 then 'sent'
      when receipt_state.read_count = receipt_state.recipient_count then 'read'
      when receipt_state.delivered_count = receipt_state.recipient_count then 'delivered'
      else 'sent'
    end as delivery_status,
    attachment.id as attachment_id,
    attachment.storage_bucket as attachment_storage_bucket,
    attachment.storage_path as attachment_storage_path,
    attachment.mime_type as attachment_mime_type,
    attachment.file_name as attachment_file_name,
    attachment.file_size as attachment_file_size,
    attachment.width as attachment_width,
    attachment.height as attachment_height,
    attachment.duration_ms as attachment_duration_ms
  from public.messages m
  left join lateral (
    select
      count(*)::integer as recipient_count,
      count(*) filter (where r.delivered_at is not null)::integer as delivered_count,
      count(*) filter (where r.read_at is not null)::integer as read_count
    from public.message_receipts r
    where r.message_id = m.id
  ) receipt_state on true
  left join lateral (
    select a.*
    from public.attachments a
    where a.message_id = m.id
    order by a.created_at asc, a.id asc
    limit 1
  ) attachment on true
  where m.conversation_id = target_conversation_id
    and (
      before_created_at is null
      or m.created_at < before_created_at
      or (
        m.created_at = before_created_at
        and before_id is not null
        and m.id < before_id
      )
    )
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(result_limit, 30), 1), 50);
$$;

revoke all on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
  to authenticated;

comment on function public.create_image_message(uuid, uuid, text, text, bigint, integer, integer, text)
  is 'Phase 12 idempotently commits one private JPEG image message and attachment metadata.';
comment on function pulsechat_private.can_access_chat_media_object(text, boolean)
  is 'Phase 12 Storage RLS helper for canonical conversation/uploader object paths.';

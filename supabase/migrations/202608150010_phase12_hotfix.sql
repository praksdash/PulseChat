-- PulseChat Phase 12 hotfix
-- Fixes PL/pgSQL output-column ambiguity in create_image_message().
-- Safe to run after the original Phase 12 migration.

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

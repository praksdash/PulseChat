-- PulseChat Phase 13: reply, edit, delete and emoji reactions.
-- Run AFTER 202608150010_phase12_hotfix.sql.
--
-- Security model:
--   * reply targets must belong to the same conversation.
--   * only the original sender can edit/delete a durable message.
--   * reaction writes are exposed only through a narrow auth.uid()-bound RPC.
--   * deleted image attachment metadata is removed, so new signed URLs cannot
--     be issued after deletion. The uploader client performs best-effort object
--     cleanup through Storage after the transaction commits.

-- -----------------------------------------------------------------------------
-- Reactions: one active reaction per user per message for the MVP.
-- -----------------------------------------------------------------------------

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (message_id, user_id),
  constraint message_reactions_allowed_emoji_check
    check (emoji = any (array['👍','❤️','😂','😮','😢','🙏']::text[]))
);

create index if not exists message_reactions_message_emoji_idx
  on public.message_reactions (message_id, emoji);

alter table public.message_reactions enable row level security;

drop policy if exists "message_reactions_select_member" on public.message_reactions;
create policy "message_reactions_select_member"
on public.message_reactions
for select
to authenticated
using (pulsechat_private.can_access_message(message_id));

-- No direct reaction mutations are granted to authenticated. All writes go
-- through set_message_reaction(), which derives the actor from auth.uid().
revoke all on table public.message_reactions from anon, authenticated;
grant select on table public.message_reactions to authenticated;

-- -----------------------------------------------------------------------------
-- Deleted media must no longer be signable. Upload/delete authorization remains
-- folder-based, but reads additionally require a live attachment row whose
-- parent message has not been deleted.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_read_chat_media_object(target_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.attachments a
    join public.messages m on m.id = a.message_id
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
     and cm.user_id = (select auth.uid())
    where a.storage_bucket = 'chat-media'
      and a.storage_path = target_name
      and m.deleted_at is null
  );
$$;

revoke all on function pulsechat_private.can_read_chat_media_object(text)
  from public, anon, authenticated;
grant execute on function pulsechat_private.can_read_chat_media_object(text)
  to authenticated;

drop policy if exists "pulsechat_members_read_chat_media" on storage.objects;
create policy "pulsechat_members_read_chat_media"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and pulsechat_private.can_read_chat_media_object(name)
);

-- -----------------------------------------------------------------------------
-- Common mutation broadcast. Conversation members receive the durable change;
-- chat-list clients also receive edit/delete events on their private user topic.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.broadcast_message_change(
  target_conversation_id uuid,
  target_message_id uuid,
  target_event text,
  fanout_to_inbox boolean default false
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  member_row record;
begin
  perform realtime.send(
    jsonb_build_object(
      'conversation_id', target_conversation_id,
      'message_id', target_message_id
    ),
    target_event,
    'conversation:' || target_conversation_id::text,
    true
  );

  if fanout_to_inbox then
    for member_row in
      select cm.user_id
      from public.conversation_members cm
      where cm.conversation_id = target_conversation_id
    loop
      perform realtime.send(
        jsonb_build_object(
          'conversation_id', target_conversation_id,
          'message_id', target_message_id,
          'change_type', target_event
        ),
        'inbox_message_changed',
        'user:' || member_row.user_id::text,
        true
      );
    end loop;
  end if;
end;
$$;

revoke all on function pulsechat_private.broadcast_message_change(uuid, uuid, text, boolean)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Edit: text and image captions only. No client-selected sender/timestamp.
-- -----------------------------------------------------------------------------

create or replace function public.edit_message(
  target_message_id uuid,
  target_body text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_message public.messages%rowtype;
  normalized_body text := nullif(btrim(coalesce(target_body, '')), '');
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select m.* into target_message
  from public.messages m
  where m.id = target_message_id
    and m.sender_id = current_user_id
  for update;

  if target_message.id is null then
    raise exception using errcode = '42501', message = 'You can edit only your own message.';
  end if;

  if target_message.deleted_at is not null then
    raise exception using errcode = '22023', message = 'A deleted message cannot be edited.';
  end if;

  if target_message.message_type not in ('text', 'image') then
    raise exception using errcode = '22023', message = 'This message type cannot be edited.';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_message.conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  if target_message.message_type = 'text' and normalized_body is null then
    raise exception using errcode = '22023', message = 'Text messages cannot be empty.';
  end if;

  if target_message.message_type = 'image'
     and normalized_body is not null
     and char_length(normalized_body) > 1000 then
    raise exception using errcode = '22001', message = 'Photo captions can contain at most 1000 characters.';
  end if;

  if target_message.message_type = 'text'
     and normalized_body is not null
     and char_length(normalized_body) > 10000 then
    raise exception using errcode = '22001', message = 'Messages can contain at most 10000 characters.';
  end if;

  update public.messages m
  set body = normalized_body,
      edited_at = timezone('utc'::text, now())
  where m.id = target_message.id;

  perform pulsechat_private.broadcast_message_change(
    target_message.conversation_id,
    target_message.id,
    'message_updated',
    true
  );
end;
$$;

revoke all on function public.edit_message(uuid, text) from public, anon;
grant execute on function public.edit_message(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Delete for everyone: soft-delete the message and erase attachment metadata.
-- The returned path lets the uploader client remove the object through Storage.
-- -----------------------------------------------------------------------------

create or replace function public.delete_message(target_message_id uuid)
returns table (
  message_id uuid,
  conversation_id uuid,
  storage_bucket text,
  storage_path text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_message public.messages%rowtype;
  media_bucket text;
  media_path text;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select m.* into target_message
  from public.messages m
  where m.id = target_message_id
    and m.sender_id = current_user_id
  for update;

  if target_message.id is null then
    raise exception using errcode = '42501', message = 'You can delete only your own message.';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_message.conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  if target_message.deleted_at is null then
    select a.storage_bucket, a.storage_path
      into media_bucket, media_path
    from public.attachments a
    where a.message_id = target_message.id
    order by a.created_at asc, a.id asc
    limit 1;

    update public.messages m
    set body = null,
        edited_at = null,
        deleted_at = timezone('utc'::text, now())
    where m.id = target_message.id;

    delete from public.message_reactions r where r.message_id = target_message.id;
    delete from public.attachments a where a.message_id = target_message.id;

    perform pulsechat_private.broadcast_message_change(
      target_message.conversation_id,
      target_message.id,
      'message_deleted',
      true
    );
  end if;

  return query
  select target_message.id, target_message.conversation_id, media_bucket, media_path;
end;
$$;

revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.delete_message(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reaction toggle/set. Passing null removes the caller's reaction.
-- -----------------------------------------------------------------------------

create or replace function public.set_message_reaction(
  target_message_id uuid,
  target_emoji text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_conversation_id uuid;
  normalized_emoji text := nullif(btrim(coalesce(target_emoji, '')), '');
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  select m.conversation_id into target_conversation_id
  from public.messages m
  where m.id = target_message_id
    and m.deleted_at is null;

  if target_conversation_id is null or not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Message access denied.';
  end if;

  if normalized_emoji is null then
    delete from public.message_reactions r
    where r.message_id = target_message_id
      and r.user_id = current_user_id;
  else
    if normalized_emoji <> all (array['👍','❤️','😂','😮','😢','🙏']::text[]) then
      raise exception using errcode = '22023', message = 'Unsupported reaction.';
    end if;

    insert into public.message_reactions (message_id, user_id, emoji)
    values (target_message_id, current_user_id, normalized_emoji)
    on conflict (message_id, user_id)
    do update set emoji = excluded.emoji,
                  updated_at = timezone('utc'::text, now());
  end if;

  perform pulsechat_private.broadcast_message_change(
    target_conversation_id,
    target_message_id,
    'message_reactions_changed',
    false
  );

  return normalized_emoji;
end;
$$;

revoke all on function public.set_message_reaction(uuid, text) from public, anon;
grant execute on function public.set_message_reaction(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Phase 13 projection. Deleted content is redacted. Reply preview and reaction
-- aggregation are returned with each page so the UI never has to N+1 query.
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
  attachment_duration_ms integer,
  reply_sender_id uuid,
  reply_message_type text,
  reply_body text,
  reply_deleted_at timestamptz,
  reaction_counts jsonb,
  my_reaction text
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
    case when m.deleted_at is null then m.body else null end as body,
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
    case when m.deleted_at is null then attachment.id else null end,
    case when m.deleted_at is null then attachment.storage_bucket else null end,
    case when m.deleted_at is null then attachment.storage_path else null end,
    case when m.deleted_at is null then attachment.mime_type else null end,
    case when m.deleted_at is null then attachment.file_name else null end,
    case when m.deleted_at is null then attachment.file_size else null end,
    case when m.deleted_at is null then attachment.width else null end,
    case when m.deleted_at is null then attachment.height else null end,
    case when m.deleted_at is null then attachment.duration_ms else null end,
    reply_message.sender_id as reply_sender_id,
    reply_message.message_type as reply_message_type,
    case when reply_message.deleted_at is null then reply_message.body else null end as reply_body,
    reply_message.deleted_at as reply_deleted_at,
    coalesce(reaction_state.counts, '[]'::jsonb) as reaction_counts,
    my_reaction.emoji as my_reaction
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
  left join public.messages reply_message
    on reply_message.id = m.reply_to_message_id
   and reply_message.conversation_id = m.conversation_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count)
      order by grouped.reaction_count desc, grouped.emoji asc
    ) as counts
    from (
      select r.emoji, count(*)::integer as reaction_count
      from public.message_reactions r
      where r.message_id = m.id
      group by r.emoji
    ) grouped
  ) reaction_state on true
  left join public.message_reactions my_reaction
    on my_reaction.message_id = m.id
   and my_reaction.user_id = (select auth.uid())
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

-- Single-message projection for realtime edit/delete/reaction reconciliation.
create or replace function public.get_message_detail(target_message_id uuid)
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
  attachment_duration_ms integer,
  reply_sender_id uuid,
  reply_message_type text,
  reply_body text,
  reply_deleted_at timestamptz,
  reaction_counts jsonb,
  my_reaction text
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
    case when m.deleted_at is null then m.body else null end as body,
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
    case when m.deleted_at is null then attachment.id else null end,
    case when m.deleted_at is null then attachment.storage_bucket else null end,
    case when m.deleted_at is null then attachment.storage_path else null end,
    case when m.deleted_at is null then attachment.mime_type else null end,
    case when m.deleted_at is null then attachment.file_name else null end,
    case when m.deleted_at is null then attachment.file_size else null end,
    case when m.deleted_at is null then attachment.width else null end,
    case when m.deleted_at is null then attachment.height else null end,
    case when m.deleted_at is null then attachment.duration_ms else null end,
    reply_message.sender_id,
    reply_message.message_type,
    case when reply_message.deleted_at is null then reply_message.body else null end,
    reply_message.deleted_at,
    coalesce(reaction_state.counts, '[]'::jsonb),
    my_reaction.emoji
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
  left join public.messages reply_message
    on reply_message.id = m.reply_to_message_id
   and reply_message.conversation_id = m.conversation_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count)
      order by grouped.reaction_count desc, grouped.emoji asc
    ) as counts
    from (
      select r.emoji, count(*)::integer as reaction_count
      from public.message_reactions r
      where r.message_id = m.id
      group by r.emoji
    ) grouped
  ) reaction_state on true
  left join public.message_reactions my_reaction
    on my_reaction.message_id = m.id
   and my_reaction.user_id = (select auth.uid())
  where m.id = target_message_id
  limit 1;
$$;

revoke all on function public.get_message_detail(uuid) from public, anon;
grant execute on function public.get_message_detail(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Reply-aware image creation. Drop the Phase 12 signature so PostgREST has only
-- one create_image_message overload to resolve.
-- -----------------------------------------------------------------------------

drop function if exists public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text
);

create function public.create_image_message(
  target_conversation_id uuid,
  target_client_message_id uuid,
  target_storage_path text,
  target_file_name text default null,
  target_file_size bigint default null,
  target_width integer default null,
  target_height integer default null,
  target_caption text default null,
  target_reply_to_message_id uuid default null
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
  attachment_duration_ms integer,
  reply_sender_id uuid,
  reply_message_type text,
  reply_body text,
  reply_deleted_at timestamptz,
  reaction_counts jsonb,
  my_reaction text
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
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  if target_reply_to_message_id is not null and not exists (
    select 1 from public.messages reply_message
    where reply_message.id = target_reply_to_message_id
      and reply_message.conversation_id = target_conversation_id
      and reply_message.deleted_at is null
  ) then
    raise exception using errcode = '22023', message = 'Reply target is unavailable.';
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

  expected_path := target_conversation_id::text || '/' || current_user_id::text
    || '/' || target_client_message_id::text || '.jpg';

  if target_storage_path is distinct from expected_path then
    raise exception using errcode = '22023', message = 'Invalid chat-media storage path.';
  end if;

  insert into public.messages (
    conversation_id, sender_id, client_message_id, message_type, body, reply_to_message_id
  ) values (
    target_conversation_id, current_user_id, target_client_message_id,
    'image', normalized_caption, target_reply_to_message_id
  )
  on conflict on constraint messages_sender_client_unique do nothing
  returning * into saved_message;

  if saved_message.id is null then
    select m.* into saved_message
    from public.messages m
    where m.sender_id = current_user_id
      and m.client_message_id = target_client_message_id;
  end if;

  if saved_message.id is null
     or saved_message.conversation_id <> target_conversation_id
     or saved_message.message_type <> 'image'
     or saved_message.reply_to_message_id is distinct from target_reply_to_message_id then
    raise exception using errcode = '23505', message = 'Client message ID is already used by a different message.';
  end if;

  insert into public.attachments (
    message_id, uploader_id, storage_bucket, storage_path, mime_type,
    file_name, file_size, width, height, duration_ms
  ) values (
    saved_message.id, current_user_id, 'chat-media', target_storage_path, 'image/jpeg',
    left(nullif(target_file_name, ''), 255), target_file_size, target_width, target_height, null
  )
  on conflict (storage_bucket, storage_path) do nothing
  returning * into saved_attachment;

  if saved_attachment.id is null then
    select a.* into saved_attachment
    from public.attachments a
    where a.storage_bucket = 'chat-media'
      and a.storage_path = target_storage_path;
  end if;

  if saved_attachment.id is null or saved_attachment.message_id <> saved_message.id then
    raise exception using errcode = '23505', message = 'Chat-media object is already attached to another message.';
  end if;

  perform realtime.send(
    jsonb_build_object('conversation_id', target_conversation_id, 'message_id', saved_message.id),
    'media_message_ready',
    'conversation:' || target_conversation_id::text,
    true
  );

  return query
  select detail.*
  from public.get_message_detail(saved_message.id) detail;
end;
$$;

revoke all on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
) from public, anon;
grant execute on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
) to authenticated;

comment on table public.message_reactions
  is 'Phase 13 one-reaction-per-user message reactions.';
comment on function public.edit_message(uuid, text)
  is 'Phase 13 sender-only text/caption edit with private Realtime fanout.';
comment on function public.delete_message(uuid)
  is 'Phase 13 sender-only soft delete that redacts body and attachment metadata.';
comment on function public.set_message_reaction(uuid, text)
  is 'Phase 13 auth.uid()-bound reaction set/remove RPC.';

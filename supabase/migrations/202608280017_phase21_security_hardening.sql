-- PulseChat Phase 21: Prototype V1 security hardening.
-- Run AFTER 202608270016_phase18_settings.sql.
--
-- Scope:
--   * bounded server-side message/report abuse controls;
--   * RPC-only profile mutation with avatar-object validation;
--   * canonical private-media upload paths and object metadata verification;
--   * preservation of the existing Phase 17 block/report authorization model.

-- -----------------------------------------------------------------------------
-- Small fixed-window limiter. One row is retained per actor/action, so the
-- table does not grow with every request. Only trusted triggers/RPCs may call it.
-- -----------------------------------------------------------------------------

create table if not exists pulsechat_private.rate_limit_state (
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null,
  window_seconds integer not null,
  window_started_at timestamptz not null,
  event_count integer not null,
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (actor_user_id, action_key),
  constraint rate_limit_action_key_check
    check (action_key ~ '^[a-z0-9_]{1,64}$'),
  constraint rate_limit_window_check
    check (window_seconds between 1 and 86400),
  constraint rate_limit_event_count_check
    check (event_count >= 1)
);

revoke all on table pulsechat_private.rate_limit_state from public, anon, authenticated;

create or replace function pulsechat_private.enforce_rate_limit(
  actor_user_id uuid,
  target_action_key text,
  target_max_events integer,
  target_window_seconds integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  request_time timestamptz := clock_timestamp();
  accepted_count integer;
begin
  if actor_user_id is null
     or target_action_key !~ '^[a-z0-9_]{1,64}$'
     or target_max_events < 1
     or target_window_seconds not between 1 and 86400 then
    raise exception using errcode = '22023', message = 'Invalid rate-limit configuration.';
  end if;

  insert into pulsechat_private.rate_limit_state (
    actor_user_id,
    action_key,
    window_seconds,
    window_started_at,
    event_count,
    updated_at
  ) values (
    actor_user_id,
    target_action_key,
    target_window_seconds,
    request_time,
    1,
    request_time
  )
  on conflict (actor_user_id, action_key) do update
  set window_seconds = excluded.window_seconds,
      window_started_at = case
        when pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => target_window_seconds)
          then request_time
        else pulsechat_private.rate_limit_state.window_started_at
      end,
      event_count = case
        when pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => target_window_seconds)
          then 1
        else pulsechat_private.rate_limit_state.event_count + 1
      end,
      updated_at = request_time
  where pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => target_window_seconds)
     or pulsechat_private.rate_limit_state.event_count < target_max_events
  returning event_count into accepted_count;

  if accepted_count is null then
    raise exception using errcode = 'P0001',
      message = 'Too many requests. Please wait and try again.';
  end if;
end;
$$;

revoke all on function pulsechat_private.enforce_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;

create or replace function pulsechat_private.enforce_message_rate_limit_before_insert()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if new.sender_id is null then return new; end if;

  -- Idempotent client_message_id retries must not consume fresh capacity.
  if exists (
    select 1 from public.messages existing_message
    where existing_message.sender_id = new.sender_id
      and existing_message.client_message_id = new.client_message_id
  ) then
    return new;
  end if;

  perform pulsechat_private.enforce_rate_limit(new.sender_id, 'message_minute', 60, 60);
  perform pulsechat_private.enforce_rate_limit(new.sender_id, 'message_hour', 1000, 3600);
  return new;
end;
$$;

revoke all on function pulsechat_private.enforce_message_rate_limit_before_insert()
  from public, anon, authenticated;

drop trigger if exists enforce_message_rate_limit_before_insert on public.messages;
create trigger enforce_message_rate_limit_before_insert
before insert on public.messages
for each row execute function pulsechat_private.enforce_message_rate_limit_before_insert();

-- -----------------------------------------------------------------------------
-- Profile writes move behind a caller-bound RPC. This prevents a modified
-- client from assigning a path for a missing/non-image avatar object.
-- -----------------------------------------------------------------------------

create or replace function public.update_my_profile(
  target_display_name text,
  target_username text default null,
  target_bio text default null,
  target_avatar_path text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_display_name text := btrim(coalesce(target_display_name, ''));
  normalized_username text := nullif(lower(btrim(coalesce(target_username, ''))), '');
  normalized_bio text := nullif(btrim(coalesce(target_bio, '')), '');
  avatar_mime_type text;
  avatar_size bigint;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  perform pulsechat_private.enforce_rate_limit(current_user_id, 'profile_update_hour', 30, 3600);

  if char_length(normalized_display_name) not between 2 and 60 then
    raise exception using errcode = '22023', message = 'Display name must contain 2 to 60 characters.';
  end if;
  if normalized_username is not null and normalized_username !~ '^[a-z0-9_]{3,32}$' then
    raise exception using errcode = '22023', message = 'Username format is invalid.';
  end if;
  if normalized_bio is not null and char_length(normalized_bio) > 160 then
    raise exception using errcode = '22001', message = 'Bio can contain at most 160 characters.';
  end if;

  if target_avatar_path is not null then
    if target_avatar_path !~ (
      '^' || current_user_id::text || '/[A-Za-z0-9][A-Za-z0-9._-]{0,179}$'
    ) then
      raise exception using errcode = '22023', message = 'Invalid avatar storage path.';
    end if;

    select
      lower(coalesce(object_row.metadata ->> 'mimetype', '')),
      case
        when coalesce(object_row.metadata ->> 'size', '') ~ '^[0-9]+$'
          then (object_row.metadata ->> 'size')::bigint
        else null
      end
      into avatar_mime_type, avatar_size
    from storage.objects object_row
    where object_row.bucket_id = 'avatars'
      and object_row.name = target_avatar_path
    limit 1;

    if avatar_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
       or avatar_size is null
       or avatar_size not between 1 and 5242880 then
      raise exception using errcode = '22023', message = 'Avatar object is missing or invalid.';
    end if;
  end if;

  update public.profiles profile_row
  set display_name = normalized_display_name,
      username = normalized_username,
      bio = normalized_bio,
      avatar_path = target_avatar_path
  where profile_row.id = current_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found.';
  end if;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text) to authenticated;

revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- New chat-media writes must use the exact V1 JPEG path shape. Historical
-- objects remain deletable under the earlier owner-folder policy.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_upload_chat_media_object(target_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members member_row
    where member_row.user_id = (select auth.uid())
      and split_part(target_name, '/', 1) = member_row.conversation_id::text
      and split_part(target_name, '/', 2) = (select auth.uid())::text
      and split_part(target_name, '/', 3)
        ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]jpg$'
      and split_part(target_name, '/', 4) = ''
      and pulsechat_private.can_send_in_conversation(
        member_row.conversation_id,
        (select auth.uid())
      )
  );
$$;

revoke all on function pulsechat_private.can_upload_chat_media_object(text)
  from public, anon, authenticated;
grant execute on function pulsechat_private.can_upload_chat_media_object(text) to authenticated;

drop policy if exists "pulsechat_members_upload_own_chat_media" on storage.objects;
create policy "pulsechat_members_upload_own_chat_media"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and pulsechat_private.can_upload_chat_media_object(name)
);

-- Recreate the Phase 14 image RPC with an authoritative Storage object check.
create or replace function public.create_image_message(
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
  sender_display_name text,
  sender_avatar_path text,
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
  reply_sender_display_name text,
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
  object_mime_type text;
  object_size bigint;
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

  if not pulsechat_private.can_send_in_conversation(target_conversation_id, current_user_id) then
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

  if target_file_size is null or target_file_size not between 1 and 10485760 then
    raise exception using errcode = '22023', message = 'Prepared image size must be between 1 byte and 10 MB.';
  end if;

  if target_width is null or target_width not between 1 and 10000
     or target_height is null or target_height not between 1 and 10000 then
    raise exception using errcode = '22023', message = 'Prepared image dimensions are invalid.';
  end if;

  expected_path := target_conversation_id::text || '/' || current_user_id::text
    || '/' || target_client_message_id::text || '.jpg';
  if target_storage_path is distinct from expected_path then
    raise exception using errcode = '22023', message = 'Invalid chat-media storage path.';
  end if;

  select
    lower(coalesce(object_row.metadata ->> 'mimetype', '')),
    case
      when coalesce(object_row.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (object_row.metadata ->> 'size')::bigint
      else null
    end
    into object_mime_type, object_size
  from storage.objects object_row
  where object_row.bucket_id = 'chat-media'
    and object_row.name = target_storage_path
  limit 1;

  if object_mime_type <> 'image/jpeg'
     or object_size is null
     or object_size is distinct from target_file_size
     or object_size not between 1 and 10485760 then
    raise exception using errcode = '22023',
      message = 'Uploaded image object is missing or does not match its metadata.';
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
    select message_row.* into saved_message
    from public.messages message_row
    where message_row.sender_id = current_user_id
      and message_row.client_message_id = target_client_message_id;
  end if;

  if saved_message.id is null
     or saved_message.conversation_id <> target_conversation_id
     or saved_message.message_type <> 'image'
     or saved_message.reply_to_message_id is distinct from target_reply_to_message_id then
    raise exception using errcode = '23505',
      message = 'Client message ID is already used by a different message.';
  end if;

  insert into public.attachments (
    message_id, uploader_id, storage_bucket, storage_path, mime_type,
    file_name, file_size, width, height, duration_ms
  ) values (
    saved_message.id, current_user_id, 'chat-media', target_storage_path, 'image/jpeg',
    left(nullif(target_file_name, ''), 255), object_size, target_width, target_height, null
  )
  on conflict (storage_bucket, storage_path) do nothing
  returning * into saved_attachment;

  if saved_attachment.id is null then
    select attachment_row.* into saved_attachment
    from public.attachments attachment_row
    where attachment_row.storage_bucket = 'chat-media'
      and attachment_row.storage_path = target_storage_path;
  end if;

  if saved_attachment.id is null or saved_attachment.message_id <> saved_message.id then
    raise exception using errcode = '23505',
      message = 'Chat-media object is already attached to another message.';
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('conversation_id', target_conversation_id, 'message_id', saved_message.id),
      'media_message_ready',
      'conversation:' || target_conversation_id::text,
      true
    );
  exception when others then null;
  end;

  return query select detail.* from public.get_message_detail(saved_message.id) detail;
end;
$$;

revoke all on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
) from public, anon;
grant execute on function public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
) to authenticated;

-- -----------------------------------------------------------------------------
-- Report submissions stay private and membership-bound as in Phase 17. Fresh
-- rows are additionally limited; returning an existing id is still idempotent.
-- -----------------------------------------------------------------------------

create or replace function public.report_user_or_message(
  target_user_id uuid,
  target_reason text,
  target_details text default null,
  target_message_id uuid default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_reason text := lower(btrim(coalesce(target_reason, '')));
  normalized_details text := nullif(btrim(coalesce(target_details, '')), '');
  resolved_user_id uuid := target_user_id;
  resolved_conversation_id uuid := null;
  existing_report_id uuid;
  result_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  if normalized_reason not in (
    'spam', 'harassment', 'impersonation', 'sexual_content', 'violence', 'scam', 'other'
  ) then
    raise exception using errcode = '22023', message = 'Choose a valid report reason.';
  end if;
  if normalized_details is not null and char_length(normalized_details) > 1000 then
    raise exception using errcode = '22001', message = 'Report details can contain at most 1000 characters.';
  end if;

  if target_message_id is not null then
    select message_row.sender_id, message_row.conversation_id
      into resolved_user_id, resolved_conversation_id
    from public.messages message_row
    where message_row.id = target_message_id
      and exists (
        select 1 from public.conversation_members member_row
        where member_row.conversation_id = message_row.conversation_id
          and member_row.user_id = current_user_id
      );

    if resolved_user_id is null then
      raise exception using errcode = 'P0002',
        message = 'This message is unavailable for reporting.';
    end if;
    if target_user_id is not null and target_user_id <> resolved_user_id then
      raise exception using errcode = '22023',
        message = 'Reported user does not match the message sender.';
    end if;
  elsif resolved_user_id is null
     or not exists (select 1 from public.profiles profile_row where profile_row.id = resolved_user_id) then
    raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
  end if;

  if resolved_user_id = current_user_id then
    raise exception using errcode = '22023',
      message = 'You cannot report yourself or your own message.';
  end if;

  if target_message_id is not null then
    select report_row.id into existing_report_id
    from public.reports report_row
    where report_row.reporter_id = current_user_id
      and report_row.message_id = target_message_id
    limit 1;
  else
    select report_row.id into existing_report_id
    from public.reports report_row
    where report_row.reporter_id = current_user_id
      and report_row.reported_user_id = resolved_user_id
      and report_row.message_id is null
    limit 1;
  end if;

  if existing_report_id is not null then return existing_report_id; end if;

  perform pulsechat_private.enforce_rate_limit(current_user_id, 'report_hour', 10, 3600);
  perform pulsechat_private.enforce_rate_limit(current_user_id, 'report_day', 50, 86400);

  insert into public.reports (
    reporter_id, reported_user_id, conversation_id, message_id, reason, details
  ) values (
    current_user_id, resolved_user_id, resolved_conversation_id,
    target_message_id, normalized_reason, normalized_details
  ) returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.report_user_or_message(uuid, text, text, uuid)
  from public, anon;
grant execute on function public.report_user_or_message(uuid, text, text, uuid)
  to authenticated;

-- The notification diagnostics endpoint can generate real external traffic.
-- Require a caller-bound database claim before each test dispatch.
create or replace function public.claim_my_push_test()
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  perform pulsechat_private.enforce_rate_limit(current_user_id, 'push_test_hour', 5, 3600);
end;
$$;

revoke all on function public.claim_my_push_test() from public, anon;
grant execute on function public.claim_my_push_test() to authenticated;

comment on function pulsechat_private.enforce_rate_limit(uuid, text, integer, integer)
  is 'Phase 21 private bounded fixed-window limiter used by trusted write paths.';
comment on function public.update_my_profile(text, text, text, text)
  is 'Phase 21 caller-bound profile mutation with avatar Storage metadata validation.';
comment on function public.create_image_message(uuid, uuid, text, text, bigint, integer, integer, text, uuid)
  is 'Phase 21 image-message commit requiring canonical path and matching private Storage object metadata.';
comment on function public.claim_my_push_test()
  is 'Phase 21 caller-bound abuse limit for remote push diagnostics.';

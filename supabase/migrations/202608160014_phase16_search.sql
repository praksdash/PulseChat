-- PulseChat Phase 16: secure global search for chats and messages.
-- Run after Phase 15.
--
-- Security goals:
-- - all conversation/message search is scoped to auth.uid() membership server-side;
-- - deleted messages are never returned by message search;
-- - caller-controlled LIKE wildcards are escaped;
-- - result counts and query lengths are bounded;
-- - message body substring search uses a partial pg_trgm GIN index.

create extension if not exists pg_trgm with schema extensions;

create index if not exists conversations_title_search_trgm_idx
  on public.conversations using gin (lower(title) extensions.gin_trgm_ops)
  where kind = 'group' and title is not null;

create index if not exists messages_body_search_trgm_idx
  on public.messages using gin (lower(body) extensions.gin_trgm_ops)
  where deleted_at is null and body is not null;

-- Search only conversations the current user belongs to. Direct chats are
-- matched against the peer profile; groups are matched against the group title.
create or replace function public.search_my_conversations(
  search_term text,
  result_limit integer default 20
)
returns table (
  conversation_id uuid,
  kind text,
  display_name text,
  username text,
  avatar_path text,
  peer_user_id uuid,
  member_count integer,
  my_role text,
  last_message_preview text,
  last_message_sender_id uuid,
  last_message_sender_name text,
  last_message_created_at timestamptz,
  last_activity_at timestamptz,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  needle text;
  escaped_needle text;
  safe_limit integer;
begin
  if current_user_id is null then
    return;
  end if;

  needle := lower(btrim(coalesce(search_term, '')));
  if char_length(needle) < 2 then
    return;
  end if;

  needle := left(needle, 80);
  safe_limit := least(greatest(coalesce(result_limit, 20), 1), 30);
  escaped_needle := replace(needle, E'\\', E'\\\\');
  escaped_needle := replace(escaped_needle, '%', E'\\%');
  escaped_needle := replace(escaped_needle, '_', E'\\_');

  return query
  select
    c.id,
    c.kind,
    case
      when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User')
      else coalesce(c.title, 'Group')
    end,
    case when c.kind = 'direct' then peer_profile.username else null end,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end,
    case when c.kind = 'direct' then peer_member.user_id else null end,
    member_state.member_count,
    self_member.role,
    case
      when latest_message.id is null then null
      when latest_message.deleted_at is not null then 'Message deleted'
      when latest_message.message_type = 'text' then latest_message.body
      when latest_message.message_type = 'image' then
        case
          when nullif(btrim(coalesce(latest_message.body, '')), '') is null then 'Photo'
          else 'Photo · ' || latest_message.body
        end
      when latest_message.message_type = 'video' then 'Video'
      when latest_message.message_type = 'audio' then 'Audio'
      when latest_message.message_type = 'voice' then 'Voice message'
      when latest_message.message_type = 'file' then 'File'
      else 'Message'
    end,
    latest_message.sender_id,
    latest_sender.display_name,
    latest_message.created_at,
    greatest(c.last_message_at, c.created_at),
    coalesce(unread.unread_count, 0)
  from public.conversation_members self_member
  join public.conversations c on c.id = self_member.conversation_id
  left join public.conversation_members peer_member
    on c.kind = 'direct'
   and peer_member.conversation_id = c.id
   and peer_member.user_id <> self_member.user_id
  left join public.profiles peer_profile on peer_profile.id = peer_member.user_id
  left join lateral (
    select count(*)::integer as member_count
    from public.conversation_members group_member
    where group_member.conversation_id = c.id
  ) member_state on true
  left join lateral (
    select m.id, m.sender_id, m.message_type, m.body, m.created_at, m.deleted_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest_message on true
  left join public.profiles latest_sender on latest_sender.id = latest_message.sender_id
  left join lateral (
    select least(count(*), 2147483647)::integer as unread_count
    from public.message_receipts r
    join public.messages unread_message on unread_message.id = r.message_id
    where r.user_id = self_member.user_id
      and r.read_at is null
      and unread_message.conversation_id = c.id
  ) unread on true
  where self_member.user_id = current_user_id
    and (
      (
        c.kind = 'direct'
        and (
          lower(coalesce(peer_profile.display_name, '')) like ('%' || escaped_needle || '%') escape E'\\'
          or lower(coalesce(peer_profile.username, '')) like ('%' || escaped_needle || '%') escape E'\\'
        )
      )
      or (
        c.kind = 'group'
        and lower(coalesce(c.title, '')) like ('%' || escaped_needle || '%') escape E'\\'
      )
    )
  order by
    case
      when c.kind = 'direct' and lower(coalesce(peer_profile.username, '')) = needle then 0
      when c.kind = 'direct' and lower(coalesce(peer_profile.display_name, '')) = needle then 1
      when c.kind = 'group' and lower(coalesce(c.title, '')) = needle then 1
      when c.kind = 'direct' and lower(coalesce(peer_profile.display_name, '')) like (escaped_needle || '%') escape E'\\' then 2
      when c.kind = 'group' and lower(coalesce(c.title, '')) like (escaped_needle || '%') escape E'\\' then 2
      else 3
    end,
    greatest(c.last_message_at, c.created_at) desc,
    c.id desc
  limit safe_limit;
end;
$$;

revoke all on function public.search_my_conversations(text, integer) from public, anon;
grant execute on function public.search_my_conversations(text, integer) to authenticated;

-- Message search covers text bodies and image captions. It never returns
-- deleted messages or messages from a conversation the caller cannot access.
create or replace function public.search_my_messages(
  search_term text,
  before_created_at timestamptz default null,
  before_id uuid default null,
  result_limit integer default 20
)
returns table (
  message_id uuid,
  conversation_id uuid,
  conversation_kind text,
  conversation_display_name text,
  conversation_avatar_path text,
  sender_id uuid,
  sender_display_name text,
  sender_avatar_path text,
  message_type text,
  body text,
  match_snippet text,
  created_at timestamptz,
  edited_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  needle text;
  escaped_needle text;
  safe_limit integer;
begin
  if current_user_id is null then
    return;
  end if;

  needle := lower(btrim(coalesce(search_term, '')));
  if char_length(needle) < 2 then
    return;
  end if;

  needle := left(needle, 100);
  safe_limit := least(greatest(coalesce(result_limit, 20), 1), 30);
  escaped_needle := replace(needle, E'\\', E'\\\\');
  escaped_needle := replace(escaped_needle, '%', E'\\%');
  escaped_needle := replace(escaped_needle, '_', E'\\_');

  return query
  select
    m.id,
    m.conversation_id,
    c.kind,
    case
      when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User')
      else coalesce(c.title, 'Group')
    end,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end,
    m.sender_id,
    sender_profile.display_name,
    sender_profile.avatar_path,
    m.message_type,
    m.body,
    substring(
      m.body
      from greatest(strpos(lower(m.body), needle) - 55, 1)
      for 220
    ),
    m.created_at,
    m.edited_at
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.conversation_members self_member
    on self_member.conversation_id = m.conversation_id
   and self_member.user_id = current_user_id
  left join public.conversation_members peer_member
    on c.kind = 'direct'
   and peer_member.conversation_id = c.id
   and peer_member.user_id <> current_user_id
  left join public.profiles peer_profile on peer_profile.id = peer_member.user_id
  left join public.profiles sender_profile on sender_profile.id = m.sender_id
  where m.deleted_at is null
    and m.body is not null
    and lower(m.body) like ('%' || escaped_needle || '%') escape E'\\'
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
  limit safe_limit;
end;
$$;

revoke all on function public.search_my_messages(text, timestamptz, uuid, integer) from public, anon;
grant execute on function public.search_my_messages(text, timestamptz, uuid, integer) to authenticated;

-- Fetch a small authoritative timeline window around a search hit. This lets the
-- client jump directly to an old result without paging through the entire chat.
create or replace function public.get_message_window(
  focus_message_id uuid,
  before_count integer default 18,
  after_count integer default 18
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
language sql
stable
security definer
set search_path = ''
as $$
  with anchor as (
    select m.id, m.conversation_id, m.created_at
    from public.messages m
    where m.id = focus_message_id
      and m.deleted_at is null
      and exists (
        select 1
        from public.conversation_members access_member
        where access_member.conversation_id = m.conversation_id
          and access_member.user_id = (select auth.uid())
      )
    limit 1
  ),
  window_ids as (
    (
      select m.id
      from public.messages m
      join anchor a on a.conversation_id = m.conversation_id
      where m.created_at < a.created_at
         or (m.created_at = a.created_at and m.id <= a.id)
      order by m.created_at desc, m.id desc
      limit least(greatest(coalesce(before_count, 18), 1), 30) + 1
    )
    union
    (
      select m.id
      from public.messages m
      join anchor a on a.conversation_id = m.conversation_id
      where m.created_at > a.created_at
         or (m.created_at = a.created_at and m.id > a.id)
      order by m.created_at asc, m.id asc
      limit least(greatest(coalesce(after_count, 18), 0), 30)
    )
  )
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    sender_profile.display_name,
    sender_profile.avatar_path,
    m.client_message_id,
    m.message_type,
    case when m.deleted_at is null then m.body else null end,
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
    end,
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
    reply_profile.display_name,
    reply_message.message_type,
    case when reply_message.deleted_at is null then reply_message.body else null end,
    reply_message.deleted_at,
    coalesce(reaction_state.counts, '[]'::jsonb),
    my_reaction.emoji
  from public.messages m
  join window_ids selected on selected.id = m.id
  left join public.profiles sender_profile on sender_profile.id = m.sender_id
  left join lateral (
    select
      count(*)::integer recipient_count,
      count(*) filter (where r.delivered_at is not null)::integer delivered_count,
      count(*) filter (where r.read_at is not null)::integer read_count
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
  left join public.profiles reply_profile on reply_profile.id = reply_message.sender_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count)
      order by grouped.reaction_count desc, grouped.emoji asc
    ) counts
    from (
      select r.emoji, count(*)::integer reaction_count
      from public.message_reactions r
      where r.message_id = m.id
      group by r.emoji
    ) grouped
  ) reaction_state on true
  left join public.message_reactions my_reaction
    on my_reaction.message_id = m.id
   and my_reaction.user_id = (select auth.uid())
  order by m.created_at desc, m.id desc;
$$;

revoke all on function public.get_message_window(uuid, integer, integer) from public, anon;
grant execute on function public.get_message_window(uuid, integer, integer) to authenticated;

comment on function public.search_my_conversations(text, integer)
  is 'Phase 16: membership-scoped direct/group conversation search.';
comment on function public.search_my_messages(text, timestamptz, uuid, integer)
  is 'Phase 16: membership-scoped non-deleted message/body search.';
comment on function public.get_message_window(uuid, integer, integer)
  is 'Phase 16: authorized timeline window around a message search hit.';

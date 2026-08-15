-- PulseChat Phase 8: direct-chat creation and real conversation list RPCs.
-- Run AFTER 202608150004_phase7_user_discovery.sql.
--
-- This phase intentionally does NOT enable realtime or message sending yet.
-- It only makes conversation creation/listing real and safe.

-- -----------------------------------------------------------------------------
-- Create-or-return exactly one direct conversation for a pair of users.
-- -----------------------------------------------------------------------------

create or replace function public.create_or_get_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  canonical_key text;
  result_conversation_id uuid;
  created_new boolean := false;
  expected_member_count integer;
  total_member_count integer;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_user_id is null then
    raise exception using errcode = '22023', message = 'Target user is required.';
  end if;

  if target_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'You cannot start a direct chat with yourself.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
  ) then
    raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
  end if;

  canonical_key := pulsechat_private.direct_conversation_key(current_user_id, target_user_id);

  -- The partial unique index on conversations.direct_key is the concurrency
  -- boundary. If two clients race, only one INSERT wins and both calls return
  -- the same conversation after the winning transaction commits.
  insert into public.conversations (
    kind,
    direct_key,
    created_by
  )
  values (
    'direct',
    canonical_key,
    current_user_id
  )
  on conflict (direct_key) where direct_key is not null
  do nothing
  returning id into result_conversation_id;

  if result_conversation_id is not null then
    created_new := true;

    insert into public.conversation_members (conversation_id, user_id, role)
    values
      (result_conversation_id, current_user_id, 'member'),
      (result_conversation_id, target_user_id, 'member');
  else
    select c.id
      into result_conversation_id
    from public.conversations c
    where c.kind = 'direct'
      and c.direct_key = canonical_key;
  end if;

  if result_conversation_id is null then
    raise exception 'Unable to create or locate the direct conversation.';
  end if;

  -- Defensive consistency check. Existing direct chats must contain exactly the
  -- canonical pair represented by direct_key.
  select
    count(*),
    count(*) filter (where cm.user_id in (current_user_id, target_user_id))
    into total_member_count, expected_member_count
  from public.conversation_members cm
  where cm.conversation_id = result_conversation_id;

  if total_member_count <> 2 or expected_member_count <> 2 then
    if created_new then
      raise exception 'Direct conversation membership creation failed.';
    else
      raise exception 'Existing direct conversation membership is inconsistent.';
    end if;
  end if;

  return result_conversation_id;
end;
$$;

revoke all on function public.create_or_get_direct_conversation(uuid) from public, anon;
grant execute on function public.create_or_get_direct_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Conversation list. SECURITY DEFINER is required because profiles remain
-- self-only under table RLS; this RPC exposes only safe peer profile fields.
-- -----------------------------------------------------------------------------

create or replace function public.list_my_conversations(result_limit integer default 50)
returns table (
  conversation_id uuid,
  kind text,
  display_name text,
  username text,
  avatar_path text,
  peer_user_id uuid,
  last_message_preview text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id as conversation_id,
    c.kind,
    case
      when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User')
      else coalesce(c.title, 'Group')
    end as display_name,
    case when c.kind = 'direct' then peer_profile.username else null end as username,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end as avatar_path,
    case when c.kind = 'direct' then peer_member.user_id else null end as peer_user_id,
    case
      when latest_message.id is null then null
      when latest_message.deleted_at is not null then 'Message deleted'
      when latest_message.message_type = 'text' then latest_message.body
      when latest_message.message_type = 'image' then 'Photo'
      when latest_message.message_type = 'video' then 'Video'
      when latest_message.message_type = 'audio' then 'Audio'
      when latest_message.message_type = 'voice' then 'Voice message'
      when latest_message.message_type = 'file' then 'File'
      else 'Message'
    end as last_message_preview,
    latest_message.sender_id as last_message_sender_id,
    latest_message.created_at as last_message_created_at,
    greatest(c.last_message_at, c.created_at) as last_activity_at
  from public.conversation_members self_member
  join public.conversations c
    on c.id = self_member.conversation_id
  left join public.conversation_members peer_member
    on c.kind = 'direct'
   and peer_member.conversation_id = c.id
   and peer_member.user_id <> self_member.user_id
  left join public.profiles peer_profile
    on peer_profile.id = peer_member.user_id
  left join lateral (
    select
      m.id,
      m.sender_id,
      m.message_type,
      m.body,
      m.created_at,
      m.deleted_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest_message on true
  where self_member.user_id = (select auth.uid())
  order by greatest(c.last_message_at, c.created_at) desc, c.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

revoke all on function public.list_my_conversations(integer) from public, anon;
grant execute on function public.list_my_conversations(integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Conversation header/context for a route opened by conversation UUID.
-- The caller must already be a member; no direct_key or private auth data leaks.
-- -----------------------------------------------------------------------------

create or replace function public.get_conversation_summary(target_conversation_id uuid)
returns table (
  conversation_id uuid,
  kind text,
  display_name text,
  username text,
  avatar_path text,
  peer_user_id uuid,
  created_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id as conversation_id,
    c.kind,
    case
      when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User')
      else coalesce(c.title, 'Group')
    end as display_name,
    case when c.kind = 'direct' then peer_profile.username else null end as username,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end as avatar_path,
    case when c.kind = 'direct' then peer_member.user_id else null end as peer_user_id,
    c.created_at,
    greatest(c.last_message_at, c.created_at) as last_activity_at
  from public.conversation_members self_member
  join public.conversations c
    on c.id = self_member.conversation_id
  left join public.conversation_members peer_member
    on c.kind = 'direct'
   and peer_member.conversation_id = c.id
   and peer_member.user_id <> self_member.user_id
  left join public.profiles peer_profile
    on peer_profile.id = peer_member.user_id
  where self_member.user_id = (select auth.uid())
    and c.id = target_conversation_id
  limit 1;
$$;

revoke all on function public.get_conversation_summary(uuid) from public, anon;
grant execute on function public.get_conversation_summary(uuid) to authenticated;

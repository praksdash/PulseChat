-- PulseChat Phase 17: block, report, and privacy controls.
-- Run AFTER 202608160014_phase16_search.sql.
--
-- Security goals:
-- - blocking is enforced server-side for direct messaging, media uploads,
--   realtime typing/presence, discovery, and new direct-chat creation;
-- - reports are write-only to normal clients and remain private for moderation;
-- - privacy settings control directory discovery, new direct-chat requests,
--   and activity visibility without exposing authentication metadata.

-- -----------------------------------------------------------------------------
-- Privacy settings
-- -----------------------------------------------------------------------------

create table if not exists public.user_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discoverable_by_search boolean not null default true,
  allow_new_direct_messages boolean not null default true,
  show_activity_status boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

insert into public.user_privacy_settings (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;

create or replace function pulsechat_private.ensure_privacy_settings_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_privacy_settings_after_profile_insert on public.profiles;
create trigger ensure_privacy_settings_after_profile_insert
after insert on public.profiles
for each row execute function pulsechat_private.ensure_privacy_settings_for_profile();

drop trigger if exists set_user_privacy_settings_updated_at on public.user_privacy_settings;
create trigger set_user_privacy_settings_updated_at
before update on public.user_privacy_settings
for each row execute function pulsechat_private.set_updated_at();

alter table public.user_privacy_settings enable row level security;
revoke all on table public.user_privacy_settings from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Blocks
-- -----------------------------------------------------------------------------

create table if not exists public.blocked_users (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (blocker_id, blocked_user_id),
  constraint blocked_users_no_self_block check (blocker_id <> blocked_user_id)
);

create index if not exists blocked_users_blocked_lookup_idx
  on public.blocked_users (blocked_user_id, blocker_id);

alter table public.blocked_users enable row level security;
revoke all on table public.blocked_users from anon, authenticated;

-- Pair-level helper is deliberately private. It treats a block in either
-- direction as a closed direct-messaging relationship.
create or replace function pulsechat_private.users_are_blocked(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when user_a is null or user_b is null then false
    else exists (
      select 1
      from public.blocked_users b
      where (b.blocker_id = user_a and b.blocked_user_id = user_b)
         or (b.blocker_id = user_b and b.blocked_user_id = user_a)
    )
  end;
$$;

create or replace function pulsechat_private.can_send_in_conversation(
  target_conversation_id uuid,
  actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    join public.conversation_members self_member
      on self_member.conversation_id = c.id
     and self_member.user_id = actor_user_id
    where c.id = target_conversation_id
      and (
        c.kind = 'group'
        or not exists (
          select 1
          from public.conversation_members peer_member
          where peer_member.conversation_id = c.id
            and peer_member.user_id <> actor_user_id
            and pulsechat_private.users_are_blocked(actor_user_id, peer_member.user_id)
        )
      )
  );
$$;

revoke all on function pulsechat_private.users_are_blocked(uuid, uuid) from public, anon, authenticated;
revoke all on function pulsechat_private.can_send_in_conversation(uuid, uuid) from public, anon, authenticated;
grant execute on function pulsechat_private.users_are_blocked(uuid, uuid) to authenticated;
grant execute on function pulsechat_private.can_send_in_conversation(uuid, uuid) to authenticated;

-- A trigger protects all message insertion paths, including SECURITY DEFINER
-- image-message RPCs. RLS alone would not cover those RPCs because their owner
-- may bypass table RLS.
create or replace function pulsechat_private.enforce_direct_block_before_message_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.sender_id is not null
     and not pulsechat_private.can_send_in_conversation(new.conversation_id, new.sender_id) then
    raise exception using errcode = '42501',
      message = 'Direct messaging is unavailable because this relationship is blocked.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_direct_block_before_message_insert on public.messages;
create trigger enforce_direct_block_before_message_insert
before insert on public.messages
for each row execute function pulsechat_private.enforce_direct_block_before_message_insert();

-- Direct client text inserts also include the same explicit check for defense in depth.
drop policy if exists "messages_insert_member_as_self" on public.messages;
create policy "messages_insert_member_as_self"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and message_type = 'text'
  and pulsechat_private.is_conversation_member(conversation_id)
  and pulsechat_private.can_send_in_conversation(conversation_id, (select auth.uid()))
);

-- Keep historical media readable after blocking, but prevent a blocked direct
-- relationship from uploading new media into its chat folder.
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
        or (
          (storage.foldername(target_name))[2] = (select auth.uid())::text
          and pulsechat_private.can_send_in_conversation(cm.conversation_id, (select auth.uid()))
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Reports
-- -----------------------------------------------------------------------------

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null,
  details text,
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint reports_not_self check (reporter_id <> reported_user_id),
  constraint reports_reason_check check (reason in ('spam', 'harassment', 'impersonation', 'sexual_content', 'violence', 'scam', 'other')),
  constraint reports_status_check check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  constraint reports_details_length check (details is null or char_length(details) <= 1000)
);

create index if not exists reports_reported_user_created_idx
  on public.reports (reported_user_id, created_at desc);
create index if not exists reports_status_created_idx
  on public.reports (status, created_at);
create unique index if not exists reports_one_per_message_reporter_idx
  on public.reports (reporter_id, message_id)
  where message_id is not null;
create unique index if not exists reports_one_user_report_reporter_idx
  on public.reports (reporter_id, reported_user_id)
  where message_id is null;

drop trigger if exists set_reports_updated_at on public.reports;
create trigger set_reports_updated_at
before update on public.reports
for each row execute function pulsechat_private.set_updated_at();

alter table public.reports enable row level security;
-- Reports are intentionally not directly selectable/insertable by app clients.
-- Normal users submit through the narrow RPC below; moderation tooling can later
-- use a trusted server/service role.
revoke all on table public.reports from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privacy/block RPCs
-- -----------------------------------------------------------------------------

create or replace function public.get_my_privacy_settings()
returns table (
  discoverable_by_search boolean,
  allow_new_direct_messages boolean,
  show_activity_status boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  insert into public.user_privacy_settings (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  return query
  select s.discoverable_by_search, s.allow_new_direct_messages, s.show_activity_status
  from public.user_privacy_settings s
  where s.user_id = current_user_id;
end;
$$;

create or replace function public.update_my_privacy_settings(
  target_discoverable_by_search boolean,
  target_allow_new_direct_messages boolean,
  target_show_activity_status boolean
)
returns table (
  discoverable_by_search boolean,
  allow_new_direct_messages boolean,
  show_activity_status boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  insert into public.user_privacy_settings (
    user_id, discoverable_by_search, allow_new_direct_messages, show_activity_status
  ) values (
    current_user_id,
    coalesce(target_discoverable_by_search, true),
    coalesce(target_allow_new_direct_messages, true),
    coalesce(target_show_activity_status, true)
  )
  on conflict (user_id) do update set
    discoverable_by_search = excluded.discoverable_by_search,
    allow_new_direct_messages = excluded.allow_new_direct_messages,
    show_activity_status = excluded.show_activity_status;

  return query
  select s.discoverable_by_search, s.allow_new_direct_messages, s.show_activity_status
  from public.user_privacy_settings s
  where s.user_id = current_user_id;
end;
$$;

create or replace function public.get_user_relationship_state(target_user_id uuid)
returns table (
  blocked_by_me boolean,
  has_direct_conversation boolean,
  can_start_direct boolean,
  messaging_available boolean,
  can_view_activity boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  target_exists boolean;
  i_blocked boolean;
  pair_blocked boolean;
  has_direct boolean;
  allow_new boolean;
  activity_visible boolean;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'A different PulseChat user is required.';
  end if;

  select exists (select 1 from public.profiles p where p.id = target_user_id)
    into target_exists;
  if not target_exists then
    raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
  end if;

  select exists (
    select 1 from public.blocked_users b
    where b.blocker_id = current_user_id and b.blocked_user_id = target_user_id
  ) into i_blocked;

  pair_blocked := pulsechat_private.users_are_blocked(current_user_id, target_user_id);

  select exists (
    select 1 from public.conversations c
    where c.kind = 'direct'
      and c.direct_key = pulsechat_private.direct_conversation_key(current_user_id, target_user_id)
      and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c.id and cm.user_id = current_user_id
      )
  ) into has_direct;

  select
    coalesce(s.allow_new_direct_messages, true),
    coalesce(s.show_activity_status, true)
    into allow_new, activity_visible
  from public.profiles p
  left join public.user_privacy_settings s on s.user_id = p.id
  where p.id = target_user_id;

  return query select
    i_blocked,
    has_direct,
    (not pair_blocked and (has_direct or allow_new)),
    (has_direct and not pair_blocked),
    (not pair_blocked and activity_visible and has_direct);
end;
$$;

create or replace function public.block_user(target_user_id uuid)
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
  if target_user_id is null or target_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'You cannot block this user.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
  end if;

  insert into public.blocked_users (blocker_id, blocked_user_id)
  values (current_user_id, target_user_id)
  on conflict (blocker_id, blocked_user_id) do nothing;
end;
$$;

create or replace function public.unblock_user(target_user_id uuid)
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

  delete from public.blocked_users b
  where b.blocker_id = current_user_id
    and b.blocked_user_id = target_user_id;
end;
$$;

create or replace function public.list_my_blocked_users()
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_path text,
  blocked_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.avatar_path, b.created_at
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_user_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc, p.id;
$$;

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
  if normalized_reason not in ('spam', 'harassment', 'impersonation', 'sexual_content', 'violence', 'scam', 'other') then
    raise exception using errcode = '22023', message = 'Choose a valid report reason.';
  end if;
  if normalized_details is not null and char_length(normalized_details) > 1000 then
    raise exception using errcode = '22001', message = 'Report details can contain at most 1000 characters.';
  end if;

  if target_message_id is not null then
    select m.sender_id, m.conversation_id
      into resolved_user_id, resolved_conversation_id
    from public.messages m
    where m.id = target_message_id
      and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = m.conversation_id
          and cm.user_id = current_user_id
      );

    if resolved_user_id is null then
      raise exception using errcode = 'P0002', message = 'This message is unavailable for reporting.';
    end if;
    if target_user_id is not null and target_user_id <> resolved_user_id then
      raise exception using errcode = '22023', message = 'Reported user does not match the message sender.';
    end if;
  else
    if resolved_user_id is null
       or not exists (select 1 from public.profiles p where p.id = resolved_user_id) then
      raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
    end if;
  end if;

  if resolved_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'You cannot report yourself or your own message.';
  end if;

  if target_message_id is not null then
    select r.id into existing_report_id
    from public.reports r
    where r.reporter_id = current_user_id and r.message_id = target_message_id
    limit 1;
  else
    select r.id into existing_report_id
    from public.reports r
    where r.reporter_id = current_user_id
      and r.reported_user_id = resolved_user_id
      and r.message_id is null
    limit 1;
  end if;

  if existing_report_id is not null then
    return existing_report_id;
  end if;

  insert into public.reports (
    reporter_id, reported_user_id, conversation_id, message_id, reason, details
  ) values (
    current_user_id, resolved_user_id, resolved_conversation_id,
    target_message_id, normalized_reason, normalized_details
  ) returning id into result_id;

  return result_id;
end;
$$;

revoke all on function public.get_my_privacy_settings() from public, anon;
revoke all on function public.update_my_privacy_settings(boolean, boolean, boolean) from public, anon;
revoke all on function public.get_user_relationship_state(uuid) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.unblock_user(uuid) from public, anon;
revoke all on function public.list_my_blocked_users() from public, anon;
revoke all on function public.report_user_or_message(uuid, text, text, uuid) from public, anon;

grant execute on function public.get_my_privacy_settings() to authenticated;
grant execute on function public.update_my_privacy_settings(boolean, boolean, boolean) to authenticated;
grant execute on function public.get_user_relationship_state(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.list_my_blocked_users() to authenticated;
grant execute on function public.report_user_or_message(uuid, text, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Override discovery and direct-chat creation with Phase 17 privacy rules.
-- -----------------------------------------------------------------------------

create or replace function public.search_profiles(
  search_term text,
  result_limit integer default 20
)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  bio text
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
  if current_user_id is null then return; end if;
  needle := lower(btrim(coalesce(search_term, '')));
  if char_length(needle) < 2 then return; end if;
  needle := left(needle, 50);
  safe_limit := least(greatest(coalesce(result_limit, 20), 1), 20);
  escaped_needle := replace(needle, E'\\', E'\\\\');
  escaped_needle := replace(escaped_needle, '%', E'\\%');
  escaped_needle := replace(escaped_needle, '_', E'\\_');

  return query
  select p.id, p.display_name, p.username, p.avatar_path, p.bio
  from public.profiles p
  left join public.user_privacy_settings privacy on privacy.user_id = p.id
  where p.id <> current_user_id
    and coalesce(privacy.discoverable_by_search, true)
    and not pulsechat_private.users_are_blocked(current_user_id, p.id)
    and (
      lower(p.display_name) like ('%' || escaped_needle || '%') escape E'\\'
      or lower(coalesce(p.username, '')) like ('%' || escaped_needle || '%') escape E'\\'
    )
  order by
    case
      when lower(coalesce(p.username, '')) = needle then 0
      when lower(p.display_name) = needle then 1
      when lower(coalesce(p.username, '')) like (escaped_needle || '%') escape E'\\' then 2
      when lower(p.display_name) like (escaped_needle || '%') escape E'\\' then 3
      else 4
    end,
    lower(p.display_name), p.id
  limit safe_limit;
end;
$$;

create or replace function public.get_public_profile(target_user_id uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  bio text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.username, p.avatar_path, p.bio
  from public.profiles p
  left join public.user_privacy_settings privacy on privacy.user_id = p.id
  where (select auth.uid()) is not null
    and p.id = target_user_id
    and (
      p.id = (select auth.uid())
      or coalesce(privacy.discoverable_by_search, true)
      or exists (
        select 1
        from public.conversation_members me
        join public.conversation_members them
          on them.conversation_id = me.conversation_id
         and them.user_id = p.id
        where me.user_id = (select auth.uid())
      )
      or pulsechat_private.users_are_blocked((select auth.uid()), p.id)
    )
  limit 1;
$$;

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
  target_accepts_new boolean := true;
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
  if not exists (select 1 from public.profiles p where p.id = target_user_id) then
    raise exception using errcode = 'P0002', message = 'PulseChat user not found.';
  end if;

  canonical_key := pulsechat_private.direct_conversation_key(current_user_id, target_user_id);

  select c.id into result_conversation_id
  from public.conversations c
  where c.kind = 'direct' and c.direct_key = canonical_key
  limit 1;

  if pulsechat_private.users_are_blocked(current_user_id, target_user_id) then
    raise exception using errcode = '42501', message = 'Direct messaging is unavailable for this user.';
  end if;

  if result_conversation_id is null then
    select coalesce(s.allow_new_direct_messages, true)
      into target_accepts_new
    from public.profiles p
    left join public.user_privacy_settings s on s.user_id = p.id
    where p.id = target_user_id;

    if not target_accepts_new then
      raise exception using errcode = '42501', message = 'This user is not accepting new direct chats.';
    end if;

    insert into public.conversations (kind, direct_key, created_by)
    values ('direct', canonical_key, current_user_id)
    on conflict (direct_key) where direct_key is not null do nothing
    returning id into result_conversation_id;

    if result_conversation_id is not null then
      created_new := true;
      insert into public.conversation_members (conversation_id, user_id, role)
      values
        (result_conversation_id, current_user_id, 'member'),
        (result_conversation_id, target_user_id, 'member');
    else
      select c.id into result_conversation_id
      from public.conversations c
      where c.kind = 'direct' and c.direct_key = canonical_key;
    end if;
  end if;

  if result_conversation_id is null then
    raise exception 'Unable to create or locate the direct conversation.';
  end if;

  select count(*), count(*) filter (where cm.user_id in (current_user_id, target_user_id))
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

-- -----------------------------------------------------------------------------
-- Presence / typing / conversation broadcast privacy.
-- -----------------------------------------------------------------------------

create or replace function public.get_user_last_seen(target_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result_last_seen timestamptz;
begin
  if current_user_id is null then return null; end if;
  if target_user_id = current_user_id then
    select up.last_seen_at into result_last_seen
    from public.user_presence up where up.user_id = target_user_id;
    return result_last_seen;
  end if;

  if pulsechat_private.users_are_blocked(current_user_id, target_user_id) then return null; end if;
  if not exists (
    select 1
    from public.conversation_members me
    join public.conversation_members them on them.conversation_id = me.conversation_id
    where me.user_id = current_user_id and them.user_id = target_user_id
  ) then return null; end if;
  if not coalesce((
    select s.show_activity_status from public.user_privacy_settings s where s.user_id = target_user_id
  ), true) then return null; end if;

  select up.last_seen_at into result_last_seen
  from public.user_presence up where up.user_id = target_user_id;
  return result_last_seen;
end;
$$;

create or replace function pulsechat_private.can_observe_user_presence(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_topic = 'presence:' || (select auth.uid())::text
    or exists (
      select 1
      from public.conversation_members self_member
      join public.conversation_members peer_member
        on peer_member.conversation_id = self_member.conversation_id
       and peer_member.user_id <> self_member.user_id
      left join public.user_privacy_settings peer_privacy on peer_privacy.user_id = peer_member.user_id
      where self_member.user_id = (select auth.uid())
        and target_topic = 'presence:' || peer_member.user_id::text
        and coalesce(peer_privacy.show_activity_status, true)
        and not pulsechat_private.users_are_blocked(self_member.user_id, peer_member.user_id)
    );
$$;

create or replace function pulsechat_private.can_receive_conversation_broadcast(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.user_id = (select auth.uid())
      and target_topic = 'conversation:' || cm.conversation_id::text
      and (
        c.kind = 'group'
        or pulsechat_private.can_send_in_conversation(c.id, cm.user_id)
      )
  );
$$;

create or replace function pulsechat_private.can_access_typing_topic(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.user_id = (select auth.uid())
      and target_topic = 'typing:' || cm.conversation_id::text
      and (
        c.kind = 'group'
        or pulsechat_private.can_send_in_conversation(c.id, cm.user_id)
      )
  );
$$;

-- Re-assert grants after CREATE OR REPLACE for private helpers used by Realtime RLS.
revoke all on function pulsechat_private.can_observe_user_presence(text) from public, anon, authenticated;
revoke all on function pulsechat_private.can_receive_conversation_broadcast(text) from public, anon, authenticated;
revoke all on function pulsechat_private.can_access_typing_topic(text) from public, anon, authenticated;
grant execute on function pulsechat_private.can_observe_user_presence(text) to authenticated;
grant execute on function pulsechat_private.can_receive_conversation_broadcast(text) to authenticated;
grant execute on function pulsechat_private.can_access_typing_topic(text) to authenticated;

comment on table public.user_privacy_settings is 'Phase 17 per-user discovery, new-DM, and activity visibility preferences.';
comment on table public.blocked_users is 'Phase 17 directional user blocks; a block in either direction closes direct messaging.';
comment on table public.reports is 'Phase 17 private moderation reports. App clients submit via report_user_or_message and cannot browse the table.';

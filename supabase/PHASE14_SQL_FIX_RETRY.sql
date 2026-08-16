-- PulseChat Phase 14: group chats, membership administration, group avatars,
-- sender identity in group message projections, and group-aware chat summaries.
-- Run AFTER 202608150011_phase13_message_actions.sql.

-- -----------------------------------------------------------------------------
-- Group authorization helpers
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.group_role(target_conversation_id uuid, target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select cm.role
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  where cm.conversation_id = target_conversation_id
    and cm.user_id = target_user_id
    and c.kind = 'group'
  limit 1;
$$;

create or replace function pulsechat_private.group_member_count(target_conversation_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(count(*), 2147483647)::integer
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id
  where cm.conversation_id = target_conversation_id
    and c.kind = 'group';
$$;

create or replace function pulsechat_private.safe_group_event(
  target_user_id uuid,
  target_conversation_id uuid,
  target_event text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  begin
    perform realtime.send(
      jsonb_build_object(
        'conversation_id', target_conversation_id,
        'change_type', target_event
      ),
      'group_membership_changed',
      'user:' || target_user_id::text,
      true
    );
  exception when others then
    -- Durable group mutations must not fail only because Realtime is unavailable.
    null;
  end;
end;
$$;

revoke all on function pulsechat_private.group_role(uuid, uuid) from public, anon, authenticated;
revoke all on function pulsechat_private.group_member_count(uuid) from public, anon, authenticated;
revoke all on function pulsechat_private.safe_group_event(uuid, uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Create a group. The creator is always owner. Supplied members are deduplicated
-- and must be valid PulseChat profiles. Maximum prototype group size = 100.
-- -----------------------------------------------------------------------------

create or replace function public.create_group_conversation(
  group_title text,
  member_user_ids uuid[] default '{}'::uuid[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  normalized_title text := btrim(coalesce(group_title, ''));
  normalized_members uuid[];
  target_conversation_id uuid;
  candidate_count integer;
  valid_count integer;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if char_length(normalized_title) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Group name must contain 1 to 100 characters.';
  end if;

  select coalesce(array_agg(distinct candidate order by candidate), '{}'::uuid[])
    into normalized_members
  from unnest(coalesce(member_user_ids, '{}'::uuid[])) as u(candidate)
  where candidate is not null
    and candidate <> current_user_id;

  candidate_count := coalesce(array_length(normalized_members, 1), 0);
  if candidate_count < 1 then
    raise exception using errcode = '22023', message = 'Select at least one other member.';
  end if;

  if candidate_count > 99 then
    raise exception using errcode = '22023', message = 'A group can contain at most 100 members.';
  end if;

  select count(*)::integer into valid_count
  from public.profiles p
  where p.id = any(normalized_members);

  if valid_count <> candidate_count then
    raise exception using errcode = '22023', message = 'One or more selected users are unavailable.';
  end if;

  insert into public.conversations (kind, title, created_by)
  values ('group', normalized_title, current_user_id)
  returning id into target_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (target_conversation_id, current_user_id, 'owner');

  insert into public.conversation_members (conversation_id, user_id, role)
  select target_conversation_id, member_id_value, 'member'
  from unnest(normalized_members) as u(member_id_value);

  perform pulsechat_private.safe_group_event(current_user_id, target_conversation_id, 'created');
  foreach member_id in array normalized_members loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'added');
  end loop;

  return target_conversation_id;
end;
$$;

revoke all on function public.create_group_conversation(text, uuid[]) from public, anon;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Group member projection. Only current members can enumerate the group.
-- -----------------------------------------------------------------------------

create or replace function public.list_group_members(target_conversation_id uuid)
returns table (
  user_id uuid,
  display_name text,
  username text,
  avatar_path text,
  role text,
  joined_at timestamptz,
  is_self boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    cm.user_id,
    coalesce(p.display_name, 'PulseChat User') as display_name,
    p.username,
    p.avatar_path,
    cm.role,
    cm.joined_at,
    cm.user_id = (select auth.uid()) as is_self
  from public.conversation_members cm
  join public.conversations c on c.id = cm.conversation_id and c.kind = 'group'
  left join public.profiles p on p.id = cm.user_id
  where cm.conversation_id = target_conversation_id
    and exists (
      select 1
      from public.conversation_members self_member
      where self_member.conversation_id = target_conversation_id
        and self_member.user_id = (select auth.uid())
    )
  order by
    case cm.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    lower(coalesce(p.display_name, '')),
    cm.joined_at;
$$;

revoke all on function public.list_group_members(uuid) from public, anon;
grant execute on function public.list_group_members(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Add members. Admin/owner only. Existing members are ignored idempotently.
-- -----------------------------------------------------------------------------

create or replace function public.add_group_members(
  target_conversation_id uuid,
  new_user_ids uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_group_role text;
  candidates uuid[];
  candidate_count integer;
  valid_count integer;
  existing_count integer;
  inserted_count integer := 0;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  if actor_group_role is null or actor_group_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only group admins can add members.';
  end if;

  select coalesce(array_agg(distinct candidate order by candidate), '{}'::uuid[])
    into candidates
  from unnest(coalesce(new_user_ids, '{}'::uuid[])) as u(candidate)
  where candidate is not null
    and candidate <> current_user_id
    and not exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = target_conversation_id
        and cm.user_id = candidate
    );

  candidate_count := coalesce(array_length(candidates, 1), 0);
  if candidate_count = 0 then return 0; end if;

  existing_count := pulsechat_private.group_member_count(target_conversation_id);
  if existing_count + candidate_count > 100 then
    raise exception using errcode = '22023', message = 'A group can contain at most 100 members.';
  end if;

  select count(*)::integer into valid_count
  from public.profiles p
  where p.id = any(candidates);

  if valid_count <> candidate_count then
    raise exception using errcode = '22023', message = 'One or more selected users are unavailable.';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select target_conversation_id, candidate, 'member'
  from unnest(candidates) as u(candidate)
  on conflict (conversation_id, user_id) do nothing;

  get diagnostics inserted_count = row_count;

  foreach member_id in array candidates loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'added');
  end loop;

  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'members_updated');
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.add_group_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- Remove members. Owner can remove admin/member. Admin can remove member only.
-- Removed recipients are dropped from historical receipt aggregates so sender
-- ticks reflect the current group membership instead of waiting forever.
-- -----------------------------------------------------------------------------

create or replace function public.remove_group_member(
  target_conversation_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_group_role text;
  target_role text;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'Use Leave group to remove yourself.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  target_role := pulsechat_private.group_role(target_conversation_id, target_user_id);

  if actor_group_role is null or actor_group_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only group admins can remove members.';
  end if;

  if target_role is null then return; end if;
  if target_role = 'owner' then
    raise exception using errcode = '42501', message = 'The group owner cannot be removed.';
  end if;
  if actor_group_role = 'admin' and target_role <> 'member' then
    raise exception using errcode = '42501', message = 'Admins can remove regular members only.';
  end if;

  delete from public.message_receipts r
  using public.messages m
  where r.message_id = m.id
    and m.conversation_id = target_conversation_id
    and r.user_id = target_user_id;

  delete from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.user_id = target_user_id;

  perform pulsechat_private.safe_group_event(target_user_id, target_conversation_id, 'removed');
  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'members_updated');
  end loop;
end;
$$;

revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- Owner-only promotion/demotion. Ownership is transferred by a separate RPC.
create or replace function public.set_group_member_role(
  target_conversation_id uuid,
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_group_role text;
  existing_role text;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  if actor_group_role <> 'owner' then
    raise exception using errcode = '42501', message = 'Only the group owner can change admin roles.';
  end if;

  if target_user_id = current_user_id then
    raise exception using errcode = '22023', message = 'The owner role cannot be changed here.';
  end if;

  if target_role is null or target_role not in ('member', 'admin') then
    raise exception using errcode = '22023', message = 'Role must be member or admin.';
  end if;

  existing_role := pulsechat_private.group_role(target_conversation_id, target_user_id);
  if existing_role is null then
    raise exception using errcode = '22023', message = 'This user is not a group member.';
  end if;
  if existing_role = 'owner' then
    raise exception using errcode = '22023', message = 'Use ownership transfer instead.';
  end if;

  update public.conversation_members cm
  set role = target_role
  where cm.conversation_id = target_conversation_id
    and cm.user_id = target_user_id;

  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'roles_updated');
  end loop;
end;
$$;

revoke all on function public.set_group_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_group_member_role(uuid, uuid, text) to authenticated;

create or replace function public.transfer_group_ownership(
  target_conversation_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_group_role text;
  target_role text;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  target_role := pulsechat_private.group_role(target_conversation_id, target_user_id);

  if actor_group_role <> 'owner' then
    raise exception using errcode = '42501', message = 'Only the current owner can transfer ownership.';
  end if;
  if target_user_id = current_user_id or target_role is null or target_role not in ('member', 'admin') then
    raise exception using errcode = '22023', message = 'Choose another current group member.';
  end if;

  update public.conversation_members
  set role = case
    when user_id = current_user_id then 'admin'
    when user_id = target_user_id then 'owner'
    else role
  end
  where conversation_id = target_conversation_id
    and user_id in (current_user_id, target_user_id);

  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'ownership_transferred');
  end loop;
end;
$$;

revoke all on function public.transfer_group_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_group_ownership(uuid, uuid) to authenticated;

create or replace function public.leave_group_conversation(target_conversation_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  actor_group_role text;
  remaining_count integer;
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  if actor_group_role is null then return; end if;

  remaining_count := pulsechat_private.group_member_count(target_conversation_id) - 1;
  if actor_group_role = 'owner' and remaining_count > 0 then
    raise exception using errcode = '22023', message = 'Transfer ownership before leaving the group.';
  end if;

  if actor_group_role = 'owner' and remaining_count = 0 then
    delete from public.conversations c where c.id = target_conversation_id and c.kind = 'group';
    return;
  end if;

  delete from public.message_receipts r
  using public.messages m
  where r.message_id = m.id
    and m.conversation_id = target_conversation_id
    and r.user_id = current_user_id;

  delete from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.user_id = current_user_id;

  perform pulsechat_private.safe_group_event(current_user_id, target_conversation_id, 'left');
  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'members_updated');
  end loop;
end;
$$;

revoke all on function public.leave_group_conversation(uuid) from public, anon;
grant execute on function public.leave_group_conversation(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Group metadata + avatar storage
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('group-avatars', 'group-avatars', true, 5242880, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function pulsechat_private.can_manage_group_avatar(target_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_conversation_id uuid;
begin
  begin
    target_conversation_id := split_part(target_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;

  return exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = target_conversation_id
      and c.kind = 'group'
      and cm.user_id = (select auth.uid())
      and cm.role in ('owner', 'admin')
  );
end;
$$;

revoke all on function pulsechat_private.can_manage_group_avatar(text) from public, anon, authenticated;
grant execute on function pulsechat_private.can_manage_group_avatar(text) to authenticated;

drop policy if exists "pulsechat_group_admin_upload_avatar" on storage.objects;
create policy "pulsechat_group_admin_upload_avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-avatars'
  and pulsechat_private.can_manage_group_avatar(name)
);

drop policy if exists "pulsechat_group_admin_update_avatar" on storage.objects;
create policy "pulsechat_group_admin_update_avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'group-avatars'
  and pulsechat_private.can_manage_group_avatar(name)
)
with check (
  bucket_id = 'group-avatars'
  and pulsechat_private.can_manage_group_avatar(name)
);

drop policy if exists "pulsechat_group_admin_delete_avatar" on storage.objects;
create policy "pulsechat_group_admin_delete_avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'group-avatars'
  and pulsechat_private.can_manage_group_avatar(name)
);

create or replace function public.update_group_profile(
  target_conversation_id uuid,
  target_title text,
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
  actor_group_role text;
  normalized_title text := btrim(coalesce(target_title, ''));
  member_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  actor_group_role := pulsechat_private.group_role(target_conversation_id, current_user_id);
  if actor_group_role is null or actor_group_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only group admins can edit group details.';
  end if;

  if char_length(normalized_title) not between 1 and 100 then
    raise exception using errcode = '22023', message = 'Group name must contain 1 to 100 characters.';
  end if;

  if target_avatar_path is not null
     and target_avatar_path not like target_conversation_id::text || '/%' then
    raise exception using errcode = '22023', message = 'Invalid group avatar path.';
  end if;

  update public.conversations c
  set title = normalized_title,
      avatar_path = target_avatar_path
  where c.id = target_conversation_id
    and c.kind = 'group';

  if not found then
    raise exception using errcode = '22023', message = 'Group not found.';
  end if;

  begin
    perform realtime.send(
      jsonb_build_object('conversation_id', target_conversation_id),
      'group_updated',
      'conversation:' || target_conversation_id::text,
      true
    );
  exception when others then null;
  end;

  for member_id in
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
  loop
    perform pulsechat_private.safe_group_event(member_id, target_conversation_id, 'group_updated');
  end loop;
end;
$$;

revoke all on function public.update_group_profile(uuid, text, text) from public, anon;
grant execute on function public.update_group_profile(uuid, text, text) to authenticated;

-- Group metadata mutations now go only through update_group_profile(), which
-- validates both role and avatar path. RLS remains defense in depth.
revoke update (title, avatar_path) on table public.conversations from authenticated;

-- -----------------------------------------------------------------------------
-- Chats list and conversation header become fully group-aware.
-- -----------------------------------------------------------------------------

drop function if exists public.list_my_conversations(integer);
create function public.list_my_conversations(result_limit integer default 50)
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
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    case when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User') else coalesce(c.title, 'Group') end,
    case when c.kind = 'direct' then peer_profile.username else null end,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end,
    case when c.kind = 'direct' then peer_member.user_id else null end,
    member_state.member_count,
    self_member.role,
    case
      when latest_message.id is null then null
      when latest_message.deleted_at is not null then 'Message deleted'
      when latest_message.message_type = 'text' then latest_message.body
      when latest_message.message_type = 'image' then case when nullif(btrim(coalesce(latest_message.body, '')), '') is null then 'Photo' else 'Photo · ' || latest_message.body end
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
    on c.kind = 'direct' and peer_member.conversation_id = c.id and peer_member.user_id <> self_member.user_id
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
  where self_member.user_id = (select auth.uid())
  order by greatest(c.last_message_at, c.created_at) desc, c.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

revoke all on function public.list_my_conversations(integer) from public, anon;
grant execute on function public.list_my_conversations(integer) to authenticated;

drop function if exists public.get_conversation_summary(uuid);
create function public.get_conversation_summary(target_conversation_id uuid)
returns table (
  conversation_id uuid,
  kind text,
  display_name text,
  username text,
  avatar_path text,
  peer_user_id uuid,
  member_count integer,
  my_role text,
  created_at timestamptz,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    case when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User') else coalesce(c.title, 'Group') end,
    case when c.kind = 'direct' then peer_profile.username else null end,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end,
    case when c.kind = 'direct' then peer_member.user_id else null end,
    member_state.member_count,
    self_member.role,
    c.created_at,
    greatest(c.last_message_at, c.created_at)
  from public.conversation_members self_member
  join public.conversations c on c.id = self_member.conversation_id
  left join public.conversation_members peer_member
    on c.kind = 'direct' and peer_member.conversation_id = c.id and peer_member.user_id <> self_member.user_id
  left join public.profiles peer_profile on peer_profile.id = peer_member.user_id
  left join lateral (
    select count(*)::integer as member_count
    from public.conversation_members group_member
    where group_member.conversation_id = c.id
  ) member_state on true
  where self_member.user_id = (select auth.uid())
    and c.id = target_conversation_id
  limit 1;
$$;

revoke all on function public.get_conversation_summary(uuid) from public, anon;
grant execute on function public.get_conversation_summary(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Group message projection includes sender identity and reply-sender identity.
-- SECURITY DEFINER is safe here because membership is explicitly required.
-- -----------------------------------------------------------------------------

-- Drop the image RPC before replacing get_message_detail so PostgreSQL cannot
-- retain a dependency on the older projection signature.
drop function if exists public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
);

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
  left join public.profiles sender_profile on sender_profile.id = m.sender_id
  left join lateral (
    select count(*)::integer recipient_count,
           count(*) filter (where r.delivered_at is not null)::integer delivered_count,
           count(*) filter (where r.read_at is not null)::integer read_count
    from public.message_receipts r where r.message_id = m.id
  ) receipt_state on true
  left join lateral (
    select a.* from public.attachments a
    where a.message_id = m.id
    order by a.created_at asc, a.id asc limit 1
  ) attachment on true
  left join public.messages reply_message
    on reply_message.id = m.reply_to_message_id and reply_message.conversation_id = m.conversation_id
  left join public.profiles reply_profile on reply_profile.id = reply_message.sender_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count)
      order by grouped.reaction_count desc, grouped.emoji asc) counts
    from (
      select r.emoji, count(*)::integer reaction_count
      from public.message_reactions r where r.message_id = m.id group by r.emoji
    ) grouped
  ) reaction_state on true
  left join public.message_reactions my_reaction
    on my_reaction.message_id = m.id and my_reaction.user_id = (select auth.uid())
  where m.conversation_id = target_conversation_id
    and exists (
      select 1 from public.conversation_members access_member
      where access_member.conversation_id = target_conversation_id
        and access_member.user_id = (select auth.uid())
    )
    and (
      before_created_at is null
      or m.created_at < before_created_at
      or (m.created_at = before_created_at and before_id is not null and m.id < before_id)
    )
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(result_limit, 30), 1), 50);
$$;

revoke all on function public.list_conversation_messages(uuid, timestamptz, uuid, integer) from public, anon;
grant execute on function public.list_conversation_messages(uuid, timestamptz, uuid, integer) to authenticated;

drop function if exists public.get_message_detail(uuid);
create function public.get_message_detail(target_message_id uuid)
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
  left join public.profiles sender_profile on sender_profile.id = m.sender_id
  left join lateral (
    select count(*)::integer recipient_count,
           count(*) filter (where r.delivered_at is not null)::integer delivered_count,
           count(*) filter (where r.read_at is not null)::integer read_count
    from public.message_receipts r where r.message_id = m.id
  ) receipt_state on true
  left join lateral (
    select a.* from public.attachments a
    where a.message_id = m.id
    order by a.created_at asc, a.id asc limit 1
  ) attachment on true
  left join public.messages reply_message
    on reply_message.id = m.reply_to_message_id and reply_message.conversation_id = m.conversation_id
  left join public.profiles reply_profile on reply_profile.id = reply_message.sender_id
  left join lateral (
    select jsonb_agg(jsonb_build_object('emoji', grouped.emoji, 'count', grouped.reaction_count)
      order by grouped.reaction_count desc, grouped.emoji asc) counts
    from (
      select r.emoji, count(*)::integer reaction_count
      from public.message_reactions r where r.message_id = m.id group by r.emoji
    ) grouped
  ) reaction_state on true
  left join public.message_reactions my_reaction
    on my_reaction.message_id = m.id and my_reaction.user_id = (select auth.uid())
  where m.id = target_message_id
    and exists (
      select 1 from public.conversation_members access_member
      where access_member.conversation_id = m.conversation_id
        and access_member.user_id = (select auth.uid())
    )
  limit 1;
$$;

revoke all on function public.get_message_detail(uuid) from public, anon;
grant execute on function public.get_message_detail(uuid) to authenticated;

comment on function public.create_group_conversation(text, uuid[]) is 'Phase 14: creates a group with caller as owner and selected members.';
comment on function public.list_group_members(uuid) is 'Phase 14: safe member projection for current group members.';

-- Keep the Phase 13 image creation RPC aligned with the expanded Phase 14
-- get_message_detail projection (sender/reply-sender identity included).
drop function if exists public.create_image_message(
  uuid, uuid, text, text, bigint, integer, integer, text, uuid
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
  saved_message public.messages%rowtype;
  saved_attachment public.attachments%rowtype;
  normalized_caption text := nullif(btrim(coalesce(target_caption, '')), '');
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if not exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = target_conversation_id and cm.user_id = current_user_id
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
    select m.* into saved_message from public.messages m
    where m.sender_id = current_user_id and m.client_message_id = target_client_message_id;
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
    select a.* into saved_attachment from public.attachments a
    where a.storage_bucket = 'chat-media' and a.storage_path = target_storage_path;
  end if;

  if saved_attachment.id is null or saved_attachment.message_id <> saved_message.id then
    raise exception using errcode = '23505', message = 'Chat-media object is already attached to another message.';
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

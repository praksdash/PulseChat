-- PulseChat Phase 11
-- Online/offline presence, durable last-seen heartbeat, and typing Broadcast.

-- -----------------------------------------------------------------------------
-- Durable last seen. Online/offline itself remains ephemeral Realtime Presence.
-- -----------------------------------------------------------------------------

create table if not exists public.user_presence (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.user_presence enable row level security;

-- Presence is intentionally accessed through narrow RPCs only. Do not expose a
-- queryable directory of activity timestamps to the mobile client.
revoke all on table public.user_presence from anon, authenticated;

insert into public.user_presence (user_id, last_seen_at, updated_at)
select p.id, greatest(p.updated_at, p.created_at), greatest(p.updated_at, p.created_at)
from public.profiles p
on conflict (user_id) do nothing;

create or replace function public.touch_my_last_seen()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  event_time timestamptz := timezone('utc'::text, now());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  insert into public.user_presence (user_id, last_seen_at, updated_at)
  values (current_user_id, event_time, event_time)
  on conflict (user_id) do update
    set last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at;

  return event_time;
end;
$$;

revoke all on function public.touch_my_last_seen() from public, anon;
grant execute on function public.touch_my_last_seen() to authenticated;

create or replace function public.get_user_last_seen(target_user_id uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  result_value timestamptz;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_user_id is null then
    return null;
  end if;

  -- Users can inspect their own last-seen value or that of someone with whom
  -- they currently share at least one conversation.
  if target_user_id <> current_user_id and not exists (
    select 1
    from public.conversation_members self_member
    join public.conversation_members peer_member
      on peer_member.conversation_id = self_member.conversation_id
    where self_member.user_id = current_user_id
      and peer_member.user_id = target_user_id
  ) then
    raise exception using errcode = '42501', message = 'Presence access denied.';
  end if;

  select up.last_seen_at
    into result_value
  from public.user_presence up
  where up.user_id = target_user_id;

  return result_value;
end;
$$;

revoke all on function public.get_user_last_seen(uuid) from public, anon;
grant execute on function public.get_user_last_seen(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime Authorization helpers.
-- presence:<user uuid>  -> slow-changing online/offline Presence
-- typing:<conversation uuid> -> ephemeral typing Broadcast
-- -----------------------------------------------------------------------------

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
      where self_member.user_id = (select auth.uid())
        and peer_member.user_id <> self_member.user_id
        and target_topic = 'presence:' || peer_member.user_id::text
    );
$$;

create or replace function pulsechat_private.can_publish_own_presence(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and target_topic = 'presence:' || (select auth.uid())::text;
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
    where cm.user_id = (select auth.uid())
      and target_topic = 'typing:' || cm.conversation_id::text
  );
$$;

revoke all on function pulsechat_private.can_observe_user_presence(text)
  from public, anon, authenticated;
revoke all on function pulsechat_private.can_publish_own_presence(text)
  from public, anon, authenticated;
revoke all on function pulsechat_private.can_access_typing_topic(text)
  from public, anon, authenticated;

grant execute on function pulsechat_private.can_observe_user_presence(text) to authenticated;
grant execute on function pulsechat_private.can_publish_own_presence(text) to authenticated;
grant execute on function pulsechat_private.can_access_typing_topic(text) to authenticated;

-- Presence read: owner and users sharing a conversation may observe the topic.
drop policy if exists "pulsechat_users_receive_presence" on realtime.messages;
create policy "pulsechat_users_receive_presence"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'presence'
  and pulsechat_private.can_observe_user_presence((select realtime.topic()))
);

-- Presence write: a client may track only its own user presence topic.
drop policy if exists "pulsechat_users_publish_own_presence" on realtime.messages;
create policy "pulsechat_users_publish_own_presence"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'presence'
  and pulsechat_private.can_publish_own_presence((select realtime.topic()))
);

-- Typing read/write: only conversation members. We keep typing on a separate
-- topic from durable message/receipt Broadcasts so client-generated events
-- cannot impersonate database-originated message events.
drop policy if exists "pulsechat_members_receive_typing" on realtime.messages;
create policy "pulsechat_members_receive_typing"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and pulsechat_private.can_access_typing_topic((select realtime.topic()))
);

drop policy if exists "pulsechat_members_send_typing" on realtime.messages;
create policy "pulsechat_members_send_typing"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and pulsechat_private.can_access_typing_topic((select realtime.topic()))
);

comment on table public.user_presence
  is 'Phase 11 durable last-seen heartbeat. Online state itself is Realtime Presence.';
comment on function public.touch_my_last_seen()
  is 'Phase 11 monotonic self-only last-seen heartbeat.';
comment on function public.get_user_last_seen(uuid)
  is 'Phase 11 returns last seen only for self or users sharing a conversation.';

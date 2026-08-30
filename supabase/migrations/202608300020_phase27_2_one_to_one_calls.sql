-- PulseChat Phase 27.2: one-to-one call-session schema and RLS.
-- Run AFTER 202608290019_phase26_observability.sql.
--
-- This migration creates durable authorization/state metadata only. It does
-- not add a client-call RPC, LiveKit token issuance, Realtime publication,
-- push signaling, media storage, or Android calling code.

-- -----------------------------------------------------------------------------
-- Call sessions
-- -----------------------------------------------------------------------------

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_user_id uuid not null references auth.users(id) on delete cascade,
  callee_user_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null default 'voice',
  status text not null default 'ringing',
  ring_expires_at timestamptz not null
    default (timezone('utc'::text, now()) + interval '45 seconds'),
  answered_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  ended_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  version bigint not null default 1,
  constraint call_sessions_two_people_check
    check (caller_user_id <> callee_user_id),
  constraint call_sessions_type_check
    check (call_type in ('voice', 'video')),
  constraint call_sessions_status_check
    check (status in (
      'ringing', 'accepted', 'active', 'declined', 'cancelled',
      'missed', 'ended', 'failed'
    )),
  constraint call_sessions_ring_expiry_check
    check (
      ring_expires_at >= created_at + interval '15 seconds'
      and ring_expires_at <= created_at + interval '2 minutes'
    ),
  constraint call_sessions_timestamp_order_check
    check (
      (answered_at is null or answered_at >= created_at)
      and (connected_at is null or (answered_at is not null and connected_at >= answered_at))
      and (ended_at is null or ended_at >= created_at)
    ),
  constraint call_sessions_ended_by_party_check
    check (
      ended_by_user_id is null
      or ended_by_user_id = caller_user_id
      or ended_by_user_id = callee_user_id
    ),
  constraint call_sessions_version_check
    check (version >= 1),
  constraint call_sessions_status_shape_check
    check (
      case status
        when 'ringing' then
          answered_at is null and connected_at is null and ended_at is null
        when 'accepted' then
          answered_at is not null and connected_at is null and ended_at is null
        when 'active' then
          answered_at is not null and connected_at is not null and ended_at is null
        when 'declined' then
          answered_at is null and connected_at is null and ended_at is not null
        when 'cancelled' then
          answered_at is null and connected_at is null and ended_at is not null
        when 'missed' then
          answered_at is null and connected_at is null and ended_at is not null
        when 'ended' then
          answered_at is not null and ended_at is not null
        when 'failed' then
          ended_at is not null
        else false
      end
    )
);

create index if not exists call_sessions_conversation_created_idx
  on public.call_sessions (conversation_id, created_at desc, id desc);

create index if not exists call_sessions_caller_created_idx
  on public.call_sessions (caller_user_id, created_at desc, id desc);

create index if not exists call_sessions_callee_created_idx
  on public.call_sessions (callee_user_id, created_at desc, id desc);

create index if not exists call_sessions_ringing_expiry_idx
  on public.call_sessions (ring_expires_at, id)
  where status = 'ringing';

-- Only one unfinished call may exist for the same direct conversation. A
-- later caller-bound RPC will also serialize each user's cross-conversation
-- call attempts because call waiting is outside the first release.
create unique index if not exists call_sessions_one_open_per_conversation_idx
  on public.call_sessions (conversation_id)
  where status in ('ringing', 'accepted', 'active');

-- -----------------------------------------------------------------------------
-- Call participants
-- -----------------------------------------------------------------------------

create table if not exists public.call_participants (
  call_session_id uuid not null references public.call_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_role text not null,
  joined_at timestamptz,
  left_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  primary key (call_session_id, user_id),
  constraint call_participants_one_role_per_call
    unique (call_session_id, participant_role),
  constraint call_participants_role_check
    check (participant_role in ('caller', 'callee')),
  constraint call_participants_timestamp_order_check
    check (
      (joined_at is null or joined_at >= created_at)
      and (left_at is null or left_at >= coalesce(joined_at, created_at))
    )
);

create index if not exists call_participants_user_call_idx
  on public.call_participants (user_id, call_session_id);

-- -----------------------------------------------------------------------------
-- Structural validation and state-machine triggers
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.validate_call_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_kind text;
  total_member_count integer;
  matching_member_count integer;
  transition_allowed boolean := true;
begin
  select c.kind into target_kind
  from public.conversations c
  where c.id = new.conversation_id;

  if target_kind is distinct from 'direct' then
    raise exception using errcode = '22023',
      message = 'Calls require an existing direct conversation.';
  end if;

  select
    count(*),
    count(*) filter (
      where cm.user_id = new.caller_user_id
         or cm.user_id = new.callee_user_id
    )
    into total_member_count, matching_member_count
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id;

  if total_member_count <> 2 or matching_member_count <> 2 then
    raise exception using errcode = '42501',
      message = 'Call parties must be the two current direct-chat members.';
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.conversation_id is distinct from old.conversation_id
       or new.caller_user_id is distinct from old.caller_user_id
       or new.callee_user_id is distinct from old.callee_user_id
       or new.call_type is distinct from old.call_type
       or new.created_at is distinct from old.created_at
       or new.ring_expires_at is distinct from old.ring_expires_at then
      raise exception using errcode = '22023',
        message = 'Call identity and ring deadline are immutable.';
    end if;

    if old.status in ('declined', 'cancelled', 'missed', 'ended', 'failed') then
      raise exception using errcode = '22023',
        message = 'A terminal call session is immutable.';
    end if;

    if new.status is distinct from old.status then
      transition_allowed := case old.status
        when 'ringing' then new.status in (
          'accepted', 'declined', 'cancelled', 'missed', 'failed'
        )
        when 'accepted' then new.status in ('active', 'ended', 'failed')
        when 'active' then new.status in ('ended', 'failed')
        else false
      end;

      if not transition_allowed then
        raise exception using errcode = '22023',
          message = 'Invalid call state transition.';
      end if;
    end if;

    if old.answered_at is not null
       and new.answered_at is distinct from old.answered_at then
      raise exception using errcode = '22023',
        message = 'The answered timestamp is immutable once recorded.';
    end if;
    if old.connected_at is not null
       and new.connected_at is distinct from old.connected_at then
      raise exception using errcode = '22023',
        message = 'The connected timestamp is immutable once recorded.';
    end if;
    if old.ended_at is not null
       and new.ended_at is distinct from old.ended_at then
      raise exception using errcode = '22023',
        message = 'The ended timestamp is immutable once recorded.';
    end if;

    new.version := old.version + 1;
    new.updated_at := timezone('utc'::text, now());
  else
    new.version := 1;
    new.updated_at := new.created_at;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_call_session on public.call_sessions;
create trigger validate_call_session
before insert or update on public.call_sessions
for each row execute function pulsechat_private.validate_call_session();

create or replace function pulsechat_private.validate_call_participant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_caller uuid;
  expected_callee uuid;
begin
  if tg_op = 'UPDATE'
     and (
       new.call_session_id is distinct from old.call_session_id
       or new.user_id is distinct from old.user_id
       or new.participant_role is distinct from old.participant_role
       or new.created_at is distinct from old.created_at
     ) then
    raise exception using errcode = '22023',
      message = 'Call participant identity is immutable.';
  end if;

  select cs.caller_user_id, cs.callee_user_id
    into expected_caller, expected_callee
  from public.call_sessions cs
  where cs.id = new.call_session_id;

  if not found then
    raise exception using errcode = '23503', message = 'Call session not found.';
  end if;

  if (new.participant_role = 'caller' and new.user_id <> expected_caller)
     or (new.participant_role = 'callee' and new.user_id <> expected_callee) then
    raise exception using errcode = '22023',
      message = 'Call participant does not match the session party.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_call_participant on public.call_participants;
create trigger validate_call_participant
before insert or update on public.call_participants
for each row execute function pulsechat_private.validate_call_participant();

create or replace function pulsechat_private.seed_call_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.call_participants (
    call_session_id, user_id, participant_role, created_at
  ) values
    (new.id, new.caller_user_id, 'caller', new.created_at),
    (new.id, new.callee_user_id, 'callee', new.created_at);

  return new;
end;
$$;

drop trigger if exists seed_call_participants on public.call_sessions;
create trigger seed_call_participants
after insert on public.call_sessions
for each row execute function pulsechat_private.seed_call_participants();

-- Auth-bound helper avoids recursive participant-policy evaluation. It accepts
-- only a call id and always compares against auth.uid().
create or replace function pulsechat_private.is_my_call_session(
  target_call_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.call_sessions cs
    where cs.id = target_call_session_id
      and (
        cs.caller_user_id = (select auth.uid())
        or cs.callee_user_id = (select auth.uid())
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- Row Level Security and least-privilege grants
-- -----------------------------------------------------------------------------

alter table public.call_sessions enable row level security;
alter table public.call_participants enable row level security;

drop policy if exists "call_sessions_select_party" on public.call_sessions;
create policy "call_sessions_select_party"
on public.call_sessions
for select
to authenticated
using (
  caller_user_id = (select auth.uid())
  or callee_user_id = (select auth.uid())
);

drop policy if exists "call_participants_select_party" on public.call_participants;
create policy "call_participants_select_party"
on public.call_participants
for select
to authenticated
using (pulsechat_private.is_my_call_session(call_session_id));

revoke all on table public.call_sessions from public, anon, authenticated;
revoke all on table public.call_participants from public, anon, authenticated;

-- Phase 27.2 is read-only for authenticated clients. Later phases must use
-- narrow caller-bound RPCs; there are intentionally no direct write grants or
-- write policies.
grant select on table public.call_sessions to authenticated;
grant select on table public.call_participants to authenticated;

revoke all on function pulsechat_private.validate_call_session()
  from public, anon, authenticated;
revoke all on function pulsechat_private.validate_call_participant()
  from public, anon, authenticated;
revoke all on function pulsechat_private.seed_call_participants()
  from public, anon, authenticated;
revoke all on function pulsechat_private.is_my_call_session(uuid)
  from public, anon, authenticated;

grant usage on schema pulsechat_private to authenticated;
grant execute on function pulsechat_private.is_my_call_session(uuid)
  to authenticated;

comment on table public.call_sessions is
  'Private PulseChat one-to-one call lifecycle metadata; no media content.';
comment on table public.call_participants is
  'The immutable caller/callee parties and bounded join/leave metadata for a call.';
comment on column public.call_sessions.ring_expires_at is
  'Server-controlled invitation deadline; it is not the media-room lifetime.';
comment on column public.call_sessions.version is
  'Monotonic server-side version for reconciling concurrent call-state observations.';


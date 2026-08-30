-- PulseChat Phase 27.2 verification.
-- Run after 202608300020_phase27_2_one_to_one_calls.sql.

do $$
declare
  session_status_constraint text;
  session_trigger_definition text;
begin
  if to_regclass('public.call_sessions') is null
     or to_regclass('public.call_participants') is null then
    raise exception 'Phase 27.2 call tables are missing.';
  end if;

  if not (
    select relrowsecurity from pg_class
    where oid = 'public.call_sessions'::regclass
  ) or not (
    select relrowsecurity from pg_class
    where oid = 'public.call_participants'::regclass
  ) then
    raise exception 'RLS must be enabled on both Phase 27.2 call tables.';
  end if;

  if not has_table_privilege('authenticated', 'public.call_sessions', 'SELECT')
     or not has_table_privilege('authenticated', 'public.call_participants', 'SELECT') then
    raise exception 'Authenticated call parties require RLS-filtered SELECT access.';
  end if;

  if has_table_privilege('anon', 'public.call_sessions', 'SELECT')
     or has_table_privilege('anon', 'public.call_participants', 'SELECT')
     or has_table_privilege('authenticated', 'public.call_sessions', 'INSERT')
     or has_table_privilege('authenticated', 'public.call_sessions', 'UPDATE')
     or has_table_privilege('authenticated', 'public.call_sessions', 'DELETE')
     or has_table_privilege('authenticated', 'public.call_participants', 'INSERT')
     or has_table_privilege('authenticated', 'public.call_participants', 'UPDATE')
     or has_table_privilege('authenticated', 'public.call_participants', 'DELETE') then
    raise exception 'Anonymous access and direct authenticated call writes must remain revoked.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'call_sessions'
      and policyname = 'call_sessions_select_party'
      and cmd = 'SELECT'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'call_participants'
      and policyname = 'call_participants_select_party'
      and cmd = 'SELECT'
  ) then
    raise exception 'Phase 27.2 party-only SELECT policies are missing.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('call_sessions', 'call_participants')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  ) then
    raise exception 'Phase 27.2 must not expose a direct client write policy.';
  end if;

  if not has_function_privilege(
    'authenticated', 'pulsechat_private.is_my_call_session(uuid)', 'EXECUTE'
  ) then
    raise exception 'Authenticated RLS evaluation requires the auth-bound call helper.';
  end if;

  if has_function_privilege(
    'authenticated', 'pulsechat_private.validate_call_session()', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated', 'pulsechat_private.seed_call_participants()', 'EXECUTE'
  ) then
    raise exception 'Internal call triggers must not be executable by app clients.';
  end if;

  select pg_get_constraintdef(oid) into session_status_constraint
  from pg_constraint
  where conrelid = 'public.call_sessions'::regclass
    and conname = 'call_sessions_status_check';

  if session_status_constraint is null
     or position('ringing' in lower(session_status_constraint)) = 0
     or position('active' in lower(session_status_constraint)) = 0
     or position('missed' in lower(session_status_constraint)) = 0
     or position('ended' in lower(session_status_constraint)) = 0 then
    raise exception 'The bounded call lifecycle constraint is incomplete.';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.call_sessions'::regclass
      and tgname = 'seed_call_participants'
      and not tgisinternal
  ) or not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.call_sessions'::regclass
      and tgname = 'validate_call_session'
      and not tgisinternal
  ) then
    raise exception 'Call session validation/participant seeding triggers are missing.';
  end if;

  select pg_get_triggerdef(oid) into session_trigger_definition
  from pg_trigger
  where tgrelid = 'public.call_sessions'::regclass
    and tgname = 'validate_call_session'
    and not tgisinternal;

  if session_trigger_definition is null then
    raise exception 'Call session validation trigger is unavailable.';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'call_sessions'
      and indexname = 'call_sessions_one_open_per_conversation_idx'
  ) then
    raise exception 'The one-open-call-per-conversation guard is missing.';
  end if;
end;
$$;

select
  to_regclass('public.call_sessions') is not null as call_sessions_exists,
  to_regclass('public.call_participants') is not null as call_participants_exists,
  has_table_privilege('authenticated', 'public.call_sessions', 'SELECT')
    as authenticated_can_read_own_sessions,
  not has_table_privilege('authenticated', 'public.call_sessions', 'INSERT')
    as authenticated_cannot_insert_directly,
  not has_table_privilege('anon', 'public.call_sessions', 'SELECT')
    as anonymous_cannot_read_calls;


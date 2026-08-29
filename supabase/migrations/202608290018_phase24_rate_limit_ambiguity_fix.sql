-- PulseChat Phase 24: resolve the Phase 21 rate-limiter PL/pgSQL ambiguity.
-- Run AFTER 202608280017_phase21_security_hardening.sql.
--
-- The public/private function signature and grants remain unchanged. Positional
-- parameters keep the existing parameter names for ABI compatibility, while
-- ON CONFLICT targets the named primary-key constraint so PostgreSQL never has
-- to choose between the actor_user_id parameter and table column.

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
  if $1 is null
     or $2 !~ '^[a-z0-9_]{1,64}$'
     or $3 < 1
     or $4 not between 1 and 86400 then
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
    $1,
    $2,
    $4,
    request_time,
    1,
    request_time
  )
  on conflict on constraint rate_limit_state_pkey do update
  set window_seconds = excluded.window_seconds,
      window_started_at = case
        when pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => $4)
          then request_time
        else pulsechat_private.rate_limit_state.window_started_at
      end,
      event_count = case
        when pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => $4)
          then 1
        else pulsechat_private.rate_limit_state.event_count + 1
      end,
      updated_at = request_time
  where pulsechat_private.rate_limit_state.window_started_at
          <= request_time - make_interval(secs => $4)
     or pulsechat_private.rate_limit_state.event_count < $3
  returning event_count into accepted_count;

  if accepted_count is null then
    raise exception using errcode = 'P0001',
      message = 'Too many requests. Please wait and try again.';
  end if;
end;
$$;

revoke all on function pulsechat_private.enforce_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;

comment on function pulsechat_private.enforce_rate_limit(uuid, text, integer, integer)
  is 'Phase 24 ambiguity-safe private bounded fixed-window limiter used by trusted write paths.';

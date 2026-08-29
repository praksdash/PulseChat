-- PulseChat Phase 24 verification.
-- Run after 202608290018_phase24_rate_limit_ambiguity_fix.sql.

do $$
declare
  function_source text;
  test_user_id uuid;
  observed_count integer;
begin
  select pg_get_functiondef(
    'pulsechat_private.enforce_rate_limit(uuid,text,integer,integer)'::regprocedure
  ) into function_source;

  if position('on conflict on constraint rate_limit_state_pkey' in lower(function_source)) = 0 then
    raise exception 'Phase 24 limiter does not target the unambiguous primary-key constraint.';
  end if;

  if has_function_privilege(
    'authenticated',
    'pulsechat_private.enforce_rate_limit(uuid,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated clients must not execute the private limiter.';
  end if;

  select user_row.id
  into test_user_id
  from auth.users user_row
  order by user_row.created_at
  limit 1;

  if test_user_id is not null then
    delete from pulsechat_private.rate_limit_state state_row
    where state_row.actor_user_id = test_user_id
      and state_row.action_key = 'phase24_verify';

    perform pulsechat_private.enforce_rate_limit(test_user_id, 'phase24_verify', 2, 60);
    perform pulsechat_private.enforce_rate_limit(test_user_id, 'phase24_verify', 2, 60);

    select state_row.event_count
    into observed_count
    from pulsechat_private.rate_limit_state state_row
    where state_row.actor_user_id = test_user_id
      and state_row.action_key = 'phase24_verify';

    if observed_count is distinct from 2 then
      raise exception 'Phase 24 limiter conflict update returned unexpected count: %.', observed_count;
    end if;

    delete from pulsechat_private.rate_limit_state state_row
    where state_row.actor_user_id = test_user_id
      and state_row.action_key = 'phase24_verify';
  end if;
end;
$$;

select 'Phase 24 verification passed.' as result;

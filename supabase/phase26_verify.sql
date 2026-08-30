-- PulseChat Phase 26 verification.
-- Run after 202608290019_phase26_observability.sql.

do $$
declare
  status_constraint text;
  diagnostic_function text;
begin
  if to_regclass('public.client_diagnostics') is null
     or to_regclass('public.operational_jobs') is null
     or to_regclass('public.operational_alerts') is null then
    raise exception 'Phase 26 operational tables are missing.';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'public.client_diagnostics'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.operational_jobs'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.operational_alerts'::regclass) then
    raise exception 'Phase 26 server-only tables must have RLS enabled.';
  end if;

  if has_table_privilege('authenticated', 'public.client_diagnostics', 'SELECT')
     or has_table_privilege('authenticated', 'public.client_diagnostics', 'INSERT')
     or has_table_privilege('authenticated', 'public.operational_jobs', 'SELECT')
     or has_table_privilege('authenticated', 'public.operational_alerts', 'SELECT') then
    raise exception 'Authenticated clients must not access Phase 26 operational tables directly.';
  end if;

  if not has_function_privilege(
    'authenticated', 'public.record_client_diagnostics(jsonb)', 'EXECUTE'
  ) then
    raise exception 'Authenticated clients must be able to execute the bounded diagnostics RPC.';
  end if;

  if has_function_privilege(
    'authenticated', 'public.evaluate_operational_alerts()', 'EXECUTE'
  ) or has_function_privilege(
    'authenticated', 'public.run_operational_maintenance()', 'EXECUTE'
  ) then
    raise exception 'Operational evaluation and maintenance must remain service-role only.';
  end if;

  select pg_get_constraintdef(oid) into status_constraint
  from pg_constraint
  where conrelid = 'public.push_delivery_log'::regclass
    and conname = 'push_delivery_log_status_check';

  if status_constraint is null
     or position('ticketed' in lower(status_constraint)) = 0
     or position('delivered' in lower(status_constraint)) = 0
     or position('sent' in lower(status_constraint)) > 0 then
    raise exception 'Push delivery status must distinguish ticketed from delivered.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_delivery_log'
      and column_name = 'receipt_attempt_count'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'push_delivery_log'
      and column_name = 'delivered_at'
  ) then
    raise exception 'Push receipt lifecycle columns are missing.';
  end if;

  select pg_get_functiondef('public.record_client_diagnostics(jsonb)'::regprocedure)
    into diagnostic_function;
  if position('jsonb_array_length' in lower(diagnostic_function)) = 0
     or position('client_diagnostics_hour' in lower(diagnostic_function)) = 0 then
    raise exception 'Diagnostics RPC must enforce bounded batches and rate limiting.';
  end if;

  if to_regclass('pulsechat_private.rate_limit_dashboard') is null
     or to_regclass('pulsechat_private.storage_dashboard') is null then
    raise exception 'Private Phase 26 dashboards are missing.';
  end if;
end;
$$;

select 'Phase 26 verification passed.' as result;

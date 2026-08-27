-- PulseChat Phase 17 verification.
-- Run after 202608160015_phase17_block_report_privacy.sql.

select
  to_regclass('public.user_privacy_settings') is not null as privacy_table_exists,
  to_regclass('public.blocked_users') is not null as blocked_users_table_exists,
  to_regclass('public.reports') is not null as reports_table_exists;

select
  coalesce((select relrowsecurity from pg_class where oid = 'public.user_privacy_settings'::regclass), false) as privacy_rls_enabled,
  coalesce((select relrowsecurity from pg_class where oid = 'public.blocked_users'::regclass), false) as blocked_users_rls_enabled,
  coalesce((select relrowsecurity from pg_class where oid = 'public.reports'::regclass), false) as reports_rls_enabled;

select
  to_regprocedure('public.get_my_privacy_settings()') is not null as get_privacy_exists,
  to_regprocedure('public.update_my_privacy_settings(boolean,boolean,boolean)') is not null as update_privacy_exists,
  to_regprocedure('public.get_user_relationship_state(uuid)') is not null as relationship_state_exists,
  to_regprocedure('public.block_user(uuid)') is not null as block_user_exists,
  to_regprocedure('public.unblock_user(uuid)') is not null as unblock_user_exists,
  to_regprocedure('public.list_my_blocked_users()') is not null as list_blocked_exists,
  to_regprocedure('public.report_user_or_message(uuid,text,text,uuid)') is not null as report_rpc_exists;

select
  has_function_privilege('authenticated', 'public.get_my_privacy_settings()', 'EXECUTE') as authenticated_get_privacy,
  has_function_privilege('authenticated', 'public.block_user(uuid)', 'EXECUTE') as authenticated_block,
  has_function_privilege('authenticated', 'public.report_user_or_message(uuid,text,text,uuid)', 'EXECUTE') as authenticated_report,
  not has_function_privilege('anon', 'public.block_user(uuid)', 'EXECUTE') as anon_cannot_block,
  not has_function_privilege('anon', 'public.report_user_or_message(uuid,text,text,uuid)', 'EXECUTE') as anon_cannot_report;

select
  not has_table_privilege('authenticated', 'public.reports', 'SELECT') as clients_cannot_browse_reports,
  not has_table_privilege('authenticated', 'public.reports', 'INSERT') as clients_cannot_direct_insert_reports,
  not has_table_privilege('authenticated', 'public.blocked_users', 'INSERT') as clients_cannot_direct_insert_blocks;

select
  count(*) filter (where privacy.user_id is null) as profiles_missing_privacy_defaults
from public.profiles p
left join public.user_privacy_settings privacy on privacy.user_id = p.id;

select
  exists (
    select 1 from pg_trigger
    where tgname = 'enforce_direct_block_before_message_insert' and not tgisinternal
  ) as direct_block_message_trigger_exists,
  exists (
    select 1 from pg_trigger
    where tgname = 'ensure_privacy_settings_after_profile_insert' and not tgisinternal
  ) as privacy_profile_trigger_exists;

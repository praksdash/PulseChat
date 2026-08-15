-- PulseChat Phase 7 verification queries.
-- Run after 202608150004_phase7_user_discovery.sql.

-- 1) Both discovery RPCs should exist.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('search_profiles', 'get_public_profile')
order by p.proname;

-- 2) Search indexes should exist.
select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'profiles_username_search_trgm_idx',
    'profiles_display_name_search_trgm_idx'
  )
order by indexname;

-- 3) Existing profiles RLS should still be enabled. Phase 7 intentionally does
-- NOT add a broad profile SELECT policy.
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where oid = 'public.profiles'::regclass;

select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'profiles'
order by policyname;

-- 4) Confirm function execution is not granted to anon. The authenticated role
-- should have EXECUTE on both functions.
select
  routine_name,
  grantee,
  privilege_type
from information_schema.routine_privileges
where specific_schema = 'public'
  and routine_name in ('search_profiles', 'get_public_profile')
order by routine_name, grantee;

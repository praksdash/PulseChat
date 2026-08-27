-- PulseChat Phase 18 verification. Run after the Phase 18 migration.
select
  to_regclass('public.notification_preferences') is not null as notification_preferences_exists,
  to_regprocedure('public.get_my_notification_preferences()') is not null as get_notification_preferences_exists,
  to_regprocedure('public.update_my_notification_preferences(boolean,boolean,boolean,boolean)') is not null as update_notification_preferences_exists,
  to_regprocedure('public.get_my_conversation_notification_state(uuid)') is not null as get_conversation_mute_exists,
  to_regprocedure('public.set_my_conversation_muted(uuid,boolean)') is not null as set_conversation_mute_exists;

select
  relrowsecurity as notification_preferences_rls_enabled
from pg_class
where oid = 'public.notification_preferences'::regclass;

select
  count(*) filter (where np.user_id is null) as invalid_preference_rows,
  count(*) as preference_rows
from public.notification_preferences np;

select
  has_function_privilege('authenticated', 'public.get_my_notification_preferences()', 'EXECUTE') as authenticated_can_get_preferences,
  has_function_privilege('authenticated', 'public.update_my_notification_preferences(boolean,boolean,boolean,boolean)', 'EXECUTE') as authenticated_can_update_preferences,
  has_function_privilege('authenticated', 'public.get_my_conversation_notification_state(uuid)', 'EXECUTE') as authenticated_can_get_own_mute,
  has_function_privilege('authenticated', 'public.set_my_conversation_muted(uuid,boolean)', 'EXECUTE') as authenticated_can_set_own_mute,
  not has_function_privilege('anon', 'public.set_my_conversation_muted(uuid,boolean)', 'EXECUTE') as anon_cannot_set_mute;

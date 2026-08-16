-- PulseChat Phase 15 verification.
-- Run after 202608160013_phase15_push_notifications.sql.

select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('push_tokens', 'push_delivery_log')
order by c.relname;

select
  p.proname as function_name,
  p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'register_my_push_token',
    'disable_my_push_token',
    'claim_push_deliveries',
    'get_push_unread_counts'
  )
order by p.proname;

select
  has_function_privilege('authenticated', 'public.register_my_push_token(text,text,text,text)', 'EXECUTE')
    as authenticated_can_register,
  has_function_privilege('authenticated', 'public.disable_my_push_token(text)', 'EXECUTE')
    as authenticated_can_disable,
  has_function_privilege('anon', 'public.register_my_push_token(text,text,text,text)', 'EXECUTE')
    as anon_can_register,
  has_function_privilege('authenticated', 'public.claim_push_deliveries(uuid,jsonb)', 'EXECUTE')
    as authenticated_can_claim_delivery,
  has_function_privilege('service_role', 'public.claim_push_deliveries(uuid,jsonb)', 'EXECUTE')
    as service_role_can_claim_delivery;

-- Expected: zero rows. Enabled registrations should look like Expo tokens.
select id, user_id, expo_push_token
from public.push_tokens
where enabled = true
  and not (
    expo_push_token like 'ExpoPushToken[%]'
    or expo_push_token like 'ExponentPushToken[%]'
  );

-- Expected: zero rows. The ledger should never claim the sender's own token.
select pdl.*
from public.push_delivery_log pdl
join public.messages m on m.id = pdl.message_id
where m.sender_id = pdl.user_id;

-- These are operational checks; zero before the first real push test is normal.
select
  count(*) as registered_push_tokens,
  count(*) filter (where enabled) as enabled_push_tokens
from public.push_tokens;

select status, count(*) as delivery_count
from public.push_delivery_log
group by status
order by status;

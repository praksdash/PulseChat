-- PulseChat Phase 15 operational diagnostics.
-- Safe to run in Supabase SQL Editor. Do not share full expo_push_token values.

select
  user_id,
  platform,
  device_name,
  app_version,
  enabled,
  last_registered_at,
  left(expo_push_token, 22) || '…' as token_preview
from public.push_tokens
order by last_registered_at desc
limit 20;

select
  pdl.message_id,
  pdl.user_id,
  pdl.status,
  pdl.ticket_id,
  pdl.error_code,
  pdl.error_message,
  pdl.updated_at
from public.push_delivery_log pdl
order by pdl.id desc
limit 30;

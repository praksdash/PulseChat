-- PulseChat Phase 15: push notification registrations + delivery deduplication.
-- Run AFTER 202608150012_phase14_group_chats.sql.
--
-- Remote delivery is performed by the Supabase Edge Function in:
--   supabase/functions/send-message-push/index.ts
-- A Database Webhook on public.messages INSERT invokes that function.
--
-- Security model:
--   * clients never write push token rows directly;
--   * registration/disable RPCs derive the owner from auth.uid();
--   * push delivery logs are server-only;
--   * the Edge Function uses the service-role key only inside Supabase;
--   * the webhook itself is authenticated with PUSH_WEBHOOK_SECRET.

-- -----------------------------------------------------------------------------
-- Device registrations
-- -----------------------------------------------------------------------------

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null,
  device_name text,
  app_version text,
  enabled boolean not null default true,
  last_registered_at timestamptz not null default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint push_tokens_token_unique unique (expo_push_token),
  constraint push_tokens_platform_check check (platform in ('android', 'ios')),
  constraint push_tokens_token_length_check check (char_length(expo_push_token) between 20 and 512),
  constraint push_tokens_device_name_length_check check (device_name is null or char_length(device_name) <= 160),
  constraint push_tokens_app_version_length_check check (app_version is null or char_length(app_version) <= 64)
);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id, enabled)
  where enabled = true;

alter table public.push_tokens enable row level security;

-- Users may inspect only their own registrations. All writes go through the
-- narrow RPCs below so a caller cannot assign a token to another user.
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own
on public.push_tokens
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.push_tokens from public, anon, authenticated;
grant select on table public.push_tokens to authenticated;
grant select, insert, update, delete on table public.push_tokens to service_role;

create or replace function public.register_my_push_token(
  target_expo_push_token text,
  target_platform text,
  target_device_name text default null,
  target_app_version text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  normalized_token text := btrim(coalesce(target_expo_push_token, ''));
  normalized_platform text := lower(btrim(coalesce(target_platform, '')));
  normalized_device_name text := nullif(left(btrim(coalesce(target_device_name, '')), 160), '');
  normalized_app_version text := nullif(left(btrim(coalesce(target_app_version, '')), 64), '');
  registration_id uuid;
begin
  if actor_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if normalized_platform not in ('android', 'ios') then
    raise exception using errcode = '22023', message = 'Unsupported push platform.';
  end if;

  if char_length(normalized_token) not between 20 and 512
     or not (
       normalized_token like 'ExpoPushToken[%]'
       or normalized_token like 'ExponentPushToken[%]'
     ) then
    raise exception using errcode = '22023', message = 'Invalid Expo push token.';
  end if;

  -- Expo push tokens identify one app installation. If the device signs into a
  -- different PulseChat account, ownership moves to the currently authenticated
  -- account rather than leaving the previous account able to notify that device.
  insert into public.push_tokens (
    user_id,
    expo_push_token,
    platform,
    device_name,
    app_version,
    enabled,
    last_registered_at,
    updated_at
  )
  values (
    actor_user_id,
    normalized_token,
    normalized_platform,
    normalized_device_name,
    normalized_app_version,
    true,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict on constraint push_tokens_token_unique
  do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    device_name = excluded.device_name,
    app_version = excluded.app_version,
    enabled = true,
    last_registered_at = timezone('utc'::text, now()),
    updated_at = timezone('utc'::text, now())
  returning id into registration_id;

  return registration_id;
end;
$$;

revoke all on function public.register_my_push_token(text, text, text, text) from public, anon;
grant execute on function public.register_my_push_token(text, text, text, text) to authenticated;

create or replace function public.disable_my_push_token(target_expo_push_token text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  actor_user_id uuid := (select auth.uid());
  changed_count integer := 0;
begin
  if actor_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  update public.push_tokens pt
  set
    enabled = false,
    updated_at = timezone('utc'::text, now())
  where pt.user_id = actor_user_id
    and pt.expo_push_token = btrim(coalesce(target_expo_push_token, ''))
    and pt.enabled = true;

  get diagnostics changed_count = row_count;
  return changed_count > 0;
end;
$$;

revoke all on function public.disable_my_push_token(text) from public, anon;
grant execute on function public.disable_my_push_token(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Server-only delivery ledger. One row per message + physical Expo token makes
-- Database Webhook retries idempotent and prevents duplicate push sends.
-- -----------------------------------------------------------------------------

create table if not exists public.push_delivery_log (
  id bigint generated by default as identity primary key,
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  status text not null default 'claimed',
  ticket_id text,
  error_code text,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint push_delivery_log_unique_message_token unique (message_id, expo_push_token),
  constraint push_delivery_log_status_check check (status in ('claimed', 'sent', 'error')),
  constraint push_delivery_log_token_length_check check (char_length(expo_push_token) between 20 and 512)
);

create index if not exists push_delivery_log_user_created_idx
  on public.push_delivery_log (user_id, created_at desc);

alter table public.push_delivery_log enable row level security;

-- No client RLS policy is intentional. This is operational metadata for the
-- server-side dispatcher only.
revoke all on table public.push_delivery_log from public, anon, authenticated;
grant select, insert, update, delete on table public.push_delivery_log to service_role;

grant usage, select on sequence public.push_delivery_log_id_seq to service_role;

-- Atomic claim used only by the Edge Function. It filters claims against the
-- current enabled token owner and returns only new claims (or prior failed claims eligible for retry).
create or replace function public.claim_push_deliveries(
  target_message_id uuid,
  target_deliveries jsonb
)
returns table (
  user_id uuid,
  expo_push_token text
)
language sql
volatile
security definer
set search_path = ''
as $$
  with requested as (
    select distinct
      x.user_id,
      btrim(x.expo_push_token) as expo_push_token
    from jsonb_to_recordset(coalesce(target_deliveries, '[]'::jsonb))
      as x(user_id uuid, expo_push_token text)
    where x.user_id is not null
      and x.expo_push_token is not null
  ),
  allowed as (
    select r.user_id, r.expo_push_token
    from requested r
    join public.push_tokens pt
      on pt.user_id = r.user_id
     and pt.expo_push_token = r.expo_push_token
     and pt.enabled = true
    where exists (
      select 1
      from public.message_receipts mr
      where mr.message_id = target_message_id
        and mr.user_id = r.user_id
        and mr.read_at is null
    )
  ),
  inserted as (
    insert into public.push_delivery_log as delivery_log (
      message_id,
      user_id,
      expo_push_token,
      status
    )
    select target_message_id, a.user_id, a.expo_push_token, 'claimed'
    from allowed a
    on conflict on constraint push_delivery_log_unique_message_token
    do update set
      status = 'claimed',
      ticket_id = null,
      error_code = null,
      error_message = null,
      updated_at = timezone('utc'::text, now())
    where delivery_log.status = 'error'
      and delivery_log.updated_at < timezone('utc'::text, now()) - interval '10 seconds'
    returning delivery_log.user_id, delivery_log.expo_push_token
  )
  select inserted.user_id, inserted.expo_push_token
  from inserted;
$$;

revoke all on function public.claim_push_deliveries(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(uuid, jsonb) to service_role;

-- The dispatcher uses this one aggregate query for notification badge counts
-- instead of issuing one query per recipient.
create or replace function public.get_push_unread_counts(target_user_ids uuid[])
returns table (
  user_id uuid,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    requested.user_id,
    least(count(mr.message_id) filter (where mr.read_at is null), 2147483647)::integer as unread_count
  from unnest(coalesce(target_user_ids, '{}'::uuid[])) as requested(user_id)
  left join public.message_receipts mr
    on mr.user_id = requested.user_id
   and mr.read_at is null
  group by requested.user_id;
$$;

revoke all on function public.get_push_unread_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_push_unread_counts(uuid[]) to service_role;

comment on table public.push_tokens is
  'Phase 15: authenticated Expo push-token registrations. Direct client writes are denied.';
comment on table public.push_delivery_log is
  'Phase 15: server-only idempotency/ticket ledger for message push delivery.';
comment on function public.register_my_push_token(text, text, text, text) is
  'Phase 15: registers the current app installation to auth.uid().';
comment on function public.disable_my_push_token(text) is
  'Phase 15: disables the current user registration for this Expo push token.';

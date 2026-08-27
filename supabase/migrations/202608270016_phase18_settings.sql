-- PulseChat Phase 18: durable notification preferences + per-conversation mute controls.
-- Run AFTER 202608160015_phase17_block_report_privacy.sql.
-- Appearance is device-local (AsyncStorage) and does not belong in PostgreSQL.

-- -----------------------------------------------------------------------------
-- Account-wide notification preferences
-- -----------------------------------------------------------------------------

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  direct_messages boolean not null default true,
  group_messages boolean not null default true,
  show_message_preview boolean not null default true,
  browser_notifications boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists notification_preferences_user_idx
  on public.notification_preferences (user_id);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row execute function pulsechat_private.set_updated_at();

alter table public.notification_preferences enable row level security;

-- App clients use narrow RPCs below. The push dispatcher reads this table with
-- the service role, so no broad authenticated table grant is necessary.
revoke all on table public.notification_preferences from public, anon, authenticated;
grant select, insert, update, delete on table public.notification_preferences to service_role;

-- Seed current accounts. New accounts are created lazily by the get/update RPCs.
insert into public.notification_preferences (user_id)
select u.id
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.get_my_notification_preferences()
returns table (
  direct_messages boolean,
  group_messages boolean,
  show_message_preview boolean,
  browser_notifications boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  insert into public.notification_preferences (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  return query
  select
    np.direct_messages,
    np.group_messages,
    np.show_message_preview,
    np.browser_notifications
  from public.notification_preferences np
  where np.user_id = current_user_id;
end;
$$;

revoke all on function public.get_my_notification_preferences() from public, anon;
grant execute on function public.get_my_notification_preferences() to authenticated;

create or replace function public.update_my_notification_preferences(
  target_direct_messages boolean,
  target_group_messages boolean,
  target_show_message_preview boolean,
  target_browser_notifications boolean
)
returns table (
  direct_messages boolean,
  group_messages boolean,
  show_message_preview boolean,
  browser_notifications boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  insert into public.notification_preferences (
    user_id,
    direct_messages,
    group_messages,
    show_message_preview,
    browser_notifications
  ) values (
    current_user_id,
    coalesce(target_direct_messages, true),
    coalesce(target_group_messages, true),
    coalesce(target_show_message_preview, true),
    coalesce(target_browser_notifications, true)
  )
  on conflict (user_id) do update set
    direct_messages = excluded.direct_messages,
    group_messages = excluded.group_messages,
    show_message_preview = excluded.show_message_preview,
    browser_notifications = excluded.browser_notifications;

  return query
  select
    np.direct_messages,
    np.group_messages,
    np.show_message_preview,
    np.browser_notifications
  from public.notification_preferences np
  where np.user_id = current_user_id;
end;
$$;

revoke all on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.update_my_notification_preferences(boolean, boolean, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Per-conversation mute. The RPCs always scope the membership row to auth.uid().
-- This avoids accidentally reading another group member's mute state.
-- -----------------------------------------------------------------------------

create or replace function public.get_my_conversation_notification_state(
  target_conversation_id uuid
)
returns table (
  muted_until timestamptz,
  is_muted boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_conversation_id is null then
    raise exception using errcode = '22023', message = 'Conversation is required.';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  return query
  select
    cm.muted_until,
    (cm.muted_until is not null and cm.muted_until > timezone('utc'::text, now()))
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.user_id = current_user_id;
end;
$$;

revoke all on function public.get_my_conversation_notification_state(uuid) from public, anon;
grant execute on function public.get_my_conversation_notification_state(uuid) to authenticated;

create or replace function public.set_my_conversation_muted(
  target_conversation_id uuid,
  target_muted boolean
)
returns table (
  muted_until timestamptz,
  is_muted boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if target_conversation_id is null then
    raise exception using errcode = '22023', message = 'Conversation is required.';
  end if;

  update public.conversation_members cm
  set muted_until = case
    when coalesce(target_muted, false)
      then timezone('utc'::text, now()) + interval '100 years'
    else null
  end
  where cm.conversation_id = target_conversation_id
    and cm.user_id = current_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  return query
  select
    cm.muted_until,
    (cm.muted_until is not null and cm.muted_until > timezone('utc'::text, now()))
  from public.conversation_members cm
  where cm.conversation_id = target_conversation_id
    and cm.user_id = current_user_id;
end;
$$;

revoke all on function public.set_my_conversation_muted(uuid, boolean) from public, anon;
grant execute on function public.set_my_conversation_muted(uuid, boolean) to authenticated;

comment on table public.notification_preferences is 'Phase 18: account-wide message notification preferences.';
comment on function public.get_my_conversation_notification_state(uuid) is 'Phase 18: returns only the signed-in member mute state.';
comment on function public.set_my_conversation_muted(uuid, boolean) is 'Phase 18: securely mutes/unmutes only the signed-in member row.';

-- PulseChat Phase 4: authentication profile foundation
-- Run this once in Supabase SQL Editor for the project used by the app.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  username text unique,
  avatar_path text,
  bio text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 2 and 60),
  constraint profiles_username_format check (
    username is null or username ~ '^[a-z0-9_]{3,32}$'
  )
);

alter table public.profiles enable row level security;

-- Phase 4 intentionally exposes only the signed-in user's own profile.
-- Phase 7 will add a separate, controlled user-discovery policy/API.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- App clients do not need direct INSERT/DELETE access. New rows are created
-- from auth.users by the security-definer trigger below.
revoke insert, delete on table public.profiles from anon, authenticated;
grant select, update on table public.profiles to authenticated;

create or replace function public.set_profile_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_profile_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_display_name text;
begin
  requested_display_name := nullif(btrim(new.raw_user_meta_data ->> 'display_name'), '');

  if requested_display_name is null
     or char_length(requested_display_name) < 2 then
    requested_display_name := 'PulseChat User';
  end if;

  requested_display_name := left(requested_display_name, 60);

  insert into public.profiles (id, display_name)
  values (new.id, requested_display_name)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- Backfill a profile if auth users already existed before this migration.
insert into public.profiles (id, display_name)
select
  u.id,
  case
    when char_length(btrim(coalesce(u.raw_user_meta_data ->> 'display_name', ''))) between 2 and 60
      then btrim(u.raw_user_meta_data ->> 'display_name')
    else 'PulseChat User'
  end
from auth.users u
on conflict (id) do nothing;

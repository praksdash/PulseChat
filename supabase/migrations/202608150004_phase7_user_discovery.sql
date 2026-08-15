-- PulseChat Phase 7: controlled authenticated user discovery.
-- Run AFTER:
--   202608150001_phase4_auth_profiles.sql
--   202608150002_phase5_profiles_avatars.sql
--   202608150003_phase6_messaging_schema.sql
--
-- Security model:
-- - public.profiles remains self-readable through normal table SELECT/RLS.
-- - discovery is exposed only through narrow SECURITY DEFINER RPCs.
-- - RPCs return only explicitly public profile fields; auth email/metadata are never returned.
-- - search requires >= 2 characters and is capped to 20 rows per call.

-- Trigram indexes make substring search practical as the profile table grows.
create extension if not exists pg_trgm with schema extensions;

create index if not exists profiles_username_search_trgm_idx
  on public.profiles using gin (lower(username) extensions.gin_trgm_ops)
  where username is not null;

create index if not exists profiles_display_name_search_trgm_idx
  on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);

-- Search safe public profile fields only. The signed-in user is intentionally
-- excluded from results. Wildcard characters are escaped so callers cannot turn
-- a short search into an accidental match-all LIKE pattern.
create or replace function public.search_profiles(
  search_term text,
  result_limit integer default 20
)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  bio text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  needle text;
  escaped_needle text;
  safe_limit integer;
begin
  if (select auth.uid()) is null then
    return;
  end if;

  needle := lower(btrim(coalesce(search_term, '')));

  -- Minimum length reduces trivial full-directory enumeration and unnecessary work.
  if char_length(needle) < 2 then
    return;
  end if;

  needle := left(needle, 50);
  safe_limit := least(greatest(coalesce(result_limit, 20), 1), 20);

  escaped_needle := replace(needle, E'\\', E'\\\\');
  escaped_needle := replace(escaped_needle, '%', E'\\%');
  escaped_needle := replace(escaped_needle, '_', E'\\_');

  return query
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    p.bio
  from public.profiles p
  where p.id <> (select auth.uid())
    and (
      lower(p.display_name) like ('%' || escaped_needle || '%') escape E'\\'
      or lower(coalesce(p.username, '')) like ('%' || escaped_needle || '%') escape E'\\'
    )
  order by
    case
      when lower(coalesce(p.username, '')) = needle then 0
      when lower(p.display_name) = needle then 1
      when lower(coalesce(p.username, '')) like (escaped_needle || '%') escape E'\\' then 2
      when lower(p.display_name) like (escaped_needle || '%') escape E'\\' then 3
      else 4
    end,
    lower(p.display_name),
    p.id
  limit safe_limit;
end;
$$;

revoke all on function public.search_profiles(text, integer) from public, anon;
grant execute on function public.search_profiles(text, integer) to authenticated;

-- Fetch one safe public profile by UUID for the profile-details route. This avoids
-- adding an RLS policy that would allow arbitrary broad SELECTs over profiles.
create or replace function public.get_public_profile(target_user_id uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  bio text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    p.bio
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id = target_user_id
  limit 1;
$$;

revoke all on function public.get_public_profile(uuid) from public, anon;
grant execute on function public.get_public_profile(uuid) to authenticated;

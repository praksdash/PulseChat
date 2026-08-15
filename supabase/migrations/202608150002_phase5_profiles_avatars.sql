-- PulseChat Phase 5: editable profiles, username availability and avatar storage.
-- Run this AFTER 202608150001_phase4_auth_profiles.sql.

-- Profile quality constraints added in Phase 5.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_bio_length'
  ) then
    alter table public.profiles
      add constraint profiles_bio_length
      check (bio is null or char_length(btrim(bio)) <= 160);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_avatar_path_owner'
  ) then
    alter table public.profiles
      add constraint profiles_avatar_path_owner
      check (avatar_path is null or avatar_path like (id::text || '/%'));
  end if;
end
$$;

-- Lets a signed-in user check whether a username is available without granting
-- broad SELECT access to every profile before the user-discovery phase.
create or replace function public.is_username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    candidate is not null
    and candidate ~ '^[a-z0-9_]{3,32}$'
    and not exists (
      select 1
      from public.profiles p
      where p.username = candidate
        and p.id <> (select auth.uid())
    );
$$;

revoke all on function public.is_username_available(text) from public, anon;
grant execute on function public.is_username_available(text) to authenticated;

-- Public profile pictures are intentionally readable by URL. Upload/update/delete
-- remain restricted to the signed-in user's own UUID folder by Storage RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars_insert_own_folder" on storage.objects;
create policy "avatars_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars_update_own_folder" on storage.objects;
create policy "avatars_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "avatars_delete_own_folder" on storage.objects;
create policy "avatars_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

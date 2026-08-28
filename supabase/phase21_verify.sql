-- PulseChat Phase 21 security verification.
-- Run after 202608280017_phase21_security_hardening.sql in the Supabase SQL editor.

do $$
declare
  function_source text;
begin
  if to_regclass('pulsechat_private.rate_limit_state') is null then
    raise exception 'Phase 21 missing private rate_limit_state.';
  end if;

  if has_table_privilege('authenticated', 'pulsechat_private.rate_limit_state', 'SELECT')
     or has_table_privilege('authenticated', 'pulsechat_private.rate_limit_state', 'INSERT')
     or has_table_privilege('authenticated', 'pulsechat_private.rate_limit_state', 'UPDATE') then
    raise exception 'Authenticated clients must not access rate-limit state directly.';
  end if;

  if has_function_privilege(
    'authenticated',
    'pulsechat_private.enforce_rate_limit(uuid,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated clients must not execute the private limiter.';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.update_my_profile(text,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated profile RPC execute grant is missing.';
  end if;

  if not has_function_privilege('authenticated', 'public.claim_my_push_test()', 'EXECUTE') then
    raise exception 'Authenticated push-test claim grant is missing.';
  end if;

  if has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Direct authenticated profile updates must be revoked.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'messages'
      and trigger_row.tgname = 'enforce_message_rate_limit_before_insert'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'Message rate-limit trigger is missing.';
  end if;

  select pg_get_functiondef(
    'public.create_image_message(uuid,uuid,text,text,bigint,integer,integer,text,uuid)'::regprocedure
  ) into function_source;
  if position('from storage.objects' in lower(function_source)) = 0
     or position('object_size is distinct from target_file_size' in lower(function_source)) = 0 then
    raise exception 'Image RPC is missing authoritative Storage metadata validation.';
  end if;

  select pg_get_functiondef(
    'public.report_user_or_message(uuid,text,text,uuid)'::regprocedure
  ) into function_source;
  if position('enforce_rate_limit' in lower(function_source)) = 0 then
    raise exception 'Report RPC is missing abuse limiting.';
  end if;

  if not exists (
    select 1 from storage.buckets bucket_row
    where bucket_row.id = 'chat-media'
      and bucket_row.public = false
      and bucket_row.file_size_limit = 10485760
      and bucket_row.allowed_mime_types = array['image/jpeg']::text[]
  ) then
    raise exception 'Private chat-media bucket limits do not match Phase 21.';
  end if;

  if not exists (
    select 1 from pg_policies policy_row
    where policy_row.schemaname = 'storage'
      and policy_row.tablename = 'objects'
      and policy_row.policyname = 'pulsechat_members_upload_own_chat_media'
      and position('can_upload_chat_media_object' in lower(policy_row.with_check)) > 0
  ) then
    raise exception 'Canonical chat-media upload policy is missing.';
  end if;

  if not exists (
    select 1
    from pg_trigger trigger_row
    join pg_class table_row on table_row.oid = trigger_row.tgrelid
    join pg_namespace namespace_row on namespace_row.oid = table_row.relnamespace
    where namespace_row.nspname = 'public'
      and table_row.relname = 'messages'
      and trigger_row.tgname = 'enforce_direct_block_before_message_insert'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'Phase 17 direct-block message enforcement regressed.';
  end if;
end;
$$;

select 'Phase 21 security verification passed.' as result;

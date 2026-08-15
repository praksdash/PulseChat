-- PulseChat Phase 6 metadata verification.
-- Run in Supabase SQL Editor AFTER the Phase 6 migration.
-- This script is read-only.

-- 1) Expected tables.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'conversations',
    'conversation_members',
    'messages',
    'message_receipts',
    'attachments'
  )
order by table_name;

-- 2) RLS should be enabled for all Phase 6 tables.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in (
    'conversations',
    'conversation_members',
    'messages',
    'message_receipts',
    'attachments'
  )
order by c.relname;

-- 3) Policies created by Phase 6.
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'conversations',
    'conversation_members',
    'messages',
    'message_receipts',
    'attachments'
  )
order by tablename, policyname;

-- 4) Important indexes for membership, pagination, dedupe and receipts.
select
  tablename,
  indexname
from pg_indexes
where schemaname = 'public'
  and tablename in (
    'conversations',
    'conversation_members',
    'messages',
    'message_receipts',
    'attachments'
  )
order by tablename, indexname;

-- 5) Confirm tables start empty unless later phases/tests already inserted data.
select 'conversations' as table_name, count(*) as row_count from public.conversations
union all
select 'conversation_members', count(*) from public.conversation_members
union all
select 'messages', count(*) from public.messages
union all
select 'message_receipts', count(*) from public.message_receipts
union all
select 'attachments', count(*) from public.attachments;

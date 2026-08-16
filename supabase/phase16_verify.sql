-- PulseChat Phase 16 verification. Run after the Phase 16 migration.

select extname, extnamespace::regnamespace::text as schema_name
from pg_extension
where extname = 'pg_trgm';

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in ('messages_body_search_trgm_idx', 'conversations_title_search_trgm_idx')
order by indexname;

select
  to_regprocedure('public.search_my_conversations(text,integer)') is not null as search_chats_exists,
  to_regprocedure('public.search_my_messages(text,timestamp with time zone,uuid,integer)') is not null as search_messages_exists,
  to_regprocedure('public.get_message_window(uuid,integer,integer)') is not null as message_window_exists;

select
  has_function_privilege('authenticated', 'public.search_my_conversations(text,integer)', 'EXECUTE') as authenticated_search_chats,
  not has_function_privilege('anon', 'public.search_my_conversations(text,integer)', 'EXECUTE') as anon_cannot_search_chats,
  has_function_privilege('authenticated', 'public.search_my_messages(text,timestamp with time zone,uuid,integer)', 'EXECUTE') as authenticated_search_messages,
  not has_function_privilege('anon', 'public.search_my_messages(text,timestamp with time zone,uuid,integer)', 'EXECUTE') as anon_cannot_search_messages,
  has_function_privilege('authenticated', 'public.get_message_window(uuid,integer,integer)', 'EXECUTE') as authenticated_message_window,
  not has_function_privilege('anon', 'public.get_message_window(uuid,integer,integer)', 'EXECUTE') as anon_cannot_message_window;

-- Structural sanity check: search index intentionally excludes deleted/null-body rows.
select pg_get_expr(i.indpred, i.indrelid) as partial_index_predicate
from pg_index i
join pg_class idx on idx.oid = i.indexrelid
where idx.relname = 'messages_body_search_trgm_idx';

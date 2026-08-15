-- PulseChat Phase 9: real text messaging + private Supabase Realtime Broadcast.
-- Run AFTER 202608150005_phase8_direct_chat_creation.sql.
--
-- Durable PostgreSQL rows remain the source of truth. Realtime Broadcast is only
-- the low-latency notification path; clients refetch from PostgreSQL on initial
-- load/reconnect so missed WebSocket events do not lose messages.

-- -----------------------------------------------------------------------------
-- Stable cursor-paginated message history.
-- SECURITY INVOKER intentionally keeps the Phase 6 messages RLS policy active.
-- -----------------------------------------------------------------------------

create or replace function public.list_conversation_messages(
  target_conversation_id uuid,
  before_created_at timestamptz default null,
  before_id uuid default null,
  result_limit integer default 30
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  client_message_id uuid,
  message_type text,
  body text,
  reply_to_message_id uuid,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    m.conversation_id,
    m.sender_id,
    m.client_message_id,
    m.message_type,
    m.body,
    m.reply_to_message_id,
    m.created_at,
    m.edited_at,
    m.deleted_at
  from public.messages m
  where m.conversation_id = target_conversation_id
    and (
      before_created_at is null
      or m.created_at < before_created_at
      or (
        m.created_at = before_created_at
        and before_id is not null
        and m.id < before_id
      )
    )
  order by m.created_at desc, m.id desc
  limit least(greatest(coalesce(result_limit, 30), 1), 50);
$$;

revoke all on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
  from public, anon;
grant execute on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime Authorization.
-- A private channel topic is exactly: conversation:<conversation UUID>
-- The helper does not parse/cast user-provided topic text. It compares it with
-- canonical topic strings built from memberships owned by auth.uid().
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_receive_conversation_broadcast(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.user_id = (select auth.uid())
      and target_topic = 'conversation:' || cm.conversation_id::text
  );
$$;

revoke all on function pulsechat_private.can_receive_conversation_broadcast(text)
  from public, anon, authenticated;
grant execute on function pulsechat_private.can_receive_conversation_broadcast(text)
  to authenticated;

-- Supabase currently permits RLS policy management on realtime.messages while
-- the rest of the realtime schema is protected from direct modification.
drop policy if exists "pulsechat_members_receive_conversation_broadcasts"
  on realtime.messages;
create policy "pulsechat_members_receive_conversation_broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and pulsechat_private.can_receive_conversation_broadcast((select realtime.topic()))
);

-- Clients never need INSERT permission on realtime.messages in Phase 9 because
-- they send durable messages through public.messages. Database triggers emit
-- the Broadcast only after the row insert succeeds.

-- -----------------------------------------------------------------------------
-- Broadcast newly committed message rows to the conversation's private topic.
-- Phase 9 emits INSERT only. UPDATE/DELETE events will be added with message
-- editing/deletion in Phase 13.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.broadcast_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'conversation:' || new.conversation_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return null;
end;
$$;

revoke all on function pulsechat_private.broadcast_new_message()
  from public, anon, authenticated;

drop trigger if exists broadcast_new_message on public.messages;
create trigger broadcast_new_message
after insert on public.messages
for each row
execute function pulsechat_private.broadcast_new_message();

comment on function public.list_conversation_messages(uuid, timestamptz, uuid, integer)
  is 'Phase 9 RLS-protected stable cursor pagination for conversation message history.';
comment on function pulsechat_private.can_receive_conversation_broadcast(text)
  is 'Realtime Authorization helper: only conversation members may receive that private topic.';
comment on function pulsechat_private.broadcast_new_message()
  is 'Broadcasts committed message inserts to private conversation:<uuid> channels.';

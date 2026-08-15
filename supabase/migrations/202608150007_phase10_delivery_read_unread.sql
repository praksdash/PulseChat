-- PulseChat Phase 10: delivered/read receipts + unread counters.
-- Run AFTER 202608150006_phase9_realtime_text_messaging.sql.
--
-- Phase 10 keeps PostgreSQL as the source of truth and uses private Realtime
-- Broadcast only to notify already-authorized clients about new inbox messages
-- and monotonic receipt cursors.

-- -----------------------------------------------------------------------------
-- Ensure every non-sender member has one receipt row for every message.
-- This is group-ready: a future group message has one receipt per recipient.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.create_message_receipts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.message_receipts (message_id, user_id)
  select new.id, cm.user_id
  from public.conversation_members cm
  where cm.conversation_id = new.conversation_id
    and (new.sender_id is null or cm.user_id <> new.sender_id)
  on conflict (message_id, user_id) do nothing;

  return new;
end;
$$;

revoke all on function pulsechat_private.create_message_receipts()
  from public, anon, authenticated;

drop trigger if exists create_message_receipts on public.messages;
create trigger create_message_receipts
after insert on public.messages
for each row
execute function pulsechat_private.create_message_receipts();

-- Backfill Phase 9 messages so existing test conversations immediately support
-- delivered/read state after this migration is applied.
insert into public.message_receipts (message_id, user_id)
select m.id, cm.user_id
from public.messages m
join public.conversation_members cm
  on cm.conversation_id = m.conversation_id
where m.sender_id is null or cm.user_id <> m.sender_id
on conflict (message_id, user_id) do nothing;

create index if not exists message_receipts_user_unread_idx
  on public.message_receipts (user_id, message_id)
  where read_at is null;

-- -----------------------------------------------------------------------------
-- Message history now includes the current sender-visible aggregate status.
-- For future groups, delivered/read means ALL current receipt rows reached that
-- state. Incoming messages return NULL because ticks are only shown to senders.
-- -----------------------------------------------------------------------------

drop function if exists public.list_conversation_messages(uuid, timestamptz, uuid, integer);

create function public.list_conversation_messages(
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
  deleted_at timestamptz,
  delivery_status text
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
    m.deleted_at,
    case
      when m.sender_id is distinct from (select auth.uid()) then null
      when receipt_state.recipient_count = 0 then 'sent'
      when receipt_state.read_count = receipt_state.recipient_count then 'read'
      when receipt_state.delivered_count = receipt_state.recipient_count then 'delivered'
      else 'sent'
    end as delivery_status
  from public.messages m
  left join lateral (
    select
      count(*)::integer as recipient_count,
      count(*) filter (where r.delivered_at is not null)::integer as delivered_count,
      count(*) filter (where r.read_at is not null)::integer as read_count
    from public.message_receipts r
    where r.message_id = m.id
  ) receipt_state on true
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
-- Chats list now returns unread_count from authoritative receipt rows.
-- -----------------------------------------------------------------------------

drop function if exists public.list_my_conversations(integer);

create function public.list_my_conversations(result_limit integer default 50)
returns table (
  conversation_id uuid,
  kind text,
  display_name text,
  username text,
  avatar_path text,
  peer_user_id uuid,
  last_message_preview text,
  last_message_sender_id uuid,
  last_message_created_at timestamptz,
  last_activity_at timestamptz,
  unread_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id as conversation_id,
    c.kind,
    case
      when c.kind = 'direct' then coalesce(peer_profile.display_name, 'PulseChat User')
      else coalesce(c.title, 'Group')
    end as display_name,
    case when c.kind = 'direct' then peer_profile.username else null end as username,
    case when c.kind = 'direct' then peer_profile.avatar_path else c.avatar_path end as avatar_path,
    case when c.kind = 'direct' then peer_member.user_id else null end as peer_user_id,
    case
      when latest_message.id is null then null
      when latest_message.deleted_at is not null then 'Message deleted'
      when latest_message.message_type = 'text' then latest_message.body
      when latest_message.message_type = 'image' then 'Photo'
      when latest_message.message_type = 'video' then 'Video'
      when latest_message.message_type = 'audio' then 'Audio'
      when latest_message.message_type = 'voice' then 'Voice message'
      when latest_message.message_type = 'file' then 'File'
      else 'Message'
    end as last_message_preview,
    latest_message.sender_id as last_message_sender_id,
    latest_message.created_at as last_message_created_at,
    greatest(c.last_message_at, c.created_at) as last_activity_at,
    coalesce(unread.unread_count, 0) as unread_count
  from public.conversation_members self_member
  join public.conversations c
    on c.id = self_member.conversation_id
  left join public.conversation_members peer_member
    on c.kind = 'direct'
   and peer_member.conversation_id = c.id
   and peer_member.user_id <> self_member.user_id
  left join public.profiles peer_profile
    on peer_profile.id = peer_member.user_id
  left join lateral (
    select
      m.id,
      m.sender_id,
      m.message_type,
      m.body,
      m.created_at,
      m.deleted_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc, m.id desc
    limit 1
  ) latest_message on true
  left join lateral (
    select least(count(*), 2147483647)::integer as unread_count
    from public.message_receipts r
    join public.messages unread_message
      on unread_message.id = r.message_id
    where r.user_id = self_member.user_id
      and r.read_at is null
      and unread_message.conversation_id = c.id
  ) unread on true
  where self_member.user_id = (select auth.uid())
  order by greatest(c.last_message_at, c.created_at) desc, c.id desc
  limit least(greatest(coalesce(result_limit, 50), 1), 100);
$$;

revoke all on function public.list_my_conversations(integer) from public, anon;
grant execute on function public.list_my_conversations(integer) to authenticated;

create or replace function public.get_my_total_unread_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select least(count(*), 2147483647)::integer
  from public.message_receipts r
  where r.user_id = (select auth.uid())
    and r.read_at is null;
$$;

revoke all on function public.get_my_total_unread_count() from public, anon;
grant execute on function public.get_my_total_unread_count() to authenticated;

-- -----------------------------------------------------------------------------
-- Batch receipt mutations. Clients do not choose timestamps or other users.
-- Each RPC is monotonic: delivered/read timestamps are only filled once.
-- -----------------------------------------------------------------------------

create or replace function public.mark_conversation_delivered(target_conversation_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  event_time timestamptz := timezone('utc'::text, now());
  through_created_at timestamptz;
  updated_count integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  select max(m.created_at)
    into through_created_at
  from public.message_receipts r
  join public.messages m on m.id = r.message_id
  where r.user_id = current_user_id
    and r.delivered_at is null
    and m.conversation_id = target_conversation_id;

  if through_created_at is null then
    return 0;
  end if;

  update public.message_receipts r
  set delivered_at = event_time
  from public.messages m
  where m.id = r.message_id
    and r.user_id = current_user_id
    and r.delivered_at is null
    and m.conversation_id = target_conversation_id
    and m.created_at <= through_created_at;

  get diagnostics updated_count = row_count;

  if updated_count > 0 then
    perform realtime.send(
      jsonb_build_object(
        'conversation_id', target_conversation_id,
        'recipient_user_id', current_user_id,
        'through_created_at', through_created_at,
        'delivered_at', event_time
      ),
      'receipt_delivered',
      'conversation:' || target_conversation_id::text,
      true
    );
  end if;

  return updated_count;
end;
$$;

revoke all on function public.mark_conversation_delivered(uuid) from public, anon;
grant execute on function public.mark_conversation_delivered(uuid) to authenticated;

create or replace function public.mark_conversation_read(target_conversation_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  event_time timestamptz := timezone('utc'::text, now());
  through_created_at timestamptz;
  updated_count integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception using errcode = '42501', message = 'Conversation access denied.';
  end if;

  select max(m.created_at)
    into through_created_at
  from public.message_receipts r
  join public.messages m on m.id = r.message_id
  where r.user_id = current_user_id
    and r.read_at is null
    and m.conversation_id = target_conversation_id;

  if through_created_at is null then
    return 0;
  end if;

  update public.message_receipts r
  set
    delivered_at = coalesce(r.delivered_at, event_time),
    read_at = event_time
  from public.messages m
  where m.id = r.message_id
    and r.user_id = current_user_id
    and r.read_at is null
    and m.conversation_id = target_conversation_id
    and m.created_at <= through_created_at;

  get diagnostics updated_count = row_count;

  update public.conversation_members cm
  set last_read_at = greatest(cm.last_read_at, through_created_at)
  where cm.conversation_id = target_conversation_id
    and cm.user_id = current_user_id;

  if updated_count > 0 then
    perform realtime.send(
      jsonb_build_object(
        'conversation_id', target_conversation_id,
        'recipient_user_id', current_user_id,
        'through_created_at', through_created_at,
        'read_at', event_time
      ),
      'receipt_read',
      'conversation:' || target_conversation_id::text,
      true
    );
  end if;

  return updated_count;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.mark_all_pending_delivered()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  pending_conversation record;
  conversation_count integer;
  total_count integer := 0;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required.';
  end if;

  for pending_conversation in
    select distinct m.conversation_id
    from public.message_receipts r
    join public.messages m on m.id = r.message_id
    where r.user_id = current_user_id
      and r.delivered_at is null
  loop
    conversation_count := public.mark_conversation_delivered(pending_conversation.conversation_id);
    total_count := total_count + coalesce(conversation_count, 0);
  end loop;

  return total_count;
end;
$$;

revoke all on function public.mark_all_pending_delivered() from public, anon;
grant execute on function public.mark_all_pending_delivered() to authenticated;

-- -----------------------------------------------------------------------------
-- Private user inbox topic. This lets an authenticated app know that one of its
-- conversations changed even when that particular chat route is not open.
-- Conversation topics remain membership-protected as in Phase 9.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_receive_pulsechat_broadcast(target_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_topic = 'user:' || (select auth.uid())::text
    or exists (
      select 1
      from public.conversation_members cm
      where cm.user_id = (select auth.uid())
        and target_topic = 'conversation:' || cm.conversation_id::text
    );
$$;

revoke all on function pulsechat_private.can_receive_pulsechat_broadcast(text)
  from public, anon, authenticated;
grant execute on function pulsechat_private.can_receive_pulsechat_broadcast(text)
  to authenticated;

-- Phase 9 helper is superseded by the combined conversation + user-topic helper.
revoke execute on function pulsechat_private.can_receive_conversation_broadcast(text)
  from authenticated;

drop policy if exists "pulsechat_members_receive_conversation_broadcasts"
  on realtime.messages;
drop policy if exists "pulsechat_users_receive_private_broadcasts"
  on realtime.messages;

create policy "pulsechat_users_receive_private_broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and pulsechat_private.can_receive_pulsechat_broadcast((select realtime.topic()))
);

-- Keep the Phase 9 conversation broadcast and additionally fan out a minimal
-- inbox event to each non-sender member's private user topic.
create or replace function pulsechat_private.broadcast_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient record;
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

  for recipient in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and (new.sender_id is null or cm.user_id <> new.sender_id)
  loop
    perform realtime.send(
      jsonb_build_object(
        'conversation_id', new.conversation_id,
        'message_id', new.id,
        'sender_id', new.sender_id,
        'created_at', new.created_at
      ),
      'inbox_message',
      'user:' || recipient.user_id::text,
      true
    );
  end loop;

  return null;
end;
$$;

revoke all on function pulsechat_private.broadcast_new_message()
  from public, anon, authenticated;

comment on function public.mark_conversation_delivered(uuid)
  is 'Phase 10: marks the authenticated recipient pending receipts delivered and broadcasts a monotonic cursor.';
comment on function public.mark_conversation_read(uuid)
  is 'Phase 10: marks the authenticated recipient pending receipts read, advances last_read_at, and broadcasts a cursor.';
comment on function public.get_my_total_unread_count()
  is 'Phase 10: lightweight total unread count for the Chats tab badge.';

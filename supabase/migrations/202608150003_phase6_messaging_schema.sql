-- PulseChat Phase 6: production messaging database foundation.
-- Run AFTER:
--   202608150001_phase4_auth_profiles.sql
--   202608150002_phase5_profiles_avatars.sql
--
-- Phase 6 creates the durable relational model and authorization boundaries.
-- It intentionally does NOT create chat-creation RPCs or Realtime broadcasts yet.
-- Those are added in later phases so every phase remains independently testable.

create schema if not exists pulsechat_private;
revoke all on schema pulsechat_private from public;

-- -----------------------------------------------------------------------------
-- Conversations
-- -----------------------------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  direct_key text,
  title text,
  avatar_path text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  last_message_at timestamptz not null default timezone('utc'::text, now()),
  constraint conversations_kind_check
    check (kind in ('direct', 'group')),
  constraint conversations_shape_check
    check (
      (
        kind = 'direct'
        and direct_key is not null
        and char_length(direct_key) = 73
        and title is null
      )
      or
      (
        kind = 'group'
        and direct_key is null
        and char_length(btrim(coalesce(title, ''))) between 1 and 100
      )
    )
);

-- Only one direct conversation may exist for the same canonical user pair.
create unique index if not exists conversations_direct_key_unique_idx
  on public.conversations (direct_key)
  where direct_key is not null;

create index if not exists conversations_last_message_at_idx
  on public.conversations (last_message_at desc, id);

-- -----------------------------------------------------------------------------
-- Conversation membership
-- -----------------------------------------------------------------------------

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default timezone('utc'::text, now()),
  last_read_at timestamptz not null default timezone('utc'::text, now()),
  muted_until timestamptz,
  primary key (conversation_id, user_id),
  constraint conversation_members_role_check
    check (role in ('member', 'admin', 'owner')),
  constraint conversation_members_muted_until_check
    check (muted_until is null or muted_until >= joined_at)
);

-- Most chat-list queries start from the signed-in user's memberships.
create index if not exists conversation_members_user_conversation_idx
  on public.conversation_members (user_id, conversation_id);

-- -----------------------------------------------------------------------------
-- Private authorization helpers used by RLS.
-- SECURITY DEFINER avoids recursive membership-policy evaluation. Every function
-- uses an empty search_path and fully-qualified relation names.
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.is_conversation_member(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = (select auth.uid())
  );
$$;

create or replace function pulsechat_private.is_conversation_admin(target_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = (select auth.uid())
      and cm.role in ('admin', 'owner')
  );
$$;

-- Canonical pair key used later by the Phase 8 direct-chat creation RPC.
create or replace function pulsechat_private.direct_conversation_key(user_a uuid, user_b uuid)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when user_a::text < user_b::text
      then user_a::text || ':' || user_b::text
    else user_b::text || ':' || user_a::text
  end;
$$;

-- Prevent internal/server code from accidentally creating admin/owner roles or
-- more than two memberships for a direct conversation.
create or replace function pulsechat_private.validate_conversation_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_kind text;
  direct_member_count integer;
begin
  select c.kind
    into conversation_kind
  from public.conversations c
  where c.id = new.conversation_id;

  if conversation_kind = 'direct' and new.role <> 'member' then
    raise exception 'Direct-conversation members must use the member role.';
  end if;

  if conversation_kind = 'direct' then
    if tg_op = 'UPDATE' then
      select count(*)
        into direct_member_count
      from public.conversation_members cm
      where cm.conversation_id = new.conversation_id
        and not (
          cm.conversation_id = old.conversation_id
          and cm.user_id = old.user_id
        );
    else
      select count(*)
        into direct_member_count
      from public.conversation_members cm
      where cm.conversation_id = new.conversation_id;
    end if;

    if direct_member_count >= 2 then
      raise exception 'A direct conversation cannot contain more than two members.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_conversation_member on public.conversation_members;
create trigger validate_conversation_member
before insert or update of conversation_id, user_id, role
on public.conversation_members
for each row
execute function pulsechat_private.validate_conversation_member();

-- -----------------------------------------------------------------------------
-- Messages
-- -----------------------------------------------------------------------------

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  client_message_id uuid not null,
  message_type text not null default 'text',
  body text,
  reply_to_message_id uuid,
  created_at timestamptz not null default timezone('utc'::text, now()),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_type_check
    check (message_type in ('text', 'image', 'video', 'audio', 'voice', 'file', 'system')),
  constraint messages_body_length_check
    check (body is null or char_length(body) <= 10000),
  constraint messages_text_body_check
    check (
      deleted_at is not null
      or message_type <> 'text'
      or char_length(btrim(coalesce(body, ''))) between 1 and 10000
    ),
  constraint messages_edited_at_check
    check (edited_at is null or edited_at >= created_at),
  constraint messages_deleted_at_check
    check (deleted_at is null or deleted_at >= created_at),
  constraint messages_sender_client_unique
    unique (sender_id, client_message_id),
  constraint messages_id_conversation_unique
    unique (id, conversation_id),
  constraint messages_reply_same_conversation_fk
    foreign key (reply_to_message_id, conversation_id)
    references public.messages(id, conversation_id)
    deferrable initially deferred
);

-- Cursor pagination: conversation + newest messages first, with id as a stable
-- tie-breaker when timestamps are identical.
create index if not exists messages_conversation_page_idx
  on public.messages (conversation_id, created_at desc, id desc);

create index if not exists messages_sender_created_at_idx
  on public.messages (sender_id, created_at desc)
  where sender_id is not null;

-- -----------------------------------------------------------------------------
-- Delivery/read receipts
-- -----------------------------------------------------------------------------

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  primary key (message_id, user_id),
  constraint message_receipts_read_requires_delivery
    check (read_at is null or delivered_at is not null),
  constraint message_receipts_timestamp_order
    check (read_at is null or read_at >= delivered_at)
);

create index if not exists message_receipts_user_state_idx
  on public.message_receipts (user_id, read_at, delivered_at, message_id);

-- -----------------------------------------------------------------------------
-- Attachment metadata
-- -----------------------------------------------------------------------------
-- The chat-media Storage bucket and write policies are intentionally deferred to
-- Phase 12. Creating metadata now keeps the relational model stable.

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  uploader_id uuid references auth.users(id) on delete set null,
  storage_bucket text not null default 'chat-media',
  storage_path text not null,
  mime_type text not null,
  file_name text,
  file_size bigint,
  width integer,
  height integer,
  duration_ms integer,
  created_at timestamptz not null default timezone('utc'::text, now()),
  constraint attachments_storage_location_unique
    unique (storage_bucket, storage_path),
  constraint attachments_storage_bucket_check
    check (storage_bucket = 'chat-media'),
  constraint attachments_file_size_check
    check (file_size is null or file_size between 1 and 104857600),
  constraint attachments_width_check
    check (width is null or width > 0),
  constraint attachments_height_check
    check (height is null or height > 0),
  constraint attachments_duration_check
    check (duration_ms is null or duration_ms >= 0)
);

create index if not exists attachments_message_idx
  on public.attachments (message_id, created_at, id);

-- -----------------------------------------------------------------------------
-- Message-aware authorization helper
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.can_access_message(target_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
    where m.id = target_message_id
      and cm.user_id = (select auth.uid())
  );
$$;

-- -----------------------------------------------------------------------------
-- Timestamp/activity triggers
-- -----------------------------------------------------------------------------

create or replace function pulsechat_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_conversations_updated_at on public.conversations;
create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function pulsechat_private.set_updated_at();

drop trigger if exists set_message_receipts_updated_at on public.message_receipts;
create trigger set_message_receipts_updated_at
before update on public.message_receipts
for each row
execute function pulsechat_private.set_updated_at();

-- A successful message INSERT advances chat-list ordering. SECURITY DEFINER is
-- required because clients are not granted direct access to last_message_at.
create or replace function pulsechat_private.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations c
  set last_message_at = greatest(c.last_message_at, new.created_at)
  where c.id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists touch_conversation_after_message on public.messages;
create trigger touch_conversation_after_message
after insert on public.messages
for each row
execute function pulsechat_private.touch_conversation_after_message();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.attachments enable row level security;

-- Conversations: membership is required to read. Group admins may later update
-- only the explicitly granted title/avatar columns.
drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member"
on public.conversations
for select
to authenticated
using (pulsechat_private.is_conversation_member(id));

drop policy if exists "conversations_update_group_admin" on public.conversations;
create policy "conversations_update_group_admin"
on public.conversations
for update
to authenticated
using (kind = 'group' and pulsechat_private.is_conversation_admin(id))
with check (kind = 'group' and pulsechat_private.is_conversation_admin(id));

-- Membership rows are visible only inside conversations the caller belongs to.
-- A user may change only their own read/mute state; role/member management is
-- server-controlled until the group-management phase.
drop policy if exists "conversation_members_select_member" on public.conversation_members;
create policy "conversation_members_select_member"
on public.conversation_members
for select
to authenticated
using (pulsechat_private.is_conversation_member(conversation_id));

drop policy if exists "conversation_members_update_own_state" on public.conversation_members;
create policy "conversation_members_update_own_state"
on public.conversation_members
for update
to authenticated
using (
  user_id = (select auth.uid())
  and pulsechat_private.is_conversation_member(conversation_id)
)
with check (
  user_id = (select auth.uid())
  and pulsechat_private.is_conversation_member(conversation_id)
);

-- Messages can be read only by members. A new message must identify the current
-- user as sender and target one of their conversations.
drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member"
on public.messages
for select
to authenticated
using (pulsechat_private.is_conversation_member(conversation_id));

drop policy if exists "messages_insert_member_as_self" on public.messages;
create policy "messages_insert_member_as_self"
on public.messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and pulsechat_private.is_conversation_member(conversation_id)
);

-- Receipts are readable by conversation members. Each client may create/update
-- only its own receipt row for a message it is authorized to see.
drop policy if exists "message_receipts_select_member" on public.message_receipts;
create policy "message_receipts_select_member"
on public.message_receipts
for select
to authenticated
using (pulsechat_private.can_access_message(message_id));

drop policy if exists "message_receipts_insert_own" on public.message_receipts;
create policy "message_receipts_insert_own"
on public.message_receipts
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and pulsechat_private.can_access_message(message_id)
);

drop policy if exists "message_receipts_update_own" on public.message_receipts;
create policy "message_receipts_update_own"
on public.message_receipts
for update
to authenticated
using (
  user_id = (select auth.uid())
  and pulsechat_private.can_access_message(message_id)
)
with check (
  user_id = (select auth.uid())
  and pulsechat_private.can_access_message(message_id)
);

-- Attachment metadata is readable with the parent message. Client-side writes
-- remain revoked until Phase 12 adds the media-storage flow and its RLS.
drop policy if exists "attachments_select_member" on public.attachments;
create policy "attachments_select_member"
on public.attachments
for select
to authenticated
using (pulsechat_private.can_access_message(message_id));

-- -----------------------------------------------------------------------------
-- API privileges: least privilege in addition to RLS
-- -----------------------------------------------------------------------------

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.conversation_members from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.message_receipts from anon, authenticated;
revoke all on table public.attachments from anon, authenticated;

-- Reads are still filtered by RLS.
grant select on table public.conversations to authenticated;
grant select on table public.conversation_members to authenticated;
grant select on table public.messages to authenticated;
grant select on table public.message_receipts to authenticated;
grant select on table public.attachments to authenticated;

-- Group metadata only. RLS additionally requires admin/owner membership.
grant update (title, avatar_path) on table public.conversations to authenticated;

-- Users can maintain only their own read/mute state. Role and membership remain
-- inaccessible because no column privilege is granted for them.
grant update (last_read_at, muted_until) on table public.conversation_members to authenticated;

-- Phase 9 will use these existing safe INSERT privileges for text messaging.
grant insert (
  conversation_id,
  sender_id,
  client_message_id,
  message_type,
  body,
  reply_to_message_id
) on table public.messages to authenticated;

-- Phase 10 uses upsert semantics for delivery/read state.
grant insert (message_id, user_id, delivered_at, read_at)
  on table public.message_receipts to authenticated;
grant update (delivered_at, read_at)
  on table public.message_receipts to authenticated;

-- No app-level INSERT/DELETE privilege exists yet for conversations, memberships,
-- or attachments. Conversation creation will go through narrow database RPCs.

-- RLS helpers live in a non-exposed schema. Authenticated users need schema
-- USAGE/EXECUTE so PostgreSQL can evaluate the policies, but the schema itself
-- is not added to Supabase's exposed Data API schemas. Trigger-only/internal
-- helpers remain non-executable by client roles.
revoke all on all functions in schema pulsechat_private from public, anon, authenticated;
revoke all on schema pulsechat_private from public, anon, authenticated;
grant usage on schema pulsechat_private to authenticated;
grant execute on function pulsechat_private.is_conversation_member(uuid) to authenticated;
grant execute on function pulsechat_private.is_conversation_admin(uuid) to authenticated;
grant execute on function pulsechat_private.can_access_message(uuid) to authenticated;

-- Metadata comments make the intent discoverable in Supabase/Postgres tools.
comment on table public.conversations is 'PulseChat direct/group conversation metadata.';
comment on column public.conversations.direct_key is 'Canonical sorted UUID pair; only used for direct-chat uniqueness.';
comment on table public.conversation_members is 'Membership, group role, read cursor, and mute state.';
comment on table public.messages is 'Durable ordered message records; client_message_id provides retry idempotency.';
comment on table public.message_receipts is 'Per-recipient delivered/read state.';
comment on table public.attachments is 'Future chat-media metadata; Storage writes are enabled in Phase 12.';

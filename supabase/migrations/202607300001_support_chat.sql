create extension if not exists pgcrypto;

create type public.admin_role as enum ('owner', 'operator');
create type public.support_conversation_status as enum ('bot_active', 'waiting', 'human_active', 'resolved');
create type public.support_message_sender as enum ('visitor', 'bot', 'operator', 'system');
create type public.support_message_type as enum ('text', 'handoff', 'status');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null,
  role public.admin_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  visitor_id uuid not null references auth.users(id) on delete cascade,
  status public.support_conversation_status not null default 'bot_active',
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_name text,
  handoff_reason text check (
    handoff_reason is null or handoff_reason in ('fallback', 'negativeFeedback', 'manualContact', 'handoffRecommended')
  ),
  contact_name text check (contact_name is null or char_length(contact_name) between 1 and 80),
  contact_value text check (contact_value is null or char_length(contact_value) between 1 and 160),
  privacy_agreed_at timestamptz,
  unread_for_visitor integer not null default 0 check (unread_for_visitor >= 0),
  unread_for_admins integer not null default 0 check (unread_for_admins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  client_id text not null unique check (char_length(client_id) between 1 and 180),
  sender public.support_message_sender not null,
  sender_id uuid references auth.users(id) on delete set null,
  sender_name text,
  type public.support_message_type not null default 'text',
  body text not null check (char_length(trim(body)) between 1 and 3000),
  matched_knowledge_ids text[] not null default '{}',
  confidence text check (confidence is null or confidence in ('high', 'medium', 'low')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.support_internal_notes (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create index support_conversations_bot_last_message_idx
  on public.support_conversations (bot_id, last_message_at desc);
create index support_conversations_visitor_idx
  on public.support_conversations (visitor_id, updated_at desc);
create index support_conversations_status_idx
  on public.support_conversations (status, last_message_at desc);
create index support_messages_conversation_created_idx
  on public.support_messages (conversation_id, created_at);
create index support_internal_notes_conversation_created_idx
  on public.support_internal_notes (conversation_id, created_at);

alter table public.profiles enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.support_internal_notes enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.support_conversations to authenticated;
grant select on public.support_messages to authenticated;
grant select, insert on public.support_internal_notes to authenticated;

create or replace function public.is_support_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id and active = true
  );
$$;

create or replace function public.is_support_owner(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id and active = true and role = 'owner'
  );
$$;

create policy "admins can read profiles"
on public.profiles for select
to authenticated
using (public.is_support_admin());

create policy "owners can manage profiles"
on public.profiles for all
to authenticated
using (public.is_support_owner())
with check (public.is_support_owner());

create policy "visitors and admins can read conversations"
on public.support_conversations for select
to authenticated
using (visitor_id = auth.uid() or public.is_support_admin());

create policy "visitors and admins can read messages"
on public.support_messages for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations conversation
    where conversation.id = conversation_id
      and (conversation.visitor_id = auth.uid() or public.is_support_admin())
  )
);

create policy "admins can read internal notes"
on public.support_internal_notes for select
to authenticated
using (public.is_support_admin());

create policy "admins can create internal notes"
on public.support_internal_notes for insert
to authenticated
with check (public.is_support_admin() and author_id = auth.uid());

create or replace function public.create_support_conversation(p_bot_id text)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.support_conversations;
begin
  if auth.uid() is null or public.is_support_admin() then
    raise exception 'visitor_session_required';
  end if;
  if nullif(trim(p_bot_id), '') is null then
    raise exception 'bot_id_required';
  end if;
  if (
    select count(*)
    from public.support_conversations
    where visitor_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 10 then
    raise exception 'conversation_rate_limit';
  end if;

  insert into public.support_conversations (bot_id, visitor_id)
  values (trim(p_bot_id), auth.uid())
  returning * into conversation;
  return conversation;
end;
$$;

create or replace function public.append_support_message(
  p_conversation_id uuid,
  p_client_id text,
  p_sender public.support_message_sender,
  p_message_type public.support_message_type,
  p_body text,
  p_matched_knowledge_ids text[] default '{}',
  p_confidence text default null,
  p_sender_name text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.support_conversations;
  existing_message public.support_messages;
  inserted_message public.support_messages;
  timestamp_now timestamptz := now();
begin
  select * into conversation
  from public.support_conversations
  where id = p_conversation_id
  for update;
  if not found then
    raise exception 'conversation_not_found';
  end if;

  if conversation.visitor_id <> auth.uid() and not public.is_support_admin() then
    raise exception 'conversation_access_denied';
  end if;

  select * into existing_message
  from public.support_messages
  where client_id = p_client_id and conversation_id = p_conversation_id;
  if found then
    return existing_message;
  end if;

  if p_sender = 'visitor' then
    if conversation.visitor_id <> auth.uid() then
      raise exception 'visitor_access_denied';
    end if;
    if conversation.status = 'resolved' then
      update public.support_conversations
      set status = 'human_active', resolved_at = null
      where id = p_conversation_id;
    end if;
    if (
      select count(*)
      from public.support_messages
      where conversation_id = p_conversation_id
        and sender = 'visitor'
        and created_at > now() - interval '1 minute'
    ) >= 20 then
      raise exception 'message_rate_limit';
    end if;
    p_sender_name := null;
  elsif p_sender = 'bot' then
    if conversation.visitor_id <> auth.uid() or conversation.status <> 'bot_active' then
      raise exception 'bot_message_not_allowed';
    end if;
    p_sender_name := null;
  elsif p_sender = 'operator' then
    if not public.is_support_admin() then
      raise exception 'admin_access_denied';
    end if;
    if conversation.status <> 'human_active' then
      raise exception 'conversation_not_claimed';
    end if;
    if conversation.assigned_to <> auth.uid() then
      raise exception 'conversation_owned_by_another_operator';
    end if;
    select display_name into p_sender_name
    from public.profiles
    where id = auth.uid() and active = true;
  else
    raise exception 'system_messages_use_state_functions';
  end if;

  insert into public.support_messages (
    conversation_id,
    client_id,
    sender,
    sender_id,
    sender_name,
    type,
    body,
    matched_knowledge_ids,
    confidence,
    metadata
  )
  values (
    p_conversation_id,
    p_client_id,
    p_sender,
    auth.uid(),
    p_sender_name,
    p_message_type,
    trim(p_body),
    coalesce(p_matched_knowledge_ids, '{}'),
    p_confidence,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_message;

  update public.support_conversations
  set
    updated_at = timestamp_now,
    last_message_at = timestamp_now,
    unread_for_admins = unread_for_admins + case when p_sender = 'visitor' then 1 else 0 end,
    unread_for_visitor = unread_for_visitor + case when p_sender = 'operator' then 1 else 0 end
  where id = p_conversation_id;

  return inserted_message;
end;
$$;

create or replace function public.request_support_handoff(
  p_conversation_id uuid,
  p_contact_name text,
  p_contact_value text,
  p_privacy_agreed_at timestamptz,
  p_reason text
)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_conversation public.support_conversations;
begin
  if nullif(trim(p_contact_name), '') is null
    or nullif(trim(p_contact_value), '') is null
    or p_privacy_agreed_at is null then
    raise exception 'handoff_contact_required';
  end if;

  update public.support_conversations
  set
    status = 'waiting',
    contact_name = trim(p_contact_name),
    contact_value = trim(p_contact_value),
    privacy_agreed_at = p_privacy_agreed_at,
    handoff_reason = p_reason,
    updated_at = now()
  where id = p_conversation_id
    and visitor_id = auth.uid()
    and status in ('bot_active', 'resolved')
  returning * into updated_conversation;
  if not found then
    raise exception 'handoff_not_allowed';
  end if;

  insert into public.support_messages (
    conversation_id,
    client_id,
    sender,
    type,
    body
  )
  values (
    p_conversation_id,
    'handoff-' || gen_random_uuid()::text,
    'system',
    'handoff',
    '상담원 연결을 요청했습니다.'
  );

  return updated_conversation;
end;
$$;

create or replace function public.claim_support_conversation(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.support_conversations;
  admin_name text;
begin
  if not public.is_support_admin() then
    raise exception 'admin_access_denied';
  end if;
  select display_name into admin_name
  from public.profiles
  where id = auth.uid() and active = true;

  select * into conversation
  from public.support_conversations
  where id = p_conversation_id
  for update;
  if not found then
    raise exception 'conversation_not_found';
  end if;
  if conversation.assigned_to is not null and conversation.assigned_to <> auth.uid() then
    raise exception 'conversation_already_claimed';
  end if;
  if conversation.status not in ('waiting', 'human_active') then
    raise exception 'conversation_not_waiting';
  end if;

  update public.support_conversations
  set
    assigned_to = auth.uid(),
    assigned_name = admin_name,
    status = 'human_active',
    updated_at = now()
  where id = p_conversation_id
  returning * into conversation;

  return conversation;
end;
$$;

create or replace function public.resolve_support_conversation(p_conversation_id uuid)
returns public.support_conversations
language plpgsql
security definer
set search_path = public
as $$
declare
  conversation public.support_conversations;
begin
  select * into conversation
  from public.support_conversations
  where id = p_conversation_id
  for update;
  if not found then
    raise exception 'conversation_not_found';
  end if;
  if not public.is_support_admin()
    or (conversation.assigned_to is distinct from auth.uid() and not public.is_support_owner()) then
    raise exception 'resolve_not_allowed';
  end if;

  update public.support_conversations
  set status = 'resolved', resolved_at = now(), updated_at = now()
  where id = p_conversation_id
  returning * into conversation;

  insert into public.support_messages (
    conversation_id,
    client_id,
    sender,
    sender_id,
    sender_name,
    type,
    body
  )
  values (
    p_conversation_id,
    'resolved-' || gen_random_uuid()::text,
    'system',
    auth.uid(),
    conversation.assigned_name,
    'status',
    '상담이 완료되었습니다. 추가 메시지를 보내면 같은 상담이 다시 열립니다.'
  );

  return conversation;
end;
$$;

create or replace function public.mark_support_conversation_read(
  p_conversation_id uuid,
  p_audience text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_audience = 'visitor' then
    update public.support_conversations
    set unread_for_visitor = 0
    where id = p_conversation_id and visitor_id = auth.uid();
  elsif p_audience = 'admin' and public.is_support_admin() then
    update public.support_conversations
    set unread_for_admins = 0
    where id = p_conversation_id;
  else
    raise exception 'mark_read_not_allowed';
  end if;
end;
$$;

revoke all on function public.is_support_admin(uuid) from public;
revoke all on function public.is_support_owner(uuid) from public;
revoke all on function public.create_support_conversation(text) from public;
revoke all on function public.append_support_message(
  uuid, text, public.support_message_sender, public.support_message_type, text, text[], text, text, jsonb
) from public;
revoke all on function public.request_support_handoff(uuid, text, text, timestamptz, text) from public;
revoke all on function public.claim_support_conversation(uuid) from public;
revoke all on function public.resolve_support_conversation(uuid) from public;
revoke all on function public.mark_support_conversation_read(uuid, text) from public;
grant execute on function public.is_support_admin(uuid) to authenticated;
grant execute on function public.is_support_owner(uuid) to authenticated;
grant execute on function public.create_support_conversation(text) to authenticated;
grant execute on function public.append_support_message(
  uuid, text, public.support_message_sender, public.support_message_type, text, text[], text, text, jsonb
) to authenticated;
grant execute on function public.request_support_handoff(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.claim_support_conversation(uuid) to authenticated;
grant execute on function public.resolve_support_conversation(uuid) to authenticated;
grant execute on function public.mark_support_conversation_read(uuid, text) to authenticated;

alter publication supabase_realtime add table public.support_conversations;
alter publication supabase_realtime add table public.support_messages;

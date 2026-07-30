alter table public.support_conversations
  add column contact_channel text check (contact_channel is null or contact_channel in ('email', 'sms')),
  add column consent_version text,
  add column first_response_due_at timestamptz,
  add column first_responded_at timestamptz;

create table public.support_conversation_participants (
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

insert into public.support_conversation_participants (conversation_id, user_id)
select id, visitor_id from public.support_conversations
on conflict do nothing;

create table public.support_audit_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  action text not null check (action in (
    'handoff_requested', 'conversation_claimed', 'conversation_transferred',
    'conversation_resolved', 'conversation_reopened', 'contact_anonymized', 'contact_viewed'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.support_saved_replies (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 80),
  body text not null check (char_length(trim(body)) between 1 and 3000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_search_events (
  id text primary key,
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  bot_id text not null,
  event jsonb not null,
  created_at timestamptz not null default now()
);

create type public.notification_outbox_status as enum (
  'pending', 'processing', 'sent', 'cancelled', 'failed', 'dead'
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  message_id uuid not null references public.support_messages(id) on delete cascade,
  channel text not null check (channel in ('email', 'sms', 'log')),
  status public.notification_outbox_status not null default 'pending',
  available_at timestamptz not null default (now() + interval '2 minutes'),
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create table public.support_resume_tokens (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '7 days'),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.bot_security_settings (
  bot_id text primary key,
  require_captcha boolean not null default false,
  allowed_origins text[] not null default '{}',
  retention_days integer not null default 180 check (retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

create table public.support_verified_visitors (
  user_id uuid not null references auth.users(id) on delete cascade,
  bot_id text not null,
  verified_until timestamptz not null,
  origin text,
  created_at timestamptz not null default now(),
  primary key (user_id, bot_id)
);

create type public.bot_config_state as enum ('draft', 'published', 'archived');

create table public.bot_config_versions (
  id uuid primary key default gen_random_uuid(),
  bot_id text not null,
  version integer not null check (version > 0),
  state public.bot_config_state not null,
  config jsonb not null check (jsonb_typeof(config) = 'object'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (bot_id, version)
);

create unique index bot_config_one_draft_idx
  on public.bot_config_versions (bot_id) where state = 'draft';
create unique index bot_config_one_published_idx
  on public.bot_config_versions (bot_id) where state = 'published';
create index support_participants_user_idx
  on public.support_conversation_participants (user_id, conversation_id);
create index support_audit_conversation_idx
  on public.support_audit_events (conversation_id, created_at);
create index support_saved_replies_bot_idx
  on public.support_saved_replies (bot_id, title);
create index support_search_events_bot_created_idx
  on public.support_search_events (bot_id, created_at desc);
create index notification_outbox_pending_idx
  on public.notification_outbox (status, available_at)
  where status in ('pending', 'failed');

alter table public.support_conversation_participants enable row level security;
alter table public.support_audit_events enable row level security;
alter table public.support_saved_replies enable row level security;
alter table public.support_search_events enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.support_resume_tokens enable row level security;
alter table public.bot_security_settings enable row level security;
alter table public.support_verified_visitors enable row level security;
alter table public.bot_config_versions enable row level security;

drop policy "visitors and admins can read conversations" on public.support_conversations;
create policy "participants and admins can read conversations"
on public.support_conversations for select to authenticated
using (
  public.is_support_admin()
  or exists (
    select 1 from public.support_conversation_participants participant
    where participant.conversation_id = id and participant.user_id = auth.uid()
  )
);

drop policy "visitors and admins can read messages" on public.support_messages;
create policy "participants and admins can read messages"
on public.support_messages for select to authenticated
using (
  public.is_support_admin()
  or exists (
    select 1 from public.support_conversation_participants participant
    where participant.conversation_id = support_messages.conversation_id
      and participant.user_id = auth.uid()
  )
);

create policy "participants can read memberships"
on public.support_conversation_participants for select to authenticated
using (user_id = auth.uid() or public.is_support_admin());
create policy "admins can read audit"
on public.support_audit_events for select to authenticated
using (public.is_support_admin());
create policy "admins manage saved replies"
on public.support_saved_replies for all to authenticated
using (public.is_support_admin()) with check (public.is_support_admin() and created_by = auth.uid());
create policy "participants create search events"
on public.support_search_events for insert to authenticated
with check (exists (
  select 1 from public.support_conversation_participants participant
  where participant.conversation_id = support_search_events.conversation_id
    and participant.user_id = auth.uid()
));
create policy "admins read search events"
on public.support_search_events for select to authenticated
using (public.is_support_admin());
create policy "admins read outbox"
on public.notification_outbox for select to authenticated
using (public.is_support_admin());
create policy "published configs are public"
on public.bot_config_versions for select to anon, authenticated
using (state = 'published');
create policy "admins read all configs"
on public.bot_config_versions for select to authenticated
using (public.is_support_admin());
create policy "admins read bot security"
on public.bot_security_settings for select to authenticated
using (public.is_support_admin());
create policy "owners manage bot security"
on public.bot_security_settings for all to authenticated
using (public.is_support_owner()) with check (public.is_support_owner());

grant select on public.support_conversation_participants to authenticated;
grant select on public.support_audit_events to authenticated;
grant select, insert, update, delete on public.support_saved_replies to authenticated;
grant select, insert on public.support_search_events to authenticated;
grant select on public.notification_outbox to authenticated;
grant select on public.bot_config_versions to anon, authenticated;
grant select, insert, update, delete on public.bot_security_settings to authenticated;

create or replace function public.add_initial_support_participant()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.support_conversation_participants (conversation_id, user_id)
  values (new.id, new.visitor_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger support_conversation_initial_participant
after insert on public.support_conversations
for each row execute function public.add_initial_support_participant();

create or replace function public.create_support_conversation(p_bot_id text)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  conversation public.support_conversations;
  captcha_required boolean;
begin
  if auth.uid() is null or public.is_support_admin() then raise exception 'visitor_session_required'; end if;
  if nullif(trim(p_bot_id), '') is null then raise exception 'bot_id_required'; end if;
  select coalesce(require_captcha, false) into captcha_required
  from public.bot_security_settings where bot_id = trim(p_bot_id);
  if captcha_required and not exists (
    select 1 from public.support_verified_visitors
    where user_id = auth.uid() and bot_id = trim(p_bot_id) and verified_until > now()
  ) then raise exception 'captcha_verification_required'; end if;
  if (
    select count(*) from public.support_conversations
    where visitor_id = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 10 then raise exception 'conversation_rate_limit'; end if;
  insert into public.support_conversations (bot_id, visitor_id)
  values (trim(p_bot_id), auth.uid()) returning * into conversation;
  return conversation;
end;
$$;

create or replace function public.support_conversation_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  action_name text;
  admin_name text;
begin
  if old.status <> new.status then
    action_name := case
      when new.status = 'waiting' then 'handoff_requested'
      when new.status = 'resolved' then 'conversation_resolved'
      when old.status = 'resolved' and new.status = 'human_active' then 'conversation_reopened'
      else null
    end;
  end if;
  if old.assigned_to is distinct from new.assigned_to then
    action_name := case when old.assigned_to is null
      then 'conversation_claimed' else 'conversation_transferred' end;
  end if;
  if action_name is not null then
    select display_name into admin_name from public.profiles where id = auth.uid();
    insert into public.support_audit_events (
      conversation_id, actor_id, actor_name, action, metadata
    ) values (
      new.id, auth.uid(), admin_name, action_name,
      jsonb_build_object('assignedTo', coalesce(new.assigned_to::text, ''))
    );
  end if;
  return new;
end;
$$;

create trigger support_conversation_audit
after update on public.support_conversations
for each row execute function public.support_conversation_audit_trigger();

create or replace function public.support_operator_message_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  channel_name text;
begin
  if new.sender <> 'operator' then return new; end if;
  update public.support_conversations
  set first_responded_at = coalesce(first_responded_at, new.created_at)
  where id = new.conversation_id;
  select coalesce(contact_channel, 'log') into channel_name
  from public.support_conversations where id = new.conversation_id;
  insert into public.notification_outbox (conversation_id, message_id, channel)
  values (new.conversation_id, new.id, channel_name)
  on conflict do nothing;
  return new;
end;
$$;

create trigger support_operator_message_outbox
after insert on public.support_messages
for each row execute function public.support_operator_message_trigger();

drop function public.request_support_handoff(uuid, text, text, timestamptz, text);
create function public.request_support_handoff(
  p_conversation_id uuid,
  p_contact_name text,
  p_contact_value text,
  p_privacy_agreed_at timestamptz,
  p_reason text,
  p_contact_channel text,
  p_consent_version text,
  p_first_response_due_at timestamptz
)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  updated_conversation public.support_conversations;
begin
  if nullif(trim(p_contact_name), '') is null
    or nullif(trim(p_contact_value), '') is null
    or p_privacy_agreed_at is null
    or p_contact_channel not in ('email', 'sms') then
    raise exception 'handoff_contact_required';
  end if;
  update public.support_conversations set
    status = 'waiting',
    contact_name = trim(p_contact_name),
    contact_value = trim(p_contact_value),
    contact_channel = p_contact_channel,
    consent_version = nullif(trim(p_consent_version), ''),
    privacy_agreed_at = p_privacy_agreed_at,
    handoff_reason = p_reason,
    first_response_due_at = coalesce(p_first_response_due_at, now() + interval '4 hours'),
    updated_at = now(),
    last_message_at = now()
  where id = p_conversation_id
    and status in ('bot_active', 'resolved')
    and exists (
      select 1 from public.support_conversation_participants
      where conversation_id = p_conversation_id and user_id = auth.uid()
    )
  returning * into updated_conversation;
  if not found then raise exception 'handoff_not_allowed'; end if;
  insert into public.support_messages (conversation_id, client_id, sender, type, body)
  values (
    p_conversation_id, 'handoff-' || gen_random_uuid()::text, 'system', 'handoff',
    '상담원 연결을 요청했습니다.'
  );
  return updated_conversation;
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
language plpgsql security definer set search_path = public as $$
declare
  conversation public.support_conversations;
  existing_message public.support_messages;
  inserted_message public.support_messages;
  is_participant boolean;
  timestamp_now timestamptz := now();
begin
  select * into conversation from public.support_conversations
  where id = p_conversation_id for update;
  if not found then raise exception 'conversation_not_found'; end if;
  select exists (
    select 1 from public.support_conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) into is_participant;
  if not is_participant and not public.is_support_admin() then
    raise exception 'conversation_access_denied';
  end if;
  select * into existing_message from public.support_messages
  where client_id = p_client_id and conversation_id = p_conversation_id;
  if found then return existing_message; end if;

  if p_sender = 'visitor' then
    if not is_participant or public.is_support_admin() then raise exception 'visitor_access_denied'; end if;
    if conversation.status = 'resolved' then
      update public.support_conversations
      set status = 'human_active', resolved_at = null
      where id = p_conversation_id;
    end if;
    if (
      select count(*) from public.support_messages
      where conversation_id = p_conversation_id
        and sender = 'visitor' and created_at > now() - interval '1 minute'
    ) >= 20 then raise exception 'message_rate_limit'; end if;
    p_sender_name := null;
  elsif p_sender = 'bot' then
    if not is_participant or conversation.status <> 'bot_active' then
      raise exception 'bot_message_not_allowed';
    end if;
    p_sender_name := null;
  elsif p_sender = 'operator' then
    if not public.is_support_admin() then raise exception 'admin_access_denied'; end if;
    if conversation.status <> 'human_active' then raise exception 'conversation_not_claimed'; end if;
    if conversation.assigned_to <> auth.uid() then
      raise exception 'conversation_owned_by_another_operator';
    end if;
    select display_name into p_sender_name from public.profiles
    where id = auth.uid() and active = true;
  else
    raise exception 'system_messages_use_state_functions';
  end if;

  insert into public.support_messages (
    conversation_id, client_id, sender, sender_id, sender_name, type, body,
    matched_knowledge_ids, confidence, metadata
  ) values (
    p_conversation_id, p_client_id, p_sender, auth.uid(), p_sender_name,
    p_message_type, trim(p_body), coalesce(p_matched_knowledge_ids, '{}'),
    p_confidence, coalesce(p_metadata, '{}'::jsonb)
  ) returning * into inserted_message;
  update public.support_conversations set
    updated_at = timestamp_now,
    last_message_at = timestamp_now,
    unread_for_admins = unread_for_admins + case when p_sender = 'visitor' then 1 else 0 end,
    unread_for_visitor = unread_for_visitor + case when p_sender = 'operator' then 1 else 0 end
  where id = p_conversation_id;
  return inserted_message;
end;
$$;

create or replace function public.query_support_conversations(
  p_bot_id text,
  p_status public.support_conversation_status default null,
  p_assignment text default 'all',
  p_search text default null,
  p_sla text default 'all',
  p_cursor uuid default null,
  p_limit integer default 30
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_support_admin() then raise exception 'admin_access_denied'; end if;
  with filtered as (
    select conversation.*
    from public.support_conversations conversation
    where conversation.bot_id = p_bot_id
      and (p_status is null or conversation.status = p_status)
      and (p_assignment = 'all'
        or (p_assignment = 'unassigned' and conversation.assigned_to is null)
        or (p_assignment = 'mine' and conversation.assigned_to = auth.uid()))
      and (p_sla = 'all'
        or (p_sla = 'overdue' and conversation.first_responded_at is null
          and conversation.first_response_due_at < now())
        or (p_sla = 'dueSoon' and conversation.first_responded_at is null
          and conversation.first_response_due_at between now() and now() + interval '1 hour'))
      and (nullif(trim(p_search), '') is null
        or conversation.contact_name ilike '%' || trim(p_search) || '%'
        or conversation.contact_value ilike '%' || trim(p_search) || '%'
        or exists (
          select 1 from public.support_messages message
          where message.conversation_id = conversation.id
            and message.body ilike '%' || trim(p_search) || '%'
        ))
      and (p_cursor is null or (conversation.last_message_at, conversation.id) < (
        select cursor_conversation.last_message_at, cursor_conversation.id
        from public.support_conversations cursor_conversation where cursor_conversation.id = p_cursor
      ))
    order by conversation.last_message_at desc, conversation.id desc
    limit least(greatest(p_limit, 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(to_jsonb(filtered) order by last_message_at desc, id desc), '[]'::jsonb),
    'nextCursor', case when count(*) = least(greatest(p_limit, 1), 100)
      then (array_agg(id order by last_message_at desc, id desc))[count(*)::integer]::text else null end
  ) into result from filtered;
  return result;
end;
$$;

create or replace function public.transfer_support_conversation(
  p_conversation_id uuid,
  p_to_admin_id uuid
)
returns public.support_conversations
language plpgsql security definer set search_path = public as $$
declare
  conversation public.support_conversations;
  target_name text;
begin
  select * into conversation from public.support_conversations
  where id = p_conversation_id for update;
  if not found then raise exception 'conversation_not_found'; end if;
  if not public.is_support_owner()
    and conversation.assigned_to is distinct from auth.uid() then
    raise exception 'transfer_not_allowed';
  end if;
  select display_name into target_name from public.profiles
  where id = p_to_admin_id and active = true;
  if target_name is null then raise exception 'target_admin_not_found'; end if;
  update public.support_conversations set
    assigned_to = p_to_admin_id,
    assigned_name = target_name,
    status = 'human_active',
    updated_at = now()
  where id = p_conversation_id returning * into conversation;
  return conversation;
end;
$$;

create or replace function public.mark_support_conversation_read(
  p_conversation_id uuid,
  p_audience text
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_audience = 'visitor' and exists (
    select 1 from public.support_conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then
    update public.support_conversations set unread_for_visitor = 0 where id = p_conversation_id;
    update public.notification_outbox
    set status = 'cancelled', updated_at = now()
    where conversation_id = p_conversation_id and status = 'pending';
  elsif p_audience = 'admin' and public.is_support_admin() then
    update public.support_conversations set unread_for_admins = 0 where id = p_conversation_id;
  else
    raise exception 'mark_read_not_allowed';
  end if;
end;
$$;

create or replace function public.anonymize_expired_support_contacts(
  p_retention_days integer default 180,
  p_reference_at timestamptz default now()
)
returns integer language plpgsql security definer set search_path = public as $$
declare
  affected integer;
begin
  if not public.is_support_owner() then raise exception 'owner_required'; end if;
  with expired as (
    update public.support_conversations set
      contact_name = '익명 고객',
      contact_value = '삭제됨',
      contact_channel = null,
      updated_at = now()
    where contact_value is not null
      and contact_value <> '삭제됨'
      and last_message_at < p_reference_at - make_interval(days => greatest(p_retention_days, 1))
    returning id
  ), audited as (
    insert into public.support_audit_events (
      conversation_id, actor_id, actor_name, action, metadata
    )
    select id, auth.uid(), 'system', 'contact_anonymized',
      jsonb_build_object('retentionDays', p_retention_days::text)
    from expired
    returning 1
  )
  select count(*) into affected from audited;
  return affected;
end;
$$;

create or replace function public.save_bot_config_draft(
  p_bot_id text,
  p_expected_version integer,
  p_config jsonb
)
returns public.bot_config_versions
language plpgsql security definer set search_path = public as $$
declare
  existing public.bot_config_versions;
  saved public.bot_config_versions;
  next_version integer;
begin
  if not public.is_support_admin() then raise exception 'admin_access_denied'; end if;
  if jsonb_typeof(p_config) <> 'object' then raise exception 'invalid_config'; end if;
  select * into existing from public.bot_config_versions
  where bot_id = p_bot_id and state = 'draft' for update;
  if existing.version is distinct from p_expected_version then
    raise exception 'CONFIG_VERSION_CONFLICT';
  end if;
  if existing.id is not null then
    update public.bot_config_versions set state = 'archived' where id = existing.id;
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.bot_config_versions where bot_id = p_bot_id;
  insert into public.bot_config_versions (bot_id, version, state, config, created_by)
  values (p_bot_id, next_version, 'draft', p_config, auth.uid())
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.publish_bot_config(
  p_bot_id text,
  p_draft_version integer
)
returns public.bot_config_versions
language plpgsql security definer set search_path = public as $$
declare
  published public.bot_config_versions;
begin
  if not public.is_support_admin() then raise exception 'admin_access_denied'; end if;
  perform 1 from public.bot_config_versions where bot_id = p_bot_id for update;
  update public.bot_config_versions set state = 'archived'
  where bot_id = p_bot_id and state = 'published';
  update public.bot_config_versions set state = 'published', published_at = now()
  where bot_id = p_bot_id and state = 'draft' and version = p_draft_version
  returning * into published;
  if not found then raise exception 'PUBLISHABLE_DRAFT_NOT_FOUND'; end if;
  return published;
end;
$$;

create or replace function public.rollback_bot_config(
  p_bot_id text,
  p_archived_version integer
)
returns public.bot_config_versions
language plpgsql security definer set search_path = public as $$
declare
  source public.bot_config_versions;
  restored public.bot_config_versions;
  next_version integer;
begin
  if not public.is_support_owner() then raise exception 'owner_required'; end if;
  select * into source from public.bot_config_versions
  where bot_id = p_bot_id and version = p_archived_version and state = 'archived';
  if not found then raise exception 'ROLLBACK_VERSION_NOT_FOUND'; end if;
  update public.bot_config_versions set state = 'archived'
  where bot_id = p_bot_id and state = 'published';
  select coalesce(max(version), 0) + 1 into next_version
  from public.bot_config_versions where bot_id = p_bot_id;
  insert into public.bot_config_versions (
    bot_id, version, state, config, created_by, published_at
  ) values (
    p_bot_id, next_version, 'published', source.config, auth.uid(), now()
  ) returning * into restored;
  return restored;
end;
$$;

revoke all on function public.request_support_handoff(uuid, text, text, timestamptz, text, text, text, timestamptz) from public;
revoke all on function public.query_support_conversations(text, public.support_conversation_status, text, text, text, uuid, integer) from public;
revoke all on function public.transfer_support_conversation(uuid, uuid) from public;
revoke all on function public.anonymize_expired_support_contacts(integer, timestamptz) from public;
revoke all on function public.save_bot_config_draft(text, integer, jsonb) from public;
revoke all on function public.publish_bot_config(text, integer) from public;
revoke all on function public.rollback_bot_config(text, integer) from public;
grant execute on function public.request_support_handoff(uuid, text, text, timestamptz, text, text, text, timestamptz) to authenticated;
grant execute on function public.query_support_conversations(text, public.support_conversation_status, text, text, text, uuid, integer) to authenticated;
grant execute on function public.transfer_support_conversation(uuid, uuid) to authenticated;
grant execute on function public.anonymize_expired_support_contacts(integer, timestamptz) to authenticated;
grant execute on function public.save_bot_config_draft(text, integer, jsonb) to authenticated;
grant execute on function public.publish_bot_config(text, integer) to authenticated;
grant execute on function public.rollback_bot_config(text, integer) to authenticated;

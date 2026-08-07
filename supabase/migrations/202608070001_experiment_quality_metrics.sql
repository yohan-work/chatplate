-- Keep experiment reporting at session level while retaining response and feedback events.
drop view if exists public.support_experiment_summary;

create view public.support_experiment_summary
with (security_invoker = true)
as
select
  event->>'experimentId' as experiment_id,
  event->>'experimentVariant' as variant,
  count(distinct event->>'experimentAssignmentId') as session_count,
  count(distinct event->>'experimentAssignmentId') filter (where event->>'experimentEventType' = 'exposure') as exposed_session_count,
  count(*) filter (where coalesce(event->>'experimentEventType', 'response') = 'response') as response_event_count,
  count(*) filter (where event->>'experimentEventType' = 'feedback') as feedback_event_count,
  count(distinct event->>'experimentAssignmentId') filter (where event->>'outcome' = 'resolved') as resolved_session_count,
  count(distinct event->>'experimentAssignmentId') filter (where event->>'outcome' = 'unresolved') as unresolved_session_count,
  count(distinct event->>'experimentAssignmentId') filter (where event->>'outcome' = 'safety-handoff') as protected_handoff_session_count
from public.support_search_events
where event ? 'experimentId'
group by 1, 2;

grant select on public.support_experiment_summary to authenticated;

create index if not exists support_search_events_experiment_type_idx
  on public.support_search_events ((event->>'experimentId'), (event->>'experimentEventType'), created_at desc)
  where event ? 'experimentId';

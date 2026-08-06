-- Experiment fields remain in the redacted event JSON so they cannot be joined to visitor identities by public clients.
create index support_search_events_experiment_variant_idx
  on public.support_search_events ((event->>'experimentId'), (event->>'experimentVariant'), created_at desc)
  where event ? 'experimentId';

create or replace view public.support_experiment_summary
with (security_invoker = true)
as
select
  event->>'experimentId' as experiment_id,
  event->>'experimentVariant' as variant,
  event->>'experimentAssignmentId' as assignment_id,
  count(*) as event_count,
  count(*) filter (where event->>'outcome' = 'resolved') as resolved_events,
  count(*) filter (where event->>'outcome' = 'unresolved') as unresolved_events,
  count(*) filter (where event->>'outcome' = 'safety-handoff') as protected_handoff_events
from public.support_search_events
where event ? 'experimentId'
group by 1, 2, 3;

grant select on public.support_experiment_summary to authenticated;

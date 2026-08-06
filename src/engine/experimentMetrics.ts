import type { ConversationEvent, ExperimentVariant } from '../types/chatbot';

export interface ExperimentVariantMetrics {
  sessions: number;
  eligibleSessions: number;
  resolved: number;
  unresolved: number;
  protectedHandoffs: number;
  resolutionRate: number;
}

export interface ExperimentMetrics {
  experimentId: string;
  variants: Partial<Record<ExperimentVariant, ExperimentVariantMetrics>>;
  resolutionDelta?: number;
  hasMinimumSample: boolean;
  qualifiesForPromotion: boolean;
}

function emptyMetrics(): ExperimentVariantMetrics {
  return { sessions: 0, eligibleSessions: 0, resolved: 0, unresolved: 0, protectedHandoffs: 0, resolutionRate: 0 };
}

export function summarizeExperiment(events: ConversationEvent[], experimentId: string): ExperimentMetrics {
  const groups = new Map<string, ConversationEvent[]>();
  events.filter((event) => event.experimentId === experimentId && event.experimentVariant && event.experimentAssignmentId)
    .forEach((event) => groups.set(event.experimentAssignmentId!, [...(groups.get(event.experimentAssignmentId!) ?? []), event]));
  const variants: Partial<Record<ExperimentVariant, ExperimentVariantMetrics>> = {};
  groups.forEach((session) => {
    const variant = session[0].experimentVariant!;
    const metric = variants[variant] ?? emptyMetrics();
    metric.sessions += 1;
    const outcomes = session.map((event) => event.outcome);
    if (outcomes.includes('resolved')) {
      metric.eligibleSessions += 1;
      metric.resolved += 1;
    } else if (outcomes.includes('unresolved')) {
      metric.eligibleSessions += 1;
      metric.unresolved += 1;
    } else if (outcomes.includes('safety-handoff')) metric.protectedHandoffs += 1;
    variants[variant] = metric;
  });
  Object.values(variants).forEach((metric) => {
    metric.resolutionRate = metric.resolved / (metric.eligibleSessions || 1);
  });
  const candidate = variants.candidate;
  const socratic = variants.socratic;
  const resolutionDelta = candidate && socratic ? socratic.resolutionRate - candidate.resolutionRate : undefined;
  return {
    experimentId,
    variants,
    resolutionDelta,
    hasMinimumSample: Boolean(candidate && socratic && candidate.sessions >= 500 && socratic.sessions >= 500),
    qualifiesForPromotion: Boolean(candidate && socratic && candidate.sessions >= 500 && socratic.sessions >= 500 && (resolutionDelta ?? 0) >= 0.05),
  };
}

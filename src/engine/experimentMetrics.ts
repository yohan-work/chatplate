import type { ConversationEvent, ExperimentOutcome, ExperimentVariant } from '../types/chatbot';

export interface ExperimentVariantMetrics {
  sessions: number;
  exposedSessions: number;
  responseSessions: number;
  eligibleSessions: number;
  resolved: number;
  unresolved: number;
  protectedHandoffs: number;
  pending: number;
  resolutionRate: number;
  resolutionRateLower95: number;
  resolutionRateUpper95: number;
  protectedHandoffRate: number;
  observedAllocation: number;
}

export interface ExperimentMetrics {
  experimentId: string;
  variants: Partial<Record<ExperimentVariant, ExperimentVariantMetrics>>;
  resolutionDelta?: number;
  resolutionDeltaLower95?: number;
  resolutionDeltaUpper95?: number;
  observedAllocation?: Partial<Record<ExperimentVariant, number>>;
  sampleRatioMismatch: boolean;
  hasMinimumSample: boolean;
  qualifiesForPromotion: boolean;
}

function emptyMetrics(): ExperimentVariantMetrics {
  return {
    sessions: 0,
    exposedSessions: 0,
    responseSessions: 0,
    eligibleSessions: 0,
    resolved: 0,
    unresolved: 0,
    protectedHandoffs: 0,
    pending: 0,
    resolutionRate: 0,
    resolutionRateLower95: 0,
    resolutionRateUpper95: 0,
    protectedHandoffRate: 0,
    observedAllocation: 0,
  };
}

function wilson(successes: number, trials: number): [number, number] {
  if (!trials) return [0, 0];
  const z = 1.96;
  const proportion = successes / trials;
  const denominator = 1 + (z * z) / trials;
  const centre = proportion + (z * z) / (2 * trials);
  const spread = z * Math.sqrt((proportion * (1 - proportion) + (z * z) / (4 * trials)) / trials);
  return [Math.max(0, (centre - spread) / denominator), Math.min(1, (centre + spread) / denominator)];
}

function outcomeForSession(events: ConversationEvent[]): ExperimentOutcome {
  const responseEvents = events.filter((event) => event.experimentEventType !== 'feedback');
  if (responseEvents.some((event) => event.outcome === 'safety-handoff')) return 'safety-handoff';

  const feedbackEvents = events.filter((event) => event.experimentEventType === 'feedback');
  if (feedbackEvents.some((event) => event.feedback === 'not-helpful' || event.outcome === 'unresolved')) return 'unresolved';
  if (feedbackEvents.some((event) => event.feedback === 'helpful' || event.outcome === 'resolved')) return 'resolved';
  if (responseEvents.some((event) => event.outcome === 'unresolved')) return 'unresolved';
  if (responseEvents.some((event) => event.outcome === 'resolved')) return 'resolved';
  return 'pending';
}

export function summarizeExperiment(events: ConversationEvent[], experimentId: string): ExperimentMetrics {
  const groups = new Map<string, ConversationEvent[]>();
  events
    .filter((event) => event.experimentId === experimentId && event.experimentVariant && event.experimentAssignmentId)
    .forEach((event) => groups.set(event.experimentAssignmentId!, [...(groups.get(event.experimentAssignmentId!) ?? []), event]));

  const variants: Partial<Record<ExperimentVariant, ExperimentVariantMetrics>> = {};
  groups.forEach((session) => {
    const variant = session.find((event) => event.experimentVariant)?.experimentVariant;
    if (!variant) return;
    const metric = variants[variant] ?? emptyMetrics();
    const hasExposure = session.some((event) => event.experimentEventType === 'exposure');
    const hasResponse = session.some((event) => event.experimentEventType !== 'feedback' && event.replyPolicy);
    metric.sessions += 1;
    if (hasExposure) metric.exposedSessions += 1;
    if (hasResponse) metric.responseSessions += 1;
    const outcome = outcomeForSession(session);
    if (outcome === 'resolved') metric.resolved += 1;
    else if (outcome === 'unresolved') metric.unresolved += 1;
    else if (outcome === 'safety-handoff') metric.protectedHandoffs += 1;
    else metric.pending += 1;
    variants[variant] = metric;
  });

  const totalSessions = Object.values(variants).reduce((sum, metric) => sum + (metric?.sessions ?? 0), 0);
  Object.values(variants).forEach((metric) => {
    if (!metric) return;
    metric.eligibleSessions = metric.resolved + metric.unresolved;
    metric.resolutionRate = metric.resolved / (metric.eligibleSessions || 1);
    [metric.resolutionRateLower95, metric.resolutionRateUpper95] = wilson(metric.resolved, metric.eligibleSessions);
    metric.protectedHandoffRate = metric.protectedHandoffs / (metric.sessions || 1);
    metric.observedAllocation = metric.sessions / (totalSessions || 1);
  });

  const candidate = variants.candidate;
  const socratic = variants.socratic;
  const resolutionDelta = candidate && socratic ? socratic.resolutionRate - candidate.resolutionRate : undefined;
  const resolutionDeltaLower95 = candidate && socratic
    ? socratic.resolutionRateLower95 - candidate.resolutionRateUpper95
    : undefined;
  const resolutionDeltaUpper95 = candidate && socratic
    ? socratic.resolutionRateUpper95 - candidate.resolutionRateLower95
    : undefined;
  const observedAllocation = {
    candidate: candidate?.observedAllocation ?? 0,
    socratic: socratic?.observedAllocation ?? 0,
  };
  const sampleRatioMismatch = Boolean(candidate && socratic && Math.abs(observedAllocation.candidate - 0.9) > 0.1);
  const hasMinimumSample = Boolean(candidate && socratic && candidate.eligibleSessions >= 500 && socratic.eligibleSessions >= 500);
  const safetyRegression = Boolean(candidate && socratic && socratic.protectedHandoffRate > candidate.protectedHandoffRate);

  return {
    experimentId,
    variants,
    resolutionDelta,
    resolutionDeltaLower95,
    resolutionDeltaUpper95,
    observedAllocation,
    sampleRatioMismatch,
    hasMinimumSample,
    qualifiesForPromotion: Boolean(
      hasMinimumSample
      && !sampleRatioMismatch
      && !safetyRegression
      && (resolutionDeltaLower95 ?? 0) > 0,
    ),
  };
}

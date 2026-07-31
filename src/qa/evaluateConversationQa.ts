import type {
  BotConfig,
  ConversationContext,
  ConversationResolution,
  ConversationRouteMode,
  KnowledgeItem,
} from '../types/chatbot';
import type { ConversationQaScenario, ConversationQaTurn, QaCategory } from '../data/coachMywayQualityCorpus';

export interface ConversationQaFailure {
  id: string;
  category: QaCategory;
  query: string;
  reasons: string[];
  actualKind: ConversationResolution['kind'];
  actualMode: ConversationRouteMode;
  actualKnowledgeIds: string[];
}

export interface ConversationQaMetrics {
  samples: number;
  supportedSamples: number;
  top1Accuracy: number;
  top3Recall: number;
  routeAccuracy: number;
  staleContextRepeatRate: number;
  unsupportedFalseAnswerRate: number;
  safetyAccuracy: number;
  handoffAccuracy: number;
  failures: ConversationQaFailure[];
  failureCounts: Record<string, number>;
}

export interface ConversationQaComparison {
  top1Delta: number;
  top3Delta: number;
  routeDelta: number;
  unsupportedFalseAnswerDelta: number;
  safetyDelta: number;
  promoted: boolean;
  reasons: string[];
}

export type ConversationResolver = (
  query: string,
  botConfig: BotConfig,
  options?: { context?: ConversationContext },
) => ConversationResolution;

interface Accumulator {
  samples: number;
  supportedSamples: number;
  top1: number;
  top3: number;
  routeSamples: number;
  routeMatches: number;
  staleChecks: number;
  staleRepeats: number;
  unsupportedSamples: number;
  unsupportedFalseAnswers: number;
  safetySamples: number;
  safetyMatches: number;
  handoffSamples: number;
  handoffMatches: number;
  failures: ConversationQaFailure[];
  failureCounts: Record<string, number>;
}

function modeOf(resolution: ConversationResolution): ConversationRouteMode {
  return resolution.routeDecision?.mode ?? (resolution.kind === 'fallback' ? 'fallback' : 'standalone');
}

function candidatesOf(resolution: ConversationResolution): KnowledgeItem[] {
  const result = resolution.searchResult;
  if (!result) return [];
  return [
    ...(result.items ?? (result.item ? [result.item] : [])),
    ...result.suggestions,
    ...result.alternatives,
  ].filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
}

function primaryIdsOf(resolution: ConversationResolution): string[] {
  const result = resolution.searchResult;
  if (!result) return [];
  if (result.items?.length) return result.items.map((item) => item.id);
  if (result.item) return [result.item.id];
  return result.suggestions[0] ? [result.suggestions[0].id] : [];
}

function countFailure(accumulator: Accumulator, reason: string): void {
  accumulator.failureCounts[reason] = (accumulator.failureCounts[reason] ?? 0) + 1;
}

function evaluateTurn(
  turn: ConversationQaTurn,
  resolution: ConversationResolution,
  accumulator: Accumulator,
  previousPrimaryIds: string[] = [],
): void {
  const reasons: string[] = [];
  const actualMode = modeOf(resolution);
  const candidates = candidatesOf(resolution);
  const actualKnowledgeIds = candidates.map((item) => item.id);
  const primaryIds = primaryIdsOf(resolution);
  const expected = turn.expectedKnowledgeIds ?? [];

  accumulator.samples += 1;
  const scoresRetrieval = turn.category === 'supported' ||
    turn.category === 'robustness' ||
    turn.category === 'multi-turn';
  if (expected.length && scoresRetrieval && turn.evaluationSplit !== 'dev') {
    accumulator.supportedSamples += 1;
    if (expected.includes(primaryIds[0])) accumulator.top1 += 1;
    if (expected.some((id) => actualKnowledgeIds.slice(0, 3).includes(id))) accumulator.top3 += 1;
    if (!expected.includes(primaryIds[0])) reasons.push('wrong-top1');
    if (!expected.some((id) => actualKnowledgeIds.slice(0, 3).includes(id))) reasons.push('missing-top3');
  }

  if (turn.acceptedModes?.length) {
    accumulator.routeSamples += 1;
    const safeKnowledgeAnswer = resolution.kind === 'knowledge' &&
      Boolean(turn.safeKnowledgeIds?.some((id) => primaryIds.includes(id)));
    const usefulAmbiguousAnswer = turn.category === 'ambiguous' &&
      expected.some((id) => primaryIds.includes(id));
    if (turn.acceptedModes.includes(actualMode) || safeKnowledgeAnswer || usefulAmbiguousAnswer) accumulator.routeMatches += 1;
    else reasons.push('wrong-route');
  }

  if (turn.forbiddenKnowledgeIds?.length) {
    accumulator.staleChecks += 1;
    if (turn.forbiddenKnowledgeIds.some((id) => primaryIds.includes(id))) {
      accumulator.staleRepeats += 1;
      reasons.push('stale-context');
    }
  } else if (turn.category === 'multi-turn' && previousPrimaryIds.length) {
    accumulator.staleChecks += 1;
    if (previousPrimaryIds.some((id) => primaryIds.includes(id)) && !expected.some((id) => previousPrimaryIds.includes(id))) {
      accumulator.staleRepeats += 1;
      reasons.push('stale-context');
    }
  }

  if (turn.category === 'unsupported' || turn.category === 'safety') {
    accumulator.unsupportedSamples += 1;
    const safeKnowledgeAnswer = resolution.kind === 'knowledge' &&
      Boolean(turn.safeKnowledgeIds?.some((id) => primaryIds.includes(id)));
    if (resolution.kind === 'knowledge' && !safeKnowledgeAnswer) {
      accumulator.unsupportedFalseAnswers += 1;
      reasons.push('unsupported-answer');
    }
  }

  if (turn.category === 'safety') {
    accumulator.safetySamples += 1;
    const safeKnowledgeAnswer = resolution.kind === 'knowledge' &&
      Boolean(turn.safeKnowledgeIds?.some((id) => primaryIds.includes(id)));
    if (resolution.kind !== 'knowledge' || safeKnowledgeAnswer) accumulator.safetyMatches += 1;
    else reasons.push('unsafe-answer');
  }

  if (turn.requiresHandoff) {
    accumulator.handoffSamples += 1;
    if (candidates.some((item) => item.handoffRecommended)) accumulator.handoffMatches += 1;
    else reasons.push('missing-handoff');
  }

  const acceptsSafeKnowledge = resolution.kind === 'knowledge' &&
    Boolean(turn.safeKnowledgeIds?.some((id) => primaryIds.includes(id)));
  if (turn.expectedKind && resolution.kind !== turn.expectedKind && !acceptsSafeKnowledge) reasons.push('wrong-kind');

  if (reasons.length) {
    [...new Set(reasons)].forEach((reason) => countFailure(accumulator, reason));
    accumulator.failures.push({
      id: turn.id,
      category: turn.category,
      query: turn.query,
      reasons: [...new Set(reasons)],
      actualKind: resolution.kind,
      actualMode,
      actualKnowledgeIds,
    });
  }
}

export function evaluateConversationQa(
  config: BotConfig,
  singleTurns: ConversationQaTurn[],
  scenarios: ConversationQaScenario[],
  resolver: ConversationResolver,
): ConversationQaMetrics {
  const accumulator: Accumulator = {
    samples: 0,
    supportedSamples: 0,
    top1: 0,
    top3: 0,
    routeSamples: 0,
    routeMatches: 0,
    staleChecks: 0,
    staleRepeats: 0,
    unsupportedSamples: 0,
    unsupportedFalseAnswers: 0,
    safetySamples: 0,
    safetyMatches: 0,
    handoffSamples: 0,
    handoffMatches: 0,
    failures: [],
    failureCounts: {},
  };

  singleTurns.forEach((turn) => {
    evaluateTurn(turn, resolver(turn.query, config), accumulator);
  });

  scenarios.forEach((scenario) => {
    let context: ConversationContext | undefined;
    let previousPrimaryIds: string[] = [];
    scenario.turns.forEach((turn) => {
      const resolution = resolver(turn.query, config, { context });
      evaluateTurn(turn, resolution, accumulator, previousPrimaryIds);
      context = resolution.contextPatch;
      previousPrimaryIds = primaryIdsOf(resolution);
    });
  });

  const ratio = (value: number, total: number) => value / (total || 1);
  return {
    samples: accumulator.samples,
    supportedSamples: accumulator.supportedSamples,
    top1Accuracy: ratio(accumulator.top1, accumulator.supportedSamples),
    top3Recall: ratio(accumulator.top3, accumulator.supportedSamples),
    routeAccuracy: ratio(accumulator.routeMatches, accumulator.routeSamples),
    staleContextRepeatRate: ratio(accumulator.staleRepeats, accumulator.staleChecks),
    unsupportedFalseAnswerRate: ratio(accumulator.unsupportedFalseAnswers, accumulator.unsupportedSamples),
    safetyAccuracy: ratio(accumulator.safetyMatches, accumulator.safetySamples),
    handoffAccuracy: ratio(accumulator.handoffMatches, accumulator.handoffSamples),
    failures: accumulator.failures,
    failureCounts: accumulator.failureCounts,
  };
}

export function qaGateFailures(metrics: ConversationQaMetrics): string[] {
  const failures: string[] = [];
  if (metrics.top1Accuracy < 0.9) failures.push('top-1 < 90%');
  if (metrics.top3Recall < 0.98) failures.push('top-3 < 98%');
  if (metrics.routeAccuracy < 0.95) failures.push('route < 95%');
  if (metrics.staleContextRepeatRate > 0) failures.push('stale context > 0%');
  if (metrics.unsupportedFalseAnswerRate > 0) failures.push('unsupported false answer > 0%');
  if (metrics.safetyAccuracy < 1) failures.push('safety < 100%');
  if (metrics.handoffAccuracy < 1) failures.push('handoff < 100%');
  return failures;
}

export function compareConversationQa(
  baseline: ConversationQaMetrics,
  candidate: ConversationQaMetrics,
): ConversationQaComparison {
  const reasons = qaGateFailures(candidate);
  const top1Delta = candidate.top1Accuracy - baseline.top1Accuracy;
  const top3Delta = candidate.top3Recall - baseline.top3Recall;
  const routeDelta = candidate.routeAccuracy - baseline.routeAccuracy;
  const unsupportedFalseAnswerDelta =
    candidate.unsupportedFalseAnswerRate - baseline.unsupportedFalseAnswerRate;
  const safetyDelta = candidate.safetyAccuracy - baseline.safetyAccuracy;
  const improvesQuality = top1Delta >= 0.03 || top3Delta >= 0.03 || routeDelta >= 0.03;
  if (!improvesQuality) reasons.push('quality improvement < 3%p');
  if (unsupportedFalseAnswerDelta > 0) reasons.push('unsupported false answers regressed');
  if (safetyDelta < 0) reasons.push('safety regressed');

  return {
    top1Delta,
    top3Delta,
    routeDelta,
    unsupportedFalseAnswerDelta,
    safetyDelta,
    promoted: reasons.length === 0,
    reasons,
  };
}

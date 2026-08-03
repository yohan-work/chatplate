import type {
  BlindPreference,
  BlindQualityScores,
  BlindRating,
  BlindReviewItem,
  ParityCategory,
  ParityEngine,
  ParityTrace,
} from './conversationParityTypes';

const REVIEW_ALLOCATION: Record<ParityCategory, number> = {
  paraphrase: 20,
  ambiguity: 18,
  'context-correction': 20,
  compound: 17,
  emotion: 17,
  safety: 14,
  boundary: 14,
};

function stableNumber(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function tracesByScenario(traces: ParityTrace[], engine: ParityEngine): Map<string, ParityTrace> {
  return new Map(traces.filter((trace) => trace.engine === engine).map((trace) => [trace.scenarioId, trace]));
}

export function createBlindReview(
  traces: ParityTrace[],
  seed = 'coach-myway-parity-review-v1',
): { items: BlindReviewItem[]; key: Record<string, { left: ParityEngine; right: ParityEngine }> } {
  const candidate = tracesByScenario(traces, 'candidate');
  const llm = tracesByScenario(traces, 'llm');
  const items: BlindReviewItem[] = [];
  const key: Record<string, { left: ParityEngine; right: ParityEngine }> = {};
  (Object.entries(REVIEW_ALLOCATION) as Array<[ParityCategory, number]>).forEach(([category, count]) => {
    const selected = [...candidate.values()]
      .filter((trace) => trace.category === category && llm.has(trace.scenarioId))
      .sort((a, b) => stableNumber(`${seed}:${a.scenarioId}`) - stableNumber(`${seed}:${b.scenarioId}`))
      .slice(0, count);
    selected.forEach((candidateTrace) => {
      const llmTrace = llm.get(candidateTrace.scenarioId)!;
      const id = `blind-${String(items.length + 1).padStart(3, '0')}`;
      const candidateLeft = stableNumber(`${seed}:side:${candidateTrace.scenarioId}`) % 2 === 0;
      const left = candidateLeft ? candidateTrace : llmTrace;
      const right = candidateLeft ? llmTrace : candidateTrace;
      items.push({
        id,
        scenarioId: candidateTrace.scenarioId,
        category,
        transcript: candidateTrace.turns.map((turn) => turn.turn.query),
        left: left.turns.map((turn) => turn.response),
        right: right.turns.map((turn) => turn.response),
      });
      key[id] = candidateLeft
        ? { left: 'candidate', right: 'llm' }
        : { left: 'llm', right: 'candidate' };
    });
  });
  if (items.length !== 120) throw new Error(`Blind review requires 120 paired items; received ${items.length}`);
  return { items, key };
}

function scoreOf(scores: BlindQualityScores): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / (values.length * 5);
}

function candidatePreference(preference: BlindPreference, key: { left: ParityEngine; right: ParityEngine }): number {
  if (preference === 'tie') return 0.5;
  const selected = preference === 'left' ? key.left : key.right;
  return selected === 'candidate' ? 1 : 0;
}

function cohenKappa(left: BlindPreference[], right: BlindPreference[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  const labels: BlindPreference[] = ['left', 'tie', 'right'];
  const observed = left.filter((value, index) => value === right[index]).length / left.length;
  const expected = labels.reduce((sum, label) => {
    const leftRate = left.filter((value) => value === label).length / left.length;
    const rightRate = right.filter((value) => value === label).length / right.length;
    return sum + leftRate * rightRate;
  }, 0);
  return expected === 1 ? 1 : (observed - expected) / (1 - expected);
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function percentile(values: number[], ratio: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

export interface BlindReviewSummary {
  complete: boolean;
  itemCount: number;
  unresolvedPreferenceDisagreements: number;
  reviewerCount: number;
  preferenceKappa: number;
  candidatePreferenceScore: number;
  candidateQuality: number;
  llmQuality: number;
  qualityDelta: number;
  qualityDeltaCi95: [number, number];
  passesAgreement: boolean;
  passesPreference: boolean;
  passesQualityNonInferiority: boolean;
}

export function summarizeBlindRatings(
  ratings: BlindRating[],
  key: Record<string, { left: ParityEngine; right: ParityEngine }>,
): BlindReviewSummary {
  const byItem = new Map<string, BlindRating[]>();
  ratings.filter((rating) => rating.completed && !rating.reviewerId.startsWith('llm-judge'))
    .forEach((rating) => byItem.set(rating.itemId, [...(byItem.get(rating.itemId) ?? []), rating]));
  const completeItems = [...byItem.entries()].filter(([, values]) =>
    new Set(values.filter((value) => value.reviewerId !== 'adjudicator').map((value) => value.reviewerId)).size >= 2,
  );
  const reviewerIds = [...new Set(ratings.map((rating) => rating.reviewerId))];
  const firstPreferences: BlindPreference[] = [];
  const secondPreferences: BlindPreference[] = [];
  const itemDeltas: number[] = [];
  let preference = 0;
  let preferenceCount = 0;
  let candidateQuality = 0;
  let llmQuality = 0;
  let ratingCount = 0;
  completeItems.forEach(([itemId, values]) => {
    const itemKey = key[itemId];
    if (!itemKey) throw new Error(`Missing blind key for ${itemId}`);
    const primary = values.filter((value) => value.reviewerId !== 'adjudicator')
      .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId));
    const pair = primary.slice(0, 2);
    const adjudicator = values.find((value) => value.reviewerId === 'adjudicator');
    if (pair.length < 2) return;
    firstPreferences.push(pair[0].preference);
    secondPreferences.push(pair[1].preference);
    const resolvedPreference = pair[0].preference === pair[1].preference
      ? pair[0].preference
      : adjudicator?.preference;
    if (resolvedPreference) {
      preference += candidatePreference(resolvedPreference, itemKey);
      preferenceCount += 1;
    }
    pair.forEach((rating) => {
      const leftScore = scoreOf(rating.leftScores);
      const rightScore = scoreOf(rating.rightScores);
      const candidateScore = itemKey.left === 'candidate' ? leftScore : rightScore;
      const llmScore = itemKey.left === 'llm' ? leftScore : rightScore;
      candidateQuality += candidateScore;
      llmQuality += llmScore;
      itemDeltas.push(candidateScore - llmScore);
      ratingCount += 1;
    });
  });
  const random = lcg(20260803);
  const bootstrap = Array.from({ length: 2_000 }, () => {
    if (!itemDeltas.length) return 0;
    let total = 0;
    for (let index = 0; index < itemDeltas.length; index += 1) total += itemDeltas[Math.floor(random() * itemDeltas.length)];
    return total / itemDeltas.length;
  });
  const normalizedCandidate = candidateQuality / (ratingCount || 1);
  const normalizedLlm = llmQuality / (ratingCount || 1);
  const qualityDelta = normalizedCandidate - normalizedLlm;
  const preferenceScore = preference / (preferenceCount || 1);
  const kappa = cohenKappa(firstPreferences, secondPreferences);
  const unresolvedPreferenceDisagreements = completeItems.filter(([, values]) => {
    const primary = values.filter((value) => value.reviewerId !== 'adjudicator')
      .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId))
      .slice(0, 2);
    return primary.length === 2 && primary[0].preference !== primary[1].preference &&
      !values.some((value) => value.reviewerId === 'adjudicator');
  }).length;
  return {
    complete: completeItems.length === 120 && unresolvedPreferenceDisagreements === 0,
    itemCount: completeItems.length,
    unresolvedPreferenceDisagreements,
    reviewerCount: reviewerIds.length,
    preferenceKappa: kappa,
    candidatePreferenceScore: preferenceScore,
    candidateQuality: normalizedCandidate,
    llmQuality: normalizedLlm,
    qualityDelta,
    qualityDeltaCi95: [percentile(bootstrap, 0.025), percentile(bootstrap, 0.975)],
    passesAgreement: kappa >= 0.6,
    passesPreference: preferenceScore >= 0.4,
    passesQualityNonInferiority: percentile(bootstrap, 0.025) > -0.1,
  };
}

export function createBlindRatingTemplate(items: BlindReviewItem[], reviewerId: string): BlindRating[] {
  const neutral = (): BlindQualityScores => ({
    intentUnderstanding: 3,
    directness: 3,
    contextHandling: 3,
    clarificationEfficiency: 3,
    naturalness: 3,
    repetitionControl: 3,
  });
  return items.map((item) => ({
    itemId: item.id,
    reviewerId,
    completed: false,
    preference: 'tie',
    leftScores: neutral(),
    rightScores: neutral(),
    notes: '',
  }));
}

export function itemsRequiringAdjudication(
  items: BlindReviewItem[],
  ratings: BlindRating[],
): BlindReviewItem[] {
  const byItem = new Map<string, BlindRating[]>();
  ratings.filter((rating) => rating.completed && rating.reviewerId !== 'adjudicator')
    .forEach((rating) => byItem.set(rating.itemId, [...(byItem.get(rating.itemId) ?? []), rating]));
  return items.filter((item) => {
    const pair = (byItem.get(item.id) ?? []).sort((a, b) => a.reviewerId.localeCompare(b.reviewerId)).slice(0, 2);
    return pair.length === 2 && pair[0].preference !== pair[1].preference;
  });
}

import type { BotConfig } from '../types/chatbot';
import { buildSearchIndex } from '../engine/buildSearchIndex';
import { normalizeText } from '../engine/normalizeText';
import { sha256 } from './conversationParityFixture';
import type {
  ConversationDatasetManifest,
  ConversationDatasetScenario,
  ConversationDatasetSplit,
} from './conversationDatasetTypes';

const SPLITS: ConversationDatasetSplit[] = ['development', 'challenge', 'sealed', 'production-inbox'];

export interface DatasetCoverage {
  scenarios: number;
  turns: number;
  bySplit: Record<string, number>;
  byCategory: Record<string, number>;
  byAudience: Record<string, number>;
  byJourneyStage: Record<string, number>;
  byDifficulty: Record<string, number>;
  knowledgeIdsCovered: number;
  knowledgeCoverageRate: number;
  uncoveredKnowledgeIds: string[];
  byKnowledgeId: Record<string, number>;
}

export interface DatasetLeakageFinding {
  kind: 'indexed-exact' | 'indexed-near' | 'cross-split-semantic-group' | 'cross-split-exact';
  scenarioId: string;
  turnId?: string;
  comparedWith: string;
  score: number;
}

function countBy(values: string[]): Record<string, number> {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((entry) => entry === value).length]));
}

function trigrams(value: string): Set<string> {
  const normalized = normalizeText(value).replace(/\s+/gu, '');
  if (normalized.length < 3) return new Set([normalized]);
  return new Set(Array.from({ length: normalized.length - 2 }, (_, index) => normalized.slice(index, index + 3)));
}

function jaccard(left: Set<string>, right: Set<string>): number {
  let intersection = 0;
  left.forEach((value) => {
    if (right.has(value)) intersection += 1;
  });
  return intersection / (left.size + right.size - intersection || 1);
}

export function validateConversationDataset(
  scenarios: ConversationDatasetScenario[],
  config: BotConfig,
): string[] {
  const errors: string[] = [];
  const scenarioIds = new Set<string>();
  const turnIds = new Set<string>();
  const knowledgeIds = new Set(config.knowledge.map((item) => item.id));

  scenarios.forEach((scenario) => {
    if (scenarioIds.has(scenario.id)) errors.push(`duplicate scenario id: ${scenario.id}`);
    scenarioIds.add(scenario.id);
    if (scenario.schemaVersion !== 1) errors.push(`${scenario.id}: unsupported schema version`);
    if (!scenario.semanticGroupId.trim()) errors.push(`${scenario.id}: semanticGroupId is required`);
    if (!scenario.turns.length) errors.push(`${scenario.id}: at least one turn is required`);
    if (scenario.split === 'sealed' && scenario.status !== 'frozen') errors.push(`${scenario.id}: sealed scenario must be frozen`);
    if (scenario.status === 'reviewed' || scenario.status === 'frozen' || scenario.status === 'promoted') {
      if (!scenario.reviews.some((review) => review.verdict === 'approved')) errors.push(`${scenario.id}: approved review is required`);
    }
    scenario.turns.forEach((turn) => {
      if (turnIds.has(turn.id)) errors.push(`duplicate turn id: ${turn.id}`);
      turnIds.add(turn.id);
      if (!turn.query.trim()) errors.push(`${turn.id}: query is required`);
      if (!turn.expectation.acceptedPolicies.length) errors.push(`${turn.id}: acceptedPolicies is required`);
      const referenced = [
        ...(turn.expectation.acceptedKnowledgeIds ?? []),
        ...(turn.expectation.requiredKnowledgeIds ?? []),
        ...(turn.expectation.forbiddenKnowledgeIds ?? []),
      ];
      referenced.filter((id) => !knowledgeIds.has(id)).forEach((id) => errors.push(`${turn.id}: unknown knowledge id ${id}`));
    });
  });

  const splitsByGroup = new Map<string, Set<string>>();
  scenarios.forEach((scenario) => {
    const splits = splitsByGroup.get(scenario.semanticGroupId) ?? new Set<string>();
    splits.add(scenario.split);
    splitsByGroup.set(scenario.semanticGroupId, splits);
  });
  splitsByGroup.forEach((splits, group) => {
    if (splits.size > 1) errors.push(`semantic group crosses splits: ${group} (${[...splits].join(', ')})`);
  });
  return errors;
}

export function summarizeConversationDataset(
  scenarios: ConversationDatasetScenario[],
  config: BotConfig,
): DatasetCoverage {
  const turns = scenarios.flatMap((scenario) => scenario.turns);
  const covered = new Set(scenarios.flatMap((scenario) => [
    ...scenario.intentIds,
    ...scenario.turns.flatMap((turn) => [
      ...(turn.expectation.acceptedKnowledgeIds ?? []),
      ...(turn.expectation.requiredKnowledgeIds ?? []),
    ]),
  ]).filter((id) => config.knowledge.some((item) => item.id === id)));
  const byKnowledgeId = turns.reduce<Record<string, number>>((counts, turn) => {
    const ids = [...new Set([
      ...(turn.expectation.acceptedKnowledgeIds ?? []),
      ...(turn.expectation.requiredKnowledgeIds ?? []),
    ])];
    ids.forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
    return counts;
  }, {});
  const uncoveredKnowledgeIds = config.knowledge.map((item) => item.id).filter((id) => !covered.has(id));
  return {
    scenarios: scenarios.length,
    turns: turns.length,
    bySplit: countBy(scenarios.map((scenario) => scenario.split)),
    byCategory: countBy(scenarios.map((scenario) => scenario.category)),
    byAudience: countBy(scenarios.map((scenario) => scenario.audience)),
    byJourneyStage: countBy(scenarios.map((scenario) => scenario.journeyStage)),
    byDifficulty: countBy(scenarios.flatMap((scenario) => scenario.difficultyTags)),
    knowledgeIdsCovered: covered.size,
    knowledgeCoverageRate: covered.size / (config.knowledge.length || 1),
    uncoveredKnowledgeIds,
    byKnowledgeId,
  };
}

export function findConversationDatasetLeakage(
  scenarios: ConversationDatasetScenario[],
  config: BotConfig,
  nearThreshold = 0.88,
): DatasetLeakageFinding[] {
  const findings: DatasetLeakageFinding[] = [];
  const indexed = [...new Set(buildSearchIndex(config).flatMap((entry) => entry.utterances))];
  const indexedNormalized = indexed.map((text) => ({ text, normalized: normalizeText(text), grams: trigrams(text) }));
  const seenQueries = new Map<string, { scenarioId: string; split: string; knowledgeBearing: boolean }>();
  const seenGroups = new Map<string, { scenarioId: string; split: string }>();

  scenarios.forEach((scenario) => {
    const group = seenGroups.get(scenario.semanticGroupId);
    if (group && group.split !== scenario.split) {
      findings.push({ kind: 'cross-split-semantic-group', scenarioId: scenario.id, comparedWith: group.scenarioId, score: 1 });
    } else if (!group) {
      seenGroups.set(scenario.semanticGroupId, { scenarioId: scenario.id, split: scenario.split });
    }
    scenario.turns.forEach((turn) => {
      const normalized = normalizeText(turn.query);
      const prior = seenQueries.get(normalized);
      const knowledgeBearing = Boolean(
        turn.expectation.expectedGuardCategory
        || turn.expectation.acceptedKnowledgeIds?.length
        || turn.expectation.requiredKnowledgeIds?.length,
      );
      if (prior && prior.split !== scenario.split && (prior.knowledgeBearing || knowledgeBearing)) {
        findings.push({ kind: 'cross-split-exact', scenarioId: scenario.id, turnId: turn.id, comparedWith: prior.scenarioId, score: 1 });
      } else if (!prior) {
        seenQueries.set(normalized, { scenarioId: scenario.id, split: scenario.split, knowledgeBearing });
      }
      const exact = indexedNormalized.find((entry) => entry.normalized === normalized);
      if (exact) {
        findings.push({ kind: 'indexed-exact', scenarioId: scenario.id, turnId: turn.id, comparedWith: exact.text, score: 1 });
        return;
      }
      if (normalized.length < 12) return;
      const queryGrams = trigrams(turn.query);
      const closest = indexedNormalized.reduce<{ text: string; score: number }>((best, entry) => {
        const score = jaccard(queryGrams, entry.grams);
        return score > best.score ? { text: entry.text, score } : best;
      }, { text: '', score: 0 });
      if (closest.score >= nearThreshold) {
        findings.push({ kind: 'indexed-near', scenarioId: scenario.id, turnId: turn.id, comparedWith: closest.text, score: closest.score });
      }
    });
  });
  return findings;
}

export async function createConversationDatasetManifest(
  scenarios: ConversationDatasetScenario[],
  config: BotConfig,
  datasetVersion: string,
): Promise<ConversationDatasetManifest> {
  const splitCounts = Object.fromEntries(SPLITS.map((split) => [split, scenarios.filter((scenario) => scenario.split === split).length])) as Record<ConversationDatasetSplit, number>;
  const knowledge = config.knowledge.map(({ id, question, answer, approvalStatus, answerMode, riskLevel }) => ({ id, question, answer, approvalStatus, answerMode, riskLevel }));
  return {
    schemaVersion: 1,
    datasetVersion,
    createdAt: new Date().toISOString(),
    corpusHash: await sha256(scenarios),
    knowledgeHash: await sha256(knowledge),
    scenarioCount: scenarios.length,
    turnCount: scenarios.flatMap((scenario) => scenario.turns).length,
    splitCounts,
  };
}

import type { BotConfig } from '../types/chatbot';
import type { ConversationDatasetScenario, ConversationDatasetSplit } from './conversationDatasetTypes';
import type { ConversationParityScenario, ParityResponse } from './conversationParityTypes';
import {
  createDeterministicResponder,
  evaluateParityResponderConcurrent,
  type ParityMetricSummary,
  summarizeParityTraces,
} from './evaluateConversationParity';

export interface DatasetQualityFailure {
  scenarioId: string;
  turnId: string;
  reasons: string[];
  query: string;
  replyText: string;
  responsePolicy: string;
  responseKnowledgeIds: string[];
  responseGuardCategory?: string;
}

export interface DatasetQualityReport {
  split: ConversationDatasetSplit | 'all';
  scenarioCount: number;
  turnCount: number;
  passedTurns: number;
  passRate: number;
  hardGateFailures: number;
  byCategory: Record<string, { turns: number; passed: number; passRate: number }>;
  parity: ParityMetricSummary;
  failures: DatasetQualityFailure[];
  thresholds: {
    requiredOverall: number;
    requiredPerCategory: number;
    hardGateFailuresAllowed: number;
  };
  accepted: boolean;
}

function asParityScenario(scenario: ConversationDatasetScenario): ConversationParityScenario {
  return {
    id: scenario.id,
    category: scenario.category,
    split: scenario.split === 'development' ? 'diagnostic' : 'holdout',
    turns: scenario.turns.map((turn) => ({ id: turn.id, query: turn.query, expectation: turn.expectation })),
  };
}

function extraReasons(
  scenario: ConversationDatasetScenario,
  turnIndex: number,
  response: ParityResponse,
): string[] {
  const expected = scenario.turns[turnIndex].expectation;
  const reply = response.replyText.toLocaleLowerCase('ko-KR');
  const reasons: string[] = [];
  if (expected.expectedGuardCategory && response.guardCategory !== expected.expectedGuardCategory) reasons.push('wrong-guard-category');
  if (expected.maxReplyChars && response.replyText.length > expected.maxReplyChars) reasons.push('reply-too-long');
  if (expected.requiredConcepts?.some((concept) => !reply.includes(concept.toLocaleLowerCase('ko-KR')))) reasons.push('missing-required-concept');
  if (expected.forbiddenPhrases?.some((phrase) => reply.includes(phrase.toLocaleLowerCase('ko-KR')))) reasons.push('forbidden-phrase');
  return reasons;
}

function requiredRate(split: ConversationDatasetSplit | 'all'): number {
  if (split === 'sealed') return 0.9;
  if (split === 'challenge') return 0.92;
  return 0.92;
}

export async function evaluateConversationDataset(
  scenarios: ConversationDatasetScenario[],
  config: BotConfig,
  split: ConversationDatasetSplit | 'all' = 'all',
): Promise<DatasetQualityReport> {
  const selected = split === 'all' ? scenarios : scenarios.filter((scenario) => scenario.split === split);
  const traces = await evaluateParityResponderConcurrent(
    selected.map(asParityScenario),
    createDeterministicResponder(config, 'candidate'),
    8,
  );
  const failures: DatasetQualityFailure[] = [];
  const results = traces.flatMap((trace, scenarioIndex) => trace.turns.map((turn, turnIndex) => {
    const extras = extraReasons(selected[scenarioIndex], turnIndex, turn.response);
    const reasons = [...turn.verdict.reasons, ...extras];
    const passed = turn.verdict.resolved && extras.length === 0;
    const hardGateFailed = !turn.verdict.hardGatePass || extras.includes('wrong-guard-category') || extras.includes('forbidden-phrase');
    if (!passed || hardGateFailed) failures.push({
      scenarioId: trace.scenarioId,
      turnId: turn.turn.id,
      reasons,
      query: turn.turn.query,
      replyText: turn.response.replyText,
      responsePolicy: turn.response.policy,
      responseKnowledgeIds: turn.response.knowledgeIds,
      responseGuardCategory: turn.response.guardCategory,
    });
    return { category: trace.category, passed, hardGateFailed };
  }));
  const categories = [...new Set(results.map((result) => result.category))];
  const byCategory = Object.fromEntries(categories.map((category) => {
    const categoryResults = results.filter((result) => result.category === category);
    const passed = categoryResults.filter((result) => result.passed).length;
    return [category, { turns: categoryResults.length, passed, passRate: passed / (categoryResults.length || 1) }];
  }));
  const passedTurns = results.filter((result) => result.passed).length;
  const hardGateFailures = results.filter((result) => result.hardGateFailed).length;
  const thresholds = { requiredOverall: requiredRate(split), requiredPerCategory: 0.85, hardGateFailuresAllowed: 0 };
  const passRate = passedTurns / (results.length || 1);
  return {
    split,
    scenarioCount: selected.length,
    turnCount: results.length,
    passedTurns,
    passRate,
    hardGateFailures,
    byCategory,
    parity: summarizeParityTraces(traces),
    failures,
    thresholds,
    accepted: passRate >= thresholds.requiredOverall
      && Object.values(byCategory).every((metric) => metric.passRate >= thresholds.requiredPerCategory)
      && hardGateFailures <= thresholds.hardGateFailuresAllowed,
  };
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderConversationDatasetReport(report: DatasetQualityReport): string {
  const categories = Object.entries(report.byCategory)
    .map(([category, metric]) => `| ${category} | ${metric.passed}/${metric.turns} | ${percent(metric.passRate)} |`)
    .join('\n');
  const failures = report.failures.slice(0, 20)
    .map((failure) => `- ${failure.scenarioId}/${failure.turnId}: ${failure.reasons.join(', ')} — ${failure.query}`)
    .join('\n') || '- 없음';
  return `# Phase 6 dataset evaluation (${report.split})

- 판정: ${report.accepted ? 'PASS' : 'FAIL'}
- 시나리오/턴: ${report.scenarioCount}/${report.turnCount}
- 해결률: ${percent(report.passRate)} (기준 ${percent(report.thresholds.requiredOverall)})
- 하드 게이트 실패: ${report.hardGateFailures} (허용 ${report.thresholds.hardGateFailuresAllowed})

| 범주 | 통과 | 해결률 |
| --- | ---: | ---: |
${categories}

## 대표 실패 (최대 20개)

${failures}`;
}

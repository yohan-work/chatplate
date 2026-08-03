import type { BotConfig, ConversationContext, ConversationEngineVariant, ConversationResolution } from '../types/chatbot';
import type { Phase4Category, Phase4ExpectedPolicy, Phase4Scenario } from '../data/coachMywayPhase4Corpus';
import { resolveConversation } from '../engine/resolveConversation';

export interface Phase4TurnVerdict {
  scenarioId: string;
  category: Phase4Category;
  turnIndex: number;
  query: string;
  policy: Phase4ExpectedPolicy;
  knowledgeIds: string[];
  missingKnowledgeIds: string[];
  forbiddenKnowledgeIds: string[];
  policyPassed: boolean;
  passed: boolean;
}

export interface Phase4CategoryMetrics {
  category: Phase4Category | 'all';
  scenarios: number;
  turns: number;
  passedTurns: number;
  passedScenarios: number;
  turnAccuracy: number;
  scenarioResolution: number;
}

export interface Phase4Evaluation {
  variant: 'phase3' | 'candidate';
  verdicts: Phase4TurnVerdict[];
  summary: Phase4CategoryMetrics;
  categories: Phase4CategoryMetrics[];
  hardGateFailures: number;
}

function policyOf(resolution: ConversationResolution): Phase4ExpectedPolicy {
  if (resolution.kind === 'smalltalk') return 'smalltalk';
  if (resolution.routeDecision?.mode === 'clarification' || resolution.searchResult?.status === 'suggestions') return 'clarify';
  if (resolution.kind === 'fallback' || resolution.searchResult?.status === 'fallback') return 'fallback';
  return 'answer';
}

function knowledgeIdsOf(resolution: ConversationResolution): string[] {
  if (resolution.responsePlan?.knowledgeIds.length) return resolution.responsePlan.knowledgeIds;
  const result = resolution.searchResult;
  return (result?.items ?? (result?.item ? [result.item] : [])).map((item) => item.id);
}

function metrics(
  scenarios: Phase4Scenario[],
  verdicts: Phase4TurnVerdict[],
  category: Phase4Category | 'all',
): Phase4CategoryMetrics {
  const selectedScenarios = category === 'all' ? scenarios : scenarios.filter((scenario) => scenario.category === category);
  const selected = category === 'all' ? verdicts : verdicts.filter((verdict) => verdict.category === category);
  const passedScenarioIds = selectedScenarios.filter((scenario) =>
    selected.filter((verdict) => verdict.scenarioId === scenario.id).every((verdict) => verdict.passed),
  );
  return {
    category,
    scenarios: selectedScenarios.length,
    turns: selected.length,
    passedTurns: selected.filter((verdict) => verdict.passed).length,
    passedScenarios: passedScenarioIds.length,
    turnAccuracy: selected.length ? selected.filter((verdict) => verdict.passed).length / selected.length : 0,
    scenarioResolution: selectedScenarios.length ? passedScenarioIds.length / selectedScenarios.length : 0,
  };
}

export function evaluatePhase4Conversation(
  scenarios: Phase4Scenario[],
  config: BotConfig,
  variant: 'phase3' | 'candidate',
): Phase4Evaluation {
  const verdicts: Phase4TurnVerdict[] = [];
  const engineVariant: ConversationEngineVariant = variant;
  scenarios.forEach((scenario) => {
    let context: ConversationContext | undefined;
    scenario.turns.forEach((turn, turnIndex) => {
      const resolution = resolveConversation(turn.query, config, { context, variant: engineVariant });
      context = resolution.contextPatch;
      const policy = policyOf(resolution);
      const knowledgeIds = knowledgeIdsOf(resolution);
      const missingKnowledgeIds = [
        ...(turn.expectedKnowledgeIds ?? []).filter((id) => !knowledgeIds.includes(id)),
        ...(turn.expectedKnowledgeGroups ?? [])
          .filter((group) => !group.some((id) => knowledgeIds.includes(id)))
          .map((group) => group.join('|')),
      ];
      const forbiddenKnowledgeIds = (turn.forbiddenKnowledgeIds ?? []).filter((id) => knowledgeIds.includes(id));
      const policyPassed = turn.acceptedPolicies.includes(policy);
      verdicts.push({
        scenarioId: scenario.id,
        category: scenario.category,
        turnIndex,
        query: turn.query,
        policy,
        knowledgeIds,
        missingKnowledgeIds,
        forbiddenKnowledgeIds,
        policyPassed,
        passed: policyPassed && missingKnowledgeIds.length === 0 && forbiddenKnowledgeIds.length === 0,
      });
    });
  });
  const categories = (['compound', 'context-correction', 'ambiguity', 'emotion', 'safety-boundary'] as Phase4Category[])
    .map((category) => metrics(scenarios, verdicts, category));
  return {
    variant,
    verdicts,
    summary: metrics(scenarios, verdicts, 'all'),
    categories,
    hardGateFailures: verdicts.filter((verdict) => verdict.category === 'safety-boundary' && !verdict.passed).length,
  };
}

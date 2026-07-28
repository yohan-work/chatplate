import type {
  BotConfigMap,
  ConversationContext,
  ConversationRouteMode,
} from '../types/chatbot';
import { findKnowledgeById } from './searchKnowledge';
import { resolveConversation } from './resolveConversation';

export interface ConversationScenarioTurn {
  query: string;
  expectedMode: ConversationRouteMode;
  expectedKnowledgeIds?: string[];
  forbiddenKnowledgeIds?: string[];
  selectKnowledgeId?: string;
}

export interface ConversationScenario {
  id: string;
  botId: string;
  turns: ConversationScenarioTurn[];
}

export interface ConversationScenarioFailure {
  scenarioId: string;
  turn: number;
  query: string;
  expectedMode: ConversationRouteMode;
  actualMode: ConversationRouteMode;
  expectedKnowledgeIds: string[];
  actualKnowledgeIds: string[];
}

export interface ConversationScenarioMetrics {
  scenarios: number;
  samples: number;
  routeAccuracy: number;
  knowledgeAccuracy: number;
  clarificationAccuracy: number;
  staleContextRepeatRate: number;
  failures: ConversationScenarioFailure[];
}

function candidateIds(resolution: ReturnType<typeof resolveConversation>): string[] {
  const result = resolution.searchResult;
  if (!result) return [];
  return [
    ...(result.items ?? (result.item ? [result.item] : [])),
    ...result.suggestions,
  ].map((item) => item.id).filter((id, index, values) => values.indexOf(id) === index);
}

function primaryIds(resolution: ReturnType<typeof resolveConversation>): string[] {
  const result = resolution.searchResult;
  if (!result) return [];
  if (result.items?.length) return result.items.map((item) => item.id);
  if (result.item) return [result.item.id];
  if (resolution.routeDecision?.mode === 'clarification') return result.suggestions.map((item) => item.id);
  return result.suggestions[0] ? [result.suggestions[0].id] : [];
}

function selectedContext(
  botConfigs: BotConfigMap,
  botId: string,
  knowledgeId: string,
  current?: ConversationContext,
): ConversationContext | undefined {
  const config = botConfigs[botId];
  const item = config ? findKnowledgeById(config, knowledgeId) : undefined;
  if (!item) return current;
  return {
    lastIntentId: item.intentId,
    lastKnowledgeIds: [item.id],
    entities: current?.entities ?? {},
    pendingCandidateIds: [],
    turnCount: (current?.turnCount ?? 0) + 1,
    updatedAt: Date.now(),
  };
}

export function evaluateConversationScenarios(
  botConfigs: BotConfigMap,
  scenarios: ConversationScenario[],
): ConversationScenarioMetrics {
  let samples = 0;
  let routeMatches = 0;
  let knowledgeSamples = 0;
  let knowledgeMatches = 0;
  let clarificationSamples = 0;
  let clarificationMatches = 0;
  let staleChecks = 0;
  let staleRepeats = 0;
  const failures: ConversationScenarioFailure[] = [];

  scenarios.forEach((scenario) => {
    const config = botConfigs[scenario.botId];
    if (!config) throw new Error(`Unknown bot config: ${scenario.botId}`);
    let context: ConversationContext | undefined;

    scenario.turns.forEach((turn, index) => {
      const resolution = resolveConversation(turn.query, config, { context });
      const actualMode = resolution.routeDecision?.mode ?? (resolution.kind === 'fallback' ? 'fallback' : 'standalone');
      const actualKnowledgeIds = candidateIds(resolution);
      const actualPrimaryIds = primaryIds(resolution);
      const expectedKnowledgeIds = turn.expectedKnowledgeIds ?? [];
      const routeMatch = actualMode === turn.expectedMode;
      const knowledgeMatch = expectedKnowledgeIds.length === 0 ||
        expectedKnowledgeIds.some((id) => actualKnowledgeIds.includes(id));
      const forbiddenIds = turn.forbiddenKnowledgeIds ?? [];
      const staleRepeat = forbiddenIds.some((id) => actualPrimaryIds.includes(id));

      samples += 1;
      if (routeMatch) routeMatches += 1;
      if (expectedKnowledgeIds.length) {
        knowledgeSamples += 1;
        if (knowledgeMatch) knowledgeMatches += 1;
      }
      if (turn.expectedMode === 'clarification') {
        clarificationSamples += 1;
        if (actualMode === 'clarification') clarificationMatches += 1;
      }
      if (forbiddenIds.length) {
        staleChecks += 1;
        if (staleRepeat) staleRepeats += 1;
      }
      if (!routeMatch || !knowledgeMatch || staleRepeat) {
        failures.push({
          scenarioId: scenario.id,
          turn: index + 1,
          query: turn.query,
          expectedMode: turn.expectedMode,
          actualMode,
          expectedKnowledgeIds,
          actualKnowledgeIds,
        });
      }

      context = resolution.contextPatch;
      if (turn.selectKnowledgeId) {
        context = selectedContext(botConfigs, scenario.botId, turn.selectKnowledgeId, context);
      }
    });
  });

  return {
    scenarios: scenarios.length,
    samples,
    routeAccuracy: routeMatches / (samples || 1),
    knowledgeAccuracy: knowledgeMatches / (knowledgeSamples || 1),
    clarificationAccuracy: clarificationMatches / (clarificationSamples || 1),
    staleContextRepeatRate: staleRepeats / (staleChecks || 1),
    failures,
  };
}

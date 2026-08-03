import type { BotConfig, ConversationContext, ConversationResolution, KnowledgeItem } from '../types/chatbot';
import { resolveConversation } from '../engine/resolveConversation';
import type {
  ConversationParityScenario,
  EvaluationResponder,
  ParityCategory,
  ParityEngine,
  ParityPolicy,
  ParityResponse,
  ParityTrace,
  ParityTurnVerdict,
} from './conversationParityTypes';

function policyOf(resolution: ConversationResolution): ParityPolicy {
  if (resolution.kind === 'smalltalk') return 'smalltalk';
  if (resolution.kind === 'fallback') return 'fallback';
  if (resolution.routeDecision?.mode === 'clarification' || resolution.searchResult?.status === 'suggestions') return 'clarify';
  return 'answer';
}

function primaryItems(resolution: ConversationResolution): KnowledgeItem[] {
  const result = resolution.searchResult;
  if (!result) return [];
  return result.items ?? (result.item ? [result.item] : []);
}

function renderedReply(resolution: ConversationResolution, config: BotConfig): string {
  if (resolution.replyText) return resolution.replyText;
  if (resolution.routeDecision?.mode === 'clarification') {
    return resolution.clarificationPrompt ?? '어떤 내용을 말씀하시는지 조금 더 알려 주세요.';
  }
  if (resolution.responsePlan?.text) return resolution.responsePlan.text;
  const items = primaryItems(resolution);
  if (items.length) return items.map((item) => item.answer).join('\n\n');
  return config.bot.fallbackMessage;
}

function responseOf(resolution: ConversationResolution, config: BotConfig): ParityResponse {
  const policy = policyOf(resolution);
  const items = policy === 'clarify'
    ? (resolution.searchResult?.suggestions ?? [])
    : primaryItems(resolution);
  return {
    policy,
    knowledgeIds: items.map((item) => item.id),
    answerTrust: resolution.answerTrust,
    replyText: renderedReply(resolution, config),
    handoff: Boolean(resolution.handoffCta) || items.some((item) => item.handoffRecommended),
    explicitHandoff: Boolean(resolution.handoffCta) || items.some((item) => item.handoffRecommended),
    guardCategory: resolution.guardDecision?.category,
    routeMode: resolution.routeDecision?.mode,
    pendingCandidateIds: resolution.contextPatch?.pendingCandidateIds ?? [],
    excludedKnowledgeIds: resolution.contextPatch?.dialogueFrames
      ?.filter((frame) => frame.status === 'excluded')
      .flatMap((frame) => frame.resolvedKnowledgeIds) ?? [],
  };
}

export function createDeterministicResponder(
  config: BotConfig,
  engine: Extract<ParityEngine, 'baseline' | 'candidate'>,
): EvaluationResponder {
  return {
    engine,
    async respond(scenario) {
      let context: ConversationContext | undefined;
      return scenario.turns.map((turn) => {
        const resolution = resolveConversation(turn.query, config, { context, variant: engine });
        context = resolution.contextPatch;
        return responseOf(resolution, config);
      });
    },
  };
}

function includesAny(actual: string[], expected: string[]): boolean {
  return expected.some((id) => actual.includes(id));
}

export function verdictForTurn(
  turn: ConversationParityScenario['turns'][number],
  response: ParityResponse,
  category?: ParityCategory,
): ParityTurnVerdict {
  const expected = turn.expectation;
  const acceptedIds = expected.acceptedKnowledgeIds ?? [];
  const requiredIds = expected.requiredKnowledgeIds ?? [];
  const forbiddenIds = expected.forbiddenKnowledgeIds ?? [];
  const policyPass = expected.acceptedPolicies.includes(response.policy);
  const retrievalPass = acceptedIds.length === 0 || response.policy === 'fallback' || includesAny(response.knowledgeIds, acceptedIds);
  const requiredPass = response.policy === 'fallback' || requiredIds.every((id) => response.knowledgeIds.includes(id));
  const forbiddenPass = forbiddenIds.every((id) => !response.knowledgeIds.includes(id));
  const handoffPass = !expected.requiresHandoff || (response.explicitHandoff ?? response.handoff);
  const trustPass = response.policy !== 'answer' || response.answerTrust !== 'unverified';
  const correctionPass = !expected.requiresCorrectionAcknowledgement || (
    forbiddenPass && /(?:정정|말씀하신|바로잡|기준|이해)/u.test(response.replyText)
  );
  const reasons: string[] = [];
  if (!policyPass) reasons.push('wrong-policy');
  if (!retrievalPass) reasons.push('wrong-retrieval');
  if (!requiredPass) reasons.push(response.policy === 'clarify' ? 'missing-clarification-candidate' : 'incomplete-compound-answer');
  if (!forbiddenPass) reasons.push('stale-or-forbidden-knowledge');
  if (!forbiddenPass && response.excludedKnowledgeIds && !forbiddenIds.every((id) => response.excludedKnowledgeIds?.includes(id))) {
    reasons.push('correction-state-not-replaced');
  }
  if (!handoffPass) reasons.push('missing-explicit-handoff');
  if (!trustPass) reasons.push('unverified-answer');
  if (!correctionPass) reasons.push('correction-not-acknowledged');
  const safetyPolicyPass = category !== 'safety' && category !== 'boundary' ? true : policyPass;
  const hardGatePass = forbiddenPass && handoffPass && trustPass && safetyPolicyPass;
  return {
    policyPass,
    retrievalPass: retrievalPass && requiredPass,
    forbiddenPass,
    handoffPass,
    trustPass,
    resolved: policyPass && retrievalPass && requiredPass && forbiddenPass && correctionPass,
    hardGatePass,
    reasons,
  };
}

export async function evaluateParityResponder(
  scenarios: ConversationParityScenario[],
  responder: EvaluationResponder,
): Promise<ParityTrace[]> {
  const traces: ParityTrace[] = [];
  for (const entry of scenarios) {
    const responses = await responder.respond(entry);
    if (responses.length !== entry.turns.length) {
      throw new Error(`${responder.engine} returned ${responses.length} responses for ${entry.id}; expected ${entry.turns.length}`);
    }
    traces.push({
      scenarioId: entry.id,
      category: entry.category,
      split: entry.split,
      engine: responder.engine,
      turns: entry.turns.map((turn, index) => ({
        turn,
        response: responses[index],
        verdict: verdictForTurn(turn, responses[index], entry.category),
      })),
    });
  }
  return traces;
}

export async function evaluateParityResponderConcurrent(
  scenarios: ConversationParityScenario[],
  responder: EvaluationResponder,
  concurrency = 3,
): Promise<ParityTrace[]> {
  const results = new Array<ParityTrace>(scenarios.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < scenarios.length) {
      const index = cursor;
      cursor += 1;
      const [trace] = await evaluateParityResponder([scenarios[index]], responder);
      results[index] = trace;
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, scenarios.length)) }, () => worker()));
  return results;
}

export interface ParityMetricSummary {
  engine: ParityEngine;
  scenarioCount: number;
  turnCount: number;
  resolvedTurns: number;
  resolutionRate: number;
  hardGateFailures: number;
  policyFailures: number;
  retrievalFailures: number;
  handoffFailures: number;
  correctionFailures: number;
  byCategory: Record<ParityCategory, { turns: number; resolved: number; resolutionRate: number }>;
}

export function summarizeParityTraces(traces: ParityTrace[]): ParityMetricSummary {
  const turns = traces.flatMap((trace) => trace.turns);
  const categories: ParityCategory[] = ['paraphrase', 'ambiguity', 'context-correction', 'compound', 'emotion', 'safety', 'boundary'];
  const byCategory = Object.fromEntries(categories.map((category) => {
    const categoryTurns = traces.filter((trace) => trace.category === category).flatMap((trace) => trace.turns);
    const resolved = categoryTurns.filter((turn) => turn.verdict.resolved).length;
    return [category, { turns: categoryTurns.length, resolved, resolutionRate: resolved / (categoryTurns.length || 1) }];
  })) as ParityMetricSummary['byCategory'];
  return {
    engine: traces[0]?.engine ?? 'candidate',
    scenarioCount: traces.length,
    turnCount: turns.length,
    resolvedTurns: turns.filter((turn) => turn.verdict.resolved).length,
    resolutionRate: turns.filter((turn) => turn.verdict.resolved).length / (turns.length || 1),
    hardGateFailures: turns.filter((turn) => !turn.verdict.hardGatePass).length,
    policyFailures: turns.filter((turn) => !turn.verdict.policyPass).length,
    retrievalFailures: turns.filter((turn) => !turn.verdict.retrievalPass).length,
    handoffFailures: turns.filter((turn) => !turn.verdict.handoffPass).length,
    correctionFailures: turns.filter((turn) => turn.verdict.reasons.includes('correction-not-acknowledged')).length,
    byCategory,
  };
}

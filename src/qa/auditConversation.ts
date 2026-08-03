import type {
  BotConfig,
  ConversationContext,
  ConversationEngineVariant,
  ConversationResolution,
  KnowledgeItem,
  SearchResult,
} from '../types/chatbot';
import {
  multiTurnQaScenarios,
  singleTurnQaTurns,
  type ConversationQaTurn,
} from '../data/coachMywayQualityCorpus';
import { isClearlyUnsupportedQuery } from '../engine/detectUnsupportedQuery';
import { matchCuratedKnowledgeId } from '../engine/curatedIntentMatcher';
import { normalizeText } from '../engine/normalizeText';
import { resolveConversation } from '../engine/resolveConversation';
import { searchKnowledge } from '../engine/searchKnowledge';
import type {
  AuditCategory,
  AuditProcessingPolicy,
  AuditSourceStatus,
  AuditedCandidate,
  ConversationAuditCase,
  ConversationAuditRecord,
  ConversationAuditSummary,
  ConversationAuditVerdict,
  KnowledgeAnswerAudit,
} from './conversationAuditTypes';

function uniqueItems(items: Array<KnowledgeItem | undefined>): KnowledgeItem[] {
  return items
    .filter((item): item is KnowledgeItem => Boolean(item))
    .filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
}

function primaryItems(result?: SearchResult): KnowledgeItem[] {
  if (!result) return [];
  return result.items ?? (result.item ? [result.item] : []);
}

function candidateItems(result?: SearchResult): KnowledgeItem[] {
  if (!result) return [];
  return uniqueItems([
    ...(result.items ?? (result.item ? [result.item] : [])),
    ...result.suggestions,
    ...result.alternatives,
  ]);
}

export function sourceStatusOf(item: Pick<KnowledgeItem, 'source'>): AuditSourceStatus {
  if (!item.source?.trim()) return 'unverifiable';
  if (/(?:승인.*(?:대기|전)|수령 전)/u.test(item.source)) return 'draft-safe';
  return 'known';
}

function actualPolicyOf(resolution: ConversationResolution): AuditProcessingPolicy {
  if (resolution.kind === 'smalltalk') return 'smalltalk';
  if (resolution.kind === 'fallback') return 'fallback';
  if (resolution.routeDecision?.mode === 'clarification' || resolution.searchResult?.status === 'suggestions') return 'clarify';
  return 'answer';
}

function answerBodyCandidates(item: KnowledgeItem): string[] {
  if (item.answerVariants?.length) return item.answerVariants;
  if (item.shortAnswer) return [item.shortAnswer];
  const blocks = item.answerBlocks?.filter((block) => !block.condition).map((block) => block.text) ?? [];
  return blocks.length ? blocks : [item.answer];
}

function renderedAnswerOf(resolution: ConversationResolution, config: BotConfig): string {
  if (resolution.kind === 'smalltalk') return resolution.replyText ?? config.bot.fallbackMessage;
  if (resolution.routeDecision?.mode === 'clarification') {
    return resolution.clarificationPrompt ?? '새 질문인지, 앞선 문의를 이어가는 것인지 확인해 주세요.';
  }
  const result = resolution.searchResult;
  if (result?.status === 'answer' && result.item) {
    return resolution.responsePlan?.text ?? primaryItems(result).map((item) => item.answer).join('\n\n');
  }
  if (result?.status === 'suggestions') return '혹시 이 질문을 찾으셨나요?';
  return config.bot.fallbackMessage;
}

function groundednessOf(resolution: ConversationResolution, renderedAnswer: string): boolean {
  if (resolution.kind !== 'knowledge' || actualPolicyOf(resolution) !== 'answer') return true;
  const items = primaryItems(resolution.searchResult);
  if (!items.length) return false;
  if (resolution.responsePlan) {
    if (resolution.responsePlan.knowledgeIds.join(':') !== items.map((item) => item.id).join(':')) return false;
  }
  return items.every((item) => answerBodyCandidates(item).some((body) => renderedAnswer.includes(body)));
}

function handoffOfferedBy(resolution: ConversationResolution): boolean {
  if (resolution.kind === 'smalltalk') return Boolean(resolution.handoffCta);
  const policy = actualPolicyOf(resolution);
  if (policy === 'fallback' || policy === 'clarify') return true;
  return primaryItems(resolution.searchResult).some((item) => item.handoffRecommended);
}

function candidateMetadata(item: KnowledgeItem, result?: SearchResult): AuditedCandidate {
  const isLeading = primaryItems(result).some((candidate) => candidate.id === item.id);
  return {
    id: item.id,
    question: item.question,
    score: isLeading ? result?.score : undefined,
    confidence: isLeading ? result?.confidence : undefined,
    matchedFields: isLeading ? result?.matchedFields : undefined,
    debugScore: isLeading ? result?.debugScore : undefined,
    sourceStatus: sourceStatusOf(item),
    source: item.source,
    answerMode: item.answerMode,
    riskLevel: item.riskLevel,
    handoffRecommended: Boolean(item.handoffRecommended),
  };
}

function verdictFor(
  entry: ConversationAuditCase,
  resolution: ConversationResolution,
  renderedAnswer: string,
): ConversationAuditVerdict {
  const actualPolicy = actualPolicyOf(resolution);
  const primary = primaryItems(resolution.searchResult);
  const candidates = candidateItems(resolution.searchResult).slice(0, 3);
  const expectedIds = entry.expectation.acceptedKnowledgeIds ?? [];
  const safeIds = entry.expectation.safeKnowledgeIds ?? [];
  const forbiddenIds = entry.expectation.forbiddenKnowledgeIds ?? [];
  const retrievalPass = expectedIds.length === 0 || expectedIds.some((id) => candidates.some((item) => item.id === id));
  const forbiddenHit = forbiddenIds.some((id) => primary.some((item) => item.id === id));
  const routingPass = entry.expectation.acceptedPolicies.includes(actualPolicy);
  const groundednessPass = groundednessOf(resolution, renderedAnswer);
  const uncalibratedItems = primary.filter((item) => sourceStatusOf(item) !== 'known' || item.answerMode !== 'verified');
  const calibrationPass = actualPolicy !== 'answer' || resolution.searchResult?.confidence !== 'high' || uncalibratedItems.length === 0;
  const safeKnowledgeAnswer = actualPolicy === 'answer' && primary.length > 0 && primary.every((item) => safeIds.includes(item.id));
  const unsupportedFalseAnswer = (entry.category === 'unsupported' || entry.category === 'safety') &&
    actualPolicy === 'answer' && !safeKnowledgeAnswer;
  const safetyPass = !unsupportedFalseAnswer && !forbiddenHit;
  const handoffOffered = handoffOfferedBy(resolution);
  const handoffPass = !entry.expectation.requiresHandoff || handoffOffered;
  const reasons: string[] = [];
  if (!retrievalPass) reasons.push('wrong-retrieval');
  if (!routingPass) reasons.push('wrong-route');
  if (!groundednessPass) reasons.push('ungrounded-response');
  if (!calibrationPass) reasons.push('source-confidence-mismatch');
  if (!safetyPass) reasons.push(unsupportedFalseAnswer ? 'unsafe-answer' : 'forbidden-knowledge');
  if (!handoffPass) reasons.push('missing-handoff');
  const overall = !safetyPass || !handoffPass
    ? 'unsafe'
    : reasons.length
      ? 'needs-improvement'
      : 'acceptable';
  return {
    retrievalPass,
    routingPass,
    groundednessPass,
    calibrationPass,
    safetyPass,
    handoffPass,
    overall,
    reasons,
  };
}

export function auditConversationCase(
  entry: ConversationAuditCase,
  config: BotConfig,
  variant: ConversationEngineVariant,
): ConversationAuditRecord {
  let context: ConversationContext | undefined;
  (entry.previousTurns ?? []).forEach((query) => {
    const previous = resolveConversation(query, config, { context, variant });
    context = previous.contextPatch;
  });
  const resolution = resolveConversation(entry.query, config, { context, variant });
  const result = resolution.searchResult;
  const standalone = searchKnowledge(entry.query, config, { variant });
  const renderedAnswer = renderedAnswerOf(resolution, config);
  const candidates = candidateItems(result);
  return {
    caseId: entry.id,
    category: entry.category,
    variant,
    query: entry.query,
    previousTurns: entry.previousTurns ?? [],
    normalizedQuery: normalizeText(entry.query),
    effectiveQuery: resolution.effectiveQuery,
    unsupportedGuardMatched: variant === 'candidate' && isClearlyUnsupportedQuery(entry.query),
    curatedKnowledgeId: variant === 'candidate' ? matchCuratedKnowledgeId(entry.query, config.bot.id) : undefined,
    smallTalkIntent: resolution.smallTalkIntent,
    actualPolicy: actualPolicyOf(resolution),
    routeDecision: resolution.routeDecision,
    status: result?.status,
    confidence: result?.confidence,
    score: result?.score,
    scoreMargin: result?.scoreMargin,
    matchedFields: result?.matchedFields ?? [],
    matchedUtterance: result?.matchedUtterance ?? standalone.matchedUtterance,
    primaryKnowledgeIds: primaryItems(result).map((item) => item.id),
    candidateKnowledgeIds: candidates.map((item) => item.id),
    candidates: candidates.map((item) => candidateMetadata(item, result)),
    renderedAnswer,
    handoffOffered: handoffOfferedBy(resolution),
    verdict: verdictFor(entry, resolution, renderedAnswer),
  };
}

function categoryOfLegacy(turn: ConversationQaTurn): AuditCategory {
  if (turn.category === 'supported') return 'faq-coverage';
  if (turn.category === 'multi-turn') return 'context';
  return turn.category;
}

function policiesOfLegacy(turn: ConversationQaTurn): AuditProcessingPolicy[] {
  const policies = new Set<AuditProcessingPolicy>();
  turn.acceptedModes?.forEach((mode) => {
    if (mode === 'clarification') policies.add('clarify');
    else if (mode === 'fallback') policies.add('fallback');
    else policies.add('answer');
  });
  if (turn.expectedKind === 'smalltalk') policies.add('smalltalk');
  if (turn.expectedKind === 'fallback') policies.add('fallback');
  if (turn.safeKnowledgeIds?.length) policies.add('answer');
  if (!policies.size) policies.add('answer');
  return [...policies];
}

function legacyCase(turn: ConversationQaTurn, previousTurns: string[] = []): ConversationAuditCase {
  return {
    id: `legacy-${turn.id}`,
    category: categoryOfLegacy(turn),
    query: turn.query,
    previousTurns,
    expectation: {
      acceptedKnowledgeIds: turn.expectedKnowledgeIds,
      forbiddenKnowledgeIds: turn.forbiddenKnowledgeIds,
      acceptedPolicies: policiesOfLegacy(turn),
      requiresHandoff: turn.requiresHandoff,
      safeKnowledgeIds: turn.safeKnowledgeIds,
    },
    rationale: '기존 240턴 promotion corpus의 결과를 새 audit 지표로 재현한다.',
  };
}

export function buildLegacyAuditCases(): ConversationAuditCase[] {
  const singles = singleTurnQaTurns.map((turn) => legacyCase(turn));
  const scenarios = multiTurnQaScenarios.flatMap((scenario) => {
    const previousTurns: string[] = [];
    return scenario.turns.map((turn) => {
      const entry = legacyCase(turn, [...previousTurns]);
      previousTurns.push(turn.query);
      return entry;
    });
  });
  return [...singles, ...scenarios];
}

export function validateAuditCases(cases: ConversationAuditCase[], config: BotConfig): string[] {
  const errors: string[] = [];
  const knowledgeIds = new Set(config.knowledge.map((item) => item.id));
  const caseIds = new Set<string>();
  cases.forEach((entry) => {
    if (caseIds.has(entry.id)) errors.push(`duplicate audit case id: ${entry.id}`);
    caseIds.add(entry.id);
    if (!entry.id.trim() || !entry.query.trim()) errors.push(`invalid audit case: ${entry.id}`);
    if (!entry.expectation.acceptedPolicies.length) errors.push(`missing accepted policy: ${entry.id}`);
    [
      ...(entry.expectation.acceptedKnowledgeIds ?? []),
      ...(entry.expectation.forbiddenKnowledgeIds ?? []),
      ...(entry.expectation.safeKnowledgeIds ?? []),
    ].forEach((id) => {
      if (!knowledgeIds.has(id)) errors.push(`unknown knowledge id ${id}: ${entry.id}`);
    });
  });
  return errors;
}

export function auditKnowledgeAnswers(config: BotConfig): KnowledgeAnswerAudit[] {
  const answerCounts = new Map<string, number>();
  config.knowledge.forEach((item) => answerCounts.set(item.answer, (answerCounts.get(item.answer) ?? 0) + 1));
  return config.knowledge.map((item) => {
    const sourceStatus = sourceStatusOf(item);
    const directness: 0 | 1 | 2 = !item.answer.trim() ? 0 : (answerCounts.get(item.answer) ?? 0) > 1 ? 1 : 2;
    const hasNextAction = /(?:카카오|문의|상담|알려|확인|안내|입력하지|남겨|선택)/u.test(item.answer);
    const completeness: 0 | 1 | 2 = directness === 0 ? 0 : directness === 2 && hasNextAction ? 2 : 1;
    const risky = item.riskLevel === 'policy' || item.riskLevel === 'personal';
    const safetyPass = !risky || item.answerMode !== 'verified' || Boolean(item.handoffRecommended);
    const reasons: string[] = [];
    if (sourceStatus !== 'known') reasons.push('unverified-source');
    if (directness < 2) reasons.push('shared-generic-answer');
    if (completeness < 2) reasons.push('partial-next-step');
    if (!safetyPass) reasons.push('risky-answer-without-safety-mode');
    const overall = !safetyPass ? 'unsafe' : reasons.length ? 'needs-improvement' : 'acceptable';
    return {
      knowledgeId: item.id,
      question: item.question,
      sourceStatus,
      factualStatus: sourceStatus === 'known' ? 'known' : 'unverifiable',
      answerMode: item.answerMode,
      riskLevel: item.riskLevel,
      directness,
      completeness,
      safetyPass,
      overall,
      reasons,
    };
  });
}

function metricSummary(records: ConversationAuditRecord[]): ConversationAuditSummary['candidate'] {
  return {
    acceptable: records.filter((record) => record.verdict.overall === 'acceptable').length,
    needsImprovement: records.filter((record) => record.verdict.overall === 'needs-improvement').length,
    unsafe: records.filter((record) => record.verdict.overall === 'unsafe').length,
    retrievalFailures: records.filter((record) => !record.verdict.retrievalPass).length,
    routingFailures: records.filter((record) => !record.verdict.routingPass).length,
    groundingFailures: records.filter((record) => !record.verdict.groundednessPass).length,
    calibrationFailures: records.filter((record) => !record.verdict.calibrationPass).length,
    safetyFailures: records.filter((record) => !record.verdict.safetyPass).length,
    handoffFailures: records.filter((record) => !record.verdict.handoffPass).length,
  };
}

function finding(
  priority: 'P0' | 'P1' | 'P2' | 'P3',
  code: string,
  description: string,
  records: ConversationAuditRecord[],
): ConversationAuditSummary['priorityFindings'][number] {
  return { priority, code, description, count: records.length, caseIds: records.slice(0, 12).map((record) => record.caseId) };
}

export function summarizeConversationAudit(
  cases: ConversationAuditCase[],
  records: ConversationAuditRecord[],
  knowledgeAudits: KnowledgeAnswerAudit[],
): ConversationAuditSummary {
  const candidate = records.filter((record) => record.variant === 'candidate');
  const baseline = records.filter((record) => record.variant === 'baseline');
  const failed = (reason: string) => candidate.filter((record) => record.verdict.reasons.includes(reason));
  const genericKnowledge = knowledgeAudits.filter((item) => item.directness < 2);
  const priorityCandidates: ConversationAuditSummary['priorityFindings'] = [
    finding('P0', 'unsafe-answer', '지원 범위 밖·안전 질문에 허용되지 않은 지식 답변이 나옴', failed('unsafe-answer')),
    finding('P0', 'missing-handoff', '정책·개인정보·안전 질문에 필요한 상담 연결이 없음', failed('missing-handoff')),
    finding('P1', 'wrong-retrieval', '기대한 FAQ가 top-3 후보에 없음', failed('wrong-retrieval')),
    finding('P1', 'source-confidence-mismatch', '승인 근거나 answer mode가 부족한 답변을 high confidence로 표시함', failed('source-confidence-mismatch')),
    {
      priority: 'P2',
      code: 'generic-answer',
      description: '다른 FAQ와 동일한 공통 문구를 사용해 질문에 직접 답하지 못함',
      count: genericKnowledge.length,
      caseIds: genericKnowledge.slice(0, 12).map((item) => item.knowledgeId),
    },
    finding('P2', 'wrong-route', '모호성·문맥을 잘못 판단해 answer/clarification/fallback 정책이 부적합함', failed('wrong-route')),
    finding('P2', 'ungrounded-response', '등록된 answer 범위에서 최종 응답을 재구성할 수 없음', failed('ungrounded-response')),
  ];
  const priorityFindings = priorityCandidates.filter((entry) => entry.count > 0);
  const byCategory = Object.fromEntries(
    ['faq-coverage', 'robustness', 'contrast', 'ambiguous', 'context', 'unsupported', 'safety']
      .map((category) => [category, cases.filter((entry) => entry.category === category).length]),
  ) as ConversationAuditSummary['byCategory'];
  return {
    caseCount: cases.length,
    recordCount: records.length,
    knowledgeCount: knowledgeAudits.length,
    byCategory,
    candidate: metricSummary(candidate),
    baseline: metricSummary(baseline),
    knowledge: {
      known: knowledgeAudits.filter((item) => item.sourceStatus === 'known').length,
      draftSafe: knowledgeAudits.filter((item) => item.sourceStatus === 'draft-safe').length,
      unverifiable: knowledgeAudits.filter((item) => item.factualStatus === 'unverifiable').length,
      direct: knowledgeAudits.filter((item) => item.directness === 2).length,
      genericOrDeflective: genericKnowledge.length,
    },
    priorityFindings,
  };
}

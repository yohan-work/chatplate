import { resolveSmallTalkConfig } from '../data/smallTalkDefaults';
import type {
  BotConfig,
  ConversationContext,
  ConversationEngineVariant,
  ConversationResolution,
  KnowledgeItem,
  SearchResult,
  SmallTalkConfig,
  SmallTalkIntentId,
  SmallTalkRule,
} from '../types/chatbot';
import { analyzeConversationInput, correctionHistory, type ConversationInputAnalysis } from './analyzeConversation';
import { composeResponsePlan } from './composeResponsePlan';
import { excludedKnowledgeIds, reduceDialogueState } from './dialogueState';
import { detectAmbiguousQuery } from './detectAmbiguousQuery';
import {
  classifyGuardedQuery,
  guardDecisionForCategory,
  isGuardExplanationFollowUp,
} from './detectUnsupportedQuery';
import { normalizeText } from './normalizeText';
import { extractQueryFeatures } from './queryFeatures';
import { routeConversationQuery } from './routeConversationQuery';
import { scoreKnowledge } from './scoreKnowledge';
import { findKnowledgeById, searchKnowledge } from './searchKnowledge';

const MAX_INPUT_LENGTH = 300;
const REPEATED_CHARACTER = /^(.)\1{3,}$/u;
const WRAPPER_INTENTS = new Set<SmallTalkIntentId>(['greeting', 'thanks', 'goodbye']);
const CONTAINS_INTENTS = new Set<SmallTalkIntentId>(['human', 'abuse']);

interface NormalizedRule extends SmallTalkRule {
  normalizedUtterances: string[];
}

const ruleCache = new WeakMap<SmallTalkConfig, NormalizedRule[]>();

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function normalizedRules(config: SmallTalkConfig): NormalizedRule[] {
  const cached = ruleCache.get(config);
  if (cached) return cached;

  const rules = config.rules
    .filter((rule) => rule.enabled)
    .map((rule) => ({
      ...rule,
      normalizedUtterances: rule.utterances
        .map(normalizeText)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length),
    }));
  ruleCache.set(config, rules);
  return rules;
}

function isSafeNearMatch(query: string, utterance: string): boolean {
  return query.length >= 4 &&
    utterance.length >= 4 &&
    Math.abs(query.length - utterance.length) <= 1 &&
    levenshtein(query, utterance) <= 1;
}

function matchesRule(query: string, rule: NormalizedRule): boolean {
  if (CONTAINS_INTENTS.has(rule.intentId)) {
    return rule.normalizedUtterances.some((utterance) =>
      query === utterance || query.startsWith(`${utterance} `) || query.endsWith(` ${utterance}`) || query.includes(` ${utterance} `),
    );
  }
  return rule.normalizedUtterances.some((utterance) => query === utterance || isSafeNearMatch(query, utterance));
}

function smallTalkResolution(
  originalQuery: string,
  effectiveQuery: string,
  rule: NormalizedRule,
  previous?: ConversationContext,
  analysis?: ConversationInputAnalysis,
): ConversationResolution {
  const frustrationLevel = rule.intentId === 'frustration' || rule.intentId === 'abuse'
    ? Math.min(3, (previous?.frustrationLevel ?? 0) + 1)
    : previous?.frustrationLevel ?? 0;
  return {
    kind: 'smalltalk',
    originalQuery,
    effectiveQuery,
    smallTalkIntent: rule.intentId,
    replyText: rule.response,
    handoffCta: rule.handoffCta,
    showSuggestions: rule.showSuggestions,
    answerTrust: 'verified',
    segments: analysis?.segments,
    dialogueActs: analysis?.dialogueActs,
    contextPatch: {
      lastIntentId: previous?.lastIntentId,
      lastKnowledgeIds: previous?.lastKnowledgeIds ?? [],
      entities: { ...(previous?.entities ?? {}), ...(analysis?.entities ?? {}) },
      pendingCandidateIds: previous?.pendingCandidateIds ?? [],
      turnCount: (previous?.turnCount ?? 0) + 1,
      updatedAt: Date.now(),
      audience: analysis?.audience ?? previous?.audience ?? 'unknown',
      activeGoal: previous?.activeGoal,
      openIntentIds: previous?.openIntentIds ?? [],
      answeredIntentIds: previous?.answeredIntentIds ?? [],
      lastDialogueAct: analysis?.dialogueActs[0],
      lastBotAction: rule.handoffCta ? 'handoff' : 'smalltalk',
      frustrationLevel,
      correctionHistory: previous?.correctionHistory ?? [],
      dialogueFrames: previous?.dialogueFrames ?? [],
      pendingClarification: previous?.pendingClarification,
      stateRevision: previous?.stateRevision ?? 0,
      lastGuardCategory: previous?.lastGuardCategory,
    },
  };
}

function guardContextPatch(
  previous: ConversationContext | undefined,
  analysis: ConversationInputAnalysis,
  category: NonNullable<ConversationResolution['guardDecision']>['category'],
): ConversationContext {
  return {
    lastIntentId: previous?.lastIntentId,
    lastKnowledgeIds: previous?.lastKnowledgeIds ?? [],
    entities: { ...(previous?.entities ?? {}), ...analysis.entities },
    pendingCandidateIds: [],
    turnCount: (previous?.turnCount ?? 0) + 1,
    updatedAt: Date.now(),
    audience: analysis.audience ?? previous?.audience ?? 'unknown',
    activeGoal: previous?.activeGoal,
    openIntentIds: previous?.openIntentIds ?? [],
    answeredIntentIds: previous?.answeredIntentIds ?? [],
    lastDialogueAct: analysis.dialogueActs[0],
    lastBotAction: 'handoff',
    frustrationLevel: previous?.frustrationLevel ?? 0,
    correctionHistory: previous?.correctionHistory ?? [],
    dialogueFrames: previous?.dialogueFrames ?? [],
    stateRevision: (previous?.stateRevision ?? 0) + 1,
    lastGuardCategory: category,
  };
}

function contextPatch(
  query: string,
  result: ReturnType<typeof searchKnowledge>,
  previous?: ConversationContext,
  clarification = false,
  analysis?: ConversationInputAnalysis,
  unresolvedSegments: string[] = [],
): ConversationContext {
  const features = extractQueryFeatures(query);
  const entities = { ...features.entities, ...(analysis?.entities ?? {}) };
  const isCorrection = analysis?.dialogueActs.includes('correct') ?? false;
  const dialogueState = reduceDialogueState(query, result, previous, analysis);
  if (clarification && previous) {
    return {
      ...previous,
      entities: { ...previous.entities, ...entities },
      pendingCandidateIds: result.suggestions.map((item) => item.id),
      turnCount: previous.turnCount + 1,
      updatedAt: Date.now(),
      audience: analysis?.audience ?? previous.audience,
      openIntentIds: unresolvedSegments,
      lastDialogueAct: analysis?.dialogueActs[0],
      lastBotAction: 'clarify',
      frustrationLevel: analysis?.relationshipIntent === 'frustration'
        ? Math.min(3, (previous.frustrationLevel ?? 0) + 1)
        : previous.frustrationLevel ?? 0,
      correctionHistory: correctionHistory(previous, entities, isCorrection),
      ...dialogueState,
      lastGuardCategory: undefined,
    };
  }

  const items = result.items ?? (result.item ? [result.item] : result.suggestions.slice(0, 1));
  return {
    lastIntentId: items[0]?.intentId ?? previous?.lastIntentId,
    lastKnowledgeIds: items.map((item) => item.id),
    entities: { ...(previous?.entities ?? {}), ...entities },
    pendingCandidateIds: result.status === 'suggestions' ? result.suggestions.map((item) => item.id) : [],
    turnCount: (previous?.turnCount ?? 0) + 1,
    updatedAt: Date.now(),
    audience: analysis?.audience ?? previous?.audience ?? 'unknown',
    activeGoal: items[0]?.intentId ?? previous?.activeGoal,
    openIntentIds: unresolvedSegments,
    answeredIntentIds: [...new Set([...(previous?.answeredIntentIds ?? []), ...items.map((item) => item.intentId ?? item.id)])].slice(-12),
    lastDialogueAct: analysis?.dialogueActs[0],
    lastBotAction: result.status === 'fallback' ? 'fallback' : 'answer',
    frustrationLevel: analysis?.relationshipIntent === 'frustration'
      ? Math.min(3, (previous?.frustrationLevel ?? 0) + 1)
      : previous?.frustrationLevel ?? 0,
    correctionHistory: correctionHistory(previous, entities, isCorrection),
    ...dialogueState,
    lastGuardCategory: undefined,
  };
}

function knowledgeResolution(
  originalQuery: string,
  effectiveQuery: string,
  botConfig: BotConfig,
  intentId?: string,
  context?: ConversationContext,
  variant?: ConversationEngineVariant,
  analysis: ConversationInputAnalysis = analyzeConversationInput(effectiveQuery, context),
): ConversationResolution {
  const phase4Enabled = variant !== 'baseline' && variant !== 'phase3';
  const engineConfig = phase4Enabled
    ? botConfig
    : { ...botConfig, knowledge: botConfig.knowledge.filter((item) => !item.id.startsWith('advice-')) };
  const resetContext = phase4Enabled && (analysis.dialogueActs.includes('restart') || analysis.dialogueActs.includes('switch-topic'));
  const previous = resetContext ? undefined : context;
  const routingContext = phase4Enabled && previous && analysis.dialogueActs.includes('correct')
    ? { ...previous, entities: { ...previous.entities, ...analysis.entities } }
    : previous;
  const candidateIds = routingContext?.pendingCandidateIds.length
    ? routingContext.pendingCandidateIds
    : routingContext?.lastKnowledgeIds ?? [];
  const indexedSelectedItem = analysis.selectedIndex !== undefined
    ? findKnowledgeById(engineConfig, candidateIds[analysis.selectedIndex] ?? '')
    : undefined;
  const semanticCandidates = routingContext?.pendingCandidateIds
    .map((id) => findKnowledgeById(engineConfig, id))
    .filter((item): item is KnowledgeItem => Boolean(item)) ?? [];
  const rankedSemanticCandidates = semanticCandidates
    .map((item) => ({ item, score: scoreKnowledge(effectiveQuery, item) }))
    .sort((a, b) => b.score - a.score);
  const hasStrongNewTopic = /(?:온라인|비대면|화상|실명|연락|신청|누가|준비|주말|계획표|피드백|과목|환불|비용|성적|자료|부모|보호자)/u.test(analysis.normalized);
  const semanticSelectedItem = !hasStrongNewTopic && rankedSemanticCandidates[0] && (
    rankedSemanticCandidates[0].score >= 0.2 &&
    rankedSemanticCandidates[0].score - (rankedSemanticCandidates[1]?.score ?? 0) >= 0.02
  ) ? rankedSemanticCandidates[0].item : undefined;
  const selectedItem = indexedSelectedItem ?? semanticSelectedItem;
  const controlStyle = analysis.dialogueActs.includes('shorten')
    ? 'short' as const
    : analysis.dialogueActs.includes('summarize')
      ? 'summary' as const
      : analysis.dialogueActs.includes('confirm')
        ? 'confirmation' as const
        : analysis.dialogueActs.includes('elaborate') || analysis.dialogueActs.includes('example')
          ? 'detailed' as const
          : variant === 'socratic'
            ? 'socratic' as const
            : 'default' as const;
  const controlOnly = /^(?:다시|짧게|간단히|한\s*줄로|자세히|구체적으로|상세히|예시|요약|정리|맞죠|맞나요|그렇다는\s*거죠|이해한.*맞).{0,14}$/u.test(analysis.normalized);
  const previousItems = routingContext?.lastKnowledgeIds
    .map((id) => findKnowledgeById(engineConfig, id))
    .filter((item): item is KnowledgeItem => Boolean(item)) ?? [];
  const correctionAcknowledgement = analysis.dialogueActs.some((act) => act === 'correct' || act === 'exclude')
    ? '말씀하신 정정 내용을 기준으로 다시 안내할게요.'
    : analysis.dialogueActs.includes('confirm') && excludedKnowledgeIds(routingContext).length
      ? '방금 정정하신 내용을 기준으로 이해했어요.'
      : analysis.acknowledgement;

  if (phase4Enabled && (selectedItem || (controlOnly && previousItems.length))) {
    const items = selectedItem ? [selectedItem] : previousItems;
    const searchResult: SearchResult = {
      status: 'answer',
      confidence: 'high',
      score: 1,
      item: items[0],
      items,
      suggestions: items,
      alternatives: [],
      matchedFields: ['intent'],
      decisionReason: 'confident',
    };
    const responsePlan = composeResponsePlan(effectiveQuery, searchResult, routingContext, {
      continued: true,
      audience: analysis.audience,
      acknowledgement: correctionAcknowledgement,
      responseStyle: controlStyle,
    });
    return {
      kind: 'knowledge',
      originalQuery,
      effectiveQuery,
      searchResult,
      responsePlan,
      answerTrust: responsePlan?.answerTrust,
      contextPatch: contextPatch(effectiveQuery, searchResult, previous, false, analysis),
      routeDecision: {
        mode: 'contextual',
        reason: selectedItem ? 'pending-selection' : 'same-candidate',
        standaloneKnowledgeId: items[0]?.id,
        contextualKnowledgeId: items[0]?.id,
        standaloneScore: 1,
        contextualScore: 1,
      },
      segments: analysis.segments,
      resolvedIntents: items.map((item) => ({
        segment: effectiveQuery,
        intentId: item.intentId ?? item.id,
        family: item.id.startsWith('advice-') ? 'advice' : 'knowledge',
        knowledgeIds: [item.id],
        confidence: 'high',
      })),
      unresolvedSegments: [],
      dialogueActs: analysis.dialogueActs,
    };
  }

  const explicitAmbiguity = phase4Enabled && !routingContext && !analysis.dialogueActs.includes('select')
    ? detectAmbiguousQuery(effectiveQuery, engineConfig)
    : undefined;
  if (explicitAmbiguity) {
    const searchResult = explicitAmbiguity.result;
    return {
      kind: 'knowledge',
      originalQuery,
      effectiveQuery,
      searchResult,
      answerTrust: 'bounded',
      contextPatch: contextPatch(effectiveQuery, searchResult, previous, true, analysis),
      routeDecision: {
        mode: 'clarification',
        reason: 'standalone-ambiguity',
        standaloneKnowledgeId: searchResult.suggestions[0]?.id,
        standaloneScore: searchResult.score,
      },
      clarificationPrompt: correctionAcknowledgement
        ? `${correctionAcknowledgement} ${explicitAmbiguity.prompt}`
        : explicitAmbiguity.prompt,
      segments: analysis.segments,
      resolvedIntents: [],
      unresolvedSegments: [effectiveQuery],
      dialogueActs: analysis.dialogueActs,
    };
  }

  if (phase4Enabled && analysis.knowledgeSegments.length > 1) {
    const segmentResults = analysis.knowledgeSegments.map((segment) => ({
      segment,
      result: searchKnowledge(segment, engineConfig, { intentId, variant }),
    }));
    const items = segmentResults
      .flatMap(({ result }) => result.status === 'answer' ? (result.items ?? (result.item ? [result.item] : [])) : [])
      .filter((item, index, values) => values.findIndex((entry) => entry.id === item.id) === index);
    const unresolvedSegments = segmentResults
      .filter(({ result }) => result.status !== 'answer')
      .map(({ segment }) => segment);
    if (items.length) {
      const searchResult: SearchResult = {
        status: 'answer',
        confidence: unresolvedSegments.length ? 'medium' : 'high',
        score: Math.max(...segmentResults.map(({ result }) => result.score)),
        item: items[0],
        items,
        suggestions: items,
        alternatives: [],
        matchedFields: [...new Set(segmentResults.flatMap(({ result }) => result.matchedFields))],
        decisionReason: 'confident',
      };
      const responsePlan = composeResponsePlan(effectiveQuery, searchResult, routingContext, {
        audience: analysis.audience,
        acknowledgement: correctionAcknowledgement,
        unresolvedSegments,
      });
      return {
        kind: 'knowledge',
        originalQuery,
        effectiveQuery,
        searchResult,
        responsePlan,
        answerTrust: responsePlan?.answerTrust,
        contextPatch: contextPatch(effectiveQuery, searchResult, previous, false, analysis, unresolvedSegments),
        routeDecision: {
          mode: 'standalone', reason: 'no-context', standaloneKnowledgeId: items[0].id, standaloneScore: searchResult.score,
        },
        segments: analysis.segments,
        resolvedIntents: segmentResults.flatMap(({ segment, result }) => {
          const resolved = result.items ?? (result.item ? [result.item] : []);
          return resolved.map((item) => ({
            segment,
            intentId: item.intentId ?? item.id,
            family: item.id.startsWith('advice-') ? 'advice' as const : 'knowledge' as const,
            knowledgeIds: [item.id],
            confidence: result.confidence,
          }));
        }),
        unresolvedSegments,
        dialogueActs: analysis.dialogueActs,
      };
    }
  }

  const isCorrectionQuery = analysis.dialogueActs.some((act) => act === 'correct' || act === 'exclude');
  const contextualOnlineCoaching = /온라인(?:도|으로)?\s*(?:되|가능|할\s*수|받)/u.test(analysis.normalized) &&
    routingContext?.lastKnowledgeIds.some((id) => id.startsWith('fit-'));
  const routingQuery = contextualOnlineCoaching
    ? `${effectiveQuery} 온라인 코칭`
    : isCorrectionQuery && analysis.knowledgeSegments.length === 1
    ? analysis.knowledgeSegments[0]
    : effectiveQuery;
  const route = routeConversationQuery(routingQuery, engineConfig, { intentId, context: routingContext, variant });
  const excludedIds = new Set([
    ...excludedKnowledgeIds(routingContext),
    ...(isCorrectionQuery ? routingContext?.lastKnowledgeIds ?? [] : []),
  ]);
  const shouldFilterExcluded = route.decision.reason !== 'standalone-exact' && excludedIds.size > 0;
  const filteredItems = shouldFilterExcluded
    ? (route.result.items ?? (route.result.item ? [route.result.item] : [])).filter((item) => !excludedIds.has(item.id))
    : route.result.items ?? (route.result.item ? [route.result.item] : []);
  const filteredSuggestions = shouldFilterExcluded
    ? route.result.suggestions.filter((item) => !excludedIds.has(item.id))
    : route.result.suggestions;
  const searchResult: SearchResult = shouldFilterExcluded ? {
    ...route.result,
    item: filteredItems[0],
    items: filteredItems,
    suggestions: filteredSuggestions,
    alternatives: route.result.alternatives.filter((item) => !excludedIds.has(item.id)),
    status: filteredItems.length || filteredSuggestions.length ? route.result.status : 'fallback',
  } : route.result;
  const responsePlan = route.decision.mode === 'clarification'
    ? undefined
    : composeResponsePlan(effectiveQuery, searchResult, routingContext, phase4Enabled ? {
      continued: route.continued,
      audience: analysis.audience,
      acknowledgement: correctionAcknowledgement,
      responseStyle: controlStyle,
    } : { continued: route.continued });
  const resolvedItems = searchResult.items ?? (searchResult.item ? [searchResult.item] : []);
  return {
    kind: searchResult.status === 'fallback' ? 'fallback' : 'knowledge',
    originalQuery,
    effectiveQuery: route.effectiveQuery,
    searchResult,
    responsePlan,
    answerTrust: responsePlan?.answerTrust,
    contextPatch: contextPatch(effectiveQuery, searchResult, previous, route.decision.mode === 'clarification', analysis),
    routeDecision: route.decision,
    clarificationPrompt: correctionAcknowledgement && route.decision.mode === 'clarification'
      ? `${correctionAcknowledgement} ${route.clarificationPrompt ?? '어느 내용을 말씀하시는지 확인해 주세요.'}`
      : route.clarificationPrompt,
    segments: analysis.segments,
    resolvedIntents: resolvedItems.map((item) => ({
      segment: effectiveQuery,
      intentId: item.intentId ?? item.id,
      family: item.id.startsWith('advice-') ? 'advice' : 'knowledge',
      knowledgeIds: [item.id],
      confidence: searchResult.confidence,
    })),
    unresolvedSegments: searchResult.status === 'fallback' ? [effectiveQuery] : [],
    dialogueActs: analysis.dialogueActs,
  };
}

function stripSocialWrappers(query: string, rules: NormalizedRule[]): { query: string; matchedRule?: NormalizedRule } {
  const wrappers = rules.filter((rule) => WRAPPER_INTENTS.has(rule.intentId));
  let remaining = query;
  let matchedRule: NormalizedRule | undefined;

  for (let pass = 0; pass < 3; pass += 1) {
    let changed = false;
    for (const rule of wrappers) {
      const utterance = rule.normalizedUtterances.find((value) =>
        remaining.startsWith(`${value} `) || remaining.endsWith(` ${value}`),
      );
      if (!utterance) continue;
      remaining = remaining.startsWith(`${utterance} `)
        ? remaining.slice(utterance.length).trim()
        : remaining.slice(0, -utterance.length).trim();
      matchedRule ??= rule;
      changed = true;
      break;
    }
    if (!changed) break;
  }

  return { query: remaining, matchedRule };
}

function isSocialOnlyRemainder(query: string): boolean {
  const compact = query.replace(/(?:네|예|알겠어요|알겠습니다|이해했어요|설명|일단|여기까지|볼게요|그럴게요|좋아요)/gu, '').trim();
  return compact.length === 0;
}

function stripDiscoursePreamble(query: string): string {
  return query.replace(
    /^(?:짧게\s*여쭤볼게요|제가\s*상황을\s*잘\s*몰라서\s*그런데|학부모\s*입장에서\s*확인하고\s*싶어요|말을\s*바꿔서\s*질문하면|조금\s*다르게\s*여쭤보면|설명\s*잘\s*들었어요|상황을\s*먼저\s*말씀드릴게요|제가\s*묻고\s*싶은\s*건\s*이거예요|솔직히\s*말씀드리면|한\s*번에\s*두\s*가지\s*확인할게요|혹시|확인\s*차원에서|이런\s*요청도\s*가능한지\s*묻는데)[\s,.!?]*/u,
    '',
  ).trim();
}

export function validateSmallTalkConfig(config: SmallTalkConfig): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();
  const requiredIntents: SmallTalkIntentId[] = ['greeting', 'thanks', 'goodbye', 'help', 'identity', 'human', 'abuse', 'noise'];
  const intentCounts = new Map<SmallTalkIntentId, number>();

  config.rules.forEach((rule) => {
    intentCounts.set(rule.intentId, (intentCounts.get(rule.intentId) ?? 0) + 1);
    if (!rule.enabled) return;
    if (!rule.response.trim()) errors.push(`${rule.label}: 응답 문구가 비어 있습니다.`);
    if (rule.utterances.length === 0) errors.push(`${rule.label}: 발화를 하나 이상 등록해야 합니다.`);
    rule.utterances.forEach((utterance) => {
      const normalized = normalizeText(utterance);
      if (!normalized) errors.push(`${rule.label}: 비어 있거나 기호만 있는 발화가 있습니다.`);
      if (normalized.length < 2 && rule.intentId !== 'noise') errors.push(`${rule.label}: "${utterance}"는 오탐 위험이 있어 두 글자 이상이어야 합니다.`);
      const owner = seen.get(normalized);
      if (owner) errors.push(`"${utterance}" 발화가 ${owner}와 ${rule.id}에 중복 등록됐습니다.`);
      else if (normalized) seen.set(normalized, rule.id);
    });
  });
  requiredIntents.forEach((intentId) => {
    const count = intentCounts.get(intentId) ?? 0;
    if (count === 0) errors.push(`${intentId} 의도가 없습니다.`);
    if (count > 1) errors.push(`${intentId} 의도가 ${count}개 중복 등록됐습니다.`);
  });

  return [...new Set(errors)];
}

export function resolveConversation(
  query: string,
  botConfig: BotConfig,
  options?: { intentId?: string; context?: ConversationContext; variant?: ConversationEngineVariant },
): ConversationResolution {
  const analysis = analyzeConversationInput(query, options?.context);
  const smallTalk = resolveSmallTalkConfig(botConfig.bot, botConfig.smallTalk);
  if (!smallTalk.enabled) {
    return knowledgeResolution(query, query, botConfig, options?.intentId, options?.context, options?.variant, analysis);
  }

  const rules = normalizedRules(smallTalk);
  const rawNormalized = normalizeText(query);
  const queryWithoutPreamble = stripDiscoursePreamble(query) || query;
  const normalized = normalizeText(queryWithoutPreamble) || rawNormalized;
  const noiseRule = rules.find((rule) => rule.intentId === 'noise');
  const compact = normalized.replace(/\s/g, '');
  if ((!normalized || query.length > MAX_INPUT_LENGTH || REPEATED_CHARACTER.test(compact)) && noiseRule) {
    return smallTalkResolution(query, normalized, noiseRule, options?.context, analysis);
  }

  const guardDecision = options?.variant === 'baseline'
    ? undefined
    : classifyGuardedQuery(query) ?? (
      options?.context?.lastGuardCategory && isGuardExplanationFollowUp(normalized)
        ? guardDecisionForCategory(options.context.lastGuardCategory)
        : undefined
    );
  if (guardDecision) {
    return {
      kind: 'fallback',
      originalQuery: query,
      effectiveQuery: normalized,
      replyText: guardDecision.replyText,
      handoffCta: guardDecision.handoffCta,
      answerTrust: 'bounded',
      guardDecision,
      searchResult: {
        status: 'fallback',
        confidence: 'low',
        score: 0,
        suggestions: [],
        alternatives: [],
        matchedFields: [],
        decisionReason: 'guarded',
      },
      routeDecision: {
        mode: 'fallback',
        reason: 'guarded',
        standaloneScore: 0,
      },
      segments: analysis.segments,
      unresolvedSegments: [query],
      dialogueActs: analysis.dialogueActs,
      contextPatch: guardContextPatch(options?.context, analysis, guardDecision.category),
    };
  }

  const priorityRule = rules.find((rule) =>
    (rule.intentId === 'human' || rule.intentId === 'abuse') && matchesRule(normalized, rule),
  );
  if (priorityRule) return smallTalkResolution(query, normalized, priorityRule, options?.context, analysis);

  // Resolve exact catalog entries before typo tolerance so similar emotional
  // expressions such as "미안해요" and "불안해요" cannot cross-match.
  const exactRule = rules.find((rule) => rule.normalizedUtterances.includes(normalized));
  const standaloneRule = exactRule ?? rules.find((rule) => matchesRule(normalized, rule));
  if (standaloneRule) return smallTalkResolution(query, normalized, standaloneRule, options?.context, analysis);

  const stripped = stripSocialWrappers(normalized, rules);
  if (stripped.query !== normalized) {
    if (!stripped.query && stripped.matchedRule) return smallTalkResolution(query, normalized, stripped.matchedRule, options?.context, analysis);
    if (stripped.matchedRule && isSocialOnlyRemainder(stripped.query)) {
      return smallTalkResolution(query, normalized, stripped.matchedRule, options?.context, analysis);
    }
    const effective = stripDiscoursePreamble(stripped.query) || stripped.query;
    const effectiveAnalysis = analyzeConversationInput(effective, options?.context);
    effectiveAnalysis.audience = analysis.audience;
    effectiveAnalysis.segments = analysis.segments;
    return knowledgeResolution(query, effective, botConfig, options?.intentId, options?.context, options?.variant, effectiveAnalysis);
  }

  const effective = queryWithoutPreamble !== query ? queryWithoutPreamble : query;
  const effectiveAnalysis = effective === query ? analysis : analyzeConversationInput(effective, options?.context);
  effectiveAnalysis.audience = analysis.audience;
  return knowledgeResolution(query, effective, botConfig, options?.intentId, options?.context, options?.variant, effectiveAnalysis);
}

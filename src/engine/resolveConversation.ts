import { resolveSmallTalkConfig } from '../data/smallTalkDefaults';
import type {
  BotConfig,
  ConversationContext,
  ConversationResolution,
  SmallTalkConfig,
  SmallTalkIntentId,
  SmallTalkRule,
} from '../types/chatbot';
import { composeResponsePlan } from './composeResponsePlan';
import { normalizeText } from './normalizeText';
import { extractQueryFeatures } from './queryFeatures';
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

function smallTalkResolution(originalQuery: string, effectiveQuery: string, rule: NormalizedRule): ConversationResolution {
  return {
    kind: 'smalltalk',
    originalQuery,
    effectiveQuery,
    smallTalkIntent: rule.intentId,
    replyText: rule.response,
    handoffCta: rule.handoffCta,
    showSuggestions: rule.showSuggestions,
  };
}

function rewriteFollowUpQuery(query: string, botConfig: BotConfig, context?: ConversationContext): string {
  if (!context || Date.now() - context.updatedAt > 10 * 60 * 1000) return query;
  const features = extractQueryFeatures(query);
  if (!features.followUp) return query;

  const contextEntities = Object.values(context.entities).filter((value) => !query.includes(value));
  const hasStrongTopic = /(가격|비용|수강료|환불|취소|상담|등록|일정|시간|온라인|방문)/u.test(query);
  if (hasStrongTopic) return [query, ...contextEntities].join(' ').trim();

  const previous = context.lastKnowledgeIds.map((id) => findKnowledgeById(botConfig, id)).find(Boolean);
  return previous ? `${previous.question} ${query}` : [query, ...contextEntities].join(' ').trim();
}

function contextPatch(
  query: string,
  result: ReturnType<typeof searchKnowledge>,
  previous?: ConversationContext,
): ConversationContext {
  const items = result.items ?? (result.item ? [result.item] : result.suggestions.slice(0, 1));
  const features = extractQueryFeatures(query);
  return {
    lastIntentId: items[0]?.intentId ?? previous?.lastIntentId,
    lastKnowledgeIds: items.map((item) => item.id),
    entities: { ...(previous?.entities ?? {}), ...features.entities },
    pendingCandidateIds: result.status === 'suggestions' ? result.suggestions.map((item) => item.id) : [],
    turnCount: (previous?.turnCount ?? 0) + 1,
    updatedAt: Date.now(),
  };
}

function knowledgeResolution(
  originalQuery: string,
  effectiveQuery: string,
  botConfig: BotConfig,
  intentId?: string,
  context?: ConversationContext,
): ConversationResolution {
  const rewrittenQuery = rewriteFollowUpQuery(effectiveQuery, botConfig, context);
  const searchResult = searchKnowledge(rewrittenQuery, botConfig, { intentId });
  return {
    kind: searchResult.status === 'fallback' ? 'fallback' : 'knowledge',
    originalQuery,
    effectiveQuery: rewrittenQuery,
    searchResult,
    responsePlan: composeResponsePlan(effectiveQuery, searchResult, context),
    contextPatch: contextPatch(effectiveQuery, searchResult, context),
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
  options?: { intentId?: string; context?: ConversationContext },
): ConversationResolution {
  const smallTalk = resolveSmallTalkConfig(botConfig.bot, botConfig.smallTalk);
  if (!smallTalk.enabled) return knowledgeResolution(query, query, botConfig, options?.intentId, options?.context);

  const rules = normalizedRules(smallTalk);
  const normalized = normalizeText(query);
  const noiseRule = rules.find((rule) => rule.intentId === 'noise');
  const compact = normalized.replace(/\s/g, '');
  if ((!normalized || query.length > MAX_INPUT_LENGTH || REPEATED_CHARACTER.test(compact)) && noiseRule) {
    return smallTalkResolution(query, normalized, noiseRule);
  }

  const priorityRule = rules.find((rule) =>
    (rule.intentId === 'human' || rule.intentId === 'abuse') && matchesRule(normalized, rule),
  );
  if (priorityRule) return smallTalkResolution(query, normalized, priorityRule);

  const standaloneRule = rules.find((rule) => matchesRule(normalized, rule));
  if (standaloneRule) return smallTalkResolution(query, normalized, standaloneRule);

  const stripped = stripSocialWrappers(normalized, rules);
  if (stripped.query !== normalized) {
    if (!stripped.query && stripped.matchedRule) return smallTalkResolution(query, normalized, stripped.matchedRule);
    return knowledgeResolution(query, stripped.query, botConfig, options?.intentId, options?.context);
  }

  return knowledgeResolution(query, query, botConfig, options?.intentId, options?.context);
}

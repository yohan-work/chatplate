import type {
  BotConfig,
  ConversationContext,
  ConversationRouteDecision,
  ConversationRouteMode,
  KnowledgeItem,
  SearchResult,
} from '../types/chatbot';
import { extractQueryFeatures } from './queryFeatures';
import { findKnowledgeById, searchKnowledge } from './searchKnowledge';

const CONTEXT_TTL_MS = 10 * 60 * 1000;
const ROUTE_SCORE_MARGIN = 0.08;

export interface ConversationQueryRoute {
  effectiveQuery: string;
  result: SearchResult;
  decision: ConversationRouteDecision;
  continued: boolean;
  clarificationPrompt?: string;
}

function leadingItem(result: SearchResult): KnowledgeItem | undefined {
  return result.items?.[0] ?? result.item ?? result.suggestions[0];
}

function isUsable(result: SearchResult): boolean {
  return result.status !== 'fallback' && result.confidence !== 'low' && Boolean(leadingItem(result));
}

function decision(
  mode: ConversationRouteMode,
  reason: ConversationRouteDecision['reason'],
  standalone: SearchResult,
  contextual?: SearchResult,
): ConversationRouteDecision {
  return {
    mode,
    reason,
    standaloneKnowledgeId: leadingItem(standalone)?.id,
    contextualKnowledgeId: contextual ? leadingItem(contextual)?.id : undefined,
    standaloneScore: standalone.score,
    contextualScore: contextual?.score,
  };
}

function uniqueItems(items: Array<KnowledgeItem | undefined>): KnowledgeItem[] {
  return items.filter((item): item is KnowledgeItem => Boolean(item))
    .filter((item, index, values) => values.findIndex((entry) => entry.id === item.id) === index)
    .slice(0, 2);
}

function clarificationResult(
  standalone: SearchResult,
  contextual: SearchResult,
  candidates: KnowledgeItem[],
): SearchResult {
  const strongest = standalone.score >= contextual.score ? standalone : contextual;
  return {
    status: 'suggestions',
    confidence: 'medium',
    score: Math.max(standalone.score, contextual.score),
    suggestions: candidates,
    alternatives: [],
    matchedFields: [...new Set([...standalone.matchedFields, ...contextual.matchedFields])],
    debugScore: strongest.debugScore,
    matchedUtterance: strongest.matchedUtterance,
    scoreMargin: Math.abs(standalone.score - contextual.score),
    decisionReason: 'ambiguous',
  };
}

function contextualQuery(query: string, context: ConversationContext): string {
  const retainedEntities = Object.values(context.entities).filter((value) => !query.includes(value));
  return [query, ...retainedEntities].join(' ').trim();
}

function referenceCandidates(botConfig: BotConfig, context: ConversationContext): KnowledgeItem[] {
  const previous = context.lastKnowledgeIds
    .map((id) => findKnowledgeById(botConfig, id))
    .find((item): item is KnowledgeItem => Boolean(item));
  const related = previous?.relatedIds
    .map((id) => findKnowledgeById(botConfig, id))
    .find((item): item is KnowledgeItem => Boolean(item));
  return uniqueItems([previous, related]);
}

export function routeConversationQuery(
  query: string,
  botConfig: BotConfig,
  options?: { intentId?: string; context?: ConversationContext; now?: number },
): ConversationQueryRoute {
  const standalone = searchKnowledge(query, botConfig, { intentId: options?.intentId });
  const context = options?.context;
  const now = options?.now ?? Date.now();
  if (!context || now - context.updatedAt > CONTEXT_TTL_MS) {
    return {
      effectiveQuery: query,
      result: standalone,
      decision: decision(standalone.status === 'fallback' ? 'fallback' : 'standalone', 'no-context', standalone),
      continued: false,
    };
  }

  const features = extractQueryFeatures(query);
  const enrichedQuery = contextualQuery(query, context);
  const contextual = searchKnowledge(enrichedQuery, botConfig, {
    intentId: context.lastIntentId ?? options?.intentId,
  });
  const standaloneItem = leadingItem(standalone);
  const contextualItem = leadingItem(contextual);
  const standaloneUsable = isUsable(standalone);
  const contextualUsable = isUsable(contextual);

  if (standaloneItem && contextualItem && standaloneItem.id === contextualItem.id && (standaloneUsable || contextualUsable)) {
    const useContextual = features.referenceStrength === 'strong' || contextual.score > standalone.score;
    return {
      effectiveQuery: useContextual ? enrichedQuery : query,
      result: useContextual ? contextual : standalone,
      decision: decision(features.referenceStrength === 'strong' ? 'contextual' : 'standalone', 'same-candidate', standalone, contextual),
      continued: features.referenceStrength === 'strong',
    };
  }

  if (standalone.decisionReason === 'exact' && standaloneItem) {
    return {
      effectiveQuery: query,
      result: standalone,
      decision: decision('standalone', 'standalone-exact', standalone, contextual),
      continued: false,
    };
  }

  if (standaloneUsable !== contextualUsable) {
    const useContextual = contextualUsable;
    return {
      effectiveQuery: useContextual ? enrichedQuery : query,
      result: useContextual ? contextual : standalone,
      decision: decision(useContextual ? 'contextual' : 'standalone', 'single-usable', standalone, contextual),
      continued: useContextual && features.referenceStrength !== 'none',
    };
  }

  if (standaloneUsable && contextualUsable && standaloneItem && contextualItem) {
    const scoreGap = Math.abs(standalone.score - contextual.score);
    if (scoreGap >= ROUTE_SCORE_MARGIN) {
      const useContextual = contextual.score > standalone.score;
      return {
        effectiveQuery: useContextual ? enrichedQuery : query,
        result: useContextual ? contextual : standalone,
        decision: decision(useContextual ? 'contextual' : 'standalone', 'score-gap', standalone, contextual),
        continued: useContextual && features.referenceStrength !== 'none',
      };
    }

    const candidates = uniqueItems([standaloneItem, contextualItem]);
    return {
      effectiveQuery: query,
      result: clarificationResult(standalone, contextual, candidates),
      decision: decision('clarification', 'close-candidates', standalone, contextual),
      continued: false,
      clarificationPrompt: '새 질문인지, 앞선 문의를 이어가는 것인지 확인해 주세요.',
    };
  }

  if (features.referenceStrength === 'strong') {
    const candidates = referenceCandidates(botConfig, context);
    if (candidates.length) {
      return {
        effectiveQuery: query,
        result: clarificationResult(standalone, contextual, candidates),
        decision: decision('clarification', 'reference-without-evidence', standalone, contextual),
        continued: false,
        clarificationPrompt: '앞서 안내한 내용 중 어떤 문의를 이어갈지 선택해 주세요.',
      };
    }
  }

  const fallback = standalone.score >= contextual.score ? standalone : contextual;
  return {
    effectiveQuery: fallback === contextual ? enrichedQuery : query,
    result: fallback,
    decision: decision('fallback', 'both-low', standalone, contextual),
    continued: false,
  };
}

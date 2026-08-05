import type { BotConfig, ConversationEngineVariant, KnowledgeItem, SearchResult } from '../types/chatbot';
import { analyzeQuery } from './analyzeQuery';
import { buildSearchIndex } from './buildSearchIndex';
import { composeMultiIntentItems, decideSearchResult, HIGH_CONFIDENCE_THRESHOLD, MEDIUM_CONFIDENCE_THRESHOLD } from './decideSearchResult';
import { rankKnowledge } from './rankKnowledge';
import { matchCuratedKnowledgeId } from './curatedIntentMatcher';

export const ANSWER_THRESHOLD = HIGH_CONFIDENCE_THRESHOLD;
export const SUGGESTION_THRESHOLD = MEDIUM_CONFIDENCE_THRESHOLD;

export function searchKnowledge(
  query: string,
  botConfig: BotConfig,
  options?: { intentId?: string; variant?: ConversationEngineVariant },
): SearchResult {
  const analysis = analyzeQuery(query, botConfig.search?.synonymGroups);
  const index = buildSearchIndex(botConfig);
  const ranked = rankKnowledge(analysis, index, options?.intentId);
  const result = decideSearchResult(ranked);
  const matchedCuratedKnowledgeId = options?.variant === 'baseline'
    ? undefined
    : matchCuratedKnowledgeId(query, botConfig.bot.id);
  const explicitlyRequestsMultiple = /(?:둘\s*다|두\s*가지|한\s*번에|같이|함께|각각|구분|모두)/u.test(analysis.normalized);
  const curatedKnowledgeId = result.decisionReason === 'exact'
    ? undefined
    : matchedCuratedKnowledgeId;
  const curatedItem = curatedKnowledgeId ? findKnowledgeById(botConfig, curatedKnowledgeId) : undefined;
  if ((!explicitlyRequestsMultiple || analysis.intents.length === 1) && curatedItem && (curatedItem.status ?? 'active') === 'active') {
    const relatedItems = curatedItem.relatedIds
      .map((id) => findKnowledgeById(botConfig, id))
      .filter((item): item is KnowledgeItem => Boolean(item))
      .slice(0, 3);
    return {
      status: 'answer',
      confidence: 'high',
      score: 0.98,
      item: curatedItem,
      items: [curatedItem],
      suggestions: [curatedItem, ...relatedItems],
      alternatives: relatedItems,
      matchedFields: ['intent'],
      scoreMargin: 0.98,
      decisionReason: 'confident',
    };
  }

  if (analysis.intents.length > 1) {
    const intentResults = analysis.intents.map((intent) => {
      const intentCuratedId = options?.variant === 'baseline' ? undefined : matchCuratedKnowledgeId(intent, botConfig.bot.id);
      const intentCuratedItem = intentCuratedId ? findKnowledgeById(botConfig, intentCuratedId) : undefined;
      if (intentCuratedItem && (intentCuratedItem.status ?? 'active') === 'active') {
        return {
          status: 'answer' as const,
          confidence: 'high' as const,
          score: 0.98,
          item: intentCuratedItem,
          items: [intentCuratedItem],
          suggestions: [intentCuratedItem],
          alternatives: [],
          matchedFields: ['intent' as const],
          decisionReason: 'confident' as const,
        };
      }
      const intentAnalysis = analyzeQuery(intent, botConfig.search?.synonymGroups);
      const intentResult = decideSearchResult(rankKnowledge(intentAnalysis, index, options?.intentId));
      if (!intentResult.item && intentResult.suggestions[0]) {
        return { ...intentResult, item: intentResult.suggestions[0] };
      }
      if (!intentResult.item && intentAnalysis.tokens.length === 1) {
        const token = intentAnalysis.tokens[0];
        const keywordMatch = index.find((entry) => entry.keywords.some((keyword) => keyword === token || keyword.includes(token)));
        if (keywordMatch) {
          return { ...intentResult, confidence: 'medium' as const, item: keywordMatch.item };
        }
      }
      return intentResult;
    });
    const items = composeMultiIntentItems(intentResults);

    if (items.length > 1) {
      return {
        ...result,
        status: 'answer',
        confidence: intentResults.some((entry) => entry.confidence === 'medium') ? 'medium' : 'high',
        item: items[0],
        items,
        suggestions: items,
        alternatives: result.alternatives,
        matchedFields: [...new Set(intentResults.flatMap((entry) => entry.matchedFields))],
      };
    }
  }

  return result;
}

export function findKnowledgeById(botConfig: BotConfig, id: string): KnowledgeItem | undefined {
  return botConfig.knowledge.find((item) => item.id === id);
}

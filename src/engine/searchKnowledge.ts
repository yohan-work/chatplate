import type { BotConfig, KnowledgeItem, SearchResult } from '../types/chatbot';
import { analyzeQuery } from './analyzeQuery';
import { buildSearchIndex } from './buildSearchIndex';
import { composeMultiIntentItems, decideSearchResult, HIGH_CONFIDENCE_THRESHOLD, MEDIUM_CONFIDENCE_THRESHOLD } from './decideSearchResult';
import { rankKnowledge } from './rankKnowledge';

export const ANSWER_THRESHOLD = HIGH_CONFIDENCE_THRESHOLD;
export const SUGGESTION_THRESHOLD = MEDIUM_CONFIDENCE_THRESHOLD;

export function searchKnowledge(query: string, botConfig: BotConfig, options?: { intentId?: string }): SearchResult {
  const analysis = analyzeQuery(query, botConfig.search?.synonymGroups);
  const index = buildSearchIndex(botConfig);
  const ranked = rankKnowledge(analysis, index, options?.intentId);
  const result = decideSearchResult(ranked);

  if (analysis.intents.length > 1) {
    const intentResults = analysis.intents.map((intent) => {
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

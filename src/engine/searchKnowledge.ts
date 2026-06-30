import type { BotConfig, KnowledgeItem, SearchResult } from '../types/chatbot';
import { scoreKnowledge } from './scoreKnowledge';

export const ANSWER_THRESHOLD = 52;
export const SUGGESTION_THRESHOLD = 24;

export function searchKnowledge(query: string, botConfig: BotConfig): SearchResult {
  const ranked = botConfig.knowledge
    .map((item) => ({ item, score: scoreKnowledge(query, item) }))
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const suggestions = ranked
    .filter((entry) => entry.score >= SUGGESTION_THRESHOLD)
    .slice(0, 3)
    .map((entry) => entry.item);

  if (top && top.score >= ANSWER_THRESHOLD) {
    return { status: 'answer', score: top.score, item: top.item, suggestions };
  }

  if (suggestions.length > 0) {
    return { status: 'suggestions', score: top?.score ?? 0, suggestions };
  }

  return { status: 'fallback', score: top?.score ?? 0, suggestions: [] };
}

export function findKnowledgeById(botConfig: BotConfig, id: string): KnowledgeItem | undefined {
  return botConfig.knowledge.find((item) => item.id === id);
}

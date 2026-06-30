import type { KnowledgeItem, SearchConfidence, SearchResult } from '../types/chatbot';
import type { RankedKnowledge } from './rankKnowledge';

export const HIGH_CONFIDENCE_THRESHOLD = 58;
export const MEDIUM_CONFIDENCE_THRESHOLD = 28;

function confidenceFor(score: number): SearchConfidence {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

export function decideSearchResult(ranked: RankedKnowledge[]): SearchResult {
  const top = ranked[0];
  const alternatives = ranked.slice(1, 4).map((entry) => entry.entry.item);

  if (!top) {
    return {
      status: 'fallback',
      confidence: 'low',
      score: 0,
      suggestions: [],
      alternatives: [],
      matchedFields: [],
    };
  }

  const confidence = confidenceFor(top.score);
  const suggestions = ranked
    .filter((entry) => entry.score >= MEDIUM_CONFIDENCE_THRESHOLD)
    .slice(0, 3)
    .map((entry) => entry.entry.item);

  if (confidence === 'high') {
    return {
      status: 'answer',
      confidence,
      score: top.score,
      item: top.entry.item,
      items: [top.entry.item],
      suggestions,
      alternatives,
      matchedFields: top.matchedFields,
      debugScore: top.debugScore,
    };
  }

  if (confidence === 'medium') {
    return {
      status: 'answer',
      confidence,
      score: top.score,
      item: top.entry.item,
      items: [top.entry.item],
      suggestions,
      alternatives,
      matchedFields: top.matchedFields,
      debugScore: top.debugScore,
    };
  }

  return {
    status: 'fallback',
    confidence,
    score: top.score,
    suggestions: [],
    alternatives: [],
    matchedFields: top.matchedFields,
    debugScore: top.debugScore,
  };
}

export function composeMultiIntentItems(intentResults: SearchResult[]): KnowledgeItem[] {
  const seen = new Set<string>();
  return intentResults
    .filter((result) => result.confidence !== 'low' && result.item)
    .map((result) => result.item!)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .slice(0, 2);
}

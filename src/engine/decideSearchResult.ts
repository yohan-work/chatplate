import type { KnowledgeItem, SearchConfidence, SearchResult } from '../types/chatbot';
import type { RankedKnowledge } from './rankKnowledge';

export const HIGH_CONFIDENCE_THRESHOLD = 0.75;
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.38;

function confidenceFor(score: number): SearchConfidence {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return 'high';
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'low';
}

export function decideSearchResult(ranked: RankedKnowledge[]): SearchResult {
  const top = ranked[0];
  const second = ranked[1];
  const scoreMargin = top && second ? top.score - second.score : top?.score ?? 0;
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

  const isExact = top.debugScore.exact === 1;
  const isAmbiguous = Boolean(second && top.score >= MEDIUM_CONFIDENCE_THRESHOLD && second.score >= MEDIUM_CONFIDENCE_THRESHOLD && scoreMargin < 0.08);

  if (isAmbiguous) {
    return {
      status: 'suggestions',
      confidence: 'medium',
      score: top.score,
      suggestions,
      alternatives,
      matchedFields: top.matchedFields,
      debugScore: top.debugScore,
      matchedUtterance: top.matchedUtterance,
      scoreMargin,
      decisionReason: 'ambiguous',
    };
  }

  if (confidence === 'high' || isExact) {
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
      matchedUtterance: top.matchedUtterance,
      scoreMargin,
      decisionReason: isExact ? 'exact' : 'confident',
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
      matchedUtterance: top.matchedUtterance,
      scoreMargin,
      decisionReason: 'confident',
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
    matchedUtterance: top.matchedUtterance,
    scoreMargin,
    decisionReason: 'low-similarity',
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

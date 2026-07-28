import type { MatchedField, SearchScoreBreakdown } from '../types/chatbot';
import type { QueryAnalysis } from './analyzeQuery';
import type { SearchIndexEntry } from './buildSearchIndex';
import { bm25Scores, cosineSimilarity, jaccardSimilarity, ngrams, tokenize } from './textSimilarity';

export interface RankedKnowledge {
  entry: SearchIndexEntry;
  score: number;
  matchedFields: MatchedField[];
  debugScore: SearchScoreBreakdown;
  matchedUtterance: string;
}

function createBreakdown(): SearchScoreBreakdown {
  return {
    exact: 0, alias: 0, keyword: 0, tag: 0, token: 0, typo: 0, synonym: 0, intent: 0,
    priority: 0, penalty: 0, bm25: 0, ngram: 0, jaccard: 0,
  };
}

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

function typoScore(query: string, values: string[]): number {
  if (query.length < 3) return 0;

  let best = 0;
  values.forEach((value) => {
    if (value.length < 3) return;
    const distance = levenshtein(query, value);
    const ratio = 1 - distance / Math.max(query.length, value.length);
    if (ratio >= 0.72) best = Math.max(best, ratio * 24);
  });

  return best;
}

export function rankKnowledge(analysis: QueryAnalysis, entries: SearchIndexEntry[], intentId?: string): RankedKnowledge[] {
  const queryTokens = [...new Set([...tokenize(analysis.normalized), ...analysis.synonymTokens])];
  const queryNgrams = ngrams(analysis.normalized);
  const bm25 = bm25Scores(queryTokens, entries.map((entry) => entry.documentTokens));

  return entries
    .map((entry, entryIndex) => {
      const debugScore = createBreakdown();
      const matchedFields = new Set<MatchedField>();
      const searchablePhrases = [entry.question, ...entry.aliases, ...entry.utterances];
      const exactIndex = searchablePhrases.findIndex((value) => analysis.normalized === value || analysis.compact === value.replace(/\s/g, ''));
      const partialIndex = searchablePhrases.findIndex((value) =>
        analysis.compact.length >= 3 && (analysis.compact.includes(value.replace(/\s/g, '')) || value.replace(/\s/g, '').includes(analysis.compact)),
      );
      const ngramScores = entry.utteranceNgrams.map((vector) => cosineSimilarity(queryNgrams, vector));
      const bestNgramScore = Math.max(...ngramScores, 0);
      const bestNgramIndex = ngramScores.indexOf(bestNgramScore);
      const jaccardScores = searchablePhrases.map((value) => jaccardSimilarity(queryTokens, tokenize(value)));
      const bestJaccardScore = Math.max(...jaccardScores, 0);

      debugScore.exact = exactIndex >= 0 ? 1 : partialIndex >= 0 ? 0.72 : 0;
      debugScore.alias = exactIndex > 0 ? 1 : 0;
      debugScore.bm25 = bm25[entryIndex] ?? 0;
      debugScore.ngram = bestNgramScore;
      debugScore.jaccard = bestJaccardScore;
      debugScore.token = bestJaccardScore;
      debugScore.synonym = analysis.synonymTokens.some((token) => entry.searchableText.includes(token)) ? 1 : 0;
      debugScore.intent = intentId && entry.item.intentId === intentId ? 1 : 0;
      debugScore.priority = Math.min(entry.item.priority, 10) / 10;
      if (debugScore.exact) matchedFields.add(exactIndex === 0 ? 'question' : 'alias');
      if (debugScore.bm25) matchedFields.add('bm25');
      if (debugScore.ngram >= 0.45) matchedFields.add('ngram');
      if (debugScore.jaccard) matchedFields.add('token');
      if (debugScore.synonym) matchedFields.add('synonym');
      if (debugScore.intent) matchedFields.add('intent');

      if (intentId && entry.item.intentId === intentId) {
        matchedFields.add('intent');
      }

      debugScore.typo = typoScore(analysis.normalized, [entry.question, ...entry.aliases]);
      const hasNegativeMatch = entry.negativeKeywords.some((keyword) => analysis.normalized.includes(keyword));
      const shortGeneralPenalty = partialIndex < 0 && queryTokens.length <= 1 && analysis.compact.length < 4 ? 0.1 : 0;
      debugScore.penalty = (hasNegativeMatch ? 0.25 : 0) + shortGeneralPenalty;
      const weightedScore = debugScore.bm25 * 0.3 +
        debugScore.ngram * 0.25 +
        debugScore.jaccard * 0.15 +
        debugScore.exact * 0.15 +
        debugScore.synonym * 0.05 +
        debugScore.intent * 0.1 -
        debugScore.penalty;
      const hasDomainEvidence = exactIndex >= 0 || partialIndex >= 0 || debugScore.bm25 > 0 || debugScore.jaccard > 0 || debugScore.synonym > 0 || debugScore.ngram >= 0.65;
      const rawScore = exactIndex >= 0
        ? 0.98
        : hasDomainEvidence
          ? Math.max(weightedScore, debugScore.ngram * 0.95 - debugScore.penalty)
          : 0;
      const matchedIndex = exactIndex >= 0 ? exactIndex : bestNgramIndex >= 0 ? bestNgramIndex : 0;

      return {
        entry,
        score: Math.max(0, Math.min(1, Math.round(rawScore * 10000) / 10000)),
        matchedFields: [...matchedFields],
        debugScore,
        matchedUtterance: searchablePhrases[matchedIndex] ?? entry.question,
      };
    })
    .sort((a, b) => b.score - a.score);
}

import type { MatchedField, SearchScoreBreakdown } from '../types/chatbot';
import type { QueryAnalysis } from './analyzeQuery';
import type { SearchIndexEntry } from './buildSearchIndex';
import { extractQueryFeatures } from './queryFeatures';
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
    priority: 0, penalty: 0, bm25: 0, ngram: 0, jaccard: 0, entity: 0, jamo: 0, rrf: 0, routeCount: 0,
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
    if (ratio >= 0.72) best = Math.max(best, ratio);
  });

  return best;
}

export function rankKnowledge(analysis: QueryAnalysis, entries: SearchIndexEntry[], intentId?: string): RankedKnowledge[] {
  const features = extractQueryFeatures(analysis.normalized);
  const queryTokens = [...new Set([...tokenize(analysis.normalized), ...features.stems, ...analysis.synonymTokens])];
  const queryNgrams = ngrams(analysis.normalized);
  const queryJamoNgrams = ngrams(features.jamoText);
  const bm25 = bm25Scores(queryTokens, entries.map((entry) => entry.documentTokens));

  const candidates = entries
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
      const jamoScores = entry.utteranceJamoNgrams.map((value) => cosineSimilarity(queryJamoNgrams, value));
      const bestJamoScore = Math.max(...jamoScores, 0);
      const entityValues = Object.values(features.entities);
      const entityScore = entityValues.length
        ? entityValues.filter((value) => entry.searchableText.includes(value)).length / entityValues.length
        : 0;

      debugScore.exact = exactIndex >= 0 ? 1 : partialIndex >= 0 ? 0.72 : 0;
      debugScore.alias = exactIndex > 0 ? 1 : 0;
      debugScore.bm25 = bm25[entryIndex] ?? 0;
      debugScore.ngram = bestNgramScore;
      debugScore.jaccard = bestJaccardScore;
      debugScore.jamo = bestJamoScore;
      debugScore.entity = entityScore;
      debugScore.token = bestJaccardScore;
      debugScore.synonym = analysis.synonymTokens.some((token) => entry.searchableText.includes(token)) ? 1 : 0;
      debugScore.intent = intentId && entry.item.intentId === intentId ? 1 : 0;
      debugScore.priority = Math.min(entry.item.priority, 10) / 10;
      if (debugScore.exact) matchedFields.add(exactIndex === 0 ? 'question' : 'alias');
      if (debugScore.bm25) matchedFields.add('bm25');
      if (debugScore.ngram >= 0.45) matchedFields.add('ngram');
      if (debugScore.jaccard) matchedFields.add('token');
      if (debugScore.jamo >= 0.5) matchedFields.add('jamo');
      if (debugScore.entity) matchedFields.add('entity');
      if (debugScore.synonym) matchedFields.add('synonym');
      if (debugScore.intent) matchedFields.add('intent');

      if (intentId && entry.item.intentId === intentId) {
        matchedFields.add('intent');
      }

      debugScore.typo = typoScore(analysis.normalized, [entry.question, ...entry.aliases]);
      const hasNegativeMatch = entry.negativeKeywords.some((keyword) => analysis.normalized.includes(keyword));
      const shortGeneralPenalty = partialIndex < 0 && queryTokens.length <= 1 && analysis.compact.length < 4 ? 0.1 : 0;
      const negativeConflict = features.negative && !entry.searchableText.includes('안 ') && !entry.searchableText.includes('못 ');
      debugScore.penalty = (hasNegativeMatch ? 0.25 : 0) + (negativeConflict ? 0.05 : 0) + shortGeneralPenalty;
      const matchedIndex = exactIndex >= 0 ? exactIndex : bestNgramIndex >= 0 ? bestNgramIndex : 0;

      return {
        entry,
        score: 0,
        matchedFields: [...matchedFields],
        debugScore,
        matchedUtterance: searchablePhrases[matchedIndex] ?? entry.question,
      };
    });

  const routes: Array<(candidate: RankedKnowledge) => number> = [
    (candidate) => candidate.debugScore.exact,
    (candidate) => candidate.debugScore.bm25,
    (candidate) => candidate.debugScore.ngram,
    (candidate) => candidate.debugScore.jaccard,
    (candidate) => candidate.debugScore.jamo,
    (candidate) => candidate.debugScore.entity,
    (candidate) => candidate.debugScore.synonym,
  ];
  const rrf = new Map<string, number>();
  const routeCounts = new Map<string, number>();
  routes.forEach((route) => {
    candidates
      .map((candidate) => ({ candidate, value: route(candidate) }))
      .filter(({ value }) => value >= 0.08)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .forEach(({ candidate }, index) => {
        const id = candidate.entry.item.id;
        rrf.set(id, (rrf.get(id) ?? 0) + 1 / (60 + index + 1));
        routeCounts.set(id, (routeCounts.get(id) ?? 0) + 1);
      });
  });
  const maxRrf = Math.max(...rrf.values(), 0);

  return candidates
    .map((candidate) => {
      const id = candidate.entry.item.id;
      const routeCount = routeCounts.get(id) ?? 0;
      const rrfScore = maxRrf ? (rrf.get(id) ?? 0) / maxRrf : 0;
      const signals = [
        candidate.debugScore.bm25,
        candidate.debugScore.ngram,
        candidate.debugScore.jaccard,
        candidate.debugScore.jamo,
        candidate.debugScore.entity,
        candidate.debugScore.synonym,
        candidate.debugScore.typo,
      ];
      const strongestSignal = Math.max(...signals);
      const partialOrExact = candidate.debugScore.exact;
      const strongestLexical = Math.max(
        candidate.debugScore.bm25,
        candidate.debugScore.jaccard,
        candidate.debugScore.entity,
        candidate.debugScore.synonym,
        candidate.debugScore.typo,
      );
      const hasEvidence = partialOrExact > 0 ||
        strongestLexical >= 0.18 ||
        (candidate.debugScore.ngram >= 0.72 && candidate.debugScore.jamo >= 0.72);
      candidate.debugScore.rrf = rrfScore;
      candidate.debugScore.routeCount = routeCount;
      if (rrfScore) candidate.matchedFields.push('rrf');
      const rawScore = candidate.debugScore.exact === 1
        ? 0.99
        : hasEvidence
          ? rrfScore * 0.35 +
            strongestSignal * 0.35 +
            Math.min(routeCount / 4, 1) * 0.18 +
            partialOrExact * 0.08 +
            candidate.debugScore.intent * 0.06 -
            candidate.debugScore.penalty
          : 0;
      return {
        ...candidate,
        score: Math.max(0, Math.min(1, Math.round(rawScore * 10000) / 10000)),
      };
    })
    .sort((a, b) => b.score - a.score);
}

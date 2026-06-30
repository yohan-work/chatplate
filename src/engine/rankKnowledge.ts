import type { MatchedField, SearchScoreBreakdown } from '../types/chatbot';
import type { QueryAnalysis } from './analyzeQuery';
import type { SearchIndexEntry } from './buildSearchIndex';

export interface RankedKnowledge {
  entry: SearchIndexEntry;
  score: number;
  matchedFields: MatchedField[];
  debugScore: SearchScoreBreakdown;
}

function createBreakdown(): SearchScoreBreakdown {
  return { exact: 0, alias: 0, keyword: 0, tag: 0, token: 0, typo: 0, priority: 0, penalty: 0 };
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

function containsScore(query: string, values: string[], exactWeight: number, partialWeight: number): number {
  return values.reduce((score, value) => {
    if (!value) return score;
    if (query === value) return Math.max(score, exactWeight);
    if (query.includes(value) || value.includes(query)) return Math.max(score, partialWeight);
    return score;
  }, 0);
}

export function rankKnowledge(analysis: QueryAnalysis, entries: SearchIndexEntry[]): RankedKnowledge[] {
  return entries
    .map((entry) => {
      const debugScore = createBreakdown();
      const matchedFields = new Set<MatchedField>();

      debugScore.priority = Math.min(entry.item.priority, 10);
      debugScore.exact = containsScore(analysis.normalized, [entry.question], 86, 38);
      if (debugScore.exact > 0) matchedFields.add('question');

      debugScore.alias = containsScore(analysis.normalized, entry.aliases, 74, 34);
      if (debugScore.alias > 0) matchedFields.add('alias');

      const compactQuestionMatch = entry.questionCompact.includes(analysis.compact) || analysis.compact.includes(entry.questionCompact);
      const compactAliasMatch = entry.aliasesCompact.some((alias) => alias.includes(analysis.compact) || analysis.compact.includes(alias));
      if ((compactQuestionMatch || compactAliasMatch) && analysis.compact.length >= 3) {
        debugScore.exact = Math.max(debugScore.exact, compactQuestionMatch ? 42 : 0);
        debugScore.alias = Math.max(debugScore.alias, compactAliasMatch ? 36 : 0);
        matchedFields.add(compactQuestionMatch ? 'question' : 'alias');
      }

      analysis.tokens.forEach((token) => {
        if (entry.keywords.some((keyword) => keyword.includes(token) || token.includes(keyword))) {
          debugScore.keyword += 18;
          matchedFields.add('keyword');
        }
        if (entry.tags.some((tag) => tag.includes(token) || token.includes(tag))) {
          debugScore.tag += 12;
          matchedFields.add('tag');
        }
        if (entry.searchableText.includes(token)) {
          debugScore.token += 8;
        }
      });

      debugScore.typo = typoScore(analysis.normalized, [entry.question, ...entry.aliases]);
      if (debugScore.typo > 0) matchedFields.add('question');

      if (entry.categoryName && analysis.normalized.includes(entry.categoryName)) {
        debugScore.tag += 10;
        matchedFields.add('tag');
      }

      const hasNegativeMatch = entry.negativeKeywords.some((keyword) => analysis.normalized.includes(keyword));
      debugScore.penalty = hasNegativeMatch ? 32 : 0;

      const rawScore =
        debugScore.exact +
        debugScore.alias +
        Math.min(debugScore.keyword, 42) +
        Math.min(debugScore.tag, 24) +
        Math.min(debugScore.token, 32) +
        debugScore.typo +
        debugScore.priority -
        debugScore.penalty;

      return {
        entry,
        score: Math.max(0, Math.round(rawScore * 100) / 100),
        matchedFields: [...matchedFields],
        debugScore,
      };
    })
    .sort((a, b) => b.score - a.score);
}

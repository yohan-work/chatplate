import type { KnowledgeItem } from '../types/chatbot';
import { normalizeText } from './normalizeText';

function includesAny(query: string, values: string[]): number {
  return values.reduce((score, value) => {
    const normalized = normalizeText(value);
    if (!normalized) return score;
    if (query.includes(normalized)) return score + 18;
    if (normalized.includes(query) && query.length >= 2) return score + 12;
    return score;
  }, 0);
}

function tokenOverlap(query: string, values: string[]): number {
  const queryTokens = new Set(query.split(' ').filter((token) => token.length >= 2));
  if (queryTokens.size === 0) return 0;

  const targetTokens = new Set(
    values.flatMap((value) => normalizeText(value).split(' ').filter((token) => token.length >= 2)),
  );

  let matches = 0;
  queryTokens.forEach((token) => {
    if (targetTokens.has(token)) matches += 1;
  });

  return (matches / queryTokens.size) * 30;
}

export function scoreKnowledge(query: string, item: KnowledgeItem): number {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return 0;

  const question = normalizeText(item.question);
  const aliases = item.aliases.map(normalizeText);
  const keywords = item.keywords.map(normalizeText);

  let score = Math.min(item.priority, 10);
  if (normalizedQuery === question) score += 90;
  if (aliases.includes(normalizedQuery)) score += 78;
  if (question.includes(normalizedQuery) || normalizedQuery.includes(question)) score += 42;
  score += includesAny(normalizedQuery, keywords) * 1.15;
  score += includesAny(normalizedQuery, aliases);
  score += tokenOverlap(normalizedQuery, [item.question, ...item.aliases, ...item.keywords]);

  return Math.round(score * 100) / 100;
}

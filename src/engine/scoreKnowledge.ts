import type { KnowledgeItem } from '../types/chatbot';
import { analyzeQuery } from './analyzeQuery';
import type { SearchIndexEntry } from './buildSearchIndex';
import { normalizeText } from './normalizeText';
import { rankKnowledge } from './rankKnowledge';

export function scoreKnowledge(query: string, item: KnowledgeItem): number {
  const entry: SearchIndexEntry = {
    item,
    question: normalizeText(item.question),
    questionCompact: normalizeText(item.question).replace(/\s/g, ''),
    aliases: item.aliases.map(normalizeText),
    aliasesCompact: item.aliases.map((alias) => normalizeText(alias).replace(/\s/g, '')),
    keywords: item.keywords.map(normalizeText),
    tags: (item.tags ?? []).map(normalizeText),
    negativeKeywords: (item.negativeKeywords ?? []).map(normalizeText),
    categoryName: '',
    searchableText: [item.question, ...item.aliases, ...item.keywords, ...(item.tags ?? [])].map(normalizeText).join(' '),
  };

  return rankKnowledge(analyzeQuery(query), [entry])[0]?.score ?? 0;
}

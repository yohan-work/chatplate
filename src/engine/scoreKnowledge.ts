import type { KnowledgeItem } from '../types/chatbot';
import { analyzeQuery } from './analyzeQuery';
import type { SearchIndexEntry } from './buildSearchIndex';
import { normalizeText } from './normalizeText';
import { rankKnowledge } from './rankKnowledge';
import { ngrams, tokenize } from './textSimilarity';

export function scoreKnowledge(query: string, item: KnowledgeItem): number {
  const entry: SearchIndexEntry = {
    item,
    question: normalizeText(item.question),
    questionCompact: normalizeText(item.question).replace(/\s/g, ''),
    aliases: item.aliases.map(normalizeText),
    aliasesCompact: item.aliases.map((alias) => normalizeText(alias).replace(/\s/g, '')),
    utterances: (item.utterances ?? []).map((utterance) => normalizeText(utterance.text)),
    utteranceNgrams: [item.question, ...item.aliases, ...(item.utterances ?? []).map((utterance) => utterance.text)].map(ngrams),
    keywords: item.keywords.map(normalizeText),
    tags: (item.tags ?? []).map(normalizeText),
    negativeKeywords: (item.negativeKeywords ?? []).map(normalizeText),
    categoryName: '',
    searchableText: [item.question, ...item.aliases, ...item.keywords, ...(item.tags ?? [])].map(normalizeText).join(' '),
    documentTokens: tokenize([item.question, ...item.aliases, ...item.keywords, ...(item.tags ?? [])].join(' ')),
  };

  return rankKnowledge(analyzeQuery(query), [entry])[0]?.score ?? 0;
}

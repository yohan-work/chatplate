import type { BotConfig, KnowledgeItem } from '../types/chatbot';
import { normalizeText } from './normalizeText';
import { toJamo } from './queryFeatures';
import { ngrams, tokenize } from './textSimilarity';

export interface SearchIndexEntry {
  item: KnowledgeItem;
  question: string;
  questionCompact: string;
  aliases: string[];
  aliasesCompact: string[];
  utterances: string[];
  utteranceNgrams: Map<string, number>[];
  utteranceJamoNgrams: Map<string, number>[];
  keywords: string[];
  tags: string[];
  negativeKeywords: string[];
  categoryName: string;
  searchableText: string;
  documentTokens: string[];
}

const indexCache = new WeakMap<BotConfig, SearchIndexEntry[]>();

export function buildSearchIndex(botConfig: BotConfig): SearchIndexEntry[] {
  const cachedIndex = indexCache.get(botConfig);
  if (cachedIndex) return cachedIndex;

  const categoryNameById = new Map(botConfig.categories.map((category) => [category.id, category.name]));

  const index = botConfig.knowledge
    .filter((item) => (item.status ?? 'active') === 'active')
    .map((item) => {
      const question = normalizeText(item.question);
      const aliases = item.aliases.map(normalizeText);
      const utterances = (item.utterances ?? [])
        .filter((utterance) => !utterance.split || utterance.split === 'train')
        .map((utterance) => normalizeText(utterance.text));
      const approvedUtterances = (item.utterances ?? [])
        .filter((utterance) => (!utterance.split || utterance.split === 'train') && utterance.approved)
        .map((utterance) => normalizeText(utterance.text));
      const keywords = item.keywords.map(normalizeText);
      const tags = (item.tags ?? []).map(normalizeText);
      const negativeKeywords = (item.negativeKeywords ?? []).map(normalizeText);
      const categoryName = normalizeText(categoryNameById.get(item.categoryId) ?? '');
      const searchableText = [question, ...aliases, ...utterances, ...keywords, ...tags, categoryName].filter(Boolean).join(' ');

      return {
        item,
        question,
        questionCompact: question.replace(/\s/g, ''),
        aliases,
        aliasesCompact: aliases.map((alias) => alias.replace(/\s/g, '')),
        utterances,
        utteranceNgrams: [question, ...aliases, ...approvedUtterances].map(ngrams),
        utteranceJamoNgrams: [question, ...aliases, ...approvedUtterances].map((value) => ngrams(toJamo(value))),
        keywords,
        tags,
        negativeKeywords,
        categoryName,
        searchableText,
        documentTokens: tokenize([question, ...aliases, ...approvedUtterances, ...keywords, ...tags, categoryName].join(' ')),
      };
    });

  indexCache.set(botConfig, index);
  return index;
}

import type { BotConfig, KnowledgeItem } from '../types/chatbot';
import { normalizeText } from './normalizeText';

export interface SearchIndexEntry {
  item: KnowledgeItem;
  question: string;
  questionCompact: string;
  aliases: string[];
  aliasesCompact: string[];
  keywords: string[];
  tags: string[];
  negativeKeywords: string[];
  categoryName: string;
  searchableText: string;
}

export function buildSearchIndex(botConfig: BotConfig): SearchIndexEntry[] {
  const categoryNameById = new Map(botConfig.categories.map((category) => [category.id, category.name]));

  return botConfig.knowledge
    .filter((item) => (item.status ?? 'active') === 'active')
    .map((item) => {
      const question = normalizeText(item.question);
      const aliases = item.aliases.map(normalizeText);
      const keywords = item.keywords.map(normalizeText);
      const tags = (item.tags ?? []).map(normalizeText);
      const negativeKeywords = (item.negativeKeywords ?? []).map(normalizeText);
      const categoryName = normalizeText(categoryNameById.get(item.categoryId) ?? '');
      const searchableText = [question, ...aliases, ...keywords, ...tags, categoryName].filter(Boolean).join(' ');

      return {
        item,
        question,
        questionCompact: question.replace(/\s/g, ''),
        aliases,
        aliasesCompact: aliases.map((alias) => alias.replace(/\s/g, '')),
        keywords,
        tags,
        negativeKeywords,
        categoryName,
        searchableText,
      };
    });
}

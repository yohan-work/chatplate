import type { BotConfig, KnowledgeItem } from '../types/chatbot';

export function getRelatedQuestions(item: KnowledgeItem, botConfig: BotConfig): KnowledgeItem[] {
  const ids = new Set(item.relatedIds);
  return botConfig.knowledge.filter((knowledge) => ids.has(knowledge.id)).slice(0, 3);
}

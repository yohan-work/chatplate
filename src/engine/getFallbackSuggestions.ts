import type { BotConfig, KnowledgeItem } from '../types/chatbot';
import { findKnowledgeById } from './searchKnowledge';

export function getFallbackSuggestions(botConfig: BotConfig): KnowledgeItem[] {
  return botConfig.quickReplies
    .map((reply) => findKnowledgeById(botConfig, reply.knowledgeId))
    .filter((item): item is KnowledgeItem => Boolean(item))
    .slice(0, 3);
}

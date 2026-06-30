import type { BotConfig, KnowledgeItem, Notice, QuickReply, Ticket } from '../types/chatbot';

export function createEmptyNotice(): Notice {
  const timestamp = Date.now();
  return {
    id: `notice-${timestamp}`,
    title: '새 공지',
    summary: '공지 요약을 입력하세요.',
    content: '공지 본문을 입력하세요.',
    createdAt: '방금 전',
    unread: true,
    imageUrl: '',
    buttons: [],
  };
}

export function createEmptyKnowledge(categoryId: string): KnowledgeItem {
  const timestamp = Date.now();
  return {
    id: `knowledge-${timestamp}`,
    categoryId,
    question: '새 질문',
    keywords: [],
    aliases: [],
    tags: [],
    negativeKeywords: [],
    answer: '답변을 입력하세요.',
    buttons: [],
    relatedIds: [],
    priority: 5,
    status: 'draft',
    lastUpdated: new Date().toISOString(),
  };
}

export function createQuickReply(knowledge: KnowledgeItem): QuickReply {
  return {
    label: knowledge.question,
    knowledgeId: knowledge.id,
  };
}

export function removeKnowledgeItem(config: BotConfig, knowledgeId: string): BotConfig {
  return {
    ...config,
    knowledge: config.knowledge.filter((item) => item.id !== knowledgeId),
    quickReplies: config.quickReplies.filter((reply) => reply.knowledgeId !== knowledgeId),
  };
}

export function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function formatCommaList(values: string[]): string {
  return values.join(', ');
}

export function createKnowledgeFromTicket(ticket: Ticket, categoryId: string): KnowledgeItem {
  return {
    ...createEmptyKnowledge(categoryId),
    question: ticket.originalQuestion || ticket.message,
    aliases: ticket.originalQuestion && ticket.originalQuestion !== ticket.message ? [ticket.message] : [],
    answer: '답변을 입력하세요.',
    status: 'draft',
    source: `ticket:${ticket.id}`,
  };
}

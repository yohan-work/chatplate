import { describe, expect, it } from 'vitest';
import type { KnowledgeItem, SearchResult } from '../types/chatbot';
import {
  appendConversationEvent,
  createConversationEvent,
  createSmallTalkConversationEvent,
  loadConversationEvents,
  updateConversationEventFeedback,
} from './conversationEvents';

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
}

describe('conversationEvents', () => {
  it('stores search events and feedback', () => {
    const storage = createStorage();
    const item = { id: 'k1' } as KnowledgeItem;
    const result: SearchResult = {
      status: 'answer',
      confidence: 'high',
      score: 90,
      suggestions: [],
      alternatives: [],
      matchedFields: ['question'],
      items: [item],
      matchedUtterance: '질문 변형',
      scoreMargin: 0.42,
      decisionReason: 'confident',
    };
    const event = createConversationEvent('bot-1', '질문', result);
    appendConversationEvent(event, storage);
    updateConversationEventFeedback(event.id, 'helpful', storage);
    expect(loadConversationEvents(storage)[0]).toMatchObject({
      feedback: 'helpful',
      matchedKnowledgeIds: ['k1'],
      candidateKnowledgeIds: ['k1'],
      topScore: 90,
      scoreMargin: 0.42,
      matchedUtterance: '질문 변형',
      decisionReason: 'confident',
    });
  });

  it('stores small-talk events separately from knowledge failures', () => {
    const event = createSmallTalkConversationEvent('bot-1', {
      kind: 'smalltalk',
      originalQuery: '안녕하세요',
      effectiveQuery: '안녕하세요',
      smallTalkIntent: 'greeting',
      replyText: '반갑습니다.',
    });

    expect(event).toMatchObject({
      status: 'smalltalk',
      interactionType: 'smalltalk',
      smallTalkIntent: 'greeting',
      matchedKnowledgeIds: [],
    });
  });
});

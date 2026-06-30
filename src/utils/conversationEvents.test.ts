import { describe, expect, it } from 'vitest';
import type { KnowledgeItem, SearchResult } from '../types/chatbot';
import { appendConversationEvent, createConversationEvent, loadConversationEvents, updateConversationEventFeedback } from './conversationEvents';

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
    };
    const event = createConversationEvent('bot-1', '질문', result);
    appendConversationEvent(event, storage);
    updateConversationEventFeedback(event.id, 'helpful', storage);
    expect(loadConversationEvents(storage)[0]).toMatchObject({ feedback: 'helpful', matchedKnowledgeIds: ['k1'] });
  });
});

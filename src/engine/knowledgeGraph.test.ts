import { describe, expect, it } from 'vitest';
import type { KnowledgeItem } from '../types/chatbot';
import { answerSummary, buildKnowledgeGraph } from './knowledgeGraph';

const item = (id: string, relatedIds: string[] = []): KnowledgeItem => ({
  id, categoryId: 'general', question: `${id} 질문`, keywords: [], aliases: [], answer: `${id} 답변`, buttons: [], relatedIds, priority: 1,
});

describe('buildKnowledgeGraph', () => {
  it('keeps outgoing, incoming, and mutual relations distinct', () => {
    const graph = buildKnowledgeGraph([item('a', ['b', 'missing']), item('b', ['a']), item('c', ['a'])], 'a');
    expect(graph?.nodes.map(({ id, direction }) => ({ id, direction }))).toEqual([
      { id: 'a', direction: 'center' }, { id: 'b', direction: 'mutual' }, { id: 'c', direction: 'inbound' },
    ]);
    expect(graph?.missingRelatedIds).toEqual(['missing']);
    expect(graph?.edges).toEqual(expect.arrayContaining([{ from: 'a', to: 'b', directFromCenter: true }, { from: 'b', to: 'a', directFromCenter: true }]));
  });

  it('summarizes answer text without changing short answers', () => {
    expect(answerSummary(item('a'))).toBe('a 답변');
    expect(answerSummary({ ...item('a'), answer: '가'.repeat(90) })).toHaveLength(88);
  });
});

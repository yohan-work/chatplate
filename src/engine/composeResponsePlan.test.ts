import { describe, expect, it } from 'vitest';
import type { KnowledgeItem, SearchResult } from '../types/chatbot';
import { composeResponsePlan } from './composeResponsePlan';

const item = {
  id: 'fit-1',
  question: '중학생도 가능한가요?',
  answer: '상담에서 확인해 주세요.',
  answerVariants: ['중학생도 상담할 수 있어요.', '중학생 관련 상담이 가능합니다.'],
  followUpPrompts: ['상담 방법도 알려드릴까요?'],
} as KnowledgeItem;

const result: SearchResult = {
  status: 'answer',
  confidence: 'high',
  score: 0.9,
  item,
  items: [item],
  suggestions: [],
  alternatives: [],
  matchedFields: ['rrf'],
};

describe('composeResponsePlan', () => {
  it('builds a deterministic approved-block response', () => {
    const first = composeResponsePlan('중학생도 가능한가요?', result);
    const second = composeResponsePlan('중학생도 가능한가요?', result);
    expect(first).toEqual(second);
    expect(first?.text).toContain('중학생');
    expect(first?.followUpPrompts).toContain('상담 방법도 알려드릴까요?');
  });

  it('does not render stale verified facts as a direct answer', () => {
    const stale = {
      ...result.item!,
      id: 'hours-001',
      answer: '오래된 운영시간은 오전 9시입니다.',
      approvalStatus: 'verified' as const,
      answerMode: 'verified' as const,
      riskLevel: 'low' as const,
      source: '운영 문서',
      reviewedBy: '운영자',
      reviewedAt: '2025-01-01',
      nextReviewAt: '2025-12-31',
    };
    const plan = composeResponsePlan('운영시간이 언제예요?', { ...result, item: stale, items: [stale] });
    expect(plan?.answerTrust).toBe('bounded');
    expect(plan?.text).not.toContain('오전 9시');
    expect(plan?.text).toContain('최신 기준');
  });

  it('separates pending answer trust from retrieval confidence', () => {
    const pending = {
      ...item,
      approvalStatus: 'pending' as const,
      answerMode: 'safe-general' as const,
      riskLevel: 'personal' as const,
    };
    const plan = composeResponsePlan('중학생도 되나요', { ...result, item: pending, items: [pending] });
    expect(plan?.answerTrust).toBe('bounded');
    expect(plan?.text).toContain('현재 등록된 안내 범위');
  });

  it('uses a contextual opening for a follow-up turn', () => {
    const plan = composeResponsePlan(
      '그럼 중학생은요?',
      result,
      {
        lastKnowledgeIds: ['fit-1'],
        entities: {},
        pendingCandidateIds: [],
        turnCount: 1,
        updatedAt: Date.now(),
      },
      { continued: true },
    );
    expect(plan?.text).toContain('앞선 문의와 이어서');
  });
});

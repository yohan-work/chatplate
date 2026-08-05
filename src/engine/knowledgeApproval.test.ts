import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import type { KnowledgeItem } from '../types/chatbot';
import { answerTrustFor } from './answerTrust';
import { botConfigApprovalErrors, knowledgeApprovalIssues } from './knowledgeApproval';

function verifiedItem(patch: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return {
    id: 'test-knowledge',
    categoryId: 'intro',
    question: '확인된 질문',
    keywords: [],
    aliases: [],
    answer: '확인된 답변',
    buttons: [],
    relatedIds: [],
    priority: 5,
    approvalStatus: 'verified',
    answerMode: 'verified',
    riskLevel: 'low',
    source: '운영 문서 A',
    reviewedBy: '운영자',
    reviewedAt: '2026-08-05',
    ...patch,
  };
}

describe('knowledge approval', () => {
  it('accepts a complete low-risk approval as verified', () => {
    const item = verifiedItem();
    expect(knowledgeApprovalIssues(item, new Date('2026-08-05T00:00:00Z'))).toEqual([]);
    expect(answerTrustFor(item, new Date('2026-08-05T00:00:00Z'))).toBe('verified');
  });

  it('bounds an expired operational approval', () => {
    const item = verifiedItem({ id: 'hours-001', nextReviewAt: '2026-08-04' });
    expect(knowledgeApprovalIssues(item, new Date('2026-08-05T00:00:00Z')).map((issue) => issue.code)).toContain('expired');
    expect(answerTrustFor(item, new Date('2026-08-05T00:00:00Z'))).toBe('bounded');
  });

  it('requires a review date for changeable policy facts', () => {
    const item = verifiedItem({ intentId: 'pricing' });
    expect(knowledgeApprovalIssues(item).map((issue) => issue.code)).toContain('missing-next-review-at');
  });

  it('keeps the bundled Coach Myway config publishable', () => {
    expect(botConfigApprovalErrors(botConfigs['coach-myway'], new Date('2026-08-05T00:00:00Z'))).toEqual([]);
  });
});

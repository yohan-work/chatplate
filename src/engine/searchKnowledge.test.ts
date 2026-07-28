import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { searchKnowledge } from './searchKnowledge';

describe('searchKnowledge', () => {
  it('returns an installation answer for a direct install question', () => {
    const result = searchKnowledge('설치는 어떻게 하나요?', botConfigs['alf-demo']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('install-001');
  });

  it('returns a parking answer for animal hospital data', () => {
    const result = searchKnowledge('주차 가능해요?', botConfigs['animal-hospital']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('parking-001');
  });

  it('returns the Coach My:Way consultation answer for parent-style questions', () => {
    const result = searchKnowledge('우리 아이에게 맞는지 상담 받고 싶어요', botConfigs['coach-myway']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('consultation-002');
  });

  it('returns the Coach My:Way price handoff answer for price questions', () => {
    const result = searchKnowledge('수강료가 얼마예요?', botConfigs['coach-myway']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('policy-001');
    expect(result.item?.handoffRecommended).toBe(true);
  });

  it('uses Coach My:Way synonym groups for conversational inquiry wording', () => {
    const result = searchKnowledge('카톡으로 문의하고 싶어요', botConfigs['coach-myway']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('consultation-001');
  });

  it('returns suggestions instead of a single answer for close matches', () => {
    const config = {
      ...botConfigs['coach-myway'],
      knowledge: [
        { ...botConfigs['coach-myway'].knowledge.find((item) => item.id === 'policy-001')!, question: '비용 안내', aliases: [], keywords: ['비용'], priority: 8 },
        { ...botConfigs['coach-myway'].knowledge.find((item) => item.id === 'policy-002')!, question: '비용 안내', aliases: [], keywords: ['비용'], priority: 8 },
      ],
    };
    const result = searchKnowledge('비용 안내', config);
    expect(result.status).toBe('suggestions');
  });

  it('falls back for unrelated Coach My:Way questions', () => {
    const result = searchKnowledge('오늘 점심 메뉴가 뭐예요?', botConfigs['coach-myway']);
    expect(result.status).toBe('fallback');
  });

  it('keeps the Coach My:Way 50-question coverage catalog as drafts until approved', () => {
    const knowledge = botConfigs['coach-myway'].knowledge;
    expect(knowledge).toHaveLength(50);
    expect(knowledge.filter((item) => item.status === 'draft')).toHaveLength(40);
  });

  it('falls back for unrelated questions', () => {
    const result = searchKnowledge('우주선 정비도 가능한가요?', botConfigs['alf-demo']);
    expect(result.status).toBe('fallback');
  });

  it('handles spacing variations', () => {
    const result = searchKnowledge('설치어떻게하나요', botConfigs['alf-demo']);
    expect(result.status).toBe('answer');
    expect(result.item?.id).toBe('install-001');
  });

  it('returns multiple items for compound questions', () => {
    const result = searchKnowledge('설치랑 요금 알려줘', botConfigs['alf-demo']);
    expect(result.status).toBe('answer');
    expect(result.items?.map((item) => item.id)).toEqual(expect.arrayContaining(['install-001', 'billing-001']));
  });

  it('excludes draft knowledge items', () => {
    const result = searchKnowledge('임시 질문', {
      ...botConfigs['alf-demo'],
      knowledge: [
        ...botConfigs['alf-demo'].knowledge,
        {
          id: 'draft-001',
          categoryId: 'intro',
          question: '임시 질문',
          keywords: ['임시'],
          aliases: [],
          answer: '보이면 안 됩니다.',
          buttons: [],
          relatedIds: [],
          priority: 10,
          status: 'draft',
        },
      ],
    });
    expect(result.item?.id).not.toBe('draft-001');
  });
});

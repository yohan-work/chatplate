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

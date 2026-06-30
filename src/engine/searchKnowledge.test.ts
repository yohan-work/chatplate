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
});

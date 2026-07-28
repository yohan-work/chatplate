import { describe, expect, it } from 'vitest';
import { extractQueryFeatures, toJamo } from './queryFeatures';

describe('queryFeatures', () => {
  it('extracts Korean education entities and question type', () => {
    const features = extractQueryFeatures('중2 학생은 온라인 코칭 비용이 얼마인가요?');
    expect(features.entities).toMatchObject({ grade: '중2', mode: '온라인', policy: '비용' });
    expect(features.queryType).toBe('price');
    expect(features.stems).toContain('학생');
  });

  it('keeps negation and follow-up signals', () => {
    const features = extractQueryFeatures('그럼 온라인 말고 방문은요?');
    expect(features.negative).toBe(true);
    expect(features.followUp).toBe(true);
    expect(features.entities.mode).toBe('온라인');
  });

  it('decomposes Hangul into stable jamo text', () => {
    expect(toJamo('코칭')).not.toBe('코칭');
    expect(toJamo('코 칭')).toBe(toJamo('코칭'));
  });
});

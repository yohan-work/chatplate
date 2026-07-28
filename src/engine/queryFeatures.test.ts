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
    expect(features.referenceStrength).toBe('weak');
    expect(features.entities.mode).toBe('온라인');
  });

  it('decomposes Hangul into stable jamo text', () => {
    expect(toJamo('코칭')).not.toBe('코칭');
    expect(toJamo('코 칭')).toBe(toJamo('코칭'));
  });

  it('recognizes a short location question as an explicit topic', () => {
    const features = extractQueryFeatures('위치가 어디?');
    expect(features.queryType).toBe('location');
    expect(features.isShort).toBe(true);
    expect(features.referenceStrength).toBe('none');
    expect(features.followUp).toBe(true);
  });

  it('separates a strong reference from a merely short question', () => {
    expect(extractQueryFeatures('그건 어떻게 진행돼요?').referenceStrength).toBe('strong');
    expect(extractQueryFeatures('과목은 뭐가 있어?').referenceStrength).toBe('none');
  });
});

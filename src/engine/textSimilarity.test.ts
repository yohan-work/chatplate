import { describe, expect, it } from 'vitest';
import { bm25Scores, cosineSimilarity, jaccardSimilarity, ngrams, tokenize } from './textSimilarity';

describe('textSimilarity', () => {
  it('matches spacing variations with character n-grams', () => {
    expect(cosineSimilarity(ngrams('상담 신청 어떻게 해요'), ngrams('상담신청어떻게해요'))).toBeGreaterThan(0.9);
  });

  it('measures token overlap independent of word order', () => {
    expect(jaccardSimilarity(tokenize('비용 상담 문의'), tokenize('상담 비용 안내'))).toBeGreaterThan(0.4);
  });

  it('ranks a document containing the rare query token first', () => {
    const scores = bm25Scores(['환불'], [['비용', '등록'], ['환불', '규정'], ['상담', '신청']]);
    expect(scores[1]).toBe(1);
    expect(scores[0]).toBe(0);
  });
});

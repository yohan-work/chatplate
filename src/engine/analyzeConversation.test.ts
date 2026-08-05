import { describe, expect, it } from 'vitest';
import { analyzeConversationInput } from './analyzeConversation';

describe('analyzeConversationInput', () => {
  it('keeps noun particles inside one intent', () => {
    expect(analyzeConversationInput('코치와 안 맞을까 봐 걱정돼요. 바꿀 수 있나요?').knowledgeSegments)
      .toEqual(['코치와 안 맞을까 봐 걱정돼요 바꿀 수 있나요']);
  });

  it('separates two complete privacy clauses', () => {
    const analysis = analyzeConversationInput('실명과 연락처가 필요한지, 상담 기록은 누가 보는지도 알려주세요');
    expect(analysis.knowledgeSegments).toEqual(['실명과 연락처가 필요한지', '상담 기록은 누가 보는지도 알려주세요']);
  });
});

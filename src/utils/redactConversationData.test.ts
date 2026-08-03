import { describe, expect, it } from 'vitest';
import { redactConversationText } from './redactConversationData';

describe('redactConversationText', () => {
  it('redacts contact details without marking the row as highly sensitive', () => {
    const result = redactConversationText('전화 010-1234-5678, 메일 test@example.com');
    expect(result.text).toBe('전화 [전화번호 삭제], 메일 [이메일 삭제]');
    expect(result.redacted).toBe(true);
    expect(result.sensitive).toBe(false);
  });

  it('rejects resident and payment identifiers from dataset promotion', () => {
    const result = redactConversationText('주민번호 990101-1234567 카드 1234-5678-9012-3456');
    expect(result.text).not.toContain('990101-1234567');
    expect(result.text).not.toContain('1234-5678-9012-3456');
    expect(result.sensitive).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { createDefaultSmallTalkConfig } from '../data/smallTalkDefaults';
import { normalizeText } from './normalizeText';
import { resolveConversation, validateSmallTalkConfig } from './resolveConversation';

const coach = botConfigs['coach-myway'];

describe('resolveConversation', () => {
  it.each([
    ['안녕하세요', 'greeting'],
    ['감사합니다', 'thanks'],
    ['다음에 올게요', 'goodbye'],
    ['뭘 물어볼 수 있나요', 'help'],
    ['너는 누구야', 'identity'],
    ['상담원 연결해 주세요', 'human'],
    ['왜 이렇게 못해', 'abuse'],
    ['ㅋㅋㅋㅋ', 'noise'],
  ] as const)('classifies "%s" as %s', (query, intentId) => {
    const result = resolveConversation(query, coach);
    expect(result.kind).toBe('smalltalk');
    expect(result.smallTalkIntent).toBe(intentId);
  });

  it('handles a common greeting typo without fuzzy matching arbitrary short text', () => {
    expect(resolveConversation('안녕하새요', coach).smallTalkIntent).toBe('greeting');
    expect(resolveConversation('하', coach).kind).toBe('fallback');
  });

  it.each([
    ['안녕하세요, 수강료가 궁금해요', 'policy-001'],
    ['감사한데 환불 규정도 알려주세요', 'policy-005'],
  ])('removes a social wrapper and searches the domain query: %s', (query, expectedId) => {
    const result = resolveConversation(query, coach);
    const candidates = [
      ...(result.searchResult?.items ?? (result.searchResult?.item ? [result.searchResult.item] : [])),
      ...(result.searchResult?.suggestions ?? []),
    ];
    expect(result.kind).not.toBe('smalltalk');
    expect(candidates.map((item) => item.id)).toContain(expectedId);
    expect(result.effectiveQuery).not.toBe(normalizeText(query));
  });

  it('does not confuse ordinary consultation FAQ wording with a human-agent request', () => {
    const result = resolveConversation('상담 신청 방법이 궁금해요', coach);
    const candidates = [
      ...(result.searchResult?.items ?? (result.searchResult?.item ? [result.searchResult.item] : [])),
      ...(result.searchResult?.suggestions ?? []),
    ];
    expect(result.kind).toBe('knowledge');
    expect(candidates.map((item) => item.id)).toContain('consultation-001');
  });

  it('keeps unsupported open-domain questions in the existing fallback path', () => {
    const result = resolveConversation('오늘 날씨가 어떤가요?', coach);
    expect(result.kind).toBe('fallback');
    expect(result.searchResult?.status).toBe('fallback');
  });

  it('rewrites an elliptical follow-up using the previous resolved FAQ', () => {
    const first = resolveConversation('우리 아이에게 맞는지 궁금해요', coach);
    const followUp = resolveConversation('그건 어떻게 진행돼요?', coach, { context: first.contextPatch });
    expect(followUp.effectiveQuery).toContain('우리 아이에게 맞을지 궁금해요');
    expect(followUp.responsePlan?.text).toContain('앞선 문의와 이어서');
    expect(followUp.contextPatch?.turnCount).toBe(2);
  });

  it('lets a strong new topic override the previous intent while retaining useful entities', () => {
    const first = resolveConversation('중학생 코칭이 가능한가요?', coach);
    const followUp = resolveConversation('그럼 비용은요?', coach, { context: first.contextPatch });
    const candidates = [
      ...(followUp.searchResult?.items ?? (followUp.searchResult?.item ? [followUp.searchResult.item] : [])),
      ...(followUp.searchResult?.suggestions ?? []),
    ];
    expect(followUp.effectiveQuery).toContain('중학생');
    expect(candidates.some((item) => item.intentId === 'pricing')).toBe(true);
  });

  it('uses the same default behavior for another domain', () => {
    const result = resolveConversation('안녕하세요', botConfigs['animal-hospital']);
    expect(result.kind).toBe('smalltalk');
    expect(result.replyText).toContain('포근동물병원');
  });

  it('can disable the common layer per bot', () => {
    const result = resolveConversation('안녕하세요', {
      ...coach,
      smallTalk: { ...createDefaultSmallTalkConfig(coach.bot), enabled: false },
    });
    expect(result.kind).toBe('fallback');
  });

  it('ships a unique reviewed seed catalog in the planned size range', () => {
    const config = createDefaultSmallTalkConfig(coach.bot);
    const values = config.rules.flatMap((rule) => rule.utterances.map(normalizeText));
    expect(values.length).toBeGreaterThanOrEqual(120);
    expect(values.length).toBeLessThanOrEqual(160);
    expect(new Set(values).size).toBe(values.length);
    expect(validateSmallTalkConfig(config)).toEqual([]);
  });

  it('retrieves every registered expression as its intended small-talk intent', () => {
    const config = createDefaultSmallTalkConfig(coach.bot);
    const botConfig = { ...coach, smallTalk: config };
    config.rules.forEach((rule) => {
      rule.utterances.forEach((utterance) => {
        const result = resolveConversation(utterance, botConfig);
        expect(result.smallTalkIntent, `"${utterance}" should resolve to ${rule.intentId}`).toBe(rule.intentId);
      });
    });
  });

  it('reports unsafe cross-intent duplicates', () => {
    const config = createDefaultSmallTalkConfig(coach.bot);
    config.rules[1].utterances.push(config.rules[0].utterances[0]);
    expect(validateSmallTalkConfig(config).some((error) => error.includes('중복 등록'))).toBe(true);
  });
});

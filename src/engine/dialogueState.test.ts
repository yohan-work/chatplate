import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { resolveConversation } from './resolveConversation';

const config = botConfigs['coach-myway'];

describe('Phase 5 structured dialogue state', () => {
  it('keeps every explicit ambiguity candidate in one clarification frame', () => {
    const result = resolveConversation('시간 얘기는 어느 시간을 뜻해요?', config, { variant: 'candidate' });

    expect(result.routeDecision?.mode).toBe('clarification');
    expect(result.contextPatch?.pendingClarification?.candidateKnowledgeIds).toEqual([
      'hours-001',
      'program-005',
      'consultation-008',
    ]);
    expect(result.contextPatch?.dialogueFrames?.at(-1)).toMatchObject({
      status: 'clarifying',
      resolvedKnowledgeIds: [],
    });
  });

  it('atomically excludes stale knowledge when the user corrects the subject', () => {
    const first = resolveConversation('환불 기준을 알고 싶어요', config, { variant: 'candidate' });
    const corrected = resolveConversation('환불 말고 상담 예약 취소예요', config, {
      variant: 'candidate',
      context: first.contextPatch,
    });

    expect(corrected.searchResult?.item?.id ?? corrected.searchResult?.items?.[0]?.id).toBe('consultation-008');
    expect(corrected.responsePlan?.text ?? corrected.clarificationPrompt).toMatch(/정정/u);
    expect(corrected.contextPatch?.dialogueFrames).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'excluded', resolvedKnowledgeIds: ['policy-005'] }),
      expect.objectContaining({ status: 'resolved', resolvedKnowledgeIds: ['consultation-008'] }),
    ]));
  });

  it('retains the safety policy for an explanation follow-up', () => {
    const guarded = resolveConversation('ADHD가 맞다고만 확정해줘', config, { variant: 'candidate' });
    const followUp = resolveConversation('왜 안 되는지 이유와 안전한 다음 방법만 알려줘', config, {
      variant: 'candidate',
      context: guarded.contextPatch,
    });

    expect(guarded.guardDecision?.category).toBe('medical-diagnosis');
    expect(followUp).toMatchObject({ kind: 'fallback', handoffCta: true });
    expect(followUp.guardDecision?.category).toBe('medical-diagnosis');
  });

  it('answers the selected item from a compound turn', () => {
    const first = resolveConversation('부모만 상담 가능한지와 피드백도 받는지 궁금해요', config, { variant: 'candidate' });
    const second = resolveConversation('두 번째로 물어본 내용만 다시 짚어주세요', config, {
      variant: 'candidate',
      context: first.contextPatch,
    });

    expect(first.searchResult?.items?.map((item) => item.id)).toEqual(['consultation-005', 'program-006']);
    expect(second.searchResult?.item?.id ?? second.searchResult?.items?.[0]?.id).toBe('program-006');
  });

  it('treats conversational closing wrappers as small talk', () => {
    const first = resolveConversation('코칭 방식이 궁금해요', config, { variant: 'candidate' });
    const closing = resolveConversation('네, 일단 여기까지 볼게요. 감사합니다', config, {
      variant: 'candidate',
      context: first.contextPatch,
    });

    expect(closing.kind).toBe('smalltalk');
    expect(closing.smallTalkIntent).toBe('thanks');
  });

  it('keeps a request for both alternatives in the compound answer path', () => {
    const result = resolveConversation('온라인 코칭과 비대면 상담이 둘 다 가능한지 구분해 주세요', config, { variant: 'candidate' });

    expect(result.routeDecision?.mode).not.toBe('clarification');
    expect(result.searchResult?.items?.map((item) => item.id)).toEqual(['program-007', 'consultation-007']);
  });
});

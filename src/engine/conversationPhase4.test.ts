import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import {
  buildCoachMywayConversationIntents,
  validateCoachMywayConversationIntents,
} from '../data/coachMywayConversationIntents';
import {
  coachMywayPhase4Scenarios,
  validateCoachMywayPhase4Corpus,
} from '../data/coachMywayPhase4Corpus';
import { evaluatePhase4Conversation } from '../qa/evaluatePhase4Conversation';
import { resolveConversation } from './resolveConversation';

const coach = botConfigs['coach-myway'];

describe('Phase 4 deterministic conversation quality', () => {
  it('ships exactly 100 deep intent specifications without holdout leakage', () => {
    const specs = buildCoachMywayConversationIntents(coach);
    const familyCounts = specs.reduce<Record<string, number>>((counts, spec) => {
      counts[spec.family] = (counts[spec.family] ?? 0) + 1;
      return counts;
    }, {});

    expect(specs).toHaveLength(100);
    expect(familyCounts).toEqual({ knowledge: 50, advice: 20, relationship: 15, control: 15 });
    expect(validateCoachMywayConversationIntents(specs)).toEqual([]);
    specs.forEach((spec) => {
      const train = new Set(spec.utterances.filter((item) => item.split === 'train').map((item) => item.text));
      const test = spec.utterances.filter((item) => item.split === 'test').map((item) => item.text);
      expect(test.some((text) => train.has(text))).toBe(false);
    });
  });

  it('answers a social wrapper and two academy questions in one turn', () => {
    const result = resolveConversation('안녕하세요, 중학생 가능한지랑 비용도 알려주세요', coach);

    expect(result.kind).toBe('knowledge');
    expect(result.responsePlan?.knowledgeIds).toEqual(expect.arrayContaining(['fit-008', 'policy-001']));
    expect(result.responsePlan?.text).toContain('두 가지로 나누어');
    expect(result.segments?.length).toBeGreaterThanOrEqual(3);
    expect(result.unresolvedSegments).toEqual([]);
  });

  it('combines empathy with a safe, actionable learning response', () => {
    const result = resolveConversation('아이가 계획만 세우고 안 지켜서 너무 답답해요. 어떻게 해야 할까요?', coach);

    expect(result.responsePlan?.knowledgeIds).toContain('advice-follow-plan');
    expect(result.responsePlan?.text).toContain('많이 답답하고 힘드셨겠어요');
    expect(result.responsePlan?.text).toContain('1.');
    expect(result.answerTrust).toBe('bounded');
    expect(result.contextPatch?.audience).toBe('parent');
  });

  it('corrects a retained entity and excludes a previous compound intent', () => {
    const first = resolveConversation('고등학생 코칭이랑 비용이 궁금해요', coach);
    const corrected = resolveConversation(
      '고등학생이 아니라 중학생이에요. 비용은 빼고 대상만 다시 알려줘',
      coach,
      { context: first.contextPatch },
    );

    expect(first.responsePlan?.knowledgeIds.length).toBeGreaterThanOrEqual(2);
    expect(corrected.responsePlan?.knowledgeIds).toContain('fit-008');
    expect(corrected.responsePlan?.knowledgeIds).not.toContain('policy-001');
    expect(corrected.contextPatch?.entities.grade).toBe('중학생');
    expect(corrected.contextPatch?.correctionHistory).toContainEqual({ entity: 'grade', from: '고등학생', to: '중학생' });
  });

  it('selects the requested item from a previous compound answer', () => {
    const first = resolveConversation('상담 신청 방법하고 비용을 알려주세요', coach);
    const second = resolveConversation('첫 번째 말고 두 번째만 짧게 알려줘', coach, { context: first.contextPatch });

    expect(first.responsePlan?.knowledgeIds).toEqual(expect.arrayContaining(['consultation-001', 'policy-001']));
    expect(second.responsePlan?.knowledgeIds).toEqual(['policy-001']);
    expect(second.responsePlan?.text).not.toContain('상담은 어떻게 신청');
  });

  it('keeps open-domain facts outside the deterministic product boundary', () => {
    const result = resolveConversation('오늘 날씨가 어때요?', coach);

    expect(result.kind).toBe('fallback');
    expect(result.responsePlan).toBeUndefined();
    expect(result.answerTrust).toBe('bounded');
  });

  it('meets the Phase 4 quality gates on all 300 independent scenarios', () => {
    expect(validateCoachMywayPhase4Corpus(new Set(coach.knowledge.map((item) => item.id)))).toEqual([]);
    const before = evaluatePhase4Conversation(coachMywayPhase4Scenarios, coach, 'phase3');
    const candidate = evaluatePhase4Conversation(coachMywayPhase4Scenarios, coach, 'candidate');
    const byCategory = new Map(candidate.categories.map((category) => [category.category, category.scenarioResolution]));

    expect(candidate.summary.scenarioResolution).toBeGreaterThan(before.summary.scenarioResolution);
    expect(candidate.summary.scenarioResolution).toBeGreaterThanOrEqual(0.95);
    expect(byCategory.get('compound')).toBeGreaterThanOrEqual(0.85);
    expect(byCategory.get('context-correction')).toBeGreaterThanOrEqual(0.9);
    expect(byCategory.get('ambiguity')).toBeGreaterThanOrEqual(0.9);
    expect(byCategory.get('emotion')).toBeGreaterThanOrEqual(0.9);
    expect(byCategory.get('safety-boundary')).toBe(1);
    expect(candidate.hardGateFailures).toBe(0);
  }, 30_000);
});

import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { resolveConversation } from '../engine/resolveConversation';
import {
  ambiguousQaTurns,
  conversationQaTurnCount,
  multiTurnQaScenarios,
  robustnessQaTurns,
  singleTurnQaTurns,
  supportedQaTurns,
  unsupportedQaTurns,
} from '../data/coachMywayQualityCorpus';
import { compareConversationQa, evaluateConversationQa, qaGateFailures } from './evaluateConversationQa';

describe('blind conversation QA', () => {
  it('keeps the corpus size and category balance fixed', () => {
    expect(conversationQaTurnCount).toBe(240);
    expect(supportedQaTurns).toHaveLength(100);
    expect(robustnessQaTurns).toHaveLength(40);
    expect(ambiguousQaTurns).toHaveLength(20);
    expect(unsupportedQaTurns).toHaveLength(30);
    expect(multiTurnQaScenarios).toHaveLength(25);
  });

  it('meets the product quality gates without indexing the blind questions', () => {
    const evaluate = (variant: 'baseline' | 'candidate') => evaluateConversationQa(
      botConfigs['coach-myway'],
      singleTurnQaTurns,
      multiTurnQaScenarios,
      (query, config, options) => resolveConversation(query, config, { ...options, variant }),
    );
    const baseline = evaluate('baseline');
    const candidate = evaluate('candidate');

    expect(qaGateFailures(candidate), JSON.stringify(candidate, null, 2)).toEqual([]);
    expect(compareConversationQa(baseline, candidate)).toMatchObject({
      promoted: true,
      reasons: [],
    });
  }, 10_000);
});

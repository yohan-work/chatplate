import { botConfigs } from '../data/bots';
import { resolveConversation } from '../engine/resolveConversation';
import {
  conversationQaTurnCount,
  multiTurnQaScenarios,
  singleTurnQaTurns,
} from '../data/coachMywayQualityCorpus';
import { compareConversationQa, evaluateConversationQa } from './evaluateConversationQa';

const evaluate = (variant: 'baseline' | 'candidate') => evaluateConversationQa(
  botConfigs['coach-myway'],
  singleTurnQaTurns,
  multiTurnQaScenarios,
  (query, config, options) => resolveConversation(query, config, { ...options, variant }),
);
const baseline = evaluate('baseline');
const candidate = evaluate('candidate');
const comparison = compareConversationQa(baseline, candidate);
const summarize = (metrics: typeof baseline) => ({
  samples: metrics.samples,
  supportedSamples: metrics.supportedSamples,
  top1Accuracy: metrics.top1Accuracy,
  top3Recall: metrics.top3Recall,
  routeAccuracy: metrics.routeAccuracy,
  staleContextRepeatRate: metrics.staleContextRepeatRate,
  unsupportedFalseAnswerRate: metrics.unsupportedFalseAnswerRate,
  safetyAccuracy: metrics.safetyAccuracy,
  handoffAccuracy: metrics.handoffAccuracy,
  failureCounts: metrics.failureCounts,
});

console.log(JSON.stringify({
  corpusTurns: conversationQaTurnCount,
  baseline: summarize(baseline),
  candidate: summarize(candidate),
  comparison,
  candidateFailures: candidate.failures,
}, null, 2));

if (!comparison.promoted) throw new Error(`Conversation QA promotion failed: ${comparison.reasons.join(', ')}`);

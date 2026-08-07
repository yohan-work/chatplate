import { describe, expect, it } from 'vitest';
import type { ConversationEvent } from '../types/chatbot';
import { summarizeExperiment } from './experimentMetrics';

const event = (variant: 'candidate' | 'socratic', assignment: string, outcome: ConversationEvent['outcome']): ConversationEvent => ({
  id: `${assignment}-${outcome}`, botId: 'coach-myway', query: '질문', status: 'answer', confidence: 'high', matchedKnowledgeIds: [],
  experimentId: 'experiment', experimentVariant: variant, experimentAssignmentId: assignment, outcome, createdAt: '2026-08-06T00:00:00.000Z',
});

describe('summarizeExperiment', () => {
  it('counts one final outcome per stable assignment and excludes protected handoffs', () => {
    const metrics = summarizeExperiment([event('candidate', 'a', 'unresolved'), event('socratic', 'b', 'resolved'), event('socratic', 'c', 'safety-handoff')], 'experiment');
    expect(metrics.variants.candidate?.resolutionRate).toBe(0);
    expect(metrics.variants.socratic).toMatchObject({ sessions: 2, eligibleSessions: 1, protectedHandoffs: 1, resolutionRate: 1 });
  });

  it('uses linked feedback as the session outcome without double counting the response', () => {
    const response = { ...event('candidate', 'session-1', 'pending'), id: 'response-1', replyPolicy: 'answer' as const, experimentEventType: 'response' as const };
    const feedback: ConversationEvent = {
      ...event('candidate', 'session-1', 'resolved'),
      id: 'feedback-1',
      experimentEventType: 'feedback',
      feedbackForEventId: 'response-1',
      feedback: 'not-helpful',
      outcome: 'unresolved',
    };
    const metrics = summarizeExperiment([response, feedback], 'experiment');
    expect(metrics.variants.candidate).toMatchObject({ sessions: 1, responseSessions: 1, resolved: 0, unresolved: 1, eligibleSessions: 1 });
  });

  it('blocks promotion when allocation is materially imbalanced or confidence excludes no effect', () => {
    const events: ConversationEvent[] = [];
    for (let index = 0; index < 500; index += 1) {
      events.push(event('candidate', `candidate-${index}`, 'resolved'));
      events.push(event('socratic', `socratic-${index}`, index < 450 ? 'resolved' : 'unresolved'));
    }
    const metrics = summarizeExperiment(events, 'experiment');
    expect(metrics.hasMinimumSample).toBe(true);
    expect(metrics.sampleRatioMismatch).toBe(true);
    expect(metrics.qualifiesForPromotion).toBe(false);
    expect(metrics.resolutionDeltaLower95).toBeDefined();
  });
});

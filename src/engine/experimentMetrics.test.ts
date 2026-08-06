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
});

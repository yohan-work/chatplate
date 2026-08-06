import type { ConversationExperimentAssignment, ExperimentOutcome, ExperimentVariant } from '../types/chatbot';

export const COACH_MYWAY_EXPERIMENT_ID = 'coach-myway-socratic-v1';

/** Start safely: 10% socratic, 90% current candidate. Raise to .5 after observation. */
export const COACH_MYWAY_SOCRATIC_ALLOCATION = 0.1;

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

export function assignConversationExperiment(
  botId: string,
  conversationId: string,
  allocation = COACH_MYWAY_SOCRATIC_ALLOCATION,
): ConversationExperimentAssignment | undefined {
  if (botId !== 'coach-myway') return undefined;
  const boundedAllocation = Math.max(0, Math.min(1, allocation));
  const assignmentId = `${COACH_MYWAY_EXPERIMENT_ID}:${conversationId}`;
  const variant: ExperimentVariant = stableBucket(assignmentId) < boundedAllocation ? 'socratic' : 'candidate';
  return { experimentId: COACH_MYWAY_EXPERIMENT_ID, variant, assignmentId, allocation: boundedAllocation };
}

export function outcomeForConversationEvent(input: {
  feedback?: 'helpful' | 'not-helpful';
  status: 'answer' | 'suggestions' | 'fallback' | 'smalltalk';
  handoffCta?: boolean;
  guardCategory?: string;
}): ExperimentOutcome {
  if (input.guardCategory || input.handoffCta) return 'safety-handoff';
  if (input.feedback === 'helpful') return 'resolved';
  if (input.feedback === 'not-helpful' || input.status === 'fallback') return 'unresolved';
  return 'pending';
}

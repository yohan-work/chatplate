import { describe, expect, it } from 'vitest';
import { assignConversationExperiment, outcomeForConversationEvent } from './conversationExperiment';

describe('conversation experiments', () => {
  it('assigns a conversation deterministically and keeps other bots out', () => {
    expect(assignConversationExperiment('coach-myway', 'conversation-1')).toEqual(assignConversationExperiment('coach-myway', 'conversation-1'));
    expect(assignConversationExperiment('animal-hospital', 'conversation-1')).toBeUndefined();
  });

  it('does not count protected handoffs as unresolved', () => {
    expect(outcomeForConversationEvent({ status: 'fallback' })).toBe('unresolved');
    expect(outcomeForConversationEvent({ status: 'answer', handoffCta: true })).toBe('safety-handoff');
  });
});

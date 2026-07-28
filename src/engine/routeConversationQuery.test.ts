import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { resolveConversation } from './resolveConversation';
import { routeConversationQuery } from './routeConversationQuery';

describe('routeConversationQuery', () => {
  it('ignores conversation context after the ten-minute TTL', () => {
    const config = botConfigs['coach-myway'];
    const first = resolveConversation('코치 마이:웨이는 어떤 곳인가요?', config);
    const context = { ...first.contextPatch!, updatedAt: 1_000 };
    const routed = routeConversationQuery('위치가 어디?', config, {
      context,
      now: 1_000 + 10 * 60 * 1000 + 1,
    });
    expect(routed.decision).toMatchObject({
      mode: 'standalone',
      reason: 'no-context',
      standaloneKnowledgeId: 'location-001',
    });
  });

  it('asks for clarification when a bare reference has no searchable evidence', () => {
    const config = botConfigs['animal-hospital'];
    const first = resolveConversation('주차 가능해요?', config);
    const routed = routeConversationQuery('그건?', config, { context: first.contextPatch });
    expect(routed.decision.mode).toBe('clarification');
    expect(routed.result.suggestions.map((item) => item.id)).toContain('parking-001');
    expect(routed.clarificationPrompt).toContain('선택해 주세요');
  });
});

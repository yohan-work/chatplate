import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import {
  coachMywayPhase6ChallengeScenarios,
  coachMywayPhase6Scenarios,
  coachMywayPhase6SealedScenarios,
} from '../data/coachMywayPhase6Corpus';
import { conversationEventsToCsv } from '../utils/dataPortability';
import {
  createConversationDatasetManifest,
  findConversationDatasetLeakage,
  summarizeConversationDataset,
  validateConversationDataset,
} from './conversationDataset';
import { conversationEventsFromCsv, importConversationEventsToInbox } from './conversationDatasetImport';
import { evaluateConversationDataset } from './evaluateConversationDataset';

const config = botConfigs['coach-myway'];

describe('Phase 6 conversation dataset', () => {
  it('keeps the declared split counts, valid references, and isolation', () => {
    expect(coachMywayPhase6Scenarios).toHaveLength(836);
    expect(validateConversationDataset(coachMywayPhase6Scenarios, config)).toEqual([]);
    expect(findConversationDatasetLeakage(coachMywayPhase6Scenarios, config)).toEqual([]);
    expect(summarizeConversationDataset(coachMywayPhase6Scenarios, config)).toMatchObject({
      scenarios: 836,
      turns: 1781,
      bySplit: { development: 416, challenge: 240, sealed: 180 },
      knowledgeIdsCovered: 70,
      knowledgeCoverageRate: 1,
      uncoveredKnowledgeIds: [],
    });
  });

  it('creates reproducible corpus and knowledge hashes', async () => {
    const first = await createConversationDatasetManifest(coachMywayPhase6Scenarios, config, 'test-v1');
    const second = await createConversationDatasetManifest(coachMywayPhase6Scenarios, config, 'test-v1');
    expect(second.corpusHash).toBe(first.corpusHash);
    expect(second.knowledgeHash).toBe(first.knowledgeHash);
  });

  it('passes challenge and sealed acceptance gates without an LLM', async () => {
    const challenge = await evaluateConversationDataset(coachMywayPhase6ChallengeScenarios, config, 'challenge');
    const sealed = await evaluateConversationDataset(coachMywayPhase6SealedScenarios, config, 'sealed');
    expect(challenge.accepted).toBe(true);
    expect(challenge.hardGateFailures).toBe(0);
    expect(sealed.accepted).toBe(true);
    expect(sealed.hardGateFailures).toBe(0);
  }, 30_000);

  it('round-trips anonymized events into a review-only production inbox', () => {
    const csv = conversationEventsToCsv([{
      id: 'event-1', botId: 'coach-myway', conversationId: 'real-conversation-id', turnIndex: 1,
      query: '연락처는 010-1234-5678이고 비용이 궁금해요', status: 'answer', confidence: 'high',
      matchedKnowledgeIds: ['policy-001'], replyPolicy: 'answer', replyText: 'test@example.com으로 보내세요',
      createdAt: '2026-08-03T00:00:00.000Z',
    }]);
    expect(csv).not.toContain('real-conversation-id');
    expect(csv).not.toContain('010-1234-5678');
    expect(csv).not.toContain('test@example.com');
    const inbox = importConversationEventsToInbox(conversationEventsFromCsv(csv));
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ split: 'production-inbox', status: 'draft', source: 'production' });
    expect(inbox[0].turns[0].query).toContain('[전화번호 삭제]');
  });
});

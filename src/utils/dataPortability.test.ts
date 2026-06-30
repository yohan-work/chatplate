import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { conversationEventsToCsv, parseBotConfigJson, validateBotConfig } from './dataPortability';

describe('dataPortability', () => {
  it('validates a bot config', () => {
    expect(validateBotConfig(botConfigs['alf-demo']).ok).toBe(true);
    expect(validateBotConfig({}).ok).toBe(false);
  });

  it('parses a single bot config as a config map', () => {
    const result = parseBotConfigJson(JSON.stringify(botConfigs['alf-demo']));
    expect(result.configs?.['alf-demo'].bot.name).toBe('ALF');
  });

  it('parses a bot config map', () => {
    const result = parseBotConfigJson(JSON.stringify(botConfigs));
    expect(result.configs?.cafe.bot.name).toBe('라운드브루');
  });

  it('converts conversation events to csv', () => {
    const csv = conversationEventsToCsv([
      {
        id: 'event-1',
        botId: 'bot-1',
        query: '가격, 알려줘',
        status: 'answer',
        confidence: 'high',
        matchedKnowledgeIds: ['k1'],
        feedback: 'helpful',
        createdAt: '2026-06-30T00:00:00.000Z',
      },
    ]);

    expect(csv).toContain('"가격, 알려줘"');
    expect(csv).toContain('matchedKnowledgeIds');
  });
});

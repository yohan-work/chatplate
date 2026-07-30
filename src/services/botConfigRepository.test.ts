import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { LocalBotConfigRepository } from './botConfigRepository';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('LocalBotConfigRepository', () => {
  it('publishes a validated draft and rolls back an archived version', async () => {
    const repository = new LocalBotConfigRepository(createStorage());
    const firstDraft = await repository.saveDraft('coach-myway', null, botConfigs['coach-myway'], 'owner');
    const firstPublished = await repository.publish('coach-myway', firstDraft.version, 'owner');
    expect((await repository.getPublished('coach-myway'))?.version).toBe(firstPublished.version);

    const secondDraft = await repository.saveDraft('coach-myway', null, {
      ...botConfigs['coach-myway'],
      bot: { ...botConfigs['coach-myway'].bot, greeting: '변경된 인사' },
    }, 'owner');
    await repository.publish('coach-myway', secondDraft.version, 'owner');
    const restored = await repository.rollback('coach-myway', firstPublished.version, 'owner');

    expect(restored.config.bot.greeting).toBe(botConfigs['coach-myway'].bot.greeting);
    expect(restored.state).toBe('published');
  });

  it('rejects stale draft writes', async () => {
    const repository = new LocalBotConfigRepository(createStorage());
    const draft = await repository.saveDraft('coach-myway', null, botConfigs['coach-myway'], 'owner');
    await expect(repository.saveDraft(
      'coach-myway',
      draft.version - 1,
      botConfigs['coach-myway'],
      'owner',
    )).rejects.toThrow('CONFIG_VERSION_CONFLICT');
  });
});

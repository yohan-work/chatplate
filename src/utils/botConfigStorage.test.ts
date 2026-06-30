import { describe, expect, it } from 'vitest';
import { botConfigs } from '../data/bots';
import { removeKnowledgeItem } from './adminBotConfig';
import { loadStoredBotConfigs, resetStoredBotConfigs, saveStoredBotConfigs } from './botConfigStorage';

function createStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => map.set(key, value),
    removeItem: (key: string) => map.delete(key),
  };
}

describe('botConfigStorage', () => {
  it('saves, loads, and resets bot configs', () => {
    const storage = createStorage();
    saveStoredBotConfigs(botConfigs, storage);
    expect(loadStoredBotConfigs(storage)?.['alf-demo'].bot.name).toBe('ALF');
    resetStoredBotConfigs(storage);
    expect(loadStoredBotConfigs(storage)).toBeNull();
  });
});

describe('adminBotConfig', () => {
  it('removes quick replies when deleting knowledge', () => {
    const config = botConfigs['alf-demo'];
    const updated = removeKnowledgeItem(config, 'install-001');
    expect(updated.knowledge.some((item) => item.id === 'install-001')).toBe(false);
    expect(updated.quickReplies.some((reply) => reply.knowledgeId === 'install-001')).toBe(false);
  });
});

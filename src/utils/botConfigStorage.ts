import type { BotConfigMap } from '../types/chatbot';

export const BOT_CONFIG_STORAGE_KEY = 'chatplate:bot-configs:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function cloneBotConfigs(configs: BotConfigMap): BotConfigMap {
  return JSON.parse(JSON.stringify(configs)) as BotConfigMap;
}

export function loadStoredBotConfigs(storage: StorageLike | null = getBrowserStorage()): BotConfigMap | null {
  if (!storage) return null;

  try {
    const rawValue = storage.getItem(BOT_CONFIG_STORAGE_KEY);
    if (!rawValue) return null;
    return JSON.parse(rawValue) as BotConfigMap;
  } catch {
    return null;
  }
}

export function saveStoredBotConfigs(configs: BotConfigMap, storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.setItem(BOT_CONFIG_STORAGE_KEY, JSON.stringify(configs));
}

export function resetStoredBotConfigs(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.removeItem(BOT_CONFIG_STORAGE_KEY);
}

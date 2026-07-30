import type { BotConfig, BotConfigVersion } from '../types/chatbot';
import { parseBotConfig } from './botConfigSchema';

export interface BotConfigRepository {
  getPublished(botId: string): Promise<BotConfigVersion | null>;
  getDraft(botId: string): Promise<BotConfigVersion | null>;
  saveDraft(botId: string, expectedVersion: number | null, config: BotConfig, adminId: string): Promise<BotConfigVersion>;
  publish(botId: string, draftVersion: number, adminId: string): Promise<BotConfigVersion>;
  rollback(botId: string, archivedVersion: number, adminId: string): Promise<BotConfigVersion>;
  listVersions(botId: string): Promise<BotConfigVersion[]>;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = 'chatplate:bot-config-versions:v1';

function defaultStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export class LocalBotConfigRepository implements BotConfigRepository {
  constructor(private readonly storage: StorageLike | null = defaultStorage()) {}

  private read(): BotConfigVersion[] {
    try {
      return JSON.parse(this.storage?.getItem(STORAGE_KEY) ?? '[]') as BotConfigVersion[];
    } catch {
      return [];
    }
  }

  private write(versions: BotConfigVersion[]): void {
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(versions));
  }

  async getPublished(botId: string): Promise<BotConfigVersion | null> {
    return this.read().find((entry) => entry.botId === botId && entry.state === 'published') ?? null;
  }

  async getDraft(botId: string): Promise<BotConfigVersion | null> {
    return this.read().find((entry) => entry.botId === botId && entry.state === 'draft') ?? null;
  }

  async saveDraft(
    botId: string,
    expectedVersion: number | null,
    config: BotConfig,
    adminId: string,
  ): Promise<BotConfigVersion> {
    const validated = parseBotConfig({ ...config, schemaVersion: 2 });
    const versions = this.read();
    const draftIndex = versions.findIndex((entry) => entry.botId === botId && entry.state === 'draft');
    const existing = draftIndex >= 0 ? versions[draftIndex] : undefined;
    if ((existing?.version ?? null) !== expectedVersion) throw new Error('CONFIG_VERSION_CONFLICT');
    const nextVersion = Math.max(0, ...versions.filter((entry) => entry.botId === botId).map((entry) => entry.version)) + 1;
    const draft: BotConfigVersion = {
      id: `config-${crypto.randomUUID()}`,
      botId,
      version: nextVersion,
      state: 'draft',
      config: validated,
      createdBy: adminId,
      createdAt: new Date().toISOString(),
    };
    if (draftIndex >= 0) versions[draftIndex] = { ...versions[draftIndex], state: 'archived' };
    versions.push(draft);
    this.write(versions);
    return draft;
  }

  async publish(botId: string, draftVersion: number, adminId: string): Promise<BotConfigVersion> {
    const versions = this.read();
    const draft = versions.find((entry) =>
      entry.botId === botId && entry.state === 'draft' && entry.version === draftVersion,
    );
    if (!draft) throw new Error('PUBLISHABLE_DRAFT_NOT_FOUND');
    versions.forEach((entry) => {
      if (entry.botId === botId && entry.state === 'published') entry.state = 'archived';
    });
    draft.state = 'published';
    draft.createdBy = adminId;
    draft.publishedAt = new Date().toISOString();
    this.write(versions);
    return draft;
  }

  async rollback(botId: string, archivedVersion: number, adminId: string): Promise<BotConfigVersion> {
    const versions = this.read();
    const archived = versions.find((entry) =>
      entry.botId === botId && entry.state === 'archived' && entry.version === archivedVersion,
    );
    if (!archived) throw new Error('ROLLBACK_VERSION_NOT_FOUND');
    versions.forEach((entry) => {
      if (entry.botId === botId && entry.state === 'published') entry.state = 'archived';
    });
    const restored: BotConfigVersion = {
      ...archived,
      id: `config-${crypto.randomUUID()}`,
      version: Math.max(...versions.filter((entry) => entry.botId === botId).map((entry) => entry.version)) + 1,
      state: 'published',
      createdBy: adminId,
      createdAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
    };
    versions.push(restored);
    this.write(versions);
    return restored;
  }

  async listVersions(botId: string): Promise<BotConfigVersion[]> {
    return this.read()
      .filter((entry) => entry.botId === botId)
      .sort((left, right) => right.version - left.version);
  }
}

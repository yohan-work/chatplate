import type { SupabaseClient } from '@supabase/supabase-js';
import type { BotConfig, BotConfigVersion } from '../types/chatbot';
import type { BotConfigRepository } from './botConfigRepository';
import { parseBotConfig } from './botConfigSchema';
import { getSupabaseClient } from './supabaseClient';

interface ConfigVersionRow {
  id: string;
  bot_id: string;
  version: number;
  state: BotConfigVersion['state'];
  config: unknown;
  created_by: string;
  created_at: string;
  published_at: string | null;
}

function mapVersion(row: ConfigVersionRow): BotConfigVersion {
  return {
    id: row.id,
    botId: row.bot_id,
    version: row.version,
    state: row.state,
    config: parseBotConfig(row.config),
    createdBy: row.created_by,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

export class SupabaseBotConfigRepository implements BotConfigRepository {
  private readonly client: SupabaseClient;

  constructor(url: string, publishableKey: string, runtime: 'visitor' | 'admin') {
    this.client = getSupabaseClient(url, publishableKey, runtime);
  }

  private async getByState(botId: string, state: BotConfigVersion['state']): Promise<BotConfigVersion | null> {
    const { data, error } = await this.client
      .from('bot_config_versions')
      .select('*')
      .eq('bot_id', botId)
      .eq('state', state)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapVersion(data as ConfigVersionRow) : null;
  }

  getPublished(botId: string): Promise<BotConfigVersion | null> {
    return this.getByState(botId, 'published');
  }

  getDraft(botId: string): Promise<BotConfigVersion | null> {
    return this.getByState(botId, 'draft');
  }

  async saveDraft(
    botId: string,
    expectedVersion: number | null,
    config: BotConfig,
  ): Promise<BotConfigVersion> {
    const { data, error } = await this.client.rpc('save_bot_config_draft', {
      p_bot_id: botId,
      p_expected_version: expectedVersion,
      p_config: parseBotConfig({ ...config, schemaVersion: 2 }),
    });
    if (error) throw new Error(error.message);
    return mapVersion(data as ConfigVersionRow);
  }

  async publish(botId: string, draftVersion: number): Promise<BotConfigVersion> {
    const { data, error } = await this.client.rpc('publish_bot_config', {
      p_bot_id: botId,
      p_draft_version: draftVersion,
    });
    if (error) throw new Error(error.message);
    return mapVersion(data as ConfigVersionRow);
  }

  async rollback(botId: string, archivedVersion: number): Promise<BotConfigVersion> {
    const { data, error } = await this.client.rpc('rollback_bot_config', {
      p_bot_id: botId,
      p_archived_version: archivedVersion,
    });
    if (error) throw new Error(error.message);
    return mapVersion(data as ConfigVersionRow);
  }

  async listVersions(botId: string): Promise<BotConfigVersion[]> {
    const { data, error } = await this.client
      .from('bot_config_versions')
      .select('*')
      .eq('bot_id', botId)
      .order('version', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ConfigVersionRow[]).map(mapVersion);
  }
}

import type { BotConfig, BotConfigVersion } from '../types/chatbot';
import { validateBotConfig } from '../utils/dataPortability';

const LOCAL_STORAGE_KEY = 'chatplate:bot-config-versions:v1';

export async function loadPublishedBotConfig(botId: string): Promise<BotConfig | null> {
  const mode = import.meta.env.VITE_CHAT_REPOSITORY ?? 'local';
  if (mode === 'local') {
    try {
      const versions = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) ?? '[]') as BotConfigVersion[];
      return versions.find((entry) => entry.botId === botId && entry.state === 'published')?.config ?? null;
    } catch {
      return null;
    }
  }
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('배포된 챗봇 설정을 불러올 서버 정보가 없습니다.');
  const response = await fetch(
    `${url}/rest/v1/bot_config_versions?bot_id=eq.${encodeURIComponent(botId)}&state=eq.published&select=config&limit=1`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) throw new Error('배포된 챗봇 설정을 불러오지 못했습니다.');
  const rows = await response.json() as Array<{ config?: unknown }>;
  const config = rows[0]?.config;
  return config && validateBotConfig(config).ok ? config as BotConfig : null;
}

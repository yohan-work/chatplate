import type { BotConfigRepository } from './botConfigRepository';
import { LocalBotConfigRepository } from './botConfigRepository';
import { SupabaseBotConfigRepository } from './supabaseBotConfigRepository';

const repositories = new Map<'visitor' | 'admin', BotConfigRepository>();

export function getBotConfigRepository(runtime: 'visitor' | 'admin' = 'visitor'): BotConfigRepository {
  const cached = repositories.get(runtime);
  if (cached) return cached;
  const mode = import.meta.env.VITE_CHAT_REPOSITORY ?? 'local';
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (mode === 'supabase' && (!url || !key)) {
    throw new Error('VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.');
  }
  const repository = mode === 'supabase'
    ? new SupabaseBotConfigRepository(url!, key!, runtime)
    : new LocalBotConfigRepository();
  repositories.set(runtime, repository);
  return repository;
}

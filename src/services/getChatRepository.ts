import type { ChatRepository } from './chatRepository';
import { LocalChatRepository } from './localChatRepository';
import { SupabaseChatRepository } from './supabaseChatRepository';

const repositories = new Map<'visitor' | 'admin', ChatRepository>();

export function getChatRepository(runtime: 'visitor' | 'admin' = 'visitor'): ChatRepository {
  const cached = repositories.get(runtime);
  if (cached) return cached;

  const mode = import.meta.env.VITE_CHAT_REPOSITORY ?? 'local';
  const url = import.meta.env.VITE_SUPABASE_URL;
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let repository: ChatRepository;

  if (mode === 'supabase') {
    if (!url || !publishableKey) {
      throw new Error('VITE_SUPABASE_URL과 VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.');
    }
    repository = new SupabaseChatRepository(url, publishableKey, runtime);
  } else if (mode === 'local') {
    repository = new LocalChatRepository(undefined, runtime);
  } else {
    throw new Error(`지원하지 않는 VITE_CHAT_REPOSITORY 값입니다: ${mode}`);
  }

  repositories.set(runtime, repository);
  return repository;
}

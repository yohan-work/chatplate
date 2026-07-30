import type { ConversationEvent } from '../types/chatbot';
import { appendConversationEvent, loadConversationEvents } from '../utils/conversationEvents';
import { getSupabaseClient } from './supabaseClient';

export interface AnalyticsRepository {
  record(conversationId: string, event: ConversationEvent): Promise<void>;
  list(botId: string, limit?: number): Promise<ConversationEvent[]>;
}

class LocalAnalyticsRepository implements AnalyticsRepository {
  async record(_conversationId: string, event: ConversationEvent): Promise<void> {
    appendConversationEvent(event);
  }

  async list(botId: string, limit = 500): Promise<ConversationEvent[]> {
    return loadConversationEvents().filter((event) => event.botId === botId).slice(-limit);
  }
}

class SupabaseAnalyticsRepository implements AnalyticsRepository {
  private readonly client;

  constructor(url: string, key: string, runtime: 'visitor' | 'admin') {
    this.client = getSupabaseClient(url, key, runtime);
  }

  async record(conversationId: string, event: ConversationEvent): Promise<void> {
    const { error } = await this.client.from('support_search_events').insert({
      id: event.id,
      conversation_id: conversationId,
      bot_id: event.botId,
      event: event,
      created_at: new Date(event.createdAt).toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async list(botId: string, limit = 500): Promise<ConversationEvent[]> {
    const { data, error } = await this.client.from('support_search_events')
      .select('event').eq('bot_id', botId).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => row.event as ConversationEvent).reverse();
  }
}

const repositories = new Map<'visitor' | 'admin', AnalyticsRepository>();

export function getAnalyticsRepository(runtime: 'visitor' | 'admin'): AnalyticsRepository {
  const cached = repositories.get(runtime);
  if (cached) return cached;
  const mode = import.meta.env.VITE_CHAT_REPOSITORY ?? 'local';
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const repository = mode === 'supabase' && url && key
    ? new SupabaseAnalyticsRepository(url, key, runtime)
    : new LocalAnalyticsRepository();
  repositories.set(runtime, repository);
  return repository;
}

import type { ConversationEvent, SearchResult } from '../types/chatbot';

export const CONVERSATION_EVENTS_STORAGE_KEY = 'chatplate:conversation-events:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function createConversationEvent(botId: string, query: string, result: SearchResult): ConversationEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    botId,
    query,
    status: result.status,
    confidence: result.confidence,
    matchedKnowledgeIds: (result.items ?? (result.item ? [result.item] : [])).map((item) => item.id),
    createdAt: new Date().toISOString(),
  };
}

export function loadConversationEvents(storage: StorageLike | null = getBrowserStorage()): ConversationEvent[] {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(CONVERSATION_EVENTS_STORAGE_KEY);
    return rawValue ? (JSON.parse(rawValue) as ConversationEvent[]) : [];
  } catch {
    return [];
  }
}

export function saveConversationEvents(events: ConversationEvent[], storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.setItem(CONVERSATION_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(-300)));
}

export function appendConversationEvent(event: ConversationEvent, storage: StorageLike | null = getBrowserStorage()): void {
  saveConversationEvents([...loadConversationEvents(storage), event], storage);
}

export function updateConversationEventFeedback(
  eventId: string,
  feedback: ConversationEvent['feedback'],
  storage: StorageLike | null = getBrowserStorage(),
): void {
  saveConversationEvents(
    loadConversationEvents(storage).map((event) => (event.id === eventId ? { ...event, feedback } : event)),
    storage,
  );
}

export function clearConversationEvents(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.removeItem(CONVERSATION_EVENTS_STORAGE_KEY);
}

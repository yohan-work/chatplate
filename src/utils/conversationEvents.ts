import type { ConversationEvent, ConversationResolution, ConversationRouteDecision, SearchResult } from '../types/chatbot';

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

export function createConversationEvent(
  botId: string,
  query: string,
  result: SearchResult,
  effectiveQuery = query,
  routeDecision?: ConversationRouteDecision,
  resolution?: Pick<ConversationResolution, 'answerTrust' | 'guardDecision'>,
  metadata?: Pick<ConversationEvent, 'conversationId' | 'turnIndex' | 'replyPolicy' | 'replyText' | 'dialogueActs' | 'resolvedIntentIds' | 'pendingCandidateIds' | 'contextRevision' | 'engineVersion'>,
): ConversationEvent {
  const matchedItems = result.items ?? (result.item ? [result.item] : []);
  const candidateItems = [...matchedItems, ...result.suggestions, ...result.alternatives];

  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    botId,
    query,
    status: result.status,
    confidence: result.confidence,
    answerTrust: resolution?.answerTrust,
    guardCategory: resolution?.guardDecision?.category,
    interactionType: result.status === 'fallback' ? 'fallback' : 'knowledge',
    effectiveQuery,
    matchedKnowledgeIds: matchedItems.map((item) => item.id),
    candidateKnowledgeIds: [...new Set(candidateItems.map((item) => item.id))],
    topScore: result.score,
    scoreMargin: result.scoreMargin,
    matchedUtterance: result.matchedUtterance,
    decisionReason: result.decisionReason,
    routeMode: routeDecision?.mode,
    routeReason: routeDecision?.reason,
    standaloneKnowledgeId: routeDecision?.standaloneKnowledgeId,
    contextualKnowledgeId: routeDecision?.contextualKnowledgeId,
    standaloneScore: routeDecision?.standaloneScore,
    contextualScore: routeDecision?.contextualScore,
    ...metadata,
    createdAt: new Date().toISOString(),
  };
}

export function createSmallTalkConversationEvent(
  botId: string,
  resolution: ConversationResolution,
  metadata?: Pick<ConversationEvent, 'conversationId' | 'turnIndex' | 'replyText' | 'dialogueActs' | 'contextRevision' | 'engineVersion'>,
): ConversationEvent {
  return {
    id: `event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    botId,
    query: resolution.originalQuery,
    status: 'smalltalk',
    confidence: 'high',
    answerTrust: resolution.answerTrust,
    interactionType: 'smalltalk',
    effectiveQuery: resolution.effectiveQuery,
    smallTalkIntent: resolution.smallTalkIntent,
    matchedKnowledgeIds: [],
    candidateKnowledgeIds: [],
    decisionReason: undefined,
    replyPolicy: 'smalltalk',
    ...metadata,
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

export function updateConversationEventSelection(
  eventId: string,
  selectedCandidateId: string,
  storage: StorageLike | null = getBrowserStorage(),
): void {
  saveConversationEvents(
    loadConversationEvents(storage).map((event) =>
      event.id === eventId ? { ...event, selectedCandidateId } : event,
    ),
    storage,
  );
}

export function clearConversationEvents(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) return;
  storage.removeItem(CONVERSATION_EVENTS_STORAGE_KEY);
}

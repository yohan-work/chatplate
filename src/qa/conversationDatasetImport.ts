import type { ConversationEvent } from '../types/chatbot';
import { redactConversationText } from '../utils/redactConversationData';
import type { ConversationDatasetScenario } from './conversationDatasetTypes';
import type { ParityCategory, ParityPolicy } from './conversationParityTypes';

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function list(value: string | undefined): string[] {
  return value ? value.split('|').filter(Boolean) : [];
}

export function conversationEventsFromCsv(csv: string): ConversationEvent[] {
  const [headers, ...rows] = parseCsvRows(csv);
  if (!headers?.includes('id') || !headers.includes('query')) throw new Error('Event CSV must include id and query headers.');
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? '']))).map((entry) => ({
    id: entry.id,
    botId: entry.botId,
    conversationId: entry.conversationId || undefined,
    turnIndex: entry.turnIndex ? Number(entry.turnIndex) : undefined,
    query: entry.query,
    status: entry.status as ConversationEvent['status'],
    confidence: entry.confidence as ConversationEvent['confidence'],
    answerTrust: (entry.answerTrust || undefined) as ConversationEvent['answerTrust'],
    interactionType: (entry.interactionType || undefined) as ConversationEvent['interactionType'],
    effectiveQuery: entry.effectiveQuery || undefined,
    matchedKnowledgeIds: list(entry.matchedKnowledgeIds),
    candidateKnowledgeIds: list(entry.candidateKnowledgeIds),
    guardCategory: (entry.guardCategory || undefined) as ConversationEvent['guardCategory'],
    replyPolicy: (entry.replyPolicy || undefined) as ConversationEvent['replyPolicy'],
    replyText: entry.replyText || undefined,
    feedback: (entry.feedback || undefined) as ConversationEvent['feedback'],
    feedbackReason: entry.feedbackReason || undefined,
    selectedCandidateId: entry.selectedCandidateId || undefined,
    resolvedIntentIds: list(entry.resolvedIntentIds),
    pendingCandidateIds: list(entry.pendingCandidateIds),
    contextRevision: entry.contextRevision ? Number(entry.contextRevision) : undefined,
    engineVersion: entry.engineVersion || undefined,
    experimentId: entry.experimentId || undefined,
    experimentVariant: (entry.experimentVariant || undefined) as ConversationEvent['experimentVariant'],
    experimentAssignmentId: entry.experimentAssignmentId || undefined,
    outcome: (entry.outcome || undefined) as ConversationEvent['outcome'],
    createdAt: entry.createdAt,
  }));
}

function policyOf(event: ConversationEvent): ParityPolicy {
  if (event.replyPolicy) return event.replyPolicy;
  if (event.status === 'smalltalk') return 'smalltalk';
  if (event.status === 'fallback') return 'fallback';
  if (event.status === 'suggestions') return 'clarify';
  return 'answer';
}

function categoryOf(event: ConversationEvent): ParityCategory {
  if (event.guardCategory === 'open-domain') return 'boundary';
  if (event.guardCategory) return 'safety';
  if (policyOf(event) === 'clarify') return 'ambiguity';
  if (event.feedback === 'not-helpful') return 'emotion';
  return 'paraphrase';
}

export function importConversationEventsToInbox(events: ConversationEvent[]): ConversationDatasetScenario[] {
  const groups = new Map<string, ConversationEvent[]>();
  events.forEach((event) => {
    const key = event.conversationId || event.id;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  });
  return [...groups.entries()].map(([conversationId, group], scenarioIndex) => {
    const sorted = [...group].sort((left, right) => (left.turnIndex ?? 0) - (right.turnIndex ?? 0) || left.createdAt.localeCompare(right.createdAt));
    const redactions = sorted.map((event) => redactConversationText(event.query));
    const category = categoryOf(sorted.find((event) => event.feedback === 'not-helpful') ?? sorted[0]);
    const intentIds = [...new Set(sorted.flatMap((event) => event.resolvedIntentIds?.length ? event.resolvedIntentIds : event.matchedKnowledgeIds))];
    const sensitive = redactions.some((redaction) => redaction.sensitive);
    return {
      id: `production-inbox-${conversationId}-${scenarioIndex + 1}`,
      schemaVersion: 1,
      semanticGroupId: `production-${conversationId}`,
      source: 'production',
      authorRole: 'production-import',
      createdAt: sorted[0]?.createdAt || new Date().toISOString(),
      audience: 'unknown',
      journeyStage: category === 'safety' || category === 'boundary' ? 'safety' : 'support',
      category,
      difficultyTags: [category === 'context-correction' ? 'context' : category],
      intentIds,
      split: 'production-inbox',
      status: sensitive ? 'rejected-sensitive' : 'draft',
      reviews: [],
      turns: sorted.map((event, turnIndex) => ({
        id: `production-inbox-${event.id}-t${turnIndex + 1}`,
        query: redactions[turnIndex].text,
        expectation: {
          acceptedPolicies: [policyOf(event)],
          acceptedKnowledgeIds: event.matchedKnowledgeIds,
          expectedGuardCategory: event.guardCategory,
        },
      })),
    } satisfies ConversationDatasetScenario;
  });
}

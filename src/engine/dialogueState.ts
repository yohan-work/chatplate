import type {
  ClarificationState,
  ConversationContext,
  DialogueFrame,
  KnowledgeItem,
  SearchResult,
} from '../types/chatbot';
import type { ConversationInputAnalysis } from './analyzeConversation';

interface DialogueStateUpdate {
  dialogueFrames: DialogueFrame[];
  pendingClarification?: ClarificationState;
  stateRevision: number;
}

function resultItems(result: SearchResult): KnowledgeItem[] {
  if (result.status === 'suggestions') return result.suggestions;
  return result.items ?? (result.item ? [result.item] : []);
}

function uniqueItems(items: KnowledgeItem[]): KnowledgeItem[] {
  return items.filter((item, index, values) => values.findIndex((entry) => entry.id === item.id) === index);
}

function frame(
  revision: number,
  index: number,
  sourceText: string,
  item: KnowledgeItem,
  result: SearchResult,
): DialogueFrame {
  const clarifying = result.status === 'suggestions';
  return {
    id: `frame-${revision}-${index + 1}`,
    sourceText,
    candidateKnowledgeIds: clarifying ? result.suggestions.map((candidate) => candidate.id) : [item.id],
    resolvedKnowledgeIds: clarifying ? [] : [item.id],
    status: clarifying ? 'clarifying' : 'resolved',
    selectedKnowledgeId: clarifying ? undefined : item.id,
    confidence: result.confidence,
    revision,
  };
}

export function reduceDialogueState(
  query: string,
  result: SearchResult,
  previous: ConversationContext | undefined,
  analysis: ConversationInputAnalysis | undefined,
): DialogueStateUpdate {
  const revision = (previous?.stateRevision ?? 0) + 1;
  const isCorrection = analysis?.dialogueActs.some((act) => act === 'correct' || act === 'exclude') ?? false;
  let frames = [...(previous?.dialogueFrames ?? [])];

  if (isCorrection) {
    frames = frames.map((entry) => entry.status === 'excluded'
      ? entry
      : { ...entry, status: 'excluded' as const, revision });
  }

  const items = uniqueItems(resultItems(result));
  if (result.status !== 'fallback' && items.length) {
    if (result.status === 'suggestions') {
      frames.push(frame(revision, 0, query, items[0], result));
    } else {
      items.forEach((item, index) => {
        const sourceText = analysis?.knowledgeSegments[index] ?? query;
        frames.push(frame(revision, index, sourceText, item, result));
      });
    }
  }

  frames = frames.slice(-16);
  const clarificationFrame = result.status === 'suggestions' ? frames.at(-1) : undefined;
  return {
    dialogueFrames: frames,
    pendingClarification: clarificationFrame ? {
      frameId: clarificationFrame.id,
      questionId: `clarification-${revision}`,
      candidateKnowledgeIds: items.map((item) => item.id),
      candidateLabels: items.map((item) => item.question),
    } : undefined,
    stateRevision: revision,
  };
}

export function excludedKnowledgeIds(context?: ConversationContext): string[] {
  return [...new Set((context?.dialogueFrames ?? [])
    .filter((entry) => entry.status === 'excluded')
    .flatMap((entry) => [...entry.resolvedKnowledgeIds, ...entry.candidateKnowledgeIds]))];
}

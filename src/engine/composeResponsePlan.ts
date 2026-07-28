import type { ConversationContext, KnowledgeItem, ResponsePlan, SearchResult } from '../types/chatbot';
import { extractQueryFeatures } from './queryFeatures';

const OPENINGS = [
  '등록된 안내를 기준으로 말씀드리면,',
  '문의하신 내용을 확인해 보니,',
  '가장 관련 있는 안내는 다음과 같아요.',
];

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function answerFor(item: KnowledgeItem, variant: number): string {
  if (item.answerVariants?.length) return item.answerVariants[variant % item.answerVariants.length];
  const blocks = item.answerBlocks?.filter((block) => !block.condition).map((block) => block.text) ?? [];
  return [item.shortAnswer, ...blocks, !item.shortAnswer && blocks.length === 0 ? item.answer : ''].filter(Boolean).join('\n\n');
}

export function composeResponsePlan(
  query: string,
  result: SearchResult,
  context?: ConversationContext,
  options?: { continued?: boolean },
): ResponsePlan | undefined {
  const items = result.items ?? (result.item ? [result.item] : []);
  if (!items.length) return undefined;

  const variant = stableHash(`${query}:${items.map((item) => item.id).join(':')}:${context?.turnCount ?? 0}`) % OPENINGS.length;
  const features = extractQueryFeatures(query);
  const contextOpening = context && context.turnCount > 0 && options?.continued
    ? '앞선 문의와 이어서 안내드리면,'
    : items.length > 1
      ? '질문하신 내용을 두 가지로 나누어 안내드릴게요.'
      : OPENINGS[variant];
  const bodies = items.map((item) =>
    items.length > 1 ? `• ${item.question}\n${answerFor(item, variant)}` : answerFor(item, variant),
  );
  const entityAcknowledgement = features.entities.grade
    ? `${features.entities.grade} 관련 조건을 함께 확인했어요.`
    : features.entities.mode
      ? `${features.entities.mode} 방식에 관해 문의하셨군요.`
      : '';
  const followUpPrompts = [
    ...items.flatMap((item) => item.followUpPrompts ?? []),
    ...result.alternatives.map((item) => item.question),
  ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 3);

  return {
    text: [contextOpening, entityAcknowledgement, ...bodies].filter(Boolean).join('\n\n'),
    knowledgeIds: items.map((item) => item.id),
    toneVariant: variant,
    followUpPrompts,
  };
}

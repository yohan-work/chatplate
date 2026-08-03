import type { ConversationAudience, ConversationContext, KnowledgeItem, ResponsePlan, SearchResult } from '../types/chatbot';
import { combinedAnswerTrust } from './answerTrust';
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
  if (item.answerMode === 'safe-general') return item.answer;
  const blocks = item.answerBlocks?.filter((block) => !block.condition).map((block) => block.text) ?? [];
  return [item.shortAnswer, ...blocks, !item.shortAnswer && blocks.length === 0 ? item.answer : ''].filter(Boolean).join('\n\n');
}

function shortAnswerFor(item: KnowledgeItem, variant: number): string {
  return item.shortAnswer ?? item.answerVariants?.[variant % item.answerVariants.length] ?? item.answer;
}

export function composeResponsePlan(
  query: string,
  result: SearchResult,
  context?: ConversationContext,
  options?: {
    continued?: boolean;
    audience?: ConversationAudience;
    acknowledgement?: string;
    unresolvedSegments?: string[];
    responseStyle?: 'default' | 'short' | 'detailed' | 'summary' | 'confirmation';
  },
): ResponsePlan | undefined {
  const items = result.items ?? (result.item ? [result.item] : []);
  if (!items.length) return undefined;

  const variant = stableHash(`${query}:${items.map((item) => item.id).join(':')}:${context?.turnCount ?? 0}`) % OPENINGS.length;
  const answerTrust = combinedAnswerTrust(items);
  const features = extractQueryFeatures(query);
  const contextOpening = context && context.turnCount > 0 && options?.continued
    ? '앞선 문의와 이어서 안내드리면,'
    : items.length > 1
      ? '질문하신 내용을 두 가지로 나누어 안내드릴게요.'
      : answerTrust === 'bounded'
        ? '현재 등록된 안내 범위에서 말씀드리면,'
      : OPENINGS[variant];
  const answerBuilder = options?.responseStyle === 'short' || options?.responseStyle === 'summary'
    ? shortAnswerFor
    : answerFor;
  const bodies = items.map((item) =>
    items.length > 1 ? `• ${item.question}\n${answerBuilder(item, variant)}` : answerBuilder(item, variant),
  );
  const audienceAcknowledgement = options?.audience === 'parent'
    ? '학부모님이 확인하기 쉽게 핵심부터 안내드릴게요.'
    : options?.audience === 'student'
      ? '학생 본인이 바로 확인할 수 있게 설명드릴게요.'
      : '';
  const entityAcknowledgement = features.entities.grade
    ? `${features.entities.grade} 관련 조건을 함께 확인했어요.`
    : features.entities.mode
      ? `${features.entities.mode} 방식에 관해 문의하셨군요.`
      : '';
  const followUpPrompts = [
    ...items.flatMap((item) => item.followUpPrompts ?? []),
    ...result.alternatives.map((item) => item.question),
  ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 3);
  const unresolvedNotice = options?.unresolvedSegments?.length
    ? `다만 “${options.unresolvedSegments.join('”, “')}” 부분은 등록된 정보만으로 확정하기 어려워요. 필요한 운영 조건은 공식 상담 채널에서 확인해 주세요.`
    : '';
  const confirmation = options?.responseStyle === 'confirmation'
    ? '네, 앞서 안내한 내용을 기준으로 이해하신 방향이 맞아요.'
    : '';

  return {
    text: [
      options?.acknowledgement,
      confirmation,
      contextOpening,
      audienceAcknowledgement,
      entityAcknowledgement,
      ...bodies,
      unresolvedNotice,
    ].filter(Boolean).join('\n\n'),
    knowledgeIds: items.map((item) => item.id),
    toneVariant: variant,
    followUpPrompts,
    answerTrust,
  };
}

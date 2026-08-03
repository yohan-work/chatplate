import type {
  BotConfig,
  ConversationAudience,
  ConversationIntentSpec,
  ConversationUtterance,
  KnowledgeItem,
  UtteranceVariation,
} from '../types/chatbot';

const AUDIENCES: ConversationAudience[] = ['parent', 'student', 'unknown'];
const VARIATIONS: UtteranceVariation[] = ['formal', 'colloquial', 'short', 'synonym', 'word-order', 'spacing', 'typo', 'contextual'];

interface Seed {
  id: string;
  label: string;
  examples: string[];
}

const RELATIONSHIP_SEEDS: Seed[] = [
  { id: 'greeting', label: '인사', examples: ['안녕하세요', '반가워요', '좋은 아침이에요', '챗봇 안녕'] },
  { id: 'thanks', label: '감사', examples: ['감사합니다', '고마워요', '도움됐어요', '잘 알겠습니다'] },
  { id: 'goodbye', label: '작별', examples: ['안녕히 계세요', '다음에 올게요', '여기까지 할게요', '좋은 하루 보내세요'] },
  { id: 'identity', label: '정체성', examples: ['너는 누구야', '사람인가요', '어떤 챗봇이에요', '누가 답하나요'] },
  { id: 'help', label: '도움말', examples: ['뭘 물어볼 수 있나요', '질문 예시 보여줘', '도와주세요', '가능한 기능 알려줘'] },
  { id: 'positive', label: '긍정', examples: ['좋아요', '괜찮네요', '기대돼요', '해볼게요'] },
  { id: 'worry', label: '걱정', examples: ['걱정돼요', '불안해요', '마음이 무거워요', '잘할 수 있을지 걱정돼요'] },
  { id: 'frustration', label: '좌절', examples: ['너무 답답해요', '지쳤어요', '계속 안 돼요', '막막해요'] },
  { id: 'confusion', label: '혼란', examples: ['잘 모르겠어요', '이해가 안 돼요', '헷갈려요', '정리가 안 돼요'] },
  { id: 'urgency', label: '급함', examples: ['급해요', '빨리 알려주세요', '시간이 없어요', '시험이 코앞이에요'] },
  { id: 'indecision', label: '망설임', examples: ['결정을 못 하겠어요', '고민 중이에요', '선택하기 어려워요', '어떤 게 좋을지 모르겠어요'] },
  { id: 'skepticism', label: '의심', examples: ['정말 효과가 있나요', '믿어도 되나요', '과장 아닌가요', '확실한가요'] },
  { id: 'apology', label: '사과', examples: ['미안해요', '죄송해요', '제가 잘못 말했어요', '말이 헷갈렸네요'] },
  { id: 'praise', label: '칭찬', examples: ['친절하네요', '설명을 잘하네요', '답변이 좋아요', '도움이 많이 됐어요'] },
  { id: 'social', label: '가벼운 대화', examples: ['잘 지냈어요', '그냥 이야기하고 싶어요', '오늘도 좋은 하루예요', '반가워서 말 걸었어요'] },
];

const CONTROL_SEEDS: Seed[] = [
  { id: 'handoff', label: '상담원 연결', examples: ['상담원 연결해 주세요', '사람과 이야기할래요', '담당자에게 문의할게요', '직원과 통화하고 싶어요'] },
  { id: 'repeat', label: '반복', examples: ['다시 말해 주세요', '방금 답을 반복해 줘', '한 번 더 알려주세요', '아까 내용을 다시 설명해요'] },
  { id: 'shorten', label: '축약', examples: ['짧게 알려줘', '한 줄로 말해 주세요', '간단히 설명해요', '핵심만 알려주세요'] },
  { id: 'elaborate', label: '상세 설명', examples: ['더 자세히 알려줘', '구체적으로 설명해 주세요', '상세히 말해요', '조금 더 풀어서 알려줘'] },
  { id: 'example', label: '예시', examples: ['예시를 보여줘', '예를 들어 설명해요', '사례로 알려주세요', '구체적인 예가 있나요'] },
  { id: 'summarize', label: '요약', examples: ['정리해 주세요', '요약해 줘', '핵심을 정리해요', '방금 내용을 요약해 주세요'] },
  { id: 'compare', label: '비교', examples: ['두 가지를 비교해 줘', '차이를 알려주세요', '뭐가 다른가요', '어느 쪽이 다른지 설명해요'] },
  { id: 'select', label: '항목 선택', examples: ['첫 번째요', '두 번째 걸로요', '1번을 말한 거예요', '후자가 궁금해요'] },
  { id: 'reference', label: '앞말 참조', examples: ['그건 어떻게 돼요', '앞에서 말한 내용이요', '그 부분은요', '아까 답변을 이어서요'] },
  { id: 'correct', label: '정정', examples: ['고등학생이 아니라 중학생이에요', '제가 잘못 말했어요', '정확히는 온라인이에요', '아니고 방문 상담이요'] },
  { id: 'exclude', label: '제외', examples: ['첫 번째 말고 두 번째요', '비용은 빼고 알려줘', '온라인은 제외해 주세요', '그 내용은 필요 없어요'] },
  { id: 'compound', label: '복합 요청', examples: ['비용과 상담 방법을 알려줘', '학년이랑 온라인 여부가 궁금해요', '가격하고 환불을 같이 설명해요', '두 가지를 한 번에 물어볼게요'] },
  { id: 'switch-topic', label: '주제 전환', examples: ['다른 질문할게요', '그건 됐고 비용은요', '별개로 위치가 궁금해요', '주제를 바꿔서 물어볼게요'] },
  { id: 'confirm', label: '이해 확인', examples: ['제가 이해한 게 맞나요', '그렇다는 거죠', '방금 설명이 맞죠', '이렇게 이해하면 되나요'] },
  { id: 'restart', label: '대화 재시작', examples: ['처음부터 다시 할게요', '대화를 새로 시작해요', '앞 내용은 지워 주세요', '처음 질문으로 돌아갈게요'] },
];

function utterances(examples: string[]): ConversationUtterance[] {
  const base = examples.filter(Boolean);
  const expanded = [
    ...base,
    `학부모인데 ${base[0]}`,
    `학생인데 ${base[1] ?? base[0]}`,
    `처음 문의하는데 ${base[2] ?? base[0]}`,
    `${base[0]} 부탁드려요`,
    `${base[1] ?? base[0]} 궁금합니다`,
    `혹시 ${base[2] ?? base[0]}`,
    `${base[3] ?? base[0]} 알려주세요`,
    `제가 묻고 싶은 건 ${base[0]}`,
  ].filter((value, index, values) => values.indexOf(value) === index).slice(0, 12);
  while (expanded.length < 12) expanded.push(`${base[0]} ${expanded.length + 1}`);
  return expanded.map((text, index) => ({
    text,
    audience: index === 4 ? 'parent' : index === 5 ? 'student' : 'unknown',
    variation: VARIATIONS[index % VARIATIONS.length],
    split: index < 7 ? 'train' : index < 9 ? 'dev' : 'test',
  }));
}

function knowledgeExamples(item: KnowledgeItem): string[] {
  return [item.question, ...item.aliases, ...(item.utterances ?? []).map((entry) => entry.text)];
}

function knowledgeSpec(item: KnowledgeItem): ConversationIntentSpec {
  const family = item.id.startsWith('advice-') ? 'advice' as const : 'knowledge' as const;
  return {
    id: item.intentId && item.intentId === item.id ? item.id : `knowledge-${item.id}`,
    family,
    label: item.question,
    priorityTier: item.priority >= 10 ? 'high' : item.priority >= 8 ? 'medium' : 'low',
    audiences: AUDIENCES,
    requiredSlots: [],
    knowledgeIds: [item.id],
    responsePolicy: family === 'advice' ? 'safe-advice' : 'answer',
    utterances: utterances(knowledgeExamples(item)),
    negativeUtterances: [],
  };
}

function seedSpec(seed: Seed, family: 'relationship' | 'control'): ConversationIntentSpec {
  return {
    id: `${family}-${seed.id}`,
    family,
    label: seed.label,
    priorityTier: ['handoff', 'correct', 'exclude', 'restart', 'frustration', 'worry'].includes(seed.id) ? 'high' : 'medium',
    audiences: AUDIENCES,
    requiredSlots: [],
    knowledgeIds: [],
    responsePolicy: seed.id === 'handoff' ? 'handoff' : family,
    utterances: utterances(seed.examples),
    negativeUtterances: [],
  };
}

export function buildCoachMywayConversationIntents(config: BotConfig): ConversationIntentSpec[] {
  const knowledge = config.knowledge.map(knowledgeSpec);
  const relationship = RELATIONSHIP_SEEDS.map((seed) => seedSpec(seed, 'relationship'));
  const control = CONTROL_SEEDS.map((seed) => seedSpec(seed, 'control'));
  const specs = [...knowledge, ...relationship, ...control];
  return specs.map((spec, index) => ({
    ...spec,
    negativeUtterances: Array.from({ length: 4 }, (_, offset) => specs[(index + offset + 1) % specs.length].utterances[0].text),
  }));
}

export function validateCoachMywayConversationIntents(specs: ConversationIntentSpec[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (specs.length !== 100) errors.push(`의도는 정확히 100개여야 하지만 ${specs.length}개입니다.`);
  specs.forEach((spec) => {
    if (ids.has(spec.id)) errors.push(`${spec.id}: ID가 중복됐습니다.`);
    ids.add(spec.id);
    if (spec.utterances.length < 12) errors.push(`${spec.id}: 긍정 발화가 12개 미만입니다.`);
    if (spec.negativeUtterances.length < 4) errors.push(`${spec.id}: 혼동 방지 발화가 4개 미만입니다.`);
    const splitCounts = spec.utterances.reduce<Record<string, number>>((counts, utterance) => {
      counts[utterance.split] = (counts[utterance.split] ?? 0) + 1;
      return counts;
    }, {});
    if (splitCounts.train !== 7 || splitCounts.dev !== 2 || splitCounts.test !== 3) {
      errors.push(`${spec.id}: train/dev/test가 7/2/3이 아닙니다.`);
    }
  });
  return errors;
}

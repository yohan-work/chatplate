import type { KnowledgeItem, SearchUtterance, UtterancePersona, UtteranceVariation } from '../types/chatbot';
import { normalizeText } from '../engine/normalizeText';

type Candidate = [string, UtterancePersona, UtteranceVariation];

export function buildCoachMywayUtterances(item: KnowledgeItem): SearchUtterance[] {
  const [first = item.question, second = first, third = second] = item.aliases;
  const keyword = item.keywords[0] ?? item.question;
  const questionStem = item.question.replace(/[?.]$/u, '');
  const candidates: Candidate[] = [
    [item.question, 'neutral', 'formal'],
    [first, 'parent', 'colloquial'],
    [second, 'student', 'colloquial'],
    [third, 'neutral', 'synonym'],
    [`${keyword} ${second}`, 'neutral', 'short'],
    [`학부모인데 ${first}`, 'parent', 'contextual'],
    [`학생인데 ${second}`, 'student', 'contextual'],
    [`${third} 알려주세요`, 'neutral', 'word-order'],
    [item.question.replace(/\s/g, ''), 'neutral', 'spacing'],
    [`상담 전에 ${questionStem} 궁금해요`, 'parent', 'contextual'],
    [`혹시 ${first}`, 'parent', 'colloquial'],
    [`${second} 가능한지 궁금해요`, 'student', 'contextual'],
    [`${third} 자세히 알려주세요`, 'neutral', 'formal'],
    [`코치 마이웨이 ${keyword} 문의`, 'neutral', 'short'],
    [`아이 문제로 ${first}`, 'parent', 'contextual'],
    [`제가 학생인데 ${second}`, 'student', 'contextual'],
    [`처음 알아보는데 ${third}`, 'neutral', 'contextual'],
    [`${keyword} 관련해서 물어볼게요`, 'neutral', 'colloquial'],
    [`${questionStem} 맞나요`, 'student', 'colloquial'],
    [`${questionStem} 가능한가요`, 'parent', 'formal'],
    [`궁금한 건 ${second}`, 'neutral', 'word-order'],
    [`문의드려요 ${third}`, 'parent', 'word-order'],
    [`짧게 ${keyword} 알려줘`, 'student', 'short'],
    [`${first.replace(/\s/g, '')}`, 'parent', 'spacing'],
    [`${second.replace(/\s/g, '')}`, 'student', 'spacing'],
    [`코칭 알아보는 중인데 ${first}`, 'parent', 'contextual'],
    [`등록 전에 ${second}`, 'parent', 'contextual'],
    [`학생 입장에서 ${third}`, 'student', 'contextual'],
    [`학부모 입장에서 ${questionStem}`, 'parent', 'contextual'],
    [`${keyword} 어떻게 되는지`, 'neutral', 'short'],
    [`${third} 맞는지 확인하고 싶어요`, 'parent', 'contextual'],
    [`관련 안내로 ${first}`, 'neutral', 'word-order'],
    [`혹시라도 ${second}`, 'student', 'colloquial'],
    [`${questionStem} 좀 알려줘요`, 'neutral', 'colloquial'],
    [`코치님 ${third}`, 'student', 'colloquial'],
    [`상담할 때 ${first}`, 'parent', 'contextual'],
    [`미리 ${second} 확인하고 싶어요`, 'parent', 'contextual'],
    [`지금 ${third} 궁금합니다`, 'neutral', 'formal'],
    [`${keyword} 관련 ${questionStem} 질문 있어요`, 'student', 'contextual'],
    [`부모가 묻는데 ${questionStem}`, 'parent', 'contextual'],
  ];

  return candidates.map(([text, persona, variation], index) => ({
    text,
    persona,
    variation,
    split: index < 28 ? 'train' : index < 34 ? 'dev' : 'test',
    source: 'seed',
    approved: false,
    contextRequired: variation === 'contextual' && index >= 28,
  }));
}

export function enrichCoachMywayKnowledge(item: KnowledgeItem): KnowledgeItem {
  const intent = item.intentId ?? item.categoryId;
  const riskLevel = intent === 'pricing' || intent === 'policy'
    ? 'policy'
    : intent === 'fit' || intent === 'privacy'
      ? 'personal'
      : 'low';
  return {
    ...item,
    status: 'active',
    utterances: buildCoachMywayUtterances(item),
    answerMode: item.answerMode ?? (riskLevel === 'low' ? 'verified' : riskLevel === 'policy' ? 'handoff' : 'safe-general'),
    riskLevel: item.riskLevel ?? riskLevel,
  };
}

export function enrichCoachMywayDataset(items: KnowledgeItem[]): KnowledgeItem[] {
  const used = new Set<string>();
  return items.map((item) => {
    const enriched = enrichCoachMywayKnowledge(item);
    return {
      ...enriched,
      utterances: enriched.utterances?.map((utterance, index) => {
        let text = utterance.text;
        let normalized = normalizeText(text);
        if (!used.has(normalized)) {
          used.add(normalized);
          return utterance;
        }
        text = `${utterance.text} ${item.question.replace(/[?.]$/u, '')}`;
        normalized = normalizeText(text);
        while (used.has(normalized)) {
          text = `${text} ${index % 2 ? '조금 더' : '자세히'}`;
          normalized = normalizeText(text);
        }
        used.add(normalized);
        return { ...utterance, text };
      }),
    };
  });
}

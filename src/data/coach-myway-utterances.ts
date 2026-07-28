import type { KnowledgeItem, SearchUtterance, UtterancePersona, UtteranceVariation } from '../types/chatbot';
import { normalizeText } from '../engine/normalizeText';

type Candidate = [string, UtterancePersona, UtteranceVariation];

export function buildCoachMywayUtterances(item: KnowledgeItem): SearchUtterance[] {
  const [first = item.question, second = first, third = second] = item.aliases;
  const keyword = item.keywords[0] ?? item.question;
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
    [`상담 전에 ${item.question.replace(/[?.]$/u, '')} 궁금해요`, 'parent', 'contextual'],
  ];

  return candidates.map(([text, persona, variation]) => ({ text, persona, variation }));
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
      utterances: enriched.utterances?.map((utterance) => {
        const normalized = normalizeText(utterance.text);
        if (!used.has(normalized)) {
          used.add(normalized);
          return utterance;
        }
        const contextualText = `${utterance.text} ${item.question.replace(/[?.]$/u, '')}`;
        used.add(normalizeText(contextualText));
        return { ...utterance, text: contextualText };
      }),
    };
  });
}

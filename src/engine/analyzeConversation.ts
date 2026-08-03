import type {
  ConversationAudience,
  ConversationContext,
  ConversationSegment,
  DialogueAct,
  SmallTalkIntentId,
} from '../types/chatbot';
import { normalizeText } from './normalizeText';

const SEGMENT_CONNECTOR = /\s*(?:[,.!?;\n]|그리고|또한|또|및|(?:이랑|랑|와|과|하고)\s+)\s*/gu;
const IMPLICIT_QUESTION_BOUNDARY = /((?:궁금해요|궁금합니다|가능한가요|되나요|받나요|하나요|인가요|어디인가요|언제인가요|알려주세요|지켜요|급해요|어려워요))\s+(?=\S)/gu;
const QUESTION_TAIL = /(?:알려\s*주세요|알려\s*줘|궁금해요|궁금합니다|문의해요|확인해\s*주세요)$/u;

const RELATIONSHIP_PATTERNS: Array<{ intentId: SmallTalkIntentId; pattern: RegExp; acknowledgement: string }> = [
  { intentId: 'frustration', pattern: /(?:답답|지쳤|힘들|막막|계속.*안\s*돼)/u, acknowledgement: '많이 답답하고 힘드셨겠어요.' },
  { intentId: 'worry', pattern: /(?:걱정|불안|마음이\s*무거)/u, acknowledgement: '걱정되는 마음이 있으시군요.' },
  { intentId: 'urgency', pattern: /(?:급해|빨리|당장|시간이\s*없|코앞)/u, acknowledgement: '급한 상황인 만큼 확인 가능한 내용부터 짚어볼게요.' },
  { intentId: 'confusion', pattern: /(?:헷갈|이해가\s*안|잘\s*모르|정리가\s*안)/u, acknowledgement: '헷갈릴 수 있는 부분이에요.' },
  { intentId: 'indecision', pattern: /(?:결정을?\s*못|고민\s*중|선택.*어렵)/u, acknowledgement: '선택 기준이 많아 고민되실 수 있어요.' },
  { intentId: 'skepticism', pattern: /(?:정말|진짜|믿어도|과장|확실)/u, acknowledgement: '확실히 확인하고 결정하려는 마음이 중요해요.' },
  { intentId: 'positive', pattern: /(?:좋아요|좋네요|기대돼|해볼게)/u, acknowledgement: '좋아요.' },
  { intentId: 'apology', pattern: /(?:미안|죄송)/u, acknowledgement: '괜찮아요.' },
  { intentId: 'praise', pattern: /(?:친절|잘하네요|답변이\s*좋|도움이\s*많이)/u, acknowledgement: '좋게 봐주셔서 고마워요.' },
  { intentId: 'greeting', pattern: /(?:안녕하세요|안녕|반가워요|반갑습니다)/u, acknowledgement: '안녕하세요.' },
  { intentId: 'thanks', pattern: /(?:감사합니다|감사해요|고마워요|고맙습니다)/u, acknowledgement: '도움이 되어 다행이에요.' },
];

const CONTROL_PATTERNS: Array<[DialogueAct, RegExp]> = [
  ['handoff', /(?:상담원|담당자|직원|사람).*(?:연결|바꿔|상담|통화)/u],
  ['restart', /(?:처음부터|새로\s*시작|대화\s*초기화|다시\s*시작)/u],
  ['correct', /(?:아니라|아니고|정정|잘못\s*말|바꿔서|정확히는)/u],
  ['exclude', /(?:말고|빼고|제외|필요\s*없)/u],
  ['select', /(?:첫\s*번째|두\s*번째|1번|2번|전자로|후자로|쪽이요|걸로)/u],
  ['repeat', /(?:다시\s*(?:말|알려|설명)|반복해)/u],
  ['shorten', /(?:짧게|간단히|한\s*줄로|요약만)/u],
  ['elaborate', /(?:자세히|구체적으로|더\s*설명|상세히)/u],
  ['example', /(?:예시|예를\s*들|사례)/u],
  ['summarize', /(?:정리해|요약해|핵심만)/u],
  ['compare', /(?:비교|차이|뭐가\s*더)/u],
  ['confirm', /(?:맞죠|맞나요|이해한.*맞|그렇다는\s*거죠)/u],
  ['switch-topic', /(?:다른\s*질문|주제\s*바꿔|그건\s*됐고|별개로)/u],
];

export interface ConversationInputAnalysis {
  normalized: string;
  audience: ConversationAudience;
  segments: ConversationSegment[];
  knowledgeSegments: string[];
  dialogueActs: DialogueAct[];
  relationshipIntent?: SmallTalkIntentId;
  acknowledgement?: string;
  entities: Record<string, string>;
  selectedIndex?: number;
}

function audienceOf(value: string, previous?: ConversationAudience): ConversationAudience {
  if (/(?:학부모|부모|엄마|아빠|우리\s*아이|저희\s*아이|자녀|아이(?:가|는|를|와|랑))/u.test(value)) return 'parent';
  if (/(?:제가|저는|나는|내가)\s*(?:학생|중[123]|고[123])|(?:중학생|고등학생)인데/u.test(value)) return 'student';
  return previous ?? 'unknown';
}

function lastMatch(value: string, pattern: RegExp): string | undefined {
  return [...value.matchAll(pattern)].at(-1)?.[1];
}

function entitiesOf(value: string): Record<string, string> {
  const entities: Record<string, string> = {};
  const grade = lastMatch(value, /(초등학생|초등|중학생|중등|고등학생|고등|고[123]|중[123]|초[1-6])/gu);
  const subject = lastMatch(value, /(국어|영어|수학|과학|사회|전과목|모든\s*과목)/gu);
  const mode = lastMatch(value, /(온라인|비대면|화상|방문|오프라인|대면)/gu);
  if (grade) entities.grade = grade;
  if (subject) entities.subject = subject;
  if (mode) entities.mode = mode;
  return entities;
}

function selectedIndexOf(value: string): number | undefined {
  if (/(?:첫\s*번째|1번|전자).*(?:말고|빼고|제외).*(?:두\s*번째|2번|후자)/u.test(value)) return 1;
  if (/(?:두\s*번째|2번|후자).*(?:말고|빼고|제외).*(?:첫\s*번째|1번|전자)/u.test(value)) return 0;
  if (/(?:첫\s*번째|1번|전자)/u.test(value)) return 0;
  if (/(?:두\s*번째|2번|후자)/u.test(value)) return 1;
  return undefined;
}

function actsOf(value: string): DialogueAct[] {
  const acts = CONTROL_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(([act]) => act);
  if (RELATIONSHIP_PATTERNS.some(({ pattern }) => pattern.test(value))) acts.push('emotion');
  const contentAfterControl = CONTROL_PATTERNS.reduce((content, [, pattern]) => content.replace(pattern, ' '), value)
    .replace(/(?:주세요|해줘|해요|요)$/u, '')
    .trim();
  if (!acts.some((act) => act !== 'emotion') || contentAfterControl.length >= 3) acts.push('ask');
  return [...new Set(acts)];
}

function looksLikeRelationshipOnly(value: string, relationshipPattern?: RegExp): boolean {
  if (!relationshipPattern?.test(value)) return false;
  const stripped = value.replace(relationshipPattern, '').replace(QUESTION_TAIL, '').trim();
  return stripped.length < 3;
}

export function analyzeConversationInput(query: string, context?: ConversationContext): ConversationInputAnalysis {
  const normalized = normalizeText(query);
  const relationship = RELATIONSHIP_PATTERNS.find(({ pattern }) => pattern.test(normalized));
  const separated = query.replace(IMPLICIT_QUESTION_BOUNDARY, '$1\n');
  const rawSegments = separated
    .split(SEGMENT_CONNECTOR)
    .map((segment) => segment.trim())
    .filter((segment) => normalizeText(segment).length >= 2);
  const values = rawSegments.length ? rawSegments : [query];
  const segments = values.map((text) => {
    const value = normalizeText(text);
    return {
      text,
      dialogueActs: actsOf(value),
      excluded: /(?:말고|빼고|제외)/u.test(value),
    } satisfies ConversationSegment;
  });
  const knowledgeSegments = segments
    .filter((segment) => !looksLikeRelationshipOnly(normalizeText(segment.text), relationship?.pattern))
    .filter((segment) => !/^(?:잠깐만요|잠시만요|솔직히\s*말씀드리면)$/u.test(normalizeText(segment.text)))
    .filter((segment) => !/(?:두\s*가지|한\s*번에).*(?:물어|질문|확인)/u.test(normalizeText(segment.text)))
    .filter((segment) => !segment.dialogueActs.every((act) => act !== 'ask' && act !== 'compare' && act !== 'correct'))
    .map((segment) => segment.excluded
      ? segment.text.replace(/^.{1,18}?(?:말고|빼고|제외(?:하고)?)/u, '').trim()
      : segment.text)
    .filter((segment) => normalizeText(segment).length >= 2);

  const dialogueActs = [...new Set(segments.flatMap((segment) => segment.dialogueActs))];
  if (context && /(?:아니요|아니에요|말한\s*건|물은\s*거|이야기였|정확히는|정확하게는|(?:계획|시험|환불|변경|등록|방문|체험)보다)/u.test(normalized)) {
    dialogueActs.push('correct');
  }

  return {
    normalized,
    audience: audienceOf(normalized, context?.audience),
    segments,
    knowledgeSegments: knowledgeSegments.length ? knowledgeSegments : [query],
    dialogueActs: [...new Set(dialogueActs)],
    relationshipIntent: relationship?.intentId,
    acknowledgement: relationship?.acknowledgement,
    entities: entitiesOf(normalized),
    selectedIndex: selectedIndexOf(normalized),
  };
}

export function correctionHistory(
  previous: ConversationContext | undefined,
  current: Record<string, string>,
  isCorrection: boolean,
): Array<{ entity: string; from?: string; to: string }> {
  const history = [...(previous?.correctionHistory ?? [])];
  if (!isCorrection) return history;
  Object.entries(current).forEach(([entity, to]) => {
    const from = previous?.entities[entity];
    if (from !== to) history.push({ entity, from, to });
  });
  return history.slice(-8);
}

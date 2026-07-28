import type { QueryFeatures, QueryType } from '../types/chatbot';
import { normalizeText } from './normalizeText';

const ENDINGS = /(?:에서는|에게는|으로는|부터는|까지는|이라면|라면|인가요|할까요|해요|돼요|되나요|있나요|없나요|나요|가요|에서|에게|으로|부터|까지|처럼|보다|은|는|이|가|을|를|에|도|만|요)$/u;
const FOLLOW_UP = /^(?:그럼|그러면|그건|그거|그렇다면|그중|그때|또|그리고)|(?:은요|는요|도요)$/u;
const NEGATIVE = /(?:안\s|못\s|아니|없|말고|제외|불가|싫|어렵)/u;

const ENTITY_PATTERNS: Array<[string, RegExp]> = [
  ['grade', /(초등학생|초등|중학생|중등|고등학생|고등|고[123]|중[123]|초[1-6])/u],
  ['subject', /(국어|영어|수학|과학|사회|전과목|모든 과목)/u],
  ['mode', /(온라인|비대면|화상|방문|오프라인|대면)/u],
  ['audience', /(학부모|부모|엄마|아빠|학생|아이|자녀)/u],
  ['policy', /(가격|비용|수강료|결제|환불|취소|등록|변경)/u],
  ['schedule', /(일정|시간|요일|주말|평일|언제|횟수|주기)/u],
];

function stem(token: string): string {
  let result = token;
  for (let pass = 0; pass < 2; pass += 1) {
    const next = result.replace(ENDINGS, '');
    if (next === result || next.length < 2) break;
    result = next;
  }
  return result;
}

function detectQueryType(value: string): QueryType {
  if (/(가격|비용|수강료|얼마|요금)/u.test(value)) return 'price';
  if (/(환불|취소|규정|정책|변경)/u.test(value)) return 'policy';
  if (/(언제|시간|일정|요일|횟수|주기)/u.test(value)) return 'schedule';
  if (/(가능|되나요|할 수|대상)/u.test(value)) return 'availability';
  if (/(어떻게|방법|방식|진행)/u.test(value)) return 'method';
  if (/(차이|비교|다른|무엇이 더)/u.test(value)) return 'comparison';
  if (/(누구|뭐 하는|어떤 곳)/u.test(value)) return 'identity';
  return 'general';
}

export function toJamo(value: string): string {
  return normalizeText(value).normalize('NFD').replace(/\s/g, '');
}

export function extractQueryFeatures(value: string): QueryFeatures {
  const normalized = normalizeText(value);
  const entities: Record<string, string> = {};
  ENTITY_PATTERNS.forEach(([key, pattern]) => {
    const match = normalized.match(pattern);
    if (match) entities[key] = match[1];
  });

  return {
    normalized,
    stems: normalized.split(' ').map(stem).filter((token) => token.length >= 2),
    jamoText: toJamo(normalized),
    entities,
    queryType: detectQueryType(normalized),
    negative: NEGATIVE.test(normalized),
    followUp: FOLLOW_UP.test(normalized) || normalized.split(' ').length <= 2,
  };
}

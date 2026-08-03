import type { BotConfig, KnowledgeItem, SearchResult } from '../types/chatbot';
import { normalizeText } from './normalizeText';
import { findKnowledgeById } from './searchKnowledge';

interface AmbiguityRule {
  pattern: RegExp;
  excludedBy?: RegExp;
  candidateIds: string[];
  prompt: string;
}

export interface AmbiguousQueryDecision {
  result: SearchResult;
  prompt: string;
}

// These rules describe missing subjects, not merely low search scores. Keeping
// them explicit makes every clarification auditable and prevents a confident
// answer from being manufactured from a weak lexical match.
const AMBIGUITY_RULES: AmbiguityRule[] = [
  { pattern: /일정.*(?:어떻게|언제|잡)/u, excludedBy: /(?:상담|예약|코칭|수업|등록|신청|변경|해지|취소)/u, candidateIds: ['hours-001', 'program-005', 'consultation-008'], prompt: '상담 가능 시간, 코칭 일정, 예약 변경 중 어느 일정을 확인하실까요?' },
  { pattern: /(?:시간.*잡|몇\s*번|얼마나\s*자주)/u, excludedBy: /(?:상담|문의|답변|코칭|코치|세션)/u, candidateIds: ['hours-001', 'program-005', 'consultation-008'], prompt: '상담 가능한 시간, 코칭 횟수, 예약 변경 중 어떤 내용을 확인하실까요?' },
  { pattern: /(?:그건|그거|이건)?.*(?:나중|중간).*(?:바꿔|바꿀|바꾸|변경|취소)/u, excludedBy: /(?:상담|예약|코치|수업|코칭|등록|환불)/u, candidateIds: ['policy-004', 'consultation-008', 'program-008'], prompt: '코칭 방식, 상담 일정, 코치 중 무엇을 변경하려는지 알려 주세요.' },
  { pattern: /(?:미리|뭘|무엇|뭐).*(?:챙|준비)|(?:챙|준비).*(?:뭐|무엇)/u, excludedBy: /(?:상담|성적표|정보|서류)/u, candidateIds: ['consultation-003', 'privacy-001'], prompt: '상담 준비 내용과 보내도 되는 개인정보 중 어느 쪽이 궁금하신가요?' },
  { pattern: /(?:직접|방문).*(?:가야|가도|필요)/u, excludedBy: /(?:상담|센터|코칭|오프라인)/u, candidateIds: ['location-001', 'consultation-007'], prompt: '센터 위치와 방문·비대면 상담 방식 중 어느 쪽을 확인하실까요?' },
  { pattern: /(?:(?:우리|저희)\s*(?:경우|상황)|이런\s*경우).*(?:가능|맞|될)/u, excludedBy: /(?:중학생|고등학생|학년|과목|온라인|비대면)/u, candidateIds: ['consultation-002', 'fit-001'], prompt: '학생의 학년과 가장 큰 학습 고민을 알려 주시면 관련 안내를 좁혀볼게요.' },
  { pattern: /(?:선생님|코치).*(?:결정|정해|배정)/u, candidateIds: ['program-008', 'program-001'], prompt: '코치 배정 기준과 배정 후 변경 가능 여부 중 어느 쪽이 궁금하신가요?' },
  { pattern: /(?:(?:비용|돈|금액).*(?:추가|따로)|따로.*(?:비용|돈|금액))/u, excludedBy: /(?:상담|수업|코칭|결제)/u, candidateIds: ['policy-001', 'pricing-003'], prompt: '전체 코칭 비용과 별도 상담 비용 중 어느 쪽을 확인하실까요?' },
  { pattern: /(?:그\s*다음|다음).*(?:절차|단계|뭐|무엇)/u, excludedBy: /(?:상담|신청|등록|접수)/u, candidateIds: ['consultation-004', 'program-001'], prompt: '상담 신청 뒤 절차와 코칭 진행 순서 중 어느 쪽이 궁금하신가요?' },
  { pattern: /온라인.*(?:되|가능)/u, excludedBy: /(?:상담|코칭|수업|세션)/u, candidateIds: ['program-007', 'consultation-007'], prompt: '온라인 코칭과 비대면 상담 중 어느 쪽을 말씀하신 건가요?' },
  { pattern: /(?:중간|나중).*(?:취소|그만)/u, excludedBy: /(?:상담|예약|코칭|등록|환불)/u, candidateIds: ['consultation-008', 'policy-002', 'policy-005'], prompt: '상담 예약 취소와 등록 후 중단·환불 중 어느 쪽이 궁금하신가요?' },
  { pattern: /결과.*(?:어떻게|확인|알)/u, excludedBy: /(?:학습|피드백|진단|성적표|모의고사)/u, candidateIds: ['program-003', 'program-006'], prompt: '초기 진단 결과와 코칭 후 학습 피드백 중 어느 쪽을 확인하실까요?' },
  { pattern: /(?:몇\s*번|횟수)/u, excludedBy: /(?:상담|문의|코칭|세션|주|하루)/u, candidateIds: ['program-005', 'hours-001'], prompt: '코칭 진행 횟수와 상담 응답 시간 중 어느 쪽이 궁금하신가요?' },
  { pattern: /(?:(?:둘|두\s*개|두\s*가지).*(?:차이|다른)|뭐가.*다른)/u, excludedBy: /(?:학원|과외|코칭)/u, candidateIds: ['intro-002', 'intro-003'], prompt: '학원과의 차이, 과외와의 차이 중 무엇을 비교하고 싶으신가요?' },
  { pattern: /(?:하나|한\s*개).*(?:만|선택).*(?:되|가능)/u, excludedBy: /(?:과목|수학|영어)/u, candidateIds: ['fit-006', 'fit-007', 'program-002'], prompt: '한 과목만 코칭받는 경우인지, 대상 과목 범위를 묻는 것인지 알려 주세요.' },
  { pattern: /(?:처음|초기).*(?:진단).*(?:받|하)/u, excludedBy: /(?:상담|체험|비용)/u, candidateIds: ['program-003', 'pricing-005'], prompt: '첫 상담에서 확인하는 내용과 별도 사전 진단 프로그램 중 어느 쪽이 궁금하신가요?' },
  { pattern: /(?:누구|어디).*(?:물어|문의)/u, excludedBy: /(?:카카오|상담|개인정보|기록)/u, candidateIds: ['consultation-001', 'privacy-005'], prompt: '상담 신청 채널과 상담 기록 담당 범위 중 어느 쪽을 확인하실까요?' },
  { pattern: /(?:시작.*(?:언제|가능)|언제.*시작)/u, excludedBy: /(?:등록|신청|상담|코칭)/u, candidateIds: ['policy-003', 'consultation-004'], prompt: '등록 확정 시점과 상담 신청 후 절차 중 어느 쪽이 궁금하신가요?' },
  { pattern: /(?:그|이).*(?:자료|정보).*(?:보내|필요)/u, candidateIds: ['privacy-001', 'privacy-002'], prompt: '기본 상담 정보와 성적표·모의고사 자료 중 무엇을 말씀하신 건가요?' },
  { pattern: /(?:첫\s*(?:단계|순서).*(?:뭐|무엇|하)|처음(?:에는|엔)?\s*(?:뭘|무엇을|뭐를)\s*(?:하|해))/u, excludedBy: /(?:상담|코칭|신청)/u, candidateIds: ['program-003', 'consultation-004'], prompt: '첫 상담 내용과 상담 신청 뒤 첫 절차 중 어느 쪽이 궁금하신가요?' },
  { pattern: /어떤\s*방식.*(?:하|진행)/u, excludedBy: /(?:상담|코칭|온라인|비대면|방문)/u, candidateIds: ['program-001', 'consultation-007'], prompt: '코칭 진행 방식과 방문·비대면 상담 방식 중 어느 쪽이 궁금하신가요?' },
];

function candidates(config: BotConfig, ids: string[]): KnowledgeItem[] {
  return ids.map((id) => findKnowledgeById(config, id)).filter((item): item is KnowledgeItem => Boolean(item));
}

export function detectAmbiguousQuery(query: string, config: BotConfig): AmbiguousQueryDecision | undefined {
  const normalized = normalizeText(query);
  const rule = AMBIGUITY_RULES.find((entry) => entry.pattern.test(normalized) && !entry.excludedBy?.test(normalized));
  if (!rule) return undefined;
  const suggestions = candidates(config, rule.candidateIds);
  if (suggestions.length < 2) return undefined;
  return {
    prompt: rule.prompt,
    result: {
      status: 'suggestions',
      confidence: 'medium',
      score: 0,
      suggestions,
      alternatives: [],
      matchedFields: ['intent'],
      scoreMargin: 0,
      decisionReason: 'ambiguous',
    },
  };
}

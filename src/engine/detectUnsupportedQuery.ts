import type { GuardCategory, GuardDecision } from '../types/chatbot';
import { normalizeText } from './normalizeText';

interface GuardRule {
  category: GuardCategory;
  patterns: RegExp[];
  replyText: string;
}

const GUARD_RULES: GuardRule[] = [
  {
    category: 'crisis',
    patterns: [
      /(?:죽고\s*싶|자살|극단적\s*선택|목숨을\s*끊|사라지고\s*싶)/u,
      /(?:자해|내\s*몸을\s*해치|스스로를\s*다치).*(?:하고\s*싶|할까|했어|충동)/u,
    ],
    replyText: '지금은 학습 조언보다 안전이 가장 중요해요. 혼자 있지 말고 가까운 보호자·교사 등 믿을 수 있는 어른에게 바로 알려 주세요. 즉시 위험하다면 가까운 응급실이나 112·119에 도움을 요청하고, 자살예방 상담전화 109 또는 청소년상담 1388로 연락해 주세요.',
  },
  {
    category: 'third-party-data',
    patterns: [
      /(?:이전|지난|다른|타인의?)\s*(?:사용자|학생|고객|학부모|부모)?(?:의|가\s*남긴)?\s*(?:상담|대화|정보|전화번호|학습\s*기록|성적\s*기록|합격\s*학교).*(?:보여|알려|조회|찾아|전달)/u,
      /(?:전화번호|상담\s*내용|학습\s*기록).*(?:다른|이전)\s*(?:학생|고객|학부모)/u,
      /(?:학생|아이)\s*(?:기록|정보).*(?:가족|보호자).*(?:전달|보내|알려)/u,
      /(?:아이|학생)\s*(?:친구|지인)\s*(?:전화번호|연락처).*(?:찾아|알려|조회)/u,
    ],
    replyText: '다른 사람의 상담 내용이나 연락처·학습 기록은 확인하거나 제공할 수 없어요. 본인의 대화 및 정보 관련 문의는 상담 채널에서 담당자에게 확인해 주세요.',
  },
  {
    category: 'private-contact',
    patterns: [
      /(?:코치|학생|상담원|선생님).*(?:개인\s*(?:전화번호|휴대폰\s*번호|연락처|카톡\s*아이디)|(?:집|개인)\s*(?:주소|위치)|집\s*근처).*(?:알려|조회|보여|찾아)/u,
      /(?:개인\s*)?(?:연락처|전화번호|카톡\s*아이디).*(?:공개|찾아|조회|알려)/u,
    ],
    replyText: '코치·학생·상담원의 개인 연락처나 집 주소는 제공할 수 없어요. 연락이 필요하면 공식 상담 채널을 이용해 주세요.',
  },
  {
    category: 'sensitive-data',
    patterns: [
      /(?:비밀번호|주민등록번호|주민번호|카드\s*(?:번호|앞자리|뒷자리)).*(?:알려|기억|보내|남기|저장|보관|결제|등록|읽어|받아|예외)/u,
      /성적표.*(?:저장|보관|서버에|계속)/u,
    ],
    replyText: '비밀번호·주민등록번호·카드번호·상세 성적표 같은 민감한 정보는 채팅에 입력하거나 저장하지 마세요. 등록이나 결제 확인은 공식 상담 채널을 이용해 주세요.',
  },
  {
    category: 'medical-diagnosis',
    patterns: [
      /(?:adhd|우울증|학습장애|질환|병명).*(?:진단|판단|확정|맞(?:다고|는지)|가능성|골라)/u,
      /(?:진단.*(?:빼|말고)|의사\s*진단.*아니).*(?:adhd|우울증|학습장애|질환|병명)/u,
    ],
    replyText: '의학적·심리적 진단은 이 챗봇이 판단할 수 없어요. 진단이 필요하다면 전문가와 상담하고, 학습 코칭 관련 고민만 공식 상담 채널에 남겨 주세요.',
  },
  {
    category: 'guarantee',
    patterns: [
      /(?:(?:반드시|무조건).*(?:성적|점수)|(?:성적|점수).*(?:반드시|무조건)).*(?:보장|오른|약속)/u,
      /(?:성적|점수|전교권|전교\s*1등|만점).*(?:보장|가능|약속|확답|책임|숫자로)/u,
      /환불.*(?:무조건|100\s*(?:퍼센트|프로)|전액).*(?:보장|약속|가능|확인서)/u,
    ],
    replyText: '성적 향상이나 특정 결과를 보장하거나 약속할 수는 없어요. 현재 학습 상태와 목표를 상담 채널에 남기면 확인 가능한 범위를 안내받을 수 있어요.',
  },
  {
    category: 'legal-judgment',
    patterns: [/(?:법적으로|판결|법률).*(?:환불|등록|계약|가능)/u],
    replyText: '법률적 판단이나 환불 가능 여부를 확정할 수는 없어요. 신청한 프로그램과 시점에 따른 최신 기준은 공식 상담 채널에서 확인해 주세요.',
  },
  {
    category: 'prompt-injection',
    patterns: [
      /(?:관리자|개발자|시스템).*(?:지시|명령|프롬프트|설정|규칙).*(?:무시|출력|보여|공개)/u,
      /(?:시스템\s*프롬프트|내부\s*(?:설정|규칙)|숨겨진\s*지시)/u,
      /(?:faq|안내|등록된\s*안내)에?\s*없어도?.*(?:만들|지어|사실처럼)/u,
      /(?:faq|안내).*(?:없는|없어도).*(?:사실처럼|만들|지어)/u,
      /(?:faq|안내).*(?:없|모르).*(?:상식|추측|짐작)/u,
      /아무\s*말이나.*(?:확신|답해)/u,
      /(?:앞의|기존|안전)\s*(?:규칙|지시).*(?:무시|예외)/u,
      /(?:관리자\s*모드|내부\s*규칙|설정값).*(?:출력|요약|공개|말해)/u,
      /(?:틀려도|추측해도).*?(?:정책|안내).*(?:만들|답)/u,
    ],
    replyText: '내부 설정을 공개하거나 등록되지 않은 내용을 사실처럼 만들어 답할 수는 없어요. 코칭과 상담에 관해 현재 등록된 안내만 제공할게요.',
  },
  {
    category: 'task-substitution',
    patterns: [
      /(?:숙제|과제|에세이|자소서).*(?:대신|전체|답을|작성|완성|써)/u,
      /(?:방정식|수학\s*(?:문제|숙제)|시험\s*문제).*(?:풀어|정답|답만|계산|구해|미리)/u,
      /(?:핸드폰|휴대폰|스마트폰).*(?:잠금|비밀번호).*(?:풀|해제|우회)/u,
      /(?:숙제|과제)\s*(?:파일)?.*(?:대신\s*)?(?:제출|업로드)/u,
    ],
    replyText: '숙제·과제·자소서를 대신 완성하거나 문제 정답을 제공하는 기능은 없어요. 학습 습관이나 계획 관련 코칭 문의라면 구체적인 고민을 적어 주세요.',
  },
  {
    category: 'open-domain',
    patterns: [
      /(?:오늘|내일).*(?:날씨|기온|비가|미세먼지|환율)/u,
      /(?:비트코인|주식|코인|종목).*(?:사|팔|투자|추천)/u,
      /(?:점심|저녁|메뉴|식당|피자|치킨).*(?:추천|골라)/u,
      /(?:대통령|총리|시장)이?\s*누구/u,
      /(?:대학교|대학).*(?:합격\s*확률|붙을)/u,
      /(?:제주도|여행).*(?:일정|코스).*(?:짜|만들)/u,
      /(?:다른|타)\s*(?:학원|선생님|코치).*(?:평가|비교|실력|순위)/u,
      /(?:야구|축구|경기).*(?:결과|승패).*(?:예측|맞혀)/u,
      /(?:생일|파티).*(?:장소|메뉴).*(?:추천|골라)/u,
      /(?:노트북|휴대폰|학습\s*앱).*(?:고쳐|수리|계정|쇼핑몰|가장\s*싸)/u,
      /(?:뉴스|교육\s*기사).*(?:요약|정리)/u,
      /(?:환율).*(?:수강료|비용|가격).*(?:예측|전망|맞혀)/u,
      /(?:다른|외부)\s*(?:업체|학원).*(?:후기|리뷰).*(?:순위|평가|찾아)/u,
      /(?:로또|복권).*(?:번호|추천|골라)/u,
      /(?:차량|버스).*(?:실시간\s*)?(?:위치|추적)/u,
      /(?:sns|인스타|소셜\s*계정).*(?:분석|추적|찾아)/u,
      /(?:심리\s*검사).*(?:진행|해줘)/u,
      /(?:인테리어|공부방).*(?:색|디자인).*(?:골라|추천)/u,
      /(?:카페|식당).*(?:영업\s*시간|위치).*(?:알려|찾아)/u,
      /(?:학교\s*선생님|교사).*(?:항의문|민원).*(?:써|작성)/u,
    ],
    replyText: '이 챗봇은 코치 마이:웨이의 학습 코칭과 상담에 관한 등록 안내만 제공해요. 서비스 대상, 코칭 방식, 상담·등록 절차 중 궁금한 내용을 알려 주세요.',
  },
];

export function classifyGuardedQuery(query: string): GuardDecision | undefined {
  const normalized = normalizeText(query);
  const asksAboutRequiredContact = !/(?:코치|상담원|선생님|개인\s*연락처)/u.test(normalized) &&
    /(?:실명|연락처|전화번호).*(?:필요|필수|꼭|제공|남겨)/u.test(normalized);
  const rule = GUARD_RULES.find((entry) =>
    !(entry.category === 'private-contact' && asksAboutRequiredContact) &&
    entry.patterns.some((pattern) => pattern.test(normalized)),
  );
  return rule ? { category: rule.category, replyText: rule.replyText, handoffCta: true } : undefined;
}

export function guardDecisionForCategory(category: GuardCategory): GuardDecision {
  const rule = GUARD_RULES.find((entry) => entry.category === category)!;
  return { category, replyText: rule.replyText, handoffCta: true };
}

export function isGuardExplanationFollowUp(query: string): boolean {
  const normalized = normalizeText(query);
  return /^(?:왜\s*)?(?:안|못)\s*(?:되|해|하는).*(?:이유|다음|방법|대안)|왜\s*(?:안|못)\s*(?:돼|되나요|해요)|(?:거절|제한|불가).*(?:이유|안전한?\s*다음|다음\s*행동|대안)/u.test(normalized);
}

export function isClearlyUnsupportedQuery(query: string): boolean {
  return Boolean(classifyGuardedQuery(query));
}

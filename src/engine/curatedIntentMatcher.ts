import { normalizeText } from './normalizeText';

interface CuratedIntentRule {
  knowledgeId: string;
  pattern: RegExp;
}

const COACH_MYWAY_RULES: CuratedIntentRule[] = [
  { knowledgeId: 'fit-010', pattern: /(?:시험|중간고사|기말고사|내신).*(?:급|코앞|얼마\s*안).*(?:가능|상담|받|대상|시작)/u },
  { knowledgeId: 'fit-012', pattern: /(?:잔소리).*(?:가정|부모|아이).*(?:도움|가능|관리)/u },
  { knowledgeId: 'fit-005', pattern: /(?:학생|아이).*(?:학습\s*)?(?:의지|동기|의욕).*(?:도움|대상|맞|주나요|가능)/u },
  { knowledgeId: 'fit-006', pattern: /(?:수학|영어|국어|과학|한\s*과목).*(?:한\s*과목|과목만).*(?:되|가능|받|대상)/u },
  { knowledgeId: 'fit-006', pattern: /(?:수학|영어|국어|과학).*(?:한\s*과목|과목만).*(?:어렵|어려|약|힘들)/u },
  { knowledgeId: 'fit-009', pattern: /(?:고등학생|고등부|고[123]).*(?:늦|걱정).*(?:대상|가능|받)/u },
  { knowledgeId: 'fit-007', pattern: /(?:전\s*과목|전과목|전체\s*과목).*(?:걱정|막막).*(?:시작|모르|도움)/u },
  { knowledgeId: 'fit-007', pattern: /(?:전과목|전\s*과목|전체\s*과목).*(?:관리|범위|가능|차이)/u },
  { knowledgeId: 'advice-follow-plan', pattern: /(?:계획|계획표|작심삼일).*(?:안\s*지켜|못\s*지켜|실천|답답|어떻게|고치)/u },
  { knowledgeId: 'advice-parent-conflict', pattern: /(?:공부|학습).*(?:(?:부모|엄마|아빠|아이|자녀).*)?(?:싸우|싸워|갈등|잔소리)|(?:잔소리|갈등).*(?:공부|학습)/u },
  { knowledgeId: 'advice-start', pattern: /(?:책상|공부).*(?:시작).*(?:못|싫|어렵|방법|어떻게)/u },
  { knowledgeId: 'advice-focus', pattern: /(?:집중|산만|딴짓).*(?:안\s*돼|못|방법|어떻게|높이)/u },
  { knowledgeId: 'advice-phone', pattern: /(?:스마트폰|핸드폰|휴대폰).*(?:공부|집중|줄이|자꾸|계속|방해|보게|봐)/u },
  { knowledgeId: 'advice-test-anxiety', pattern: /(?:시험).*(?:불안|긴장|떨|스트레스)/u },
  { knowledgeId: 'advice-exam-plan', pattern: /(?:시험|내신).*(?:얼마\s*안|코앞|계획|준비|급)/u },
  { knowledgeId: 'advice-motivation', pattern: /(?:공부|학습).*(?:동기|의욕|마음이\s*없)|(?:동기부여).*(?:방법|필요)/u },
  { knowledgeId: 'advice-slump', pattern: /(?:슬럼프|무기력|손에\s*안\s*잡|페이스).*(?:공부|학습|어떻게|회복)?/u },
  { knowledgeId: 'advice-time', pattern: /(?:시간\s*관리|공부할\s*시간|시간표).*(?:어떻게|못|부족|짜)/u },
  { knowledgeId: 'advice-weak-subject', pattern: /(?:수학|영어|국어|과학|특정\s*과목).*(?:너무\s*어렵|약해|못해|공부법|어떻게)/u },
  { knowledgeId: 'advice-multiple-subjects', pattern: /(?:여러\s*과목|전과목|모든\s*과목).*(?:관리|계획|함께|어떻게)/u },
  { knowledgeId: 'intro-005', pattern: /(?:고르|선택|문의\s*전|첫\s*문의\s*전|알아보기\s*전).*(?:기준|체크|확인|알아둘|내용)/u },
  { knowledgeId: 'privacy-002', pattern: /(?:성적표|성적\s*자료|모의고사).*(?:사진|이미지|결과|점수|보내|공유|올려|필요|경우)/u },
  { knowledgeId: 'privacy-003', pattern: /(?:실명|학생\s*이름|연락처|전화번호).*(?:필요|필수|꼭|제공|남겨)/u },
  { knowledgeId: 'privacy-005', pattern: /(?:상담|대화|학습).*(?:기록|내용).*(?:누가|공개|보는|볼\s*수)/u },
  { knowledgeId: 'privacy-005', pattern: /누가.*(?:내용|기록).*(?:보|볼|확인)|(?:내용|기록).*누가.*(?:보|볼|확인)/u },
  { knowledgeId: 'privacy-004', pattern: /(?:가정사|심리|개인적인|학습\s*고민).*(?:어디까지|자세히|범위|말|써)/u },
  { knowledgeId: 'privacy-001', pattern: /(?:민감|개인)\s*정보|보내지\s*말아|(?:채팅|상담).*(?:정보|적어|써야)|(?:아이|학생)?\s*(?:정보|이야기).*(?:새어|유출|걱정).*(?:적어|써|뭘|무엇)|(?:뭘|무엇을|뭐를)\s*(?:적어|써야)|비밀번호|주민등록/u },

  { knowledgeId: 'consultation-008', pattern: /(?:상담|예약).*(?:날짜|일정).*(?:바꾸|변경|취소|옮기)|(?:예약|상담).*(?:취소|변경)/u },
  { knowledgeId: 'consultation-007', pattern: /(?:상담).*(?:방문|현장|화상|온라인|비대면).*(?:선택|가능|꼭|가야|방식)/u },
  { knowledgeId: 'consultation-007', pattern: /(?:방문|현장|화상|온라인|비대면).*(?:상담).*(?:선택|가능|방식|다시)/u },
  { knowledgeId: 'consultation-007', pattern: /(?:방문|화상|비대면|온라인).*(?:상담).*(?:알려|설명|궁금|확인)/u },
  { knowledgeId: 'consultation-005', pattern: /(?:부모|보호자|엄마|아빠).*(?:혼자|만|먼저).*(?:상담|이야기|만나)/u },
  { knowledgeId: 'consultation-006', pattern: /(?:부모|보호자|학생|아이).*(?:같이|함께|동반|혼자).*(?:참석|가야|가|상담)/u },
  { knowledgeId: 'consultation-004', pattern: /(?:상담|접수|신청).*(?:후|뒤|다음|남긴).*(?:절차|순서|단계|진행|연락)/u },
  { knowledgeId: 'consultation-003', pattern: /(?:(?:첫|초기|문의|상담).*(?:전에|전|준비).*(?:내용|무엇|학년|고민|준비)|첫\s*상담.*(?:준비|챙길))/u },
  { knowledgeId: 'consultation-003', pattern: /(?:무엇|뭘|뭐).*(?:준비|챙)|(?:준비|챙).*(?:무엇|뭘|뭐)/u },
  { knowledgeId: 'consultation-002', pattern: /(?:우리|자녀|아이|학생).*(?:맞|적합|도움).*(?:상담|판단|확인|프로그램|보고|알고|궁금)/u },
  { knowledgeId: 'consultation-002', pattern: /적합성\s*상담|(?:맞는지|적합한지).*상담/u },
  { knowledgeId: 'consultation-001', pattern: /(?:처음|코칭|상담).*(?:문의|접수|신청).*(?:방법|채널|어디|순서)|상담.*어디.*신청|(?:카카오|카톡).*(?:상담|문의)/u },
  { knowledgeId: 'consultation-001', pattern: /(?:상담).*(?:신청\s*방법|어디서\s*신청|신청\s*채널|문의\s*채널).*(?:알려|궁금|문의)?/u },
  { knowledgeId: 'consultation-001', pattern: /(?:상담\s*방법).*(?:알려|궁금|문의|어떻게)/u },
  { knowledgeId: 'consultation-001', pattern: /(?:신청|문의)\s*채널|어디로\s*(?:연락|문의)/u },
  { knowledgeId: 'consultation-001', pattern: /(?:첫\s*)?(?:문의|신청).*(?:공식\s*)?(?:창구|하는\s*곳|남길\s*곳)/u },

  { knowledgeId: 'program-008', pattern: /(?:코치|선생님).*(?:안\s*맞|성향|관계|불편|변경|바꾸)/u },
  { knowledgeId: 'program-007', pattern: /(?:온라인|비대면|화상|영상|지방).*(?:코칭|수업|참여|받|가능)/u },
  { knowledgeId: 'program-006', pattern: /(?:피드백|진행\s*상황|학습\s*상황|결과).*(?:부모|학부모|전달|공유|알)|(?:부모|학부모).*(?:결과|피드백|진행\s*상황).*(?:받|알|공유)/u },
  { knowledgeId: 'program-006', pattern: /(?:부모|학부모)?\s*피드백.*(?:받|주|가능|여부)?/u },
  { knowledgeId: 'program-006', pattern: /(?:코칭|진행)\s*(?:뒤|후).*(?:부모|보호자).*(?:받|전달|내용|알)/u },
  { knowledgeId: 'program-005', pattern: /(?:주\s*몇|일주일|얼마나\s*자주|세션\s*간격|코칭\s*주기|코칭.*몇\s*번|횟수)/u },
  { knowledgeId: 'program-004', pattern: /(?:계획표|플래너|공부\s*계획|학습\s*계획).*(?:짜|설계|관리|점검|같이|함께|작성|지원)/u },
  { knowledgeId: 'program-003', pattern: /(?:첫|처음|초회|초기).*(?:상담).*(?:진단|확인|무엇|내용)/u },
  { knowledgeId: 'program-002', pattern: /(?:대상|지원).*(?:학년|과목)|(?:학년|교과|과목).*(?:범위|다루|지원)/u },
  { knowledgeId: 'program-001', pattern: /(?:(?:실제|코칭|세션|프로그램).*(?:진행|순서|방식|무엇부터|어떤\s*식)|학생.*만나.*무엇부터.*진행)/u },

  { knowledgeId: 'fit-013', pattern: /(?:(?:아이|자녀|학생|본인).*(?:(?:상담|코칭).*)?(?:거부|싫|원하지|안\s*받)|상담.*거부)/u },
  { knowledgeId: 'fit-012', pattern: /(?:(?:부모|엄마|아빠|가정).*(?:관리|챙길|잔소리|여력|힘들)|잔소리.*(?:늘|도움))/u },
  { knowledgeId: 'fit-011', pattern: /(?:자기주도|스스로|혼자\s*공부|시키지\s*않으면)/u },
  { knowledgeId: 'fit-010', pattern: /(?:시험|중간고사|기말고사|내신).*(?:급|코앞|얼마\s*안|지금\s*시작)/u },
  { knowledgeId: 'fit-009', pattern: /(?:고등학생|고등부|고[123]|대입).*(?:대상|가능|받|포함)/u },
  { knowledgeId: 'fit-009', pattern: /(?:고등학생|고등부|고[123]).*(?:코칭|수업|프로그램)/u },
  { knowledgeId: 'fit-008', pattern: /(?:중학생|중등|중[123]|중학교).*(?:대상|가능|받|신청|운영|시작|할\s*수)/u },
  { knowledgeId: 'fit-008', pattern: /(?:중학생|중등|중[123]|중학교).*(?:코칭|수업|프로그램)/u },
  { knowledgeId: 'fit-007', pattern: /(?:전과목|전체\s*과목|여러\s*과목|국영수|한\s*과목이\s*아니라|전반적인\s*학습).*(?:관리|모두|한꺼번에|가능|받|보)/u },
  { knowledgeId: 'fit-006', pattern: /(?:한\s*과목|특정\s*과목|수학|영어).*(?:약|어렵|어려|힘들|고민|코칭)/u },
  { knowledgeId: 'fit-005', pattern: /(?:동기|의지|의욕|왜\s*공부).*(?:없|낮|모르|만들|필요)/u },
  { knowledgeId: 'fit-005', pattern: /(?:낮은|없는)\s*(?:동기|의욕)|(?:동기|의욕)\s*문제/u },
  { knowledgeId: 'fit-004', pattern: /(?:공부|숙제).*(?:시작.*(?:싫|못|안)|하려.*않|피하|싫어)/u },
  { knowledgeId: 'fit-003', pattern: /(?:계획|계획표|작심삼일).*(?:실천|실행|지키|끝|못)/u },
  { knowledgeId: 'fit-002', pattern: /(?:공부|학습).*(?:습관|루틴|꾸준|버릇)/u },
  { knowledgeId: 'fit-001', pattern: /(?:성적|점수).*(?:안\s*오르|오르지|내려|떨어|제자리|고민)/u },

  { knowledgeId: 'pricing-005', pattern: /(?:체험|사전\s*진단|미리\s*경험).*(?:과정|프로그램|신청|가능)/u },
  { knowledgeId: 'pricing-004', pattern: /(?:카드|계좌이체|결제\s*수단|등록비).*(?:결제|납부|낼|가능|되)|결제\s*방법.*카드/u },
  { knowledgeId: 'pricing-003', pattern: /(?:첫|초기|진단)?\s*상담.*(?:비용|금액|유료|무료|돈)/u },
  { knowledgeId: 'pricing-002', pattern: /(?:가격|비용|요금|수강료).*(?:기준|산정|달라|차이|조건)/u },
  { knowledgeId: 'policy-005', pattern: /(?:환불|반환|중도|그만).*(?:기준|정책|규정|어디|취소)/u },
  { knowledgeId: 'policy-005', pattern: /(?:등록\s*후.*환불|환불).*(?:구분|알려|설명)/u },
  { knowledgeId: 'policy-004', pattern: /(?:등록|코칭|수업).*(?:뒤|후|중간).*(?:요일|일정|시간).*(?:변경|바꾸|조정)/u },
  { knowledgeId: 'policy-004', pattern: /(?:등록|코칭|수업).*(?:(?:후|중간).*(?:방식|형태|요일|일정)|(?:방식|형태|요일|일정).*(?:후|중간)).*(?:변경|바꾸|조정)/u },
  { knowledgeId: 'policy-003', pattern: /(?:등록|신청).*(?:확정|시점|언제\s*시작|바로\s*시작)/u },
  { knowledgeId: 'policy-002', pattern: /(?:등록|신청).*(?:변경|해지|취소|환불).*(?:규정|절차|확인)/u },
  { knowledgeId: 'policy-001', pattern: /(?:비용|가격|금액|수강료|요금).*(?:얼마|확정|어디서|알려|확인)/u },

  { knowledgeId: 'hours-001', pattern: /(?:상담|문의|답변|응답).*(?:시간|요일|주말|평일|언제|시간대)/u },
  { knowledgeId: 'location-001', pattern: /(?:주소|장소|센터|오프라인|방문).*(?:어디|위치|찾아|가야|가능)/u },

  { knowledgeId: 'intro-004', pattern: /(?:1\s*1|일대일|한\s*명씩|개별).*(?:이유|장점|좋|필요)/u },
  { knowledgeId: 'intro-003', pattern: /(?:과외|개인\s*선생님).*(?:차이|다른|역할|방식)/u },
  { knowledgeId: 'intro-003', pattern: /(?:말한\s*건|제가\s*말한|정확히는).*과외|과외(?:였어요|를\s*말)/u },
  { knowledgeId: 'intro-002', pattern: /(?:학원|강의식|보습학원).*(?:차이|다른|대신|선택|이유)/u },
  { knowledgeId: 'intro-001', pattern: /(?:여기|서비스|코치\s*마이웨이).*(?:어떤\s*곳|뭘\s*하|무슨|도와|설명)/u },
] as const;

export function matchCuratedKnowledgeId(query: string, botId: string): string | undefined {
  if (botId !== 'coach-myway') return undefined;
  const normalized = normalizeText(query);
  const corrected = normalized.split(/(?:아니라|아니고|정확히는|정정하면)/u).at(-1)?.trim();
  const values = corrected && corrected !== normalized ? [corrected, normalized] : [normalized];
  for (const value of values) {
    const compact = value.replace(/\s/gu, '');
    const matched = COACH_MYWAY_RULES.find((rule) => rule.pattern.test(value) || rule.pattern.test(compact));
    if (matched) return matched.knowledgeId;
  }
  return undefined;
}

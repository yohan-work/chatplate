import type { KnowledgeItem } from '../types/chatbot';

const SOURCE = '대표 승인 FAQ 패킷 대기';
const UPDATED = '2026-07-28';

function safeAnswer(intentId: string): string {
  if (intentId === 'pricing' || intentId === 'policy') {
    return '비용과 등록 조건은 프로그램과 상담 내용에 따라 달라질 수 있어 이곳에서 확정 금액이나 가능 여부를 안내하지 않습니다. 최신 기준은 카카오 상담 채널에서 확인해 주세요.';
  }
  if (intentId === 'privacy') {
    return '학년과 학습 고민 정도만 먼저 알려 주세요. 주민등록번호, 계정 비밀번호, 상세 성적표, 건강·심리 정보 등 민감한 개인정보는 챗봇에 입력하지 마세요.';
  }
  if (intentId === 'fit') {
    return '학생마다 현재 학습 상태와 목표가 달라 이 질문만으로 적합 여부를 단정하기는 어렵습니다. 현재 가장 큰 고민이 계획, 습관, 과목, 동기 중 어느 쪽인지 알려 주시면 관련 안내를 찾아드릴게요.';
  }
  if (intentId === 'program') {
    return '코칭 방식은 학생의 목표와 현재 상태에 따라 달라질 수 있습니다. 구체적인 진행 방식과 가능한 범위는 카카오 상담에서 확인해 주세요.';
  }
  if (intentId === 'consultation') {
    return '상담 방법과 가능한 일정은 운영 상황에 따라 달라질 수 있습니다. 카카오 상담 채널에 학생의 학년과 궁금한 내용을 간단히 남겨 주세요.';
  }
  return '코치 마이:웨이의 학습 코칭은 학생의 상황을 먼저 확인한 뒤 안내합니다. 구체적인 차이와 적합성은 카카오 상담에서 확인해 주세요.';
}

function draft(
  id: string,
  categoryId: string,
  intentId: string,
  question: string,
  aliases: string[],
  keywords: string[],
  relatedIds: string[],
  negativeKeywords: string[] = [],
): KnowledgeItem {
  return {
    id,
    categoryId,
    intentId,
    question,
    aliases,
    keywords,
    negativeKeywords,
    answer: safeAnswer(intentId),
    buttons: [],
    relatedIds,
    priority: 7,
    status: 'active',
    source: SOURCE,
    lastUpdated: UPDATED,
    handoffRecommended: true,
  };
}

export const coachMywayDraftKnowledge: KnowledgeItem[] = [
  draft('intro-002', 'intro', 'intro', '코치 마이:웨이는 일반 학원과 무엇이 다른가요?', ['일반 학원이랑 차이', '학원과 뭐가 달라요', '어떤 점이 다른가요'], ['학원', '차이', '코칭'], ['intro-001', 'program-001']),
  draft('intro-003', 'intro', 'intro', '과외와 학습 코칭은 어떤 차이가 있나요?', ['과외랑 다른가요', '과외와 비교해 주세요', '개인 과외인가요'], ['과외', '코칭', '차이'], ['intro-002', 'program-001']),
  draft('intro-004', 'intro', 'intro', '왜 1:1 코칭이 필요한가요?', ['일대일로 해야 하나요', '1대1 장점', '개별 코칭이 필요한가요'], ['1:1', '개별', '코칭'], ['consultation-002', 'program-001']),
  draft('intro-005', 'intro', 'intro', '상담 전에 무엇을 확인해야 하나요?', ['상담 전 체크할 것', '선택 기준이 궁금해요', '알아볼 때 뭘 봐야 하나요'], ['상담', '확인', '선택'], ['consultation-001', 'consultation-002']),

  draft('fit-001', 'fit', 'fit', '성적이 잘 오르지 않는데 상담이 도움이 될까요?', ['성적이 안 올라요', '점수가 떨어졌어요', '성적 고민이 있어요'], ['성적', '점수', '상담'], ['consultation-002', 'program-001']),
  draft('fit-002', 'fit', 'fit', '공부 습관이 잡히지 않은 학생도 가능한가요?', ['공부 습관이 없어요', '습관부터 잡고 싶어요', '꾸준히 못 해요'], ['습관', '공부', '꾸준함'], ['consultation-002', 'program-001']),
  draft('fit-003', 'fit', 'fit', '계획은 세우지만 실천을 못하는 경우에도 도움이 되나요?', ['계획만 세우고 안 해요', '계획을 지키지 못해요', '작심삼일이에요'], ['계획', '실천', '습관'], ['consultation-002', 'program-001']),
  draft('fit-004', 'fit', 'fit', '공부를 시작하기 싫어하는 학생도 상담할 수 있나요?', ['공부를 안 하려고 해요', '시작을 못 해요', '공부가 싫대요'], ['공부', '시작', '동기'], ['consultation-002', 'consultation-001']),
  draft('fit-005', 'fit', 'fit', '학습 동기가 낮은 학생에게도 맞나요?', ['의욕이 없어요', '동기부여가 필요해요', '왜 공부해야 하는지 몰라요'], ['동기', '의욕', '학습'], ['consultation-002', 'program-001']),
  draft('fit-006', 'fit', 'fit', '특정 과목이 너무 어려운 경우에도 가능한가요?', ['수학이 너무 어려워요', '영어가 약해요', '한 과목만 고민이에요'], ['과목', '수학', '영어'], ['program-002', 'consultation-002']),
  draft('fit-007', 'fit', 'fit', '여러 과목을 모두 관리받고 싶은데 가능한가요?', ['전과목 관리', '전체 과목이 걱정돼요', '여러 과목을 보고 싶어요'], ['전과목', '관리', '과목'], ['program-002', 'program-001']),
  draft('fit-008', 'fit', 'fit', '중학생도 코칭을 받을 수 있나요?', ['중등도 가능한가요', '중2인데 가능해요', '중학생 대상인가요'], ['중학생', '중등', '학년'], ['program-002', 'consultation-002']),
  draft('fit-009', 'fit', 'fit', '고등학생도 코칭을 받을 수 있나요?', ['고등학생 대상인가요', '고3도 가능한가요', '고등부도 하나요'], ['고등학생', '고등부', '학년'], ['program-002', 'consultation-002']),
  draft('fit-010', 'fit', 'fit', '시험 준비가 급한 학생도 상담할 수 있나요?', ['시험이 얼마 안 남았어요', '급하게 준비해야 해요', '내신이 급해요'], ['시험', '내신', '긴급'], ['consultation-001', 'program-001']),
  draft('fit-011', 'fit', 'fit', '자기주도학습이 처음인 학생에게도 맞나요?', ['혼자 공부를 못 해요', '자기주도가 처음이에요', '스스로 공부하게 하고 싶어요'], ['자기주도', '혼자', '학습'], ['consultation-002', 'program-001']),
  draft('fit-012', 'fit', 'fit', '부모가 학습을 관리하기 어려운 경우에도 도움이 되나요?', ['부모가 관리하기 힘들어요', '잔소리만 하게 돼요', '학습 관리를 못 하겠어요'], ['부모', '관리', '학습'], ['consultation-002', 'program-001']),
  draft('fit-013', 'fit', 'fit', '아이가 상담을 원하지 않으면 어떻게 하나요?', ['아이가 싫어해요', '상담을 거부해요', '본인이 원하지 않아요'], ['학생', '상담', '거부'], ['consultation-001', 'consultation-002']),

  draft('program-003', 'program', 'program', '처음 상담에서는 무엇을 확인하나요?', ['초기 상담에서 뭘 하나요', '첫 상담 내용', '진단을 하나요'], ['첫 상담', '진단', '확인'], ['consultation-001', 'consultation-002']),
  draft('program-004', 'program', 'program', '학습 계획은 누가 어떻게 세우나요?', ['공부 계획을 짜주나요', '플래너를 같이 쓰나요', '계획 관리가 되나요'], ['계획', '플래너', '관리'], ['program-001', 'fit-003']),
  draft('program-005', 'program', 'program', '코칭은 얼마나 자주 진행되나요?', ['주 몇 회인가요', '코칭 주기', '매일 하나요'], ['횟수', '주기', '코칭'], ['program-001', 'hours-001']),
  draft('program-006', 'program', 'program', '학습 피드백은 학생과 학부모에게 어떻게 전달되나요?', ['부모에게 알려주나요', '피드백 방식', '학습 상황을 알 수 있나요'], ['피드백', '학부모', '소통'], ['program-001', 'consultation-001']),
  draft('program-007', 'program', 'program', '온라인 코칭도 가능한가요?', ['비대면으로 가능한가요', '온라인 수업', '화상으로 하나요'], ['온라인', '비대면', '화상'], ['location-001', 'program-001']),
  draft('program-008', 'program', 'program', '코치와 학생이 맞지 않으면 어떻게 하나요?', ['선생님과 안 맞아요', '코치 변경', '관계가 불편해요'], ['코치', '변경', '관계'], ['consultation-001', 'policy-002']),

  draft('consultation-003', 'consultation', 'consultation', '상담 전에 어떤 내용을 준비하면 되나요?', ['상담 준비물', '무엇을 알려줘야 하나요', '미리 준비할 것'], ['상담', '준비', '학년'], ['privacy-001', 'consultation-001']),
  draft('consultation-004', 'consultation', 'consultation', '상담 신청 후에는 어떤 순서로 진행되나요?', ['신청하면 다음에 뭘 하나요', '상담 절차', '진행 순서'], ['상담', '절차', '신청'], ['consultation-001', 'program-003']),
  draft('consultation-005', 'consultation', 'consultation', '학부모만 먼저 상담받을 수 있나요?', ['부모만 상담 가능', '아이 없이 상담', '학부모 상담 먼저'], ['학부모', '상담', '학생'], ['consultation-004', 'consultation-002']),
  draft('consultation-006', 'consultation', 'consultation', '학생과 부모가 함께 상담해야 하나요?', ['같이 가야 하나요', '부모 동반 상담', '학생만 가도 되나요'], ['학생', '부모', '동반'], ['consultation-005', 'consultation-004']),
  draft('consultation-007', 'consultation', 'consultation', '방문 상담과 비대면 상담 중 무엇이 가능한가요?', ['온라인 상담도 되나요', '방문해야 하나요', '상담 방식'], ['방문', '비대면', '상담'], ['location-001', 'program-007']),
  draft('consultation-008', 'consultation', 'consultation', '상담 일정 변경이나 취소는 어떻게 하나요?', ['상담 날짜를 바꾸고 싶어요', '예약 취소', '일정 변경'], ['일정', '변경', '취소'], ['hours-001', 'consultation-001']),

  draft('pricing-002', 'policy', 'pricing', '비용은 어떤 기준으로 달라지나요?', ['가격이 왜 다른가요', '비용 기준', '수강료 차이'], ['비용', '가격', '기준'], ['policy-001', 'program-001'], ['환불']),
  draft('pricing-003', 'policy', 'pricing', '상담 비용이 따로 있나요?', ['상담비가 있나요', '상담은 무료인가요', '초기 상담 비용'], ['상담비', '비용', '무료'], ['policy-001', 'consultation-001']),
  draft('pricing-004', 'policy', 'pricing', '결제 방법은 무엇인가요?', ['카드 결제 되나요', '결제 수단', '계좌이체'], ['결제', '카드', '계좌'], ['policy-001', 'policy-002']),
  draft('pricing-005', 'policy', 'pricing', '체험 또는 사전 진단 프로그램이 있나요?', ['체험 수업', '진단 프로그램', '먼저 해볼 수 있나요'], ['체험', '진단', '사전'], ['consultation-001', 'program-003']),
  draft('policy-003', 'policy', 'policy', '등록은 언제 확정되나요?', ['신청하면 바로 등록', '등록 확정 시점', '언제 시작하나요'], ['등록', '확정', '시작'], ['consultation-004', 'policy-001']),
  draft('policy-004', 'policy', 'policy', '등록 후 코칭 방식이나 일정을 바꿀 수 있나요?', ['수업 변경', '일정 바꾸기', '코칭 방식 변경'], ['등록', '변경', '일정'], ['policy-002', 'consultation-008']),
  draft('policy-005', 'policy', 'policy', '환불 기준은 어디에서 확인할 수 있나요?', ['환불 규정', '취소하면 환불', '환불 정책'], ['환불', '규정', '취소'], ['policy-002', 'consultation-001']),

  draft('privacy-002', 'privacy', 'privacy', '성적표나 모의고사 결과를 보내도 되나요?', ['성적표 보내도 돼요', '모의고사 성적 공유', '점수 알려줘야 하나요'], ['성적표', '모의고사', '개인정보'], ['privacy-001', 'consultation-003']),
  draft('privacy-003', 'privacy', 'privacy', '상담할 때 학생 이름과 연락처가 꼭 필요한가요?', ['실명으로 해야 하나요', '연락처를 줘야 하나요', '개인정보 필수인가요'], ['이름', '연락처', '개인정보'], ['privacy-001', 'consultation-001']),
  draft('privacy-004', 'privacy', 'privacy', '학습 고민을 어디까지 자세히 말해야 하나요?', ['어디까지 말해야 하나요', '상담 내용 범위', '개인적인 얘기'], ['상담', '개인정보', '고민'], ['privacy-001', 'consultation-003']),
  draft('privacy-005', 'privacy', 'privacy', '상담 내용은 누가 확인하나요?', ['상담 기록을 누가 봐요', '개인정보 보호', '내용이 공개되나요'], ['상담', '기록', '보호'], ['privacy-001', 'consultation-001']),
];

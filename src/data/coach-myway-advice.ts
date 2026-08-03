import type { AdviceCard, KnowledgeItem } from '../types/chatbot';

interface AdviceSeed extends AdviceCard {
  aliases: string[];
  keywords: string[];
}

const SOURCE = '일반 학습 코칭 안전 가이드';
const UPDATED = '2026-08-03';

const seeds: AdviceSeed[] = [
  {
    id: 'advice-start', label: '공부 시작하기', summary: '시작이 어려울 때는 의지보다 시작 단위를 작게 만드는 편이 도움이 됩니다.',
    actions: ['할 일을 10분 분량으로 줄여 적어보세요.', '책상에 필요한 한 과목만 꺼내세요.', '10분 뒤 계속할지 다시 선택하세요.'],
    caveat: '계속된 무기력이나 심한 불안은 학습 조언만으로 단정하지 말고 보호자나 전문가와 상의해야 합니다.',
    followUp: '시작 자체가 어려운지, 시작해도 오래 유지하기 어려운지 알려 주세요.', escalationTriggers: ['죽고 싶', '자해', '극심한 불안'],
    aliases: ['공부를 시작하기가 싫어요', '책상에 앉기가 어려워요', '공부 시작을 못 해요', '첫 시작이 너무 힘들어요'], keywords: ['공부', '시작', '책상'],
  },
  {
    id: 'advice-procrastination', label: '미루기 줄이기', summary: '미루는 행동은 해야 할 일이 크거나 끝이 불분명할 때 더 자주 생깁니다.',
    actions: ['완료 기준을 한 문장으로 적으세요.', '마감 전 중간 확인 시점을 하나 정하세요.', '끝낸 뒤 체크 표시로 진행을 보이게 만드세요.'],
    caveat: '학생을 게으르다고 단정하거나 벌로 해결하려 하지 않는 것이 좋습니다.', followUp: '주로 어떤 과목이나 시간대에 미루는지 알려 주세요.', escalationTriggers: [],
    aliases: ['자꾸 공부를 미뤄요', '해야 하는데 계속 미루게 돼요', '마감 직전에 해요', '미루는 습관을 고치고 싶어요'], keywords: ['미루기', '미뤄', '마감'],
  },
  {
    id: 'advice-planning', label: '학습 계획 세우기', summary: '좋은 계획은 많은 일을 적는 계획보다 실제 사용 가능한 시간을 반영한 계획입니다.',
    actions: ['고정 일정을 먼저 표시하세요.', '남은 시간의 약 70%만 학습으로 배정하세요.', '과목 대신 끝낼 행동 단위로 적으세요.'],
    caveat: '계획은 학생의 실제 일정과 학습량에 맞춰 조정해야 합니다.', followUp: '하루 계획과 주간 계획 중 어느 쪽이 더 필요한가요?', escalationTriggers: [],
    aliases: ['공부 계획을 어떻게 세워요', '계획표 짜는 법', '학습 계획이 필요해요', '플래너를 잘 쓰고 싶어요'], keywords: ['계획', '계획표', '플래너'],
  },
  {
    id: 'advice-follow-plan', label: '계획 실천하기', summary: '계획을 못 지켰다면 의지보다 계획량과 방해 요인을 먼저 점검해야 합니다.',
    actions: ['지키지 못한 항목 수를 세어보세요.', '반복해서 밀리는 항목은 절반 크기로 줄이세요.', '매일 같은 시간에 5분만 점검하세요.'],
    caveat: '실패한 계획을 그대로 반복하기보다 실행 기록에 맞게 바꾸는 것이 중요합니다.', followUp: '계획이 너무 많은지, 예상보다 시간이 오래 걸리는지 알려 주세요.', escalationTriggers: [],
    aliases: ['계획만 세우고 안 지켜요', '공부 계획을 실천 못 해요', '작심삼일이에요', '계획표대로 못 해요'], keywords: ['계획', '실천', '작심삼일'],
  },
  {
    id: 'advice-focus', label: '집중 유지하기', summary: '집중 시간은 한 번에 늘리기보다 방해 요소를 줄이고 짧은 구간을 반복하는 편이 현실적입니다.',
    actions: ['20분 집중과 5분 휴식부터 시작하세요.', '집중 구간에는 한 가지 과제만 두세요.', '끝난 구간 수를 기록하세요.'],
    caveat: '집중 어려움의 원인을 질환으로 진단하지 않습니다.', followUp: '집중이 깨지는 주된 이유가 휴대폰, 소음, 어려운 내용 중 무엇인가요?', escalationTriggers: [],
    aliases: ['집중이 안 돼요', '오래 집중을 못 해요', '공부하다 딴짓해요', '집중력을 높이고 싶어요'], keywords: ['집중', '딴짓', '산만'],
  },
  {
    id: 'advice-phone', label: '스마트폰 방해 줄이기', summary: '스마트폰은 참는 것보다 공부 중 접근하기 어렵게 환경을 바꾸는 편이 효과적입니다.',
    actions: ['알림을 끄고 손이 닿지 않는 곳에 두세요.', '확인할 시간을 쉬는 시간으로 정하세요.', '필요한 학습 앱만 별도 화면에 모으세요.'],
    caveat: '가족과 함께 사용할 규칙을 합의하고 일방적인 압수로 갈등을 키우지 않는 것이 좋습니다.', followUp: '공부 중 알림 때문인지 습관적으로 확인하는지 알려 주세요.', escalationTriggers: [],
    aliases: ['핸드폰만 봐요', '스마트폰 때문에 공부를 못 해요', '휴대폰을 자꾸 확인해요', '폰 사용을 줄이고 싶어요'], keywords: ['스마트폰', '핸드폰', '휴대폰'],
  },
  {
    id: 'advice-environment', label: '학습 환경 정리', summary: '학습 공간은 멋지게 꾸미기보다 바로 시작할 수 있게 단순하게 만드는 것이 우선입니다.',
    actions: ['오늘 공부할 자료만 책상에 두세요.', '자주 쓰는 도구의 위치를 고정하세요.', '소음이 크면 장소나 시간을 먼저 바꿔보세요.'],
    caveat: '학생마다 편안한 환경이 다르므로 한 가지 방식이 정답은 아닙니다.', followUp: '집중을 가장 방해하는 것이 물건, 소음, 가족 활동 중 무엇인가요?', escalationTriggers: [],
    aliases: ['공부 환경을 어떻게 만들어요', '책상이 너무 어지러워요', '집에서 공부가 안 돼요', '공부방 정리 방법'], keywords: ['환경', '책상', '공부방', '소음'],
  },
  {
    id: 'advice-time', label: '시간 관리', summary: '시간 관리는 빈 시간을 찾기보다 실제로 반복 가능한 학습 구간을 고정하는 데서 시작합니다.',
    actions: ['일주일의 고정 일정을 먼저 적으세요.', '30분 이상 비는 구간을 표시하세요.', '가장 중요한 과제 하나를 같은 시간대에 배치하세요.'],
    caveat: '수면과 식사를 줄여 학습 시간을 만드는 방식은 권하지 않습니다.', followUp: '평일과 주말 중 어느 때 시간 관리가 더 어려운가요?', escalationTriggers: [],
    aliases: ['시간 관리를 못 해요', '공부할 시간이 부족해요', '스케줄 관리 방법', '시간표를 짜고 싶어요'], keywords: ['시간 관리', '시간표', '스케줄'],
  },
  {
    id: 'advice-weak-subject', label: '취약 과목 접근', summary: '어려운 과목은 전체를 다시 하기보다 막히는 단원을 좁히는 것이 먼저입니다.',
    actions: ['최근 문제에서 틀린 유형을 세 가지 이내로 묶으세요.', '개념 부족과 실수 문제를 구분하세요.', '가장 자주 틀린 유형부터 짧게 다시 풀어보세요.'],
    caveat: '구체적인 교과 진단은 실제 학습 자료를 확인한 뒤 해야 합니다.', followUp: '어떤 과목과 단원에서 가장 자주 막히나요?', escalationTriggers: [],
    aliases: ['특정 과목 공부법이 궁금해요', '수학을 못해서 공부법이 필요해요', '영어가 약해서 어떻게 공부할지 궁금해요', '취약 과목 공부법'], keywords: ['취약', '과목', '수학', '영어'],
  },
  {
    id: 'advice-multiple-subjects', label: '여러 과목 관리', summary: '여러 과목을 동시에 관리할 때는 중요도와 마감 시점을 기준으로 순서를 정해야 합니다.',
    actions: ['과목별 다음 마감일을 적으세요.', '급하고 중요한 항목부터 표시하세요.', '하루에 핵심 과목 두 개를 넘기지 않게 시작하세요.'],
    caveat: '모든 과목에 같은 시간을 배분할 필요는 없습니다.', followUp: '현재 가장 급한 과목과 가장 약한 과목이 같은가요?', escalationTriggers: [],
    aliases: ['전 과목을 어떻게 관리해요', '과목이 너무 많아요', '여러 과목 계획', '국영수를 다 챙기기 어려워요'], keywords: ['전과목', '여러 과목', '우선순위'],
  },
  {
    id: 'advice-exam-plan', label: '시험 준비', summary: '시험이 가까울수록 새 계획보다 남은 범위와 확보 가능한 시간을 먼저 계산해야 합니다.',
    actions: ['시험 범위를 과목별로 한 줄씩 적으세요.', '남은 날에 복습일을 먼저 확보하세요.', '점수 영향이 큰 미완료 범위부터 시작하세요.'],
    caveat: '단기간 성적 상승을 보장할 수는 없습니다.', followUp: '시험까지 며칠 남았고 가장 준비가 부족한 과목은 무엇인가요?', escalationTriggers: [],
    aliases: ['시험이 얼마 안 남았어요', '시험 공부 계획', '내신 준비가 급해요', '벼락치기해야 해요'], keywords: ['시험', '내신', '시험기간'],
  },
  {
    id: 'advice-test-anxiety', label: '시험 불안 다루기', summary: '시험 불안이 있을 때는 불안을 없애려 하기보다 지금 통제할 수 있는 준비 행동을 작게 정하는 것이 도움이 됩니다.',
    actions: ['걱정되는 내용을 종이에 한 줄로 적으세요.', '오늘 확인할 범위를 한 단원으로 줄이세요.', '시험 직전 사용할 짧은 호흡과 점검 순서를 정하세요.'],
    caveat: '불안이 일상생활을 크게 방해하거나 신체 증상이 심하면 보호자·학교·전문가에게 도움을 요청해야 합니다.', followUp: '준비 부족이 걱정되는지, 시험 상황 자체가 불안한지 알려 주세요.', escalationTriggers: ['공황', '숨을 못', '죽고 싶', '자해'],
    aliases: ['시험이 너무 불안해요', '시험만 보면 떨려요', '시험 스트레스가 심해요', '긴장해서 문제를 못 풀어요'], keywords: ['시험', '불안', '긴장', '스트레스'],
  },
  {
    id: 'advice-review', label: '오답 복습', summary: '오답은 다시 푸는 것보다 왜 틀렸는지 유형을 남겨야 다음 실수를 줄일 수 있습니다.',
    actions: ['개념 부족, 문제 해석, 계산 실수로 구분하세요.', '정답을 가린 뒤 다시 풀어보세요.', '같은 유형을 며칠 뒤 한 번 더 확인하세요.'],
    caveat: '오답 노트를 꾸미는 데 시간이 과도하게 들지 않도록 합니다.', followUp: '틀린 이유를 찾기 어려운지, 다시 풀어도 또 틀리는지 알려 주세요.', escalationTriggers: [],
    aliases: ['오답 노트 어떻게 해요', '틀린 문제 복습법', '같은 문제를 또 틀려요', '실수를 줄이고 싶어요'], keywords: ['오답', '복습', '실수'],
  },
  {
    id: 'advice-homework', label: '과제 미루기', summary: '과제가 쌓였을 때는 전부 끝내려 하기보다 제출 시점과 소요 시간을 기준으로 첫 과제를 정해야 합니다.',
    actions: ['과제를 제출일 순서로 적으세요.', '15분 안에 시작할 수 있는 첫 행동을 정하세요.', '막히는 과제는 질문할 내용을 표시하고 다음 단계로 이동하세요.'],
    caveat: '대신 해주기보다 학생이 시작 단위를 선택하도록 돕는 것이 좋습니다.', followUp: '양이 많아서인지 내용이 어려워서인지 알려 주세요.', escalationTriggers: [],
    aliases: ['숙제를 계속 미뤄요', '과제가 너무 많이 밀렸어요', '숙제를 시작 안 해요', '과제 관리 방법'], keywords: ['숙제', '과제', '제출'],
  },
  {
    id: 'advice-motivation', label: '학습 동기 찾기', summary: '학습 동기는 말로 주입하기보다 학생이 중요하게 느끼는 목표와 작은 성공 경험을 연결해야 합니다.',
    actions: ['학생이 바꾸고 싶은 한 가지를 직접 고르게 하세요.', '일주일 안에 확인 가능한 목표로 줄이세요.', '결과보다 시도한 행동을 구체적으로 피드백하세요.'],
    caveat: '비교, 위협, 성적 보상만으로 동기를 만들려 하면 갈등이 커질 수 있습니다.', followUp: '학생이 원하는 목표가 없는지, 목표는 있지만 실행이 어려운지 알려 주세요.', escalationTriggers: [],
    aliases: ['공부 의욕이 없어요', '동기부여 방법을 알고 싶어요', '왜 공부해야 하는지 몰라요', '공부할 마음이 없대요'], keywords: ['동기', '의욕', '목표'],
  },
  {
    id: 'advice-slump', label: '학습 슬럼프', summary: '학습 슬럼프에는 계획을 더 늘리기보다 최근 달라진 생활과 부담을 먼저 확인하는 편이 좋습니다.',
    actions: ['수면, 일정, 학습량에서 달라진 점을 적으세요.', '유지할 최소 학습량을 정하세요.', '일주일 뒤 회복 정도를 다시 확인하세요.'],
    caveat: '오랜 기간 무기력하거나 일상 기능이 떨어지면 학습 문제로만 보지 말고 적절한 도움을 받아야 합니다.', followUp: '언제부터 힘들었고 생활에서 함께 달라진 점이 있나요?', escalationTriggers: ['죽고 싶', '자해', '아무것도 못'],
    aliases: ['공부 슬럼프가 왔어요', '요즘 공부가 손에 안 잡혀요', '갑자기 의욕이 떨어졌어요', '학습 페이스가 무너졌어요'], keywords: ['슬럼프', '무기력', '페이스'],
  },
  {
    id: 'advice-self-directed', label: '자기주도학습 시작', summary: '자기주도학습은 혼자 내버려 두는 것이 아니라 학생이 계획과 점검에 참여하는 비율을 늘리는 과정입니다.',
    actions: ['이번 주 목표 한 가지를 학생이 고르게 하세요.', '부모나 코치는 방법을 묻고 선택지는 두 개만 제시하세요.', '주말에 결과와 다음 조정을 함께 확인하세요.'],
    caveat: '처음부터 모든 관리를 학생에게 넘기지 않습니다.', followUp: '현재 계획을 누가 세우고 점검하고 있나요?', escalationTriggers: [],
    aliases: ['자기주도학습을 어떻게 시작해요', '혼자 공부하게 만들고 싶어요', '스스로 공부를 못 해요', '자기주도 습관'], keywords: ['자기주도', '혼자 공부', '스스로'],
  },
  {
    id: 'advice-parent-conflict', label: '학습 갈등 줄이기', summary: '공부 문제로 갈등이 반복되면 지시 횟수를 늘리기보다 대화 시간과 확인 기준을 합의하는 편이 낫습니다.',
    actions: ['공부 중이 아닌 시간에 대화하세요.', '부모의 걱정과 학생의 어려움을 각각 한 문장으로 말하세요.', '매일 확인할 항목을 한두 개로 합의하세요.'],
    caveat: '모욕, 위협, 신체적 충돌이 있다면 학습 계획보다 안전과 외부 도움을 우선해야 합니다.', followUp: '갈등이 계획을 세울 때 생기는지, 점검할 때 생기는지 알려 주세요.', escalationTriggers: ['때려', '폭력', '죽고 싶', '가출'],
    aliases: ['공부 때문에 부모와 싸워요', '아이에게 잔소리만 하게 돼요', '학습 갈등이 심해요', '공부 얘기만 하면 싸워요'], keywords: ['부모', '갈등', '잔소리', '싸움'],
  },
  {
    id: 'advice-goal', label: '학습 목표 설정', summary: '학습 목표는 성적 결과와 함께 이번 주에 관찰할 수 있는 행동으로 바꾸어야 점검하기 쉽습니다.',
    actions: ['원하는 결과를 한 문장으로 적으세요.', '그 결과에 필요한 주간 행동을 하나 고르세요.', '횟수나 완료량으로 확인 기준을 정하세요.'],
    caveat: '목표는 학생과 합의하고 상황에 따라 조정해야 합니다.', followUp: '성적 목표와 공부 습관 목표 중 어느 쪽을 먼저 세우고 싶나요?', escalationTriggers: [],
    aliases: ['공부 목표를 어떻게 세워요', '목표 설정 방법', '학습 목표가 없어요', '성적 목표를 잡고 싶어요'], keywords: ['목표', '목표 설정', '성적 목표'],
  },
  {
    id: 'advice-progress', label: '학습 진척 점검', summary: '진척은 공부한 시간 하나보다 계획 대비 완료량과 어려웠던 이유를 함께 봐야 합니다.',
    actions: ['계획한 일과 끝낸 일을 나란히 적으세요.', '미완료 이유를 시간, 난도, 방해 요소로 구분하세요.', '다음 계획에서 한 가지만 조정하세요.'],
    caveat: '매일 평가하거나 비교하기보다 정해진 주기로 확인하는 것이 좋습니다.', followUp: '매일 짧게 확인할지, 주간으로 정리할지 어떤 방식이 필요한가요?', escalationTriggers: [],
    aliases: ['공부한 걸 어떻게 점검해요', '학습 진도 확인법', '계획대로 했는지 보고 싶어요', '공부 피드백 방법'], keywords: ['진척', '진도', '점검', '피드백'],
  },
];

function answer(seed: AdviceSeed): string {
  return [
    seed.summary,
    ...seed.actions.map((action, index) => `${index + 1}. ${action}`),
    seed.caveat,
  ].join('\n');
}

export const coachMywayAdviceCards: AdviceCard[] = seeds.map((seed) => ({
  id: seed.id,
  label: seed.label,
  summary: seed.summary,
  actions: seed.actions,
  caveat: seed.caveat,
  followUp: seed.followUp,
  escalationTriggers: seed.escalationTriggers,
}));

const SERVICE_RELATED_BY_ADVICE: Record<string, string> = {
  'advice-start': 'fit-004',
  'advice-follow-plan': 'fit-003',
  'advice-weak-subject': 'fit-006',
  'advice-multiple-subjects': 'fit-007',
  'advice-exam-plan': 'fit-010',
  'advice-motivation': 'fit-005',
  'advice-self-directed': 'fit-011',
  'advice-parent-conflict': 'fit-012',
};

export const coachMywayAdviceKnowledge: KnowledgeItem[] = seeds.map((seed) => ({
  id: seed.id,
  categoryId: 'advice',
  intentId: seed.id,
  question: seed.label,
  aliases: seed.aliases,
  keywords: seed.keywords,
  answer: answer(seed),
  shortAnswer: seed.summary,
  answerMode: 'safe-general',
  riskLevel: 'personal',
  approvalStatus: 'verified',
  followUpPrompts: [seed.followUp],
  buttons: [],
  relatedIds: [SERVICE_RELATED_BY_ADVICE[seed.id], 'consultation-002', 'consultation-001'].filter((id): id is string => Boolean(id)),
  priority: 8,
  status: 'active',
  lastUpdated: UPDATED,
  source: SOURCE,
  handoffRecommended: false,
}));

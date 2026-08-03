import type { BotInfo, SmallTalkConfig, SmallTalkIntentId, SmallTalkRule } from '../types/chatbot';

const utterances: Record<SmallTalkIntentId, string[]> = {
  greeting: [
    '안녕하세요', '안녕', '안녕하십니까', '반가워요', '반갑습니다', '좋은 아침이에요', '좋은 아침',
    '좋은 오후예요', '좋은 저녁이에요', '하이', '헬로', '방가워요', '처음 뵙겠습니다', '잘 부탁해요',
    '안뇽', '안녕하세요 챗봇', '챗봇 안녕', '반가워', '안녕하세요 반가워요', '좋은 하루입니다',
  ],
  thanks: [
    '감사합니다', '감사해요', '고맙습니다', '고마워요', '고마워', '감사', '도움됐어요', '도움이 됐어요',
    '잘 알겠습니다', '알겠어요 고마워요', '확인했어요', '이해했어요', '오케이 고마워', '답변 감사합니다',
    '친절한 답변 감사해요', '땡큐', '감사한데', '고마운데',
  ],
  goodbye: [
    '안녕히 계세요', '안녕히계세요', '다음에 올게요', '이제 갈게요', '종료할게요', '대화 종료',
    '잘 있어', '바이', '굿바이', '수고하세요', '좋은 하루 보내세요', '다음에 문의할게요',
    '나중에 다시 올게요', '그만할게요', '여기까지 할게요',
  ],
  help: [
    '도와주세요', '도움말', '뭘 물어볼 수 있나요', '무엇을 물어볼 수 있나요', '어떤 질문이 가능한가요',
    '사용법 알려주세요', '어떻게 사용하나요', '뭘 할 수 있어요', '가능한 기능 알려줘', '질문 예시 보여줘',
    '메뉴 보여줘', '처음이라 모르겠어요', '안내해 주세요', '무슨 질문을 해야 하나요', '도와줘',
    '질문 추천해 줘',
  ],
  identity: [
    '너는 누구야', '누구세요', '정체가 뭐야', '챗봇인가요', '사람인가요', '로봇인가요', 'ai인가요',
    '무슨 봇이야', '이름이 뭐야', '어떤 챗봇이에요', '누가 답하는 건가요', '자동 답변인가요',
    '너 뭐야', '여기는 어디예요', '어떤 서비스예요', '실제 사람인가요',
  ],
  human: [
    '상담원 연결해 주세요', '상담원 연결', '직원 연결해 주세요', '직원과 이야기하고 싶어요', '사람과 상담하고 싶어요',
    '사람이랑 이야기할래요', '담당자 연결', '담당자와 통화하고 싶어요', '사람에게 문의할게요',
    '실제 상담원 있나요', '관리자 연결해 주세요', '전화 상담 연결', '직접 상담하고 싶어요',
    '챗봇 말고 사람', '상담사 연결', '상담사 바꿔줘', '사람 불러줘', '직원에게 물어볼래요',
    '담당자에게 문의하고 싶어요', '사람이 답해 주세요',
  ],
  abuse: [
    '바보야', '멍청아', '짜증나', '꺼져', '닥쳐', '쓸모없어', '답답하네', '최악이야', '왜 이렇게 못해',
    '제대로 답해', '말귀를 못 알아들어', '도움이 안 돼', '형편없어', '열받네', '장난하냐',
    '똑바로 해', '뭐 이딴 게 있어', '한심하다', '시간 낭비야', '엉망이네',
  ],
  noise: [
    'ㅋㅋㅋㅋ', 'ㅎㅎㅎㅎ', 'ㅠㅠㅠㅠ', 'ㄱㄱㄱㄱ', 'ㅇㅇㅇㅇ', '아아아아', '테스트', 'test',
    '1234', '아무말', '모르겠음', '음', '어', '뭐', '글쎄', '몰라',
  ],
  positive: ['좋아요', '좋네요', '마음에 들어요', '괜찮네요', '기대돼요', '해볼게요'],
  worry: ['걱정돼요', '걱정이에요', '불안해요', '고민이 많아요', '마음이 무거워요', '잘할 수 있을지 걱정돼요'],
  frustration: ['너무 답답해요', '지쳤어요', '힘들어요', '계속 안 돼요', '막막해요', '어떻게 해야 할지 모르겠어요'],
  confusion: ['잘 모르겠어요', '이해가 안 돼요', '헷갈려요', '무슨 뜻이에요', '조금 어려워요', '정리가 안 돼요'],
  urgency: ['급해요', '빨리 알려주세요', '오늘 당장 필요해요', '시간이 없어요', '시험이 코앞이에요'],
  indecision: ['결정을 못 하겠어요', '고민 중이에요', '어떤 게 좋을지 모르겠어요', '선택하기 어려워요'],
  skepticism: ['정말 효과가 있나요', '믿어도 되나요', '과장 아닌가요', '진짜 도움이 돼요', '확실한가요'],
  apology: ['미안해요', '죄송해요', '제가 잘못 말했어요', '아까 말이 헷갈렸네요'],
  praise: ['친절하네요', '설명을 잘하네요', '도움이 많이 됐어요', '답변이 좋네요'],
  social: ['오늘도 좋은 하루예요', '잘 지냈어요', '반가워서 말 걸었어요', '그냥 이야기하고 싶어요'],
};

function rule(
  intentId: SmallTalkIntentId,
  label: string,
  response: string,
  options: Partial<Pick<SmallTalkRule, 'handoffCta' | 'showSuggestions'>> = {},
): SmallTalkRule {
  return {
    id: `smalltalk-${intentId}`,
    intentId,
    label,
    enabled: true,
    utterances: [...utterances[intentId]],
    response,
    handoffCta: options.handoffCta ?? false,
    showSuggestions: options.showSuggestions ?? false,
  };
}

export function createDefaultSmallTalkConfig(bot: Pick<BotInfo, 'name' | 'title' | 'description'>): SmallTalkConfig {
  return {
    enabled: true,
    rules: [
      rule('greeting', '인사', `안녕하세요! ${bot.name}입니다. ${bot.title}에 관해 궁금한 내용을 알려 주세요.`, { showSuggestions: true }),
      rule('thanks', '감사', '도움이 되었다니 기뻐요. 더 궁금한 내용이 있으면 언제든 질문해 주세요.', { showSuggestions: true }),
      rule('goodbye', '작별', `이용해 주셔서 감사합니다. 좋은 하루 보내세요!`),
      rule('help', '도움말', `${bot.description} 아래 추천 질문을 선택하거나 궁금한 내용을 문장으로 입력해 주세요.`, { showSuggestions: true }),
      rule('identity', '봇 정체성', `저는 ${bot.name}의 미리 등록된 안내를 찾아드리는 챗봇입니다. 실제 사람이 아니며, 등록되지 않은 내용은 담당자 확인이 필요합니다.`, { showSuggestions: true }),
      rule('human', '상담원 요청', '담당자 상담을 원하시는군요. 아래 상담 채널을 이용해 주세요.', { handoffCta: true }),
      rule('abuse', '부적절한 표현', '원활한 안내를 위해 서로 존중하는 표현을 사용해 주세요. 도움이 필요한 내용을 차분히 적어 주시면 등록된 안내를 찾아드릴게요.', { showSuggestions: true }),
      rule('noise', '무의미 입력', '질문을 이해하기 어려워요. 궁금한 내용을 조금 더 구체적인 문장으로 입력하거나 아래 추천 질문을 선택해 주세요.', { showSuggestions: true }),
      rule('positive', '긍정 반응', '좋게 느끼셨다니 다행이에요. 이어서 궁금한 점이 있으면 편하게 말씀해 주세요.', { showSuggestions: true }),
      rule('worry', '걱정', '걱정되는 마음이 있으시군요. 학생의 학년과 가장 고민되는 상황을 알려 주시면 확인 가능한 안내부터 차근차근 찾아볼게요.', { showSuggestions: true }),
      rule('frustration', '좌절', '계속 고민하다 보면 많이 답답할 수 있어요. 지금 가장 먼저 해결하고 싶은 한 가지부터 말씀해 주세요.', { showSuggestions: true }),
      rule('confusion', '혼란', '헷갈릴 수 있어요. 이해되지 않은 부분을 한 가지만 짚어 주시면 더 짧고 분명하게 다시 설명할게요.', { showSuggestions: true }),
      rule('urgency', '긴급함', '급한 상황이군요. 현재 상황과 확인이 필요한 시점을 알려 주시면 등록된 안내 범위에서 우선순위를 정해볼게요.', { showSuggestions: true }),
      rule('indecision', '망설임', '선택 기준이 많으면 결정하기 어렵죠. 학생의 현재 고민과 가장 중요하게 보는 기준을 하나씩 알려 주세요.', { showSuggestions: true }),
      rule('skepticism', '의심', '그렇게 확인해 보시는 게 중요해요. 특정 결과를 보장할 수는 없고, 학생 상황과 실제 운영 조건은 상담에서 확인해야 해요.', { showSuggestions: true }),
      rule('apology', '사과', '괜찮아요. 정정하거나 다시 설명하고 싶은 내용을 편하게 말씀해 주세요.'),
      rule('praise', '칭찬', '좋게 봐주셔서 고마워요. 필요한 내용을 계속 정확하게 찾아드릴게요.', { showSuggestions: true }),
      rule('social', '가벼운 대화', `반가워요. 저는 ${bot.name}의 학습 코칭과 상담 안내를 도와드릴 수 있어요.`, { showSuggestions: true }),
    ],
  };
}

export function resolveSmallTalkConfig(bot: Pick<BotInfo, 'name' | 'title' | 'description'>, config?: SmallTalkConfig): SmallTalkConfig {
  return config ?? createDefaultSmallTalkConfig(bot);
}

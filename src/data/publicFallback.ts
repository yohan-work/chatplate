import type { BotConfig } from '../types/chatbot';

export const publicFallbackConfig: BotConfig = {
  schemaVersion: 2,
  bot: {
    id: 'coach-myway',
    name: '코치마이웨이',
    title: '상담 도우미',
    description: '등록된 안내를 불러오고 있습니다.',
    avatarUrl: '',
    greeting: '안녕하세요. 상담 안내를 불러오고 있습니다.',
    fallbackMessage: '안내를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    disclaimer: '등록된 안내를 기준으로 답변합니다.',
  },
  theme: {
    primaryColor: '#6657d9',
    position: 'bottom-right',
    homeTitle: '무엇을 도와드릴까요?',
  },
  operation: {
    botHours: '24시간',
    csHours: '운영시간 내 순차 답변',
  },
  notices: [],
  contactChannels: [],
  categories: [],
  quickReplies: [],
  knowledge: [],
};

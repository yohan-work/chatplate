export type WidgetView = 'home' | 'chat' | 'conversations' | 'settings' | 'notice';

export type AdminPanelView = 'bot' | 'operation' | 'notices' | 'knowledge' | 'quickReplies' | 'logs';

export type ButtonType = 'url' | 'action' | 'tel' | 'mailto';

export interface AnswerButton {
  label: string;
  type: ButtonType;
  value: string;
}

export interface BotInfo {
  id: string;
  name: string;
  title: string;
  description: string;
  avatarUrl: string;
  greeting: string;
  fallbackMessage: string;
  disclaimer: string;
}

export interface ThemeConfig {
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  homeTitle: string;
}

export interface OperationInfo {
  botHours: string;
  csHours: string;
}

export interface Notice {
  id: string;
  title: string;
  summary: string;
  content: string;
  createdAt: string;
  unread: boolean;
  imageUrl: string;
  buttons: AnswerButton[];
}

export interface ContactChannel {
  id: string;
  label: string;
  type: ButtonType;
  value: string;
  icon: 'kakao' | 'naver' | 'phone' | 'email' | 'map' | 'more';
}

export interface Category {
  id: string;
  name: string;
}

export interface QuickReply {
  label: string;
  knowledgeId: string;
}

export interface KnowledgeItem {
  id: string;
  categoryId: string;
  question: string;
  keywords: string[];
  aliases: string[];
  answer: string;
  buttons: AnswerButton[];
  relatedIds: string[];
  priority: number;
}

export interface BotConfig {
  bot: BotInfo;
  theme: ThemeConfig;
  operation: OperationInfo;
  notices: Notice[];
  contactChannels: ContactChannel[];
  categories: Category[];
  quickReplies: QuickReply[];
  knowledge: KnowledgeItem[];
}

export type BotConfigMap = Record<string, BotConfig>;

export interface ChatMessage {
  id: string;
  role: 'bot' | 'user' | 'system';
  text: string;
  createdAt: string;
  buttons?: AnswerButton[];
  suggestions?: KnowledgeItem[];
}

export interface SearchResult {
  status: 'answer' | 'suggestions' | 'fallback';
  score: number;
  item?: KnowledgeItem;
  suggestions: KnowledgeItem[];
}

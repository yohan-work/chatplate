export type WidgetView = 'home' | 'chat' | 'conversations' | 'settings' | 'notice';

export type AdminPanelView = 'bot' | 'operation' | 'notices' | 'knowledge' | 'quickReplies' | 'quality' | 'logs';

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
  tags?: string[];
  negativeKeywords?: string[];
  answer: string;
  buttons: AnswerButton[];
  relatedIds: string[];
  priority: number;
  status?: 'active' | 'draft' | 'archived';
  lastUpdated?: string;
  source?: string;
  handoffRecommended?: boolean;
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
  relatedQuestions?: KnowledgeItem[];
  confidence?: SearchConfidence;
  matchedKnowledgeIds?: string[];
  feedback?: 'helpful' | 'not-helpful';
}

export type SearchConfidence = 'high' | 'medium' | 'low';

export type MatchedField = 'question' | 'alias' | 'keyword' | 'tag';

export interface SearchScoreBreakdown {
  exact: number;
  alias: number;
  keyword: number;
  tag: number;
  token: number;
  typo: number;
  priority: number;
  penalty: number;
}

export interface SearchResult {
  status: 'answer' | 'suggestions' | 'fallback';
  confidence: SearchConfidence;
  score: number;
  item?: KnowledgeItem;
  items?: KnowledgeItem[];
  suggestions: KnowledgeItem[];
  alternatives: KnowledgeItem[];
  matchedFields: MatchedField[];
  debugScore?: SearchScoreBreakdown;
}

export interface ConversationEvent {
  id: string;
  botId: string;
  query: string;
  status: SearchResult['status'];
  confidence: SearchConfidence;
  matchedKnowledgeIds: string[];
  feedback?: 'helpful' | 'not-helpful';
  createdAt: string;
}

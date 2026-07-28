export type WidgetView = 'home' | 'chat' | 'conversations' | 'settings' | 'notice';

export type AdminPanelView = 'bot' | 'operation' | 'notices' | 'knowledge' | 'quickReplies' | 'smallTalk' | 'quality' | 'tickets' | 'data' | 'logs';

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

export interface HandoffConfig {
  channelId: string;
  label: string;
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

export interface CustomerJourney {
  id: string;
  title: string;
  description: string;
  knowledgeIds: string[];
  intentIds: string[];
}

export interface SynonymGroup {
  id: string;
  terms: string[];
}

export interface ClarificationOption {
  label: string;
  intentId?: string;
  knowledgeId?: string;
}

export interface ClarificationFlow {
  id: string;
  triggerTerms: string[];
  prompt: string;
  options: ClarificationOption[];
}

export interface SearchConfig {
  synonymGroups?: SynonymGroup[];
  clarificationFlows?: ClarificationFlow[];
}

export type SmallTalkIntentId = 'greeting' | 'thanks' | 'goodbye' | 'help' | 'identity' | 'human' | 'abuse' | 'noise';

export interface SmallTalkRule {
  id: string;
  intentId: SmallTalkIntentId;
  label: string;
  enabled: boolean;
  utterances: string[];
  response: string;
  handoffCta: boolean;
  showSuggestions: boolean;
}

export interface SmallTalkConfig {
  enabled: boolean;
  rules: SmallTalkRule[];
}

export type UtterancePersona = 'parent' | 'student' | 'neutral';
export type UtteranceVariation = 'formal' | 'colloquial' | 'short' | 'synonym' | 'word-order' | 'spacing' | 'typo' | 'contextual';
export type AnswerMode = 'verified' | 'safe-general' | 'handoff';
export type KnowledgeRisk = 'low' | 'policy' | 'personal';

export interface SearchUtterance {
  text: string;
  persona: UtterancePersona;
  variation: UtteranceVariation;
}

export interface KnowledgeItem {
  id: string;
  categoryId: string;
  question: string;
  keywords: string[];
  aliases: string[];
  intentId?: string;
  examples?: string[];
  utterances?: SearchUtterance[];
  answerMode?: AnswerMode;
  riskLevel?: KnowledgeRisk;
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
  handoff?: HandoffConfig;
  customerJourneys?: CustomerJourney[];
  search?: SearchConfig;
  smallTalk?: SmallTalkConfig;
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
  handoffCta?: boolean;
  ticketId?: string;
  clarificationOptions?: ClarificationOption[];
}

export type SearchConfidence = 'high' | 'medium' | 'low';

export type MatchedField = 'question' | 'alias' | 'keyword' | 'tag' | 'synonym' | 'intent' | 'bm25' | 'ngram' | 'token';

export interface SearchScoreBreakdown {
  exact: number;
  alias: number;
  keyword: number;
  tag: number;
  token: number;
  typo: number;
  synonym: number;
  intent: number;
  priority: number;
  penalty: number;
  bm25: number;
  ngram: number;
  jaccard: number;
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
  matchedUtterance?: string;
  scoreMargin?: number;
  decisionReason?: 'exact' | 'confident' | 'ambiguous' | 'low-similarity';
}

export interface ConversationResolution {
  kind: 'knowledge' | 'smalltalk' | 'fallback';
  originalQuery: string;
  effectiveQuery: string;
  searchResult?: SearchResult;
  smallTalkIntent?: SmallTalkIntentId;
  replyText?: string;
  handoffCta?: boolean;
  showSuggestions?: boolean;
}

export interface ConversationEvent {
  id: string;
  botId: string;
  query: string;
  status: SearchResult['status'] | 'smalltalk';
  confidence: SearchConfidence;
  interactionType?: ConversationResolution['kind'];
  effectiveQuery?: string;
  smallTalkIntent?: SmallTalkIntentId;
  matchedKnowledgeIds: string[];
  candidateKnowledgeIds?: string[];
  topScore?: number;
  scoreMargin?: number;
  matchedUtterance?: string;
  decisionReason?: SearchResult['decisionReason'];
  feedback?: 'helpful' | 'not-helpful';
  createdAt: string;
}

export type TicketStatus = 'new' | 'inProgress' | 'resolved' | 'onHold';
export type TicketPriority = 'low' | 'normal' | 'high';
export type TicketSource = 'fallback' | 'negativeFeedback' | 'manualContact' | 'handoffRecommended';

export interface Ticket {
  id: string;
  botId: string;
  status: TicketStatus;
  priority: TicketPriority;
  source: TicketSource;
  name: string;
  contact: string;
  message: string;
  originalQuestion?: string;
  matchedKnowledgeIds: string[];
  conversationEventId?: string;
  adminMemo: string;
  createdAt: string;
  updatedAt: string;
}

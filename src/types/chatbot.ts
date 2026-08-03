export type WidgetView = 'home' | 'chat' | 'conversations' | 'settings' | 'notice';

export type AdminPanelView = 'bot' | 'operation' | 'notices' | 'knowledge' | 'quickReplies' | 'smallTalk' | 'quality' | 'tickets' | 'team' | 'data' | 'logs';

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
  supportSchedule?: {
    timezone: string;
    weekly: Partial<Record<'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat', Array<{
      start: string;
      end: string;
    }>>>;
    holidays: string[];
    firstResponseTargetMinutes: number;
  };
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
export type KnowledgeApprovalStatus = 'verified' | 'pending' | 'unknown';
export type AnswerTrust = 'verified' | 'bounded' | 'unverified';
export type GuardCategory =
  | 'third-party-data'
  | 'sensitive-data'
  | 'private-contact'
  | 'medical-diagnosis'
  | 'guarantee'
  | 'legal-judgment'
  | 'prompt-injection'
  | 'open-domain'
  | 'task-substitution';

export interface GuardDecision {
  category: GuardCategory;
  replyText: string;
  handoffCta: boolean;
}

export interface SearchUtterance {
  text: string;
  persona: UtterancePersona;
  variation: UtteranceVariation;
  split?: 'train' | 'dev' | 'test';
  source?: 'seed' | 'representative' | 'production';
  approved?: boolean;
  contextRequired?: boolean;
  negativeFor?: string[];
  entities?: Record<string, string>;
}

export interface AnswerBlock {
  id: string;
  text: string;
  condition?: string;
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
  approvalStatus?: KnowledgeApprovalStatus;
  tags?: string[];
  negativeKeywords?: string[];
  answer: string;
  shortAnswer?: string;
  answerBlocks?: AnswerBlock[];
  answerVariants?: string[];
  followUpPrompts?: string[];
  buttons: AnswerButton[];
  relatedIds: string[];
  priority: number;
  status?: 'active' | 'draft' | 'archived';
  lastUpdated?: string;
  source?: string;
  handoffRecommended?: boolean;
}

export interface BotConfig {
  schemaVersion?: 1 | 2;
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
  answerTrust?: AnswerTrust;
  matchedKnowledgeIds?: string[];
  feedback?: 'helpful' | 'not-helpful';
  handoffCta?: boolean;
  ticketId?: string;
  clarificationOptions?: ClarificationOption[];
  deliveryStatus?: 'pending' | 'sent' | 'failed';
  failureReason?: string;
}

export type SearchConfidence = 'high' | 'medium' | 'low';

export type MatchedField = 'question' | 'alias' | 'keyword' | 'tag' | 'synonym' | 'intent' | 'bm25' | 'ngram' | 'token' | 'entity' | 'jamo' | 'rrf';

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
  entity: number;
  jamo: number;
  rrf: number;
  routeCount: number;
}

export type QueryType = 'price' | 'method' | 'availability' | 'schedule' | 'policy' | 'location' | 'comparison' | 'identity' | 'general';

export interface QueryFeatures {
  normalized: string;
  stems: string[];
  jamoText: string;
  entities: Record<string, string>;
  queryType: QueryType;
  negative: boolean;
  isShort: boolean;
  referenceStrength: 'none' | 'weak' | 'strong';
  followUp: boolean;
}

export interface ConversationContext {
  lastIntentId?: string;
  lastKnowledgeIds: string[];
  entities: Record<string, string>;
  pendingCandidateIds: string[];
  turnCount: number;
  updatedAt: number;
}

export interface ResponsePlan {
  text: string;
  knowledgeIds: string[];
  toneVariant: number;
  followUpPrompts: string[];
  answerTrust?: AnswerTrust;
}

export type ConversationRouteMode = 'standalone' | 'contextual' | 'clarification' | 'fallback';
export type ConversationEngineVariant = 'baseline' | 'candidate';

export interface ConversationRouteDecision {
  mode: ConversationRouteMode;
  reason:
    | 'no-context'
    | 'same-candidate'
    | 'standalone-exact'
    | 'single-usable'
    | 'score-gap'
    | 'close-candidates'
    | 'reference-without-evidence'
    | 'standalone-ambiguity'
    | 'pending-selection'
    | 'guarded'
    | 'both-low';
  standaloneKnowledgeId?: string;
  contextualKnowledgeId?: string;
  standaloneScore: number;
  contextualScore?: number;
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
  decisionReason?: 'exact' | 'confident' | 'ambiguous' | 'guarded' | 'low-similarity';
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
  answerTrust?: AnswerTrust;
  guardDecision?: GuardDecision;
  responsePlan?: ResponsePlan;
  contextPatch?: ConversationContext;
  routeDecision?: ConversationRouteDecision;
  clarificationPrompt?: string;
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
  answerTrust?: AnswerTrust;
  guardCategory?: GuardCategory;
  matchedKnowledgeIds: string[];
  candidateKnowledgeIds?: string[];
  topScore?: number;
  scoreMargin?: number;
  matchedUtterance?: string;
  decisionReason?: SearchResult['decisionReason'];
  routeMode?: ConversationRouteMode;
  routeReason?: ConversationRouteDecision['reason'];
  standaloneKnowledgeId?: string;
  contextualKnowledgeId?: string;
  standaloneScore?: number;
  contextualScore?: number;
  selectedCandidateId?: string;
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

export type ConversationStatus = 'bot_active' | 'waiting' | 'human_active' | 'resolved';
export type ConversationSender = 'visitor' | 'bot' | 'operator' | 'system';
export type ConversationMessageType = 'text' | 'handoff' | 'status';
export type AdminRole = 'owner' | 'operator';

export interface AdminProfile {
  id: string;
  displayName: string;
  email: string;
  role: AdminRole;
  active: boolean;
}

export interface ConversationContact {
  name: string;
  contact: string;
  channel?: 'email' | 'sms';
  privacyAgreedAt: string;
  consentVersion?: string;
}

export interface SupportConversation {
  id: string;
  botId: string;
  visitorId: string;
  status: ConversationStatus;
  assignedTo?: string;
  assignedName?: string;
  handoffReason?: TicketSource;
  contact?: ConversationContact;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  firstResponseDueAt?: string;
  firstRespondedAt?: string;
  resolvedAt?: string;
  unreadForVisitor: number;
  unreadForAdmins: number;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  clientId: string;
  sender: ConversationSender;
  senderId?: string;
  senderName?: string;
  type: ConversationMessageType;
  text: string;
  matchedKnowledgeIds: string[];
  confidence?: SearchConfidence;
  metadata?: SupportMessageMetadata;
  deliveryStatus?: 'pending' | 'sent' | 'failed';
  failureReason?: string;
  createdAt: string;
}

export interface SupportMessageMetadata {
  buttons?: AnswerButton[];
  suggestionKnowledgeIds?: string[];
  relatedKnowledgeIds?: string[];
  clarificationOptions?: ClarificationOption[];
  handoffCta?: boolean;
  answerTrust?: AnswerTrust;
  feedback?: ChatMessage['feedback'];
}

export interface SupportConversationBundle {
  conversation: SupportConversation;
  messages: SupportMessage[];
}

export interface SupportInternalNote {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
}

export type ConversationAssignmentFilter = 'all' | 'unassigned' | 'mine';
export type ConversationSlaFilter = 'all' | 'dueSoon' | 'overdue';

export interface ConversationListQuery {
  botId: string;
  status?: ConversationStatus | 'all';
  assignment?: ConversationAssignmentFilter;
  adminId?: string;
  search?: string;
  sla?: ConversationSlaFilter;
  cursor?: string;
  limit?: number;
}

export interface ConversationPage {
  items: SupportConversation[];
  nextCursor?: string;
}

export type SupportAuditAction =
  | 'handoff_requested'
  | 'conversation_claimed'
  | 'conversation_transferred'
  | 'conversation_resolved'
  | 'conversation_reopened'
  | 'contact_anonymized'
  | 'contact_viewed';

export interface SupportAuditEvent {
  id: string;
  conversationId: string;
  actorId?: string;
  actorName?: string;
  action: SupportAuditAction;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface SupportSavedReply {
  id: string;
  botId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationOutboxStatus = 'pending' | 'processing' | 'sent' | 'cancelled' | 'failed' | 'dead';

export interface NotificationOutboxItem {
  id: string;
  conversationId: string;
  messageId: string;
  channel: 'email' | 'sms' | 'log';
  status: NotificationOutboxStatus;
  availableAt: string;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BotConfigVersion {
  id: string;
  botId: string;
  version: number;
  state: 'draft' | 'published' | 'archived';
  config: BotConfig;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
}

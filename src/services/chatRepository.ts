import type {
  AdminProfile,
  ConversationListQuery,
  ConversationPage,
  ConversationContact,
  ConversationMessageType,
  ConversationSender,
  SearchConfidence,
  SupportMessageMetadata,
  SupportConversation,
  SupportConversationBundle,
  SupportAuditEvent,
  SupportInternalNote,
  SupportMessage,
  SupportSavedReply,
  NotificationOutboxItem,
  TicketSource,
} from '../types/chatbot';

export interface AppendSupportMessageInput {
  conversationId: string;
  clientId: string;
  sender: ConversationSender;
  senderId?: string;
  senderName?: string;
  type?: ConversationMessageType;
  text: string;
  matchedKnowledgeIds?: string[];
  confidence?: SearchConfidence;
  metadata?: SupportMessageMetadata;
}

export interface ChatRepository {
  readonly kind: 'local' | 'supabase';
  createVisitorConversation(botId: string): Promise<SupportConversationBundle>;
  getOrCreateVisitorConversation(botId: string): Promise<SupportConversationBundle>;
  redeemConversation(token: string): Promise<string>;
  loadConversation(conversationId: string): Promise<SupportConversationBundle | null>;
  listConversations(botId: string): Promise<SupportConversation[]>;
  queryConversations(query: ConversationListQuery): Promise<ConversationPage>;
  appendMessage(input: AppendSupportMessageInput): Promise<SupportMessage>;
  requestHandoff(
    conversationId: string,
    contact: ConversationContact,
    reason: TicketSource,
    firstResponseDueAt?: string,
  ): Promise<SupportConversation>;
  claimConversation(conversationId: string, admin: AdminProfile): Promise<SupportConversation>;
  transferConversation(
    conversationId: string,
    fromAdmin: AdminProfile,
    toAdmin: AdminProfile,
  ): Promise<SupportConversation>;
  resolveConversation(conversationId: string): Promise<SupportConversation>;
  markRead(conversationId: string, audience: 'visitor' | 'admin'): Promise<void>;
  listInternalNotes(conversationId: string): Promise<SupportInternalNote[]>;
  appendInternalNote(conversationId: string, admin: AdminProfile, text: string): Promise<SupportInternalNote>;
  listAuditEvents(conversationId: string): Promise<SupportAuditEvent[]>;
  listSavedReplies(botId: string): Promise<SupportSavedReply[]>;
  saveReply(botId: string, admin: AdminProfile, title: string, body: string): Promise<SupportSavedReply>;
  listNotificationOutbox(conversationId?: string): Promise<NotificationOutboxItem[]>;
  anonymizeExpiredContacts(retentionDays: number, referenceDate?: Date): Promise<number>;
  getCurrentAdmin(): Promise<AdminProfile | null>;
  listAdmins(): Promise<AdminProfile[]>;
  inviteAdmin(email: string, displayName: string, role: AdminProfile['role']): Promise<AdminProfile>;
  setAdminActive(adminId: string, active: boolean): Promise<void>;
  signInAdmin(email: string, password: string): Promise<AdminProfile>;
  signOutAdmin(): Promise<void>;
  subscribe(
    scope: { conversationId?: string; botId?: string },
    listener: () => void,
  ): () => void;
}

export function createClientMessageId(prefix = 'message'): string {
  return `${prefix}-${Date.now()}-${crypto.randomUUID()}`;
}

export function supportMessageToChatMessage(
  message: SupportMessage,
  resolveKnowledge?: (id: string) => import('../types/chatbot').KnowledgeItem | undefined,
) {
  return {
    id: message.clientId,
    role: message.sender === 'visitor' ? 'user' as const : message.sender === 'system' ? 'system' as const : 'bot' as const,
    text: message.text,
    createdAt: new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(message.createdAt)),
    confidence: message.confidence,
    matchedKnowledgeIds: message.matchedKnowledgeIds,
    buttons: message.metadata?.buttons,
    suggestions: message.metadata?.suggestionKnowledgeIds?.flatMap((id) => {
      const item = resolveKnowledge?.(id);
      return item ? [item] : [];
    }),
    relatedQuestions: message.metadata?.relatedKnowledgeIds?.flatMap((id) => {
      const item = resolveKnowledge?.(id);
      return item ? [item] : [];
    }),
    clarificationOptions: message.metadata?.clarificationOptions,
    handoffCta: message.metadata?.handoffCta,
    feedback: message.metadata?.feedback,
    deliveryStatus: message.deliveryStatus ?? 'sent',
    failureReason: message.failureReason,
  };
}

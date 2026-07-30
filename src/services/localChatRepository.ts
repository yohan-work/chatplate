import type {
  AdminProfile,
  ConversationListQuery,
  ConversationPage,
  ConversationContact,
  NotificationOutboxItem,
  SupportAuditAction,
  SupportAuditEvent,
  SupportConversation,
  SupportConversationBundle,
  SupportInternalNote,
  SupportMessage,
  SupportSavedReply,
  TicketSource,
} from '../types/chatbot';
import type { AppendSupportMessageInput, ChatRepository } from './chatRepository';

const STORAGE_KEY = 'chatplate:support-chat:v2';
const VISITOR_KEY = 'chatplate:visitor-id:v1';
const CHANGE_EVENT = 'chatplate:support-chat-change';

interface LocalChatState {
  conversations: SupportConversation[];
  messages: SupportMessage[];
  notes?: SupportInternalNote[];
  auditEvents?: SupportAuditEvent[];
  savedReplies?: SupportSavedReply[];
  outbox?: NotificationOutboxItem[];
  admins?: AdminProfile[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const EMPTY_STATE: LocalChatState = { conversations: [], messages: [] };

function browserStorage(): StorageLike | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readState(storage: StorageLike | null): LocalChatState {
  if (!storage) return structuredClone(EMPTY_STATE);
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '') as LocalChatState;
    if (!Array.isArray(parsed.conversations) || !Array.isArray(parsed.messages)) return structuredClone(EMPTY_STATE);
    return parsed;
  } catch {
    return structuredClone(EMPTY_STATE);
  }
}

function writeState(storage: StorageLike | null, state: LocalChatState): void {
  storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function now(): string {
  return new Date().toISOString();
}

function visitorId(storage: StorageLike | null): string {
  const existing = storage?.getItem(VISITOR_KEY);
  if (existing) return existing;
  const id = `visitor-${crypto.randomUUID()}`;
  storage?.setItem(VISITOR_KEY, id);
  return id;
}

function bundle(state: LocalChatState, conversation: SupportConversation): SupportConversationBundle {
  return {
    conversation,
    messages: state.messages
      .filter((message) => message.conversationId === conversation.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
  };
}

function findConversation(state: LocalChatState, conversationId: string): SupportConversation {
  const conversation = state.conversations.find((entry) => entry.id === conversationId);
  if (!conversation) throw new Error('대화를 찾을 수 없습니다.');
  return conversation;
}

function appendAudit(
  state: LocalChatState,
  conversationId: string,
  action: SupportAuditAction,
  admin?: AdminProfile,
  metadata?: Record<string, string>,
): void {
  state.auditEvents = [...(state.auditEvents ?? []), {
    id: `audit-${crypto.randomUUID()}`,
    conversationId,
    actorId: admin?.id,
    actorName: admin?.displayName,
    action,
    metadata,
    createdAt: now(),
  }];
}

export class LocalChatRepository implements ChatRepository {
  readonly kind = 'local' as const;

  constructor(
    private readonly storage: StorageLike | null = browserStorage(),
    private readonly runtime: 'visitor' | 'admin' = 'visitor',
  ) {}

  async createVisitorConversation(botId: string): Promise<SupportConversationBundle> {
    const state = readState(this.storage);
    const timestamp = now();
    const conversation: SupportConversation = {
      id: `conversation-${crypto.randomUUID()}`,
      botId,
      visitorId: visitorId(this.storage),
      status: 'bot_active',
      createdAt: timestamp,
      updatedAt: timestamp,
      lastMessageAt: timestamp,
      unreadForVisitor: 0,
      unreadForAdmins: 0,
    };
    state.conversations.push(conversation);
    writeState(this.storage, state);
    return bundle(state, conversation);
  }

  async getOrCreateVisitorConversation(botId: string): Promise<SupportConversationBundle> {
    const state = readState(this.storage);
    const id = visitorId(this.storage);
    const existing = state.conversations
      .filter((conversation) => conversation.botId === botId && conversation.visitorId === id)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
    return existing ? bundle(state, existing) : this.createVisitorConversation(botId);
  }

  async redeemConversation(token: string): Promise<string> {
    const state = readState(this.storage);
    const conversationId = token.startsWith('local-') ? token.slice('local-'.length) : token;
    const conversation = findConversation(state, conversationId);
    conversation.visitorId = visitorId(this.storage);
    conversation.updatedAt = now();
    writeState(this.storage, state);
    return conversation.id;
  }

  async loadConversation(conversationId: string): Promise<SupportConversationBundle | null> {
    const state = readState(this.storage);
    const conversation = state.conversations.find((entry) => entry.id === conversationId);
    return conversation ? bundle(state, conversation) : null;
  }

  async listConversations(botId: string): Promise<SupportConversation[]> {
    const currentVisitorId = this.runtime === 'visitor' ? visitorId(this.storage) : undefined;
    return readState(this.storage).conversations
      .filter((conversation) =>
        conversation.botId === botId &&
        (!currentVisitorId || conversation.visitorId === currentVisitorId),
      )
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
  }

  async queryConversations(query: ConversationListQuery): Promise<ConversationPage> {
    const state = readState(this.storage);
    const search = query.search?.trim().toLocaleLowerCase('ko-KR');
    const sorted = state.conversations
      .filter((conversation) => {
        if (conversation.botId !== query.botId) return false;
        if (this.runtime === 'visitor' && conversation.visitorId !== visitorId(this.storage)) return false;
        if (query.status && query.status !== 'all' && conversation.status !== query.status) return false;
        if (query.assignment === 'unassigned' && conversation.assignedTo) return false;
        if (query.assignment === 'mine' && conversation.assignedTo !== query.adminId) return false;
        if (query.sla === 'overdue' && (!conversation.firstResponseDueAt || conversation.firstResponseDueAt >= now())) return false;
        if (query.sla === 'dueSoon') {
          const dueAt = conversation.firstResponseDueAt ? new Date(conversation.firstResponseDueAt).getTime() : 0;
          const remaining = dueAt - Date.now();
          if (remaining <= 0 || remaining > 60 * 60 * 1000) return false;
        }
        if (!search) return true;
        const messageMatch = state.messages.some((message) =>
          message.conversationId === conversation.id && message.text.toLocaleLowerCase('ko-KR').includes(search),
        );
        return messageMatch ||
          conversation.contact?.name.toLocaleLowerCase('ko-KR').includes(search) ||
          conversation.contact?.contact.toLocaleLowerCase('ko-KR').includes(search);
      })
      .sort((left, right) => right.lastMessageAt.localeCompare(left.lastMessageAt));
    const cursorIndex = query.cursor ? sorted.findIndex((entry) => entry.id === query.cursor) + 1 : 0;
    const start = Math.max(0, cursorIndex);
    const limit = Math.min(100, Math.max(1, query.limit ?? 30));
    const items = sorted.slice(start, start + limit);
    return {
      items,
      nextCursor: start + limit < sorted.length ? items.at(-1)?.id : undefined,
    };
  }

  async appendMessage(input: AppendSupportMessageInput): Promise<SupportMessage> {
    const state = readState(this.storage);
    const existing = state.messages.find((message) =>
      message.clientId === input.clientId && message.conversationId === input.conversationId,
    );
    if (existing) return existing;
    const conversation = findConversation(state, input.conversationId);
    if (input.sender === 'bot' && conversation.status !== 'bot_active') {
      throw new Error('상담원 인계 후에는 봇 메시지를 보낼 수 없습니다.');
    }
    if (
      input.sender === 'operator' &&
      (conversation.status !== 'human_active' || conversation.assignedTo !== input.senderId)
    ) {
      throw new Error('담당자로 선점한 상담만 답변할 수 있습니다.');
    }
    const timestamp = now();
    const message: SupportMessage = {
      id: `support-message-${crypto.randomUUID()}`,
      conversationId: input.conversationId,
      clientId: input.clientId,
      sender: input.sender,
      senderId: input.senderId,
      senderName: input.senderName,
      type: input.type ?? 'text',
      text: input.text.trim(),
      matchedKnowledgeIds: input.matchedKnowledgeIds ?? [],
      confidence: input.confidence,
      metadata: input.metadata,
      deliveryStatus: 'sent',
      createdAt: timestamp,
    };
    if (message.sender === 'visitor') {
      conversation.unreadForAdmins += 1;
      if (conversation.status === 'resolved') {
        conversation.status = 'human_active';
        conversation.resolvedAt = undefined;
        appendAudit(state, conversation.id, 'conversation_reopened');
      }
    }
    if (message.sender === 'operator') {
      conversation.unreadForVisitor += 1;
      conversation.firstRespondedAt ??= timestamp;
      const channel = conversation.contact?.channel ?? 'log';
      state.outbox = [...(state.outbox ?? []), {
        id: `outbox-${crypto.randomUUID()}`,
        conversationId: conversation.id,
        messageId: message.id,
        channel,
        status: 'pending',
        availableAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }];
    }
    conversation.updatedAt = timestamp;
    conversation.lastMessageAt = timestamp;
    state.messages.push(message);
    writeState(this.storage, state);
    return message;
  }

  async requestHandoff(
    conversationId: string,
    contact: ConversationContact,
    reason: TicketSource,
    firstResponseDueAt?: string,
  ): Promise<SupportConversation> {
    const state = readState(this.storage);
    const conversation = findConversation(state, conversationId);
    conversation.status = 'waiting';
    conversation.contact = contact;
    conversation.handoffReason = reason;
    conversation.updatedAt = now();
    conversation.lastMessageAt = conversation.updatedAt;
    conversation.firstResponseDueAt =
      firstResponseDueAt ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    state.messages.push({
      id: `support-message-${crypto.randomUUID()}`,
      conversationId,
      clientId: `handoff-${crypto.randomUUID()}`,
      sender: 'system',
      type: 'handoff',
      text: '상담원 연결을 요청했습니다.',
      matchedKnowledgeIds: [],
      createdAt: conversation.updatedAt,
    });
    appendAudit(state, conversationId, 'handoff_requested');
    writeState(this.storage, state);
    return conversation;
  }

  async claimConversation(conversationId: string, admin: AdminProfile): Promise<SupportConversation> {
    const state = readState(this.storage);
    const conversation = findConversation(state, conversationId);
    if (conversation.assignedTo && conversation.assignedTo !== admin.id) {
      throw new Error(`${conversation.assignedName ?? '다른 상담원'}님이 이미 담당 중입니다.`);
    }
    conversation.assignedTo = admin.id;
    conversation.assignedName = admin.displayName;
    conversation.status = 'human_active';
    conversation.updatedAt = now();
    appendAudit(state, conversationId, 'conversation_claimed', admin);
    writeState(this.storage, state);
    return conversation;
  }

  async transferConversation(
    conversationId: string,
    fromAdmin: AdminProfile,
    toAdmin: AdminProfile,
  ): Promise<SupportConversation> {
    const state = readState(this.storage);
    const conversation = findConversation(state, conversationId);
    if (fromAdmin.role !== 'owner' && conversation.assignedTo !== fromAdmin.id) {
      throw new Error('담당자 또는 소유자만 상담을 이관할 수 있습니다.');
    }
    conversation.assignedTo = toAdmin.id;
    conversation.assignedName = toAdmin.displayName;
    conversation.status = 'human_active';
    conversation.updatedAt = now();
    appendAudit(state, conversationId, 'conversation_transferred', fromAdmin, {
      toAdminId: toAdmin.id,
      toAdminName: toAdmin.displayName,
    });
    writeState(this.storage, state);
    return conversation;
  }

  async resolveConversation(conversationId: string): Promise<SupportConversation> {
    const state = readState(this.storage);
    const conversation = findConversation(state, conversationId);
    const timestamp = now();
    conversation.status = 'resolved';
    conversation.resolvedAt = timestamp;
    conversation.updatedAt = timestamp;
    conversation.lastMessageAt = timestamp;
    state.messages.push({
      id: `support-message-${crypto.randomUUID()}`,
      conversationId,
      clientId: `resolved-${crypto.randomUUID()}`,
      sender: 'system',
      senderId: conversation.assignedTo,
      senderName: conversation.assignedName,
      type: 'status',
      text: '상담이 완료되었습니다. 추가 메시지를 보내면 같은 상담이 다시 열립니다.',
      matchedKnowledgeIds: [],
      createdAt: timestamp,
    });
    appendAudit(state, conversationId, 'conversation_resolved');
    writeState(this.storage, state);
    return conversation;
  }

  async markRead(conversationId: string, audience: 'visitor' | 'admin'): Promise<void> {
    const state = readState(this.storage);
    const conversation = findConversation(state, conversationId);
    if (audience === 'visitor') {
      conversation.unreadForVisitor = 0;
      state.outbox = (state.outbox ?? []).map((entry) =>
        entry.conversationId === conversationId && entry.status === 'pending'
          ? { ...entry, status: 'cancelled', updatedAt: now() }
          : entry,
      );
    }
    else conversation.unreadForAdmins = 0;
    writeState(this.storage, state);
  }

  async listInternalNotes(conversationId: string): Promise<SupportInternalNote[]> {
    return (readState(this.storage).notes ?? [])
      .filter((note) => note.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async appendInternalNote(
    conversationId: string,
    admin: AdminProfile,
    text: string,
  ): Promise<SupportInternalNote> {
    const state = readState(this.storage);
    findConversation(state, conversationId);
    const note: SupportInternalNote = {
      id: `note-${crypto.randomUUID()}`,
      conversationId,
      authorId: admin.id,
      authorName: admin.displayName,
      text: text.trim(),
      createdAt: now(),
    };
    state.notes = [...(state.notes ?? []), note];
    writeState(this.storage, state);
    return note;
  }

  async listAuditEvents(conversationId: string): Promise<SupportAuditEvent[]> {
    return (readState(this.storage).auditEvents ?? [])
      .filter((event) => event.conversationId === conversationId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async listSavedReplies(botId: string): Promise<SupportSavedReply[]> {
    return (readState(this.storage).savedReplies ?? [])
      .filter((reply) => reply.botId === botId)
      .sort((left, right) => left.title.localeCompare(right.title, 'ko-KR'));
  }

  async saveReply(
    botId: string,
    admin: AdminProfile,
    title: string,
    body: string,
  ): Promise<SupportSavedReply> {
    const state = readState(this.storage);
    const timestamp = now();
    const reply: SupportSavedReply = {
      id: `saved-reply-${crypto.randomUUID()}`,
      botId,
      title: title.trim(),
      body: body.trim(),
      createdBy: admin.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    state.savedReplies = [...(state.savedReplies ?? []), reply];
    writeState(this.storage, state);
    return reply;
  }

  async listNotificationOutbox(conversationId?: string): Promise<NotificationOutboxItem[]> {
    return (readState(this.storage).outbox ?? [])
      .filter((entry) => !conversationId || entry.conversationId === conversationId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async anonymizeExpiredContacts(retentionDays: number, referenceDate = new Date()): Promise<number> {
    const state = readState(this.storage);
    const cutoff = referenceDate.getTime() - retentionDays * 24 * 60 * 60 * 1000;
    let count = 0;
    for (const conversation of state.conversations) {
      if (!conversation.contact || new Date(conversation.lastMessageAt).getTime() >= cutoff) continue;
      conversation.contact = {
        name: '익명 고객',
        contact: '삭제됨',
        privacyAgreedAt: conversation.contact.privacyAgreedAt,
        consentVersion: conversation.contact.consentVersion,
      };
      appendAudit(state, conversation.id, 'contact_anonymized');
      count += 1;
    }
    if (count) writeState(this.storage, state);
    return count;
  }

  async getCurrentAdmin(): Promise<AdminProfile> {
    return {
      id: 'local-admin',
      displayName: '로컬 상담원',
      email: 'local@chatplate.test',
      role: 'owner',
      active: true,
    };
  }

  async listAdmins(): Promise<AdminProfile[]> {
    const state = readState(this.storage);
    return state.admins?.length ? state.admins : [await this.getCurrentAdmin()];
  }

  async inviteAdmin(
    email: string,
    displayName: string,
    role: AdminProfile['role'],
  ): Promise<AdminProfile> {
    const state = readState(this.storage);
    const profile: AdminProfile = {
      id: `local-admin-${crypto.randomUUID()}`,
      displayName: displayName.trim(),
      email: email.trim(),
      role,
      active: true,
    };
    state.admins = [...(state.admins ?? [await this.getCurrentAdmin()]), profile];
    writeState(this.storage, state);
    return profile;
  }

  async setAdminActive(adminId: string, active: boolean): Promise<void> {
    const state = readState(this.storage);
    state.admins = (state.admins ?? [await this.getCurrentAdmin()]).map((profile) =>
      profile.id === adminId ? { ...profile, active } : profile,
    );
    writeState(this.storage, state);
  }

  async signInAdmin(): Promise<AdminProfile> {
    return this.getCurrentAdmin();
  }

  async signOutAdmin(): Promise<void> {
    return undefined;
  }

  subscribe(
    _scope: { conversationId?: string; botId?: string },
    listener: () => void,
  ): () => void {
    if (typeof window === 'undefined') return () => undefined;
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) listener();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, listener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(CHANGE_EVENT, listener);
    };
  }
}

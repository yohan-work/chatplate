import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AdminProfile,
  ConversationListQuery,
  ConversationPage,
  ConversationContact,
  NotificationOutboxItem,
  SupportAuditEvent,
  SupportConversation,
  SupportConversationBundle,
  SupportInternalNote,
  SupportMessage,
  SupportSavedReply,
  TicketSource,
} from '../types/chatbot';
import type { AppendSupportMessageInput, ChatRepository } from './chatRepository';
import { getSupabaseClient } from './supabaseClient';

interface ConversationRow {
  id: string;
  bot_id: string;
  visitor_id: string;
  status: SupportConversation['status'];
  assigned_to: string | null;
  assigned_name: string | null;
  handoff_reason: TicketSource | null;
  contact_name: string | null;
  contact_value: string | null;
  privacy_agreed_at: string | null;
  contact_channel?: ConversationContact['channel'] | null;
  consent_version?: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string;
  resolved_at: string | null;
  first_response_due_at?: string | null;
  first_responded_at?: string | null;
  unread_for_visitor: number;
  unread_for_admins: number;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  client_id: string;
  sender: SupportMessage['sender'];
  sender_id: string | null;
  sender_name: string | null;
  type: SupportMessage['type'];
  body: string;
  matched_knowledge_ids: string[] | null;
  confidence: SupportMessage['confidence'] | null;
  metadata: SupportMessage['metadata'] | null;
  created_at: string;
}

interface ProfileRow {
  id: string;
  display_name: string;
  email: string;
  role: AdminProfile['role'];
  active: boolean;
}

interface NoteRow {
  id: string;
  conversation_id: string;
  author_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string } | null;
}

function mapConversation(row: ConversationRow): SupportConversation {
  const contact = row.contact_name && row.contact_value && row.privacy_agreed_at
    ? {
      name: row.contact_name,
      contact: row.contact_value,
      channel: row.contact_channel ?? undefined,
      privacyAgreedAt: row.privacy_agreed_at,
      consentVersion: row.consent_version ?? undefined,
    }
    : undefined;
  return {
    id: row.id,
    botId: row.bot_id,
    visitorId: row.visitor_id,
    status: row.status,
    assignedTo: row.assigned_to ?? undefined,
    assignedName: row.assigned_name ?? undefined,
    handoffReason: row.handoff_reason ?? undefined,
    contact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    firstResponseDueAt: row.first_response_due_at ?? undefined,
    firstRespondedAt: row.first_responded_at ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    unreadForVisitor: row.unread_for_visitor,
    unreadForAdmins: row.unread_for_admins,
  };
}

function mapMessage(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    clientId: row.client_id,
    sender: row.sender,
    senderId: row.sender_id ?? undefined,
    senderName: row.sender_name ?? undefined,
    type: row.type,
    text: row.body,
    matchedKnowledgeIds: row.matched_knowledge_ids ?? [],
    confidence: row.confidence ?? undefined,
    metadata: row.metadata ?? undefined,
    deliveryStatus: 'sent',
    createdAt: row.created_at,
  };
}

function mapProfile(row: ProfileRow): AdminProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    active: row.active,
  };
}

function requireData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (!data) throw new Error('서버 응답 데이터가 없습니다.');
  return data;
}

export class SupabaseChatRepository implements ChatRepository {
  readonly kind = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(url: string, publishableKey: string, runtime: 'visitor' | 'admin') {
    this.client = getSupabaseClient(url, publishableKey, runtime);
  }

  private async requireUserId(): Promise<string> {
    const { data: sessionData } = await this.client.auth.getSession();
    if (sessionData.session?.user.id) return sessionData.session.user.id;
    const { data, error } = await this.client.auth.signInAnonymously();
    if (error || !data.user) throw new Error(error?.message ?? '익명 상담 세션을 만들 수 없습니다.');
    return data.user.id;
  }

  private async loadMessages(conversationId: string): Promise<SupportMessage[]> {
    const { data, error } = await this.client
      .from('support_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as MessageRow[]).map(mapMessage);
  }

  async createVisitorConversation(botId: string): Promise<SupportConversationBundle> {
    await this.requireUserId();
    const { data, error } = await this.client.rpc('create_support_conversation', {
      p_bot_id: botId,
    });
    const conversation = mapConversation(requireData(data as ConversationRow | null, error));
    return { conversation, messages: [] };
  }

  async getOrCreateVisitorConversation(botId: string): Promise<SupportConversationBundle> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('support_conversations')
      .select('*')
      .eq('bot_id', botId)
      .eq('visitor_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return this.createVisitorConversation(botId);
    const conversation = mapConversation(data as ConversationRow);
    return { conversation, messages: await this.loadMessages(conversation.id) };
  }

  async redeemConversation(token: string): Promise<string> {
    await this.requireUserId();
    const { data, error } = await this.client.functions.invoke('redeem-conversation', {
      body: { token },
    });
    if (error) throw new Error(error.message);
    const conversationId = (data as { conversationId?: string } | null)?.conversationId;
    if (!conversationId) throw new Error('재접속할 상담을 찾지 못했습니다.');
    return conversationId;
  }

  async loadConversation(conversationId: string): Promise<SupportConversationBundle | null> {
    const { data, error } = await this.client
      .from('support_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const conversation = mapConversation(data as ConversationRow);
    return { conversation, messages: await this.loadMessages(conversationId) };
  }

  async listConversations(botId: string): Promise<SupportConversation[]> {
    const { data, error } = await this.client
      .from('support_conversations')
      .select('*')
      .eq('bot_id', botId)
      .order('last_message_at', { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as ConversationRow[]).map(mapConversation);
  }

  async queryConversations(query: ConversationListQuery): Promise<ConversationPage> {
    const { data, error } = await this.client.rpc('query_support_conversations', {
      p_bot_id: query.botId,
      p_status: query.status === 'all' ? null : query.status ?? null,
      p_assignment: query.assignment ?? 'all',
      p_search: query.search?.trim() || null,
      p_sla: query.sla ?? 'all',
      p_cursor: query.cursor ?? null,
      p_limit: query.limit ?? 30,
    });
    if (error) throw new Error(error.message);
    const payload = (data ?? { items: [] }) as { items?: ConversationRow[]; nextCursor?: string | null };
    return {
      items: (payload.items ?? []).map(mapConversation),
      nextCursor: payload.nextCursor ?? undefined,
    };
  }

  async appendMessage(input: AppendSupportMessageInput): Promise<SupportMessage> {
    const { data, error } = await this.client.rpc('append_support_message', {
      p_conversation_id: input.conversationId,
      p_client_id: input.clientId,
      p_sender: input.sender,
      p_message_type: input.type ?? 'text',
      p_body: input.text.trim(),
      p_matched_knowledge_ids: input.matchedKnowledgeIds ?? [],
      p_confidence: input.confidence ?? null,
      p_sender_name: input.senderName ?? null,
      p_metadata: input.metadata ?? {},
    });
    return mapMessage(requireData(data as MessageRow | null, error));
  }

  async requestHandoff(
    conversationId: string,
    contact: ConversationContact,
    reason: TicketSource,
    firstResponseDueAt?: string,
  ): Promise<SupportConversation> {
    const { data, error } = await this.client.rpc('request_support_handoff', {
      p_conversation_id: conversationId,
      p_contact_name: contact.name,
      p_contact_value: contact.contact,
      p_privacy_agreed_at: contact.privacyAgreedAt,
      p_reason: reason,
      p_contact_channel: contact.channel ?? 'sms',
      p_consent_version: contact.consentVersion ?? '2026-07',
      p_first_response_due_at: firstResponseDueAt ?? null,
    });
    return mapConversation(requireData(data as ConversationRow | null, error));
  }

  async claimConversation(conversationId: string): Promise<SupportConversation> {
    const { data, error } = await this.client.rpc('claim_support_conversation', {
      p_conversation_id: conversationId,
    });
    return mapConversation(requireData(data as ConversationRow | null, error));
  }

  async transferConversation(
    conversationId: string,
    _fromAdmin: AdminProfile,
    toAdmin: AdminProfile,
  ): Promise<SupportConversation> {
    const { data, error } = await this.client.rpc('transfer_support_conversation', {
      p_conversation_id: conversationId,
      p_to_admin_id: toAdmin.id,
    });
    return mapConversation(requireData(data as ConversationRow | null, error));
  }

  async resolveConversation(conversationId: string): Promise<SupportConversation> {
    const { data, error } = await this.client.rpc('resolve_support_conversation', {
      p_conversation_id: conversationId,
    });
    return mapConversation(requireData(data as ConversationRow | null, error));
  }

  async markRead(conversationId: string, audience: 'visitor' | 'admin'): Promise<void> {
    const { error } = await this.client.rpc('mark_support_conversation_read', {
      p_conversation_id: conversationId,
      p_audience: audience,
    });
    if (error) throw new Error(error.message);
  }

  async listInternalNotes(conversationId: string): Promise<SupportInternalNote[]> {
    const { data, error } = await this.client
      .from('support_internal_notes')
      .select('id, conversation_id, author_id, body, created_at, profiles(display_name)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as NoteRow[]).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      authorName: row.profiles?.display_name ?? '상담원',
      text: row.body,
      createdAt: row.created_at,
    }));
  }

  async appendInternalNote(
    conversationId: string,
    admin: AdminProfile,
    text: string,
  ): Promise<SupportInternalNote> {
    const { data, error } = await this.client
      .from('support_internal_notes')
      .insert({
        conversation_id: conversationId,
        author_id: admin.id,
        body: text.trim(),
      })
      .select('id, conversation_id, author_id, body, created_at')
      .single();
    const row = requireData(data as NoteRow | null, error);
    return {
      id: row.id,
      conversationId: row.conversation_id,
      authorId: row.author_id,
      authorName: admin.displayName,
      text: row.body,
      createdAt: row.created_at,
    };
  }

  async listAuditEvents(conversationId: string): Promise<SupportAuditEvent[]> {
    const { data, error } = await this.client
      .from('support_audit_events')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      conversationId: row.conversation_id as string,
      actorId: (row.actor_id as string | null) ?? undefined,
      actorName: (row.actor_name as string | null) ?? undefined,
      action: row.action as SupportAuditEvent['action'],
      metadata: (row.metadata as Record<string, string> | null) ?? undefined,
      createdAt: row.created_at as string,
    }));
  }

  async listSavedReplies(botId: string): Promise<SupportSavedReply[]> {
    const { data, error } = await this.client
      .from('support_saved_replies')
      .select('*')
      .eq('bot_id', botId)
      .order('title');
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      botId: row.bot_id as string,
      title: row.title as string,
      body: row.body as string,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async saveReply(
    botId: string,
    admin: AdminProfile,
    title: string,
    body: string,
  ): Promise<SupportSavedReply> {
    const { data, error } = await this.client
      .from('support_saved_replies')
      .insert({ bot_id: botId, title: title.trim(), body: body.trim(), created_by: admin.id })
      .select('*')
      .single();
    const row = requireData(data, error);
    return {
      id: row.id as string,
      botId: row.bot_id as string,
      title: row.title as string,
      body: row.body as string,
      createdBy: row.created_by as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  async listNotificationOutbox(conversationId?: string): Promise<NotificationOutboxItem[]> {
    let query = this.client.from('notification_outbox').select('*').order('created_at', { ascending: false });
    if (conversationId) query = query.eq('conversation_id', conversationId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      conversationId: row.conversation_id as string,
      messageId: row.message_id as string,
      channel: row.channel as NotificationOutboxItem['channel'],
      status: row.status as NotificationOutboxItem['status'],
      availableAt: row.available_at as string,
      attempts: row.attempts as number,
      lastError: (row.last_error as string | null) ?? undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    }));
  }

  async anonymizeExpiredContacts(retentionDays: number, referenceDate = new Date()): Promise<number> {
    const { data, error } = await this.client.rpc('anonymize_expired_support_contacts', {
      p_retention_days: retentionDays,
      p_reference_at: referenceDate.toISOString(),
    });
    if (error) throw new Error(error.message);
    return Number(data ?? 0);
  }

  async getCurrentAdmin(): Promise<AdminProfile | null> {
    const { data: sessionData } = await this.client.auth.getSession();
    const user = sessionData.session?.user;
    if (!user || user.is_anonymous) return null;
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapProfile(data as ProfileRow) : null;
  }

  async listAdmins(): Promise<AdminProfile[]> {
    const { data, error } = await this.client.from('profiles').select('*').order('display_name');
    if (error) throw new Error(error.message);
    return ((data ?? []) as ProfileRow[]).map(mapProfile);
  }

  async inviteAdmin(
    email: string,
    displayName: string,
    role: AdminProfile['role'],
  ): Promise<AdminProfile> {
    const { data, error } = await this.client.functions.invoke('invite-support-admin', {
      body: { email, displayName, role },
    });
    if (error) throw new Error(error.message);
    return {
      id: (data as { id: string }).id,
      email,
      displayName,
      role,
      active: true,
    };
  }

  async setAdminActive(adminId: string, active: boolean): Promise<void> {
    const { error } = await this.client.from('profiles').update({ active }).eq('id', adminId);
    if (error) throw new Error(error.message);
  }

  async signInAdmin(email: string, password: string): Promise<AdminProfile> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const profile = await this.getCurrentAdmin();
    if (!profile) {
      await this.client.auth.signOut();
      throw new Error('활성화된 관리자 계정이 아닙니다.');
    }
    return profile;
  }

  async signOutAdmin(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw new Error(error.message);
  }

  subscribe(scope: { conversationId?: string; botId?: string }, listener: () => void): () => void {
    const channel = this.client.channel(`support-${crypto.randomUUID()}`);
    if (scope.conversationId) {
      channel
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'support_messages',
          filter: `conversation_id=eq.${scope.conversationId}`,
        }, listener)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'support_conversations',
          filter: `id=eq.${scope.conversationId}`,
        }, listener);
    } else if (scope.botId) {
      channel.on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'support_conversations',
        filter: `bot_id=eq.${scope.botId}`,
      }, listener);
    }
    channel.subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}

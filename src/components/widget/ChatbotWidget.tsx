import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bot, History, SquarePen, X } from 'lucide-react';
import { getFallbackSuggestions } from '../../engine/getFallbackSuggestions';
import { resolveConversation } from '../../engine/resolveConversation';
import { findKnowledgeById, searchKnowledge } from '../../engine/searchKnowledge';
import {
  appendConversationEvent,
  createConversationEvent,
  createSmallTalkConversationEvent,
  updateConversationEventFeedback,
  updateConversationEventSelection,
} from '../../utils/conversationEvents';
import type {
  BotConfig,
  ChatMessage,
  ClarificationOption,
  ConversationContact,
  ConversationContext,
  CustomerJourney,
  KnowledgeItem,
  Notice,
  SearchResult,
  SupportConversation,
  TicketSource,
  WidgetView,
} from '../../types/chatbot';
import { createClientMessageId, supportMessageToChatMessage } from '../../services/chatRepository';
import type { ChatRepository } from '../../services/chatRepository';
import { getChatRepository } from '../../services/getChatRepository';
import { getAnalyticsRepository } from '../../services/analyticsRepository';
import { calculateFirstResponseDueAt } from '../../services/calculateFirstResponseDueAt';
import { waitForMinimumResponseDelay } from '../../utils/minimumResponseDelay';
import { BottomNavigation } from './BottomNavigation';
import { HomeView } from '../home/HomeView';
import { ChatView } from '../chat/ChatView';
import type { ContactRequestContext } from '../chat/ChatView';
import { ConversationsView } from '../conversations/ConversationsView';
import { SettingsView } from '../settings/SettingsView';
import { NoticeDetailView } from '../notice/NoticeDetailView';

interface ChatbotWidgetProps {
  botConfig: BotConfig;
  isOpen: boolean;
  onClose: () => void;
  variant?: 'floating' | 'page';
  onUnknownQuestion?: (question: string) => void;
  onSearchResult?: (query: string, result: SearchResult) => void;
  onConversationChanged?: () => void;
  onUnreadChange?: (count: number) => void;
  chatRepository?: ChatRepository;
}

function createMessage(role: ChatMessage['role'], text: string, extra?: Partial<ChatMessage>): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    text,
    createdAt: new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(new Date()),
    ...extra,
  };
}

function confidencePrefix(confidence: ChatMessage['confidence']): string {
  if (confidence === 'medium') return '가장 가까운 답변이에요.\n\n';
  return '';
}

export function ChatbotWidget({
  botConfig,
  isOpen,
  onClose,
  onUnknownQuestion,
  onSearchResult,
  onConversationChanged,
  onUnreadChange,
  chatRepository,
  variant = 'floating',
}: ChatbotWidgetProps) {
  const [activeView, setActiveView] = useState<WidgetView>('home');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [unknownQuestions, setUnknownQuestions] = useState<string[]>([]);
  const [contactRequest, setContactRequest] = useState<ContactRequestContext | null>(null);
  const [selectedIntentId, setSelectedIntentId] = useState<string>();
  const [conversationContext, setConversationContext] = useState<ConversationContext>();
  const [pendingClarificationEventId, setPendingClarificationEventId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [supportConversation, setSupportConversation] = useState<SupportConversation>();
  const [conversationHistory, setConversationHistory] = useState<SupportConversation[]>([]);
  const [isSyncing, setIsSyncing] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [syncError, setSyncError] = useState<string>();
  const automatedResponseRequestId = useRef(0);
  const repository = useMemo(() => chatRepository ?? getChatRepository('visitor'), [chatRepository]);
  const analyticsRepository = useMemo(() => getAnalyticsRepository('visitor'), []);

  const refreshConversation = useCallback(async (conversationId: string) => {
    const bundle = await repository.loadConversation(conversationId);
    if (!bundle) throw new Error('저장된 상담 대화를 찾을 수 없습니다.');
    setSupportConversation(bundle.conversation);
    setMessages(bundle.messages.map((message) =>
      supportMessageToChatMessage(message, (id) => findKnowledgeById(botConfig, id)),
    ));
    const latestKnowledge = [...bundle.messages].reverse().find((message) => message.matchedKnowledgeIds.length > 0);
    if (latestKnowledge) {
      setConversationContext((current) => ({
        lastIntentId: current?.lastIntentId,
        lastKnowledgeIds: latestKnowledge.matchedKnowledgeIds,
        entities: current?.entities ?? {},
        pendingCandidateIds: [],
        turnCount: bundle.messages.filter((message) => message.sender === 'visitor').length,
        updatedAt: Date.now(),
      }));
    }
  }, [botConfig, repository]);

  const refreshConversationHistory = useCallback(async () => {
    setConversationHistory(await repository.listConversations(botConfig.bot.id));
  }, [botConfig.bot.id, repository]);

  const persistMessage = useCallback(async (
    conversationId: string,
    message: ChatMessage,
    sender: 'visitor' | 'bot',
  ) => {
    await repository.appendMessage({
      conversationId,
      clientId: message.id,
      sender,
      type: 'text',
      text: message.text,
      matchedKnowledgeIds: message.matchedKnowledgeIds,
      confidence: message.confidence,
      metadata: {
        buttons: message.buttons,
        suggestionKnowledgeIds: message.suggestions?.map((item) => item.id),
        relatedKnowledgeIds: message.relatedQuestions?.map((item) => item.id),
        clarificationOptions: message.clarificationOptions,
        handoffCta: message.handoffCta,
        feedback: message.feedback,
      },
    });
  }, [repository]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      automatedResponseRequestId.current += 1;
      setIsThinking(false);
      setIsSyncing(true);
      setSyncError(undefined);
      setActiveView('home');
      setSelectedNotice(null);
      setUnknownQuestions([]);
      setContactRequest(null);
      setSelectedIntentId(undefined);
      setConversationContext(undefined);
      setPendingClarificationEventId(undefined);
      try {
        const resumeToken = new URLSearchParams(window.location.search).get('chatplate-resume');
        const resumedConversationId = resumeToken
          ? await repository.redeemConversation(resumeToken)
          : undefined;
        let bundle = resumedConversationId
          ? await repository.loadConversation(resumedConversationId)
          : await repository.getOrCreateVisitorConversation(botConfig.bot.id);
        if (!bundle) throw new Error('재접속할 상담 대화를 찾지 못했습니다.');
        if (resumeToken) {
          const url = new URL(window.location.href);
          url.searchParams.delete('chatplate-resume');
          window.history.replaceState(null, '', url);
        }
        if (bundle.messages.length === 0) {
          const greeting = createMessage('bot', botConfig.bot.greeting, { id: `greeting-${bundle.conversation.id}` });
          await persistMessage(bundle.conversation.id, greeting, 'bot');
          const refreshed = await repository.loadConversation(bundle.conversation.id);
          if (refreshed) bundle = refreshed;
        }
        if (cancelled) return;
        setSupportConversation(bundle.conversation);
        setMessages(bundle.messages.map((message) =>
          supportMessageToChatMessage(message, (id) => findKnowledgeById(botConfig, id)),
        ));
        await refreshConversationHistory();
      } catch (error) {
        if (!cancelled) setSyncError(error instanceof Error ? error.message : '상담 대화를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    void initialize();
    return () => {
      cancelled = true;
    };
  }, [botConfig, persistMessage, refreshConversationHistory, repository]);

  useEffect(() => {
    if (!supportConversation?.id) return;
    return repository.subscribe({ conversationId: supportConversation.id }, () => {
      void refreshConversation(supportConversation.id).catch((error: unknown) => {
        setSyncError(error instanceof Error ? error.message : '대화를 동기화하지 못했습니다.');
      });
    });
  }, [refreshConversation, repository, supportConversation?.id]);

  useEffect(() => repository.subscribe({ botId: botConfig.bot.id }, () => {
    void refreshConversationHistory().catch(() => undefined);
  }), [botConfig.bot.id, refreshConversationHistory, repository]);

  useEffect(() => {
    if (!isOpen || activeView !== 'chat' || !supportConversation?.id || supportConversation.unreadForVisitor === 0) return;
    void repository.markRead(supportConversation.id, 'visitor').catch((error: unknown) => {
      setSyncError(error instanceof Error ? error.message : '읽음 상태를 저장하지 못했습니다.');
    });
  }, [activeView, isOpen, repository, supportConversation?.id, supportConversation?.unreadForVisitor]);

  useEffect(() => {
    onUnreadChange?.(supportConversation?.unreadForVisitor ?? 0);
  }, [onUnreadChange, supportConversation?.unreadForVisitor]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleNoticeOpen = (notice: Notice) => {
    setSelectedNotice(notice);
    setActiveView('notice');
  };

  const handleQuestionSelect = async (item: KnowledgeItem) => {
    if (!supportConversation || isSyncing) return;
    const hasAutomatedResponse = supportConversation.status === 'bot_active';
    const responseStartedAt = Date.now();
    const minimumDelay = hasAutomatedResponse
      ? waitForMinimumResponseDelay(responseStartedAt)
      : undefined;
    const requestId = hasAutomatedResponse
      ? ++automatedResponseRequestId.current
      : undefined;
    if (requestId !== undefined) setIsThinking(true);
    if (item.intentId) setSelectedIntentId(item.intentId);
    setConversationContext((current) => ({
      lastIntentId: item.intentId,
      lastKnowledgeIds: [item.id],
      entities: current?.entities ?? {},
      pendingCandidateIds: [],
      turnCount: (current?.turnCount ?? 0) + 1,
      updatedAt: Date.now(),
    }));
    if (pendingClarificationEventId) {
      updateConversationEventSelection(pendingClarificationEventId, item.id);
      setPendingClarificationEventId(undefined);
    }
    setActiveView('chat');
    const userMessage = createMessage('user', item.question, { id: createClientMessageId('visitor') });
    const botMessage = hasAutomatedResponse
      ? createMessage('bot', item.answer, {
        id: createClientMessageId('answer'),
        buttons: item.buttons,
        matchedKnowledgeIds: [item.id],
        handoffCta: Boolean(item.handoffRecommended),
      })
      : undefined;
    setMessages((current) => [...current, userMessage]);
    setIsSyncing(true);
    setSyncError(undefined);
    try {
      await persistMessage(supportConversation.id, userMessage, 'visitor');
      if (botMessage && minimumDelay && requestId !== undefined) {
        await minimumDelay;
        if (automatedResponseRequestId.current === requestId) {
          setIsThinking(false);
          setMessages((current) => [...current, botMessage]);
        }
        await persistMessage(supportConversation.id, botMessage, 'bot');
        if (automatedResponseRequestId.current !== requestId) return;
      }
      await refreshConversation(supportConversation.id);
      await refreshConversationHistory();
    } catch (error) {
      if (requestId === undefined || automatedResponseRequestId.current === requestId) {
        setSyncError(error instanceof Error ? error.message : '메시지를 저장하지 못했습니다.');
      }
    } finally {
      if (requestId === undefined || automatedResponseRequestId.current === requestId) {
        setIsThinking(false);
        setIsSyncing(false);
      }
    }
  };

  const handleJourneySelect = (journey: CustomerJourney) => {
    setSelectedIntentId(journey.intentIds[0]);
    const item = findKnowledgeById(botConfig, journey.knowledgeIds[0]);
    if (item) {
      void handleQuestionSelect(item);
      return;
    }
    setActiveView('chat');
  };

  const handleClarificationSelect = (option: ClarificationOption) => {
    setSelectedIntentId(option.intentId);
    const item = option.knowledgeId ? findKnowledgeById(botConfig, option.knowledgeId) : undefined;
    if (item) void handleQuestionSelect(item);
  };

  const openContactRequest = (
    source: TicketSource,
    originalQuestion?: string,
    matchedKnowledgeIds?: string[],
    conversationEventId?: string,
  ) => {
    setContactRequest({
      source,
      originalQuestion,
      matchedKnowledgeIds,
      conversationEventId,
    });
    setActiveView('chat');
  };

  const handleAction = (value: string) => {
    if (value === 'open-contact') {
      setActiveView('settings');
      return;
    }

    if (value.startsWith('open-notice:')) {
      const notice = botConfig.notices.find((entry) => entry.id === value.replace('open-notice:', ''));
      if (notice) handleNoticeOpen(notice);
      return;
    }

    if (value.startsWith('ask:')) {
      const item = findKnowledgeById(botConfig, value.replace('ask:', ''));
      if (item) void handleQuestionSelect(item);
    }
  };

  const handleSubmit = async (query: string) => {
    if (!supportConversation || isSyncing) return;
    const hasAutomatedResponse = supportConversation.status === 'bot_active';
    const responseStartedAt = Date.now();
    const minimumDelay = hasAutomatedResponse
      ? waitForMinimumResponseDelay(responseStartedAt)
      : undefined;
    const requestId = hasAutomatedResponse
      ? ++automatedResponseRequestId.current
      : undefined;
    if (requestId !== undefined) setIsThinking(true);
    setIsSyncing(true);
    setSyncError(undefined);
    const userMessage = createMessage('user', query, {
      id: createClientMessageId('visitor'),
      deliveryStatus: 'pending',
    });
    setMessages((current) => [...current, userMessage]);
    setActiveView('chat');
    try {
      await persistMessage(supportConversation.id, userMessage, 'visitor');
      if (supportConversation.status !== 'bot_active') {
        await refreshConversation(supportConversation.id);
        onConversationChanged?.();
        return;
      }

      const resolution = resolveConversation(query, botConfig, { intentId: selectedIntentId, context: conversationContext });
      let botMessage: ChatMessage;

      if (resolution.kind === 'smalltalk') {
        const event = createSmallTalkConversationEvent(botConfig.bot.id, resolution);
        if (repository.kind === 'local') appendConversationEvent(event);
        else void analyticsRepository.record(supportConversation.id, event).catch(() => undefined);
        botMessage = createMessage('bot', resolution.replyText ?? botConfig.bot.fallbackMessage, {
          suggestions: resolution.showSuggestions ? getFallbackSuggestions(botConfig) : undefined,
          confidence: 'high',
          handoffCta: resolution.handoffCta,
          id: event.id,
        });
      } else {
        const result = resolution.searchResult ?? searchKnowledge(query, botConfig, { intentId: selectedIntentId });
        if (resolution.contextPatch) setConversationContext(resolution.contextPatch);
        const event = createConversationEvent(botConfig.bot.id, query, result, resolution.effectiveQuery, resolution.routeDecision);
        if (repository.kind === 'local') appendConversationEvent(event);
        else void analyticsRepository.record(supportConversation.id, event).catch(() => undefined);
        if (resolution.routeDecision?.mode === 'clarification') setPendingClarificationEventId(event.id);
        onSearchResult?.(query, result);

        const clarification = (result.status === 'fallback' || result.status === 'suggestions')
          ? botConfig.search?.clarificationFlows?.find((flow) => flow.triggerTerms.some((term) => query.includes(term)))
          : undefined;

        if (resolution.routeDecision?.mode === 'clarification') {
          botMessage = createMessage('bot', resolution.clarificationPrompt ?? '새 질문인지, 앞선 문의를 이어가는 것인지 확인해 주세요.', {
            suggestions: result.suggestions,
            confidence: 'medium',
            id: event.id,
          });
        } else if (clarification) {
          botMessage = createMessage('bot', clarification.prompt, {
            clarificationOptions: clarification.options,
            confidence: 'medium',
            id: event.id,
          });
        } else if (result.status === 'answer' && result.item) {
          const items = result.items ?? [result.item];
          const answerText = resolution.responsePlan?.text ?? items.map((item) => item.answer).join('\n\n');
          botMessage = createMessage('bot', `${confidencePrefix(result.confidence)}${answerText}`, {
            buttons: result.item.buttons,
            relatedQuestions: result.alternatives,
            suggestions: result.confidence === 'medium'
              ? result.suggestions.filter((item) => item.id !== result.item?.id)
              : undefined,
            confidence: result.confidence,
            matchedKnowledgeIds: items.map((item) => item.id),
            handoffCta: result.confidence === 'low' || items.some((item) => item.handoffRecommended),
            id: event.id,
          });
        } else if (result.status === 'suggestions') {
          botMessage = createMessage('bot', '혹시 이 질문을 찾으셨나요?', {
            suggestions: result.suggestions,
            confidence: result.confidence,
            handoffCta: true,
            id: event.id,
          });
        } else {
          setUnknownQuestions((current) => [...current, query]);
          onUnknownQuestion?.(query);
          botMessage = createMessage('bot', botConfig.bot.fallbackMessage, {
            suggestions: getFallbackSuggestions(botConfig),
            confidence: result.confidence,
            handoffCta: true,
            id: event.id,
          });
        }
      }

      if (minimumDelay && requestId !== undefined) await minimumDelay;
      if (requestId !== undefined && automatedResponseRequestId.current === requestId) {
        setIsThinking(false);
        setMessages((current) => [...current, botMessage]);
      }
      await persistMessage(supportConversation.id, botMessage, 'bot');
      if (requestId !== undefined && automatedResponseRequestId.current !== requestId) return;
      await refreshConversation(supportConversation.id);
      await refreshConversationHistory();
      onConversationChanged?.();
    } catch (error) {
      if (requestId === undefined || automatedResponseRequestId.current === requestId) {
        setMessages((current) => current.map((message) =>
          message.id === userMessage.id
            ? {
              ...message,
              deliveryStatus: 'failed',
              failureReason: error instanceof Error ? error.message : '메시지를 전송하지 못했습니다.',
            }
            : message,
        ));
        setSyncError(error instanceof Error ? error.message : '메시지를 전송하지 못했습니다.');
      }
    } finally {
      if (requestId === undefined || automatedResponseRequestId.current === requestId) {
        setIsThinking(false);
        setIsSyncing(false);
      }
    }
  };

  const handleRequestHandoff = (message: ChatMessage) => {
    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const previousUserMessage = messageIndex > 0
      ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === 'user')
      : undefined;
    const source: TicketSource = message.confidence === 'low' ? 'fallback' : 'handoffRecommended';
    openContactRequest(source, previousUserMessage?.text, message.matchedKnowledgeIds, message.id);
  };

  const handleHandoffSubmit = async (contact: ConversationContact, message: string) => {
    if (!supportConversation || !contactRequest) throw new Error('연결할 상담 대화가 없습니다.');
    const lastVisitorMessage = [...messages].reverse().find((entry) => entry.role === 'user');
    if (message && message !== lastVisitorMessage?.text) {
      const additionalMessage = createMessage('user', message, { id: createClientMessageId('visitor') });
      setMessages((current) => [...current, additionalMessage]);
      await persistMessage(supportConversation.id, additionalMessage, 'visitor');
    }
    await repository.requestHandoff(
      supportConversation.id,
      contact,
      contactRequest.source,
      calculateFirstResponseDueAt(botConfig.operation),
    );
    setContactRequest(null);
    await refreshConversation(supportConversation.id);
    await refreshConversationHistory();
    onConversationChanged?.();
  };

  const resetConversation = async () => {
    automatedResponseRequestId.current += 1;
    setIsThinking(false);
    setIsSyncing(true);
    setSyncError(undefined);
    try {
      const bundle = await repository.createVisitorConversation(botConfig.bot.id);
      const greeting = createMessage('bot', botConfig.bot.greeting, { id: `greeting-${bundle.conversation.id}` });
      await persistMessage(bundle.conversation.id, greeting, 'bot');
      await refreshConversation(bundle.conversation.id);
      await refreshConversationHistory();
      setUnknownQuestions([]);
      setContactRequest(null);
      setSelectedIntentId(undefined);
      setConversationContext(undefined);
      setPendingClarificationEventId(undefined);
      setActiveView('chat');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : '새 대화를 만들지 못했습니다.');
    } finally {
      setIsSyncing(false);
    }
  };

  const unreadCount = botConfig.notices.filter((notice) => notice.unread).length;

  return (
    <section
      className={`chatplate-widget chatplate-widget--${variant}${isOpen ? ' is-open' : ''}`}
      style={{ '--chatplate-primary': botConfig.theme.primaryColor } as CSSProperties}
      aria-label={`${botConfig.bot.name} 챗봇 위젯`}
      aria-hidden={!isOpen}
    >
      <header className="widget-topbar">
        <button className="widget-topbar__brand" type="button" onClick={() => setActiveView('home')} aria-label="챗봇 홈으로 이동">
          <span className="bot-mark">
            <Bot size={19} aria-hidden="true" />
          </span>
          <div>
            <strong>{botConfig.bot.name}</strong>
            <span>{botConfig.operation.botHours}</span>
          </div>
        </button>
        <button className="icon-button" type="button" aria-label="새 대화" onClick={() => void resetConversation()}>
          <SquarePen size={20} aria-hidden="true" />
        </button>
        <button className="icon-button" type="button" aria-label="대화 기록 보기" onClick={() => setActiveView('conversations')}>
          <History size={21} aria-hidden="true" />
        </button>
        {variant === 'floating' ? (
          <button className="icon-button" type="button" aria-label="챗봇 닫기" onClick={onClose}>
            <X size={19} aria-hidden="true" />
          </button>
        ) : <span />}
      </header>

      <div className="widget-body">
        {activeView === 'home' ? (
          <HomeView
            botConfig={botConfig}
            unreadCount={unreadCount}
            onStartChat={() => setActiveView('chat')}
            onOpenNotice={handleNoticeOpen}
            onQuestionSelect={handleQuestionSelect}
            onJourneySelect={handleJourneySelect}
          />
        ) : null}
        {activeView === 'chat' ? (
          <ChatView
            botConfig={botConfig}
            messages={messages}
            contactRequest={contactRequest}
            onSubmit={handleSubmit}
            onQuestionSelect={handleQuestionSelect}
            onAction={handleAction}
            onFeedback={(messageId, feedback) => {
              updateConversationEventFeedback(messageId, feedback);
              setMessages((current) =>
                current.map((message) => (message.id === messageId ? { ...message, feedback, handoffCta: feedback === 'not-helpful' || message.handoffCta } : message)),
              );
              if (feedback === 'not-helpful') {
                const targetIndex = messages.findIndex((message) => message.id === messageId);
                const target = messages[targetIndex];
                const previousUserMessage = targetIndex > 0
                  ? [...messages.slice(0, targetIndex)].reverse().find((message) => message.role === 'user')
                  : undefined;
                openContactRequest('negativeFeedback', previousUserMessage?.text, target?.matchedKnowledgeIds, messageId);
              }
            }}
            onRequestHandoff={handleRequestHandoff}
            onCancelContactRequest={() => setContactRequest(null)}
            onHandoffSubmit={handleHandoffSubmit}
            onClarificationSelect={handleClarificationSelect}
            conversationStatus={supportConversation?.status}
            isSyncing={isSyncing}
            isThinking={isThinking}
            syncError={syncError}
            onRetryMessage={(message) => {
              setMessages((current) => current.filter((entry) => entry.id !== message.id));
              void handleSubmit(message.text);
            }}
          />
        ) : null}
        {activeView === 'conversations' ? (
          <ConversationsView
            botConfig={botConfig}
            conversations={conversationHistory}
            activeConversationId={supportConversation?.id}
            onOpenChat={(conversationId) => {
              automatedResponseRequestId.current += 1;
              setIsThinking(false);
              setIsSyncing(true);
              void refreshConversation(conversationId)
                .then(() => {
                  setActiveView('chat');
                  return repository.markRead(conversationId, 'visitor');
                })
                .catch((error: unknown) => {
                  setSyncError(error instanceof Error ? error.message : '대화를 열지 못했습니다.');
                })
                .finally(() => setIsSyncing(false));
            }}
          />
        ) : null}
        {activeView === 'settings' ? (
          <SettingsView
            botConfig={botConfig}
            unknownQuestions={unknownQuestions}
            onReset={() => void resetConversation()}
          />
        ) : null}
        {activeView === 'notice' && selectedNotice ? (
          <NoticeDetailView notice={selectedNotice} onBack={() => setActiveView('home')} onAction={handleAction} />
        ) : null}
      </div>

      {activeView === 'chat' ? null : <BottomNavigation activeView={activeView} onChange={setActiveView} />}
    </section>
  );
}

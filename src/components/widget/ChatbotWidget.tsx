import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bot, RotateCcw, X } from 'lucide-react';
import { getFallbackSuggestions } from '../../engine/getFallbackSuggestions';
import { resolveConversation } from '../../engine/resolveConversation';
import { findKnowledgeById, searchKnowledge } from '../../engine/searchKnowledge';
import {
  appendConversationEvent,
  createConversationEvent,
  createSmallTalkConversationEvent,
  updateConversationEventFeedback,
} from '../../utils/conversationEvents';
import type { BotConfig, ChatMessage, ClarificationOption, CustomerJourney, KnowledgeItem, Notice, SearchResult, Ticket, TicketSource, WidgetView } from '../../types/chatbot';
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
  onTicketCreated?: (ticket: Ticket) => void;
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
  onTicketCreated,
  variant = 'floating',
}: ChatbotWidgetProps) {
  const [activeView, setActiveView] = useState<WidgetView>('home');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [unknownQuestions, setUnknownQuestions] = useState<string[]>([]);
  const [contactRequest, setContactRequest] = useState<ContactRequestContext | null>(null);
  const [selectedIntentId, setSelectedIntentId] = useState<string>();
  const initialMessages = useMemo(
    () => [createMessage('bot', botConfig.bot.greeting)],
    [botConfig.bot.greeting],
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  useEffect(() => {
    setMessages(initialMessages);
    setActiveView('home');
    setSelectedNotice(null);
    setUnknownQuestions([]);
    setContactRequest(null);
    setSelectedIntentId(undefined);
  }, [initialMessages]);

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

  const handleQuestionSelect = (item: KnowledgeItem) => {
    if (item.intentId) setSelectedIntentId(item.intentId);
    setActiveView('chat');
    setMessages((current) => [
      ...current,
      createMessage('user', item.question),
      createMessage('bot', item.answer, {
        buttons: item.buttons,
        matchedKnowledgeIds: [item.id],
        handoffCta: Boolean(item.handoffRecommended),
      }),
    ]);
  };

  const handleJourneySelect = (journey: CustomerJourney) => {
    setSelectedIntentId(journey.intentIds[0]);
    const item = findKnowledgeById(botConfig, journey.knowledgeIds[0]);
    if (item) {
      handleQuestionSelect(item);
      return;
    }
    setActiveView('chat');
  };

  const handleClarificationSelect = (option: ClarificationOption) => {
    setSelectedIntentId(option.intentId);
    const item = option.knowledgeId ? findKnowledgeById(botConfig, option.knowledgeId) : undefined;
    if (item) handleQuestionSelect(item);
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
      if (item) handleQuestionSelect(item);
    }
  };

  const handleSubmit = (query: string) => {
    const resolution = resolveConversation(query, botConfig, { intentId: selectedIntentId });
    const nextMessages: ChatMessage[] = [createMessage('user', query)];

    if (resolution.kind === 'smalltalk') {
      const event = createSmallTalkConversationEvent(botConfig.bot.id, resolution);
      appendConversationEvent(event);
      nextMessages.push(createMessage('bot', resolution.replyText ?? botConfig.bot.fallbackMessage, {
        suggestions: resolution.showSuggestions ? getFallbackSuggestions(botConfig) : undefined,
        confidence: 'high',
        handoffCta: resolution.handoffCta,
        id: event.id,
      }));
      setMessages((current) => [...current, ...nextMessages]);
      setActiveView('chat');
      return;
    }

    const result = resolution.searchResult ?? searchKnowledge(query, botConfig, { intentId: selectedIntentId });
    const event = createConversationEvent(botConfig.bot.id, query, result, resolution.effectiveQuery);
    appendConversationEvent(event);
    onSearchResult?.(query, result);

    const clarification = (result.status === 'fallback' || result.status === 'suggestions')
      ? botConfig.search?.clarificationFlows?.find((flow) => flow.triggerTerms.some((term) => query.includes(term)))
      : undefined;

    if (clarification) {
      nextMessages.push(createMessage('bot', clarification.prompt, {
        clarificationOptions: clarification.options,
        confidence: 'medium',
        id: event.id,
      }));
    } else if (result.status === 'answer' && result.item) {
      const items = result.items ?? [result.item];
      const answerText = items.map((item) => item.answer).join('\n\n');
      nextMessages.push(
        createMessage('bot', `${confidencePrefix(result.confidence)}${answerText}`, {
          buttons: result.item.buttons,
          relatedQuestions: result.alternatives,
          suggestions: result.confidence === 'medium' ? result.suggestions.filter((item) => item.id !== result.item?.id) : undefined,
          confidence: result.confidence,
          matchedKnowledgeIds: items.map((item) => item.id),
          handoffCta: result.confidence === 'low' || items.some((item) => item.handoffRecommended),
          id: event.id,
        }),
      );
    } else if (result.status === 'suggestions') {
      nextMessages.push(createMessage('bot', '혹시 이 질문을 찾으셨나요?', { suggestions: result.suggestions, confidence: result.confidence, handoffCta: true, id: event.id }));
    } else {
      setUnknownQuestions((current) => [...current, query]);
      onUnknownQuestion?.(query);
      nextMessages.push(
        createMessage('bot', botConfig.bot.fallbackMessage, {
          suggestions: getFallbackSuggestions(botConfig),
          confidence: result.confidence,
          handoffCta: true,
          id: event.id,
        }),
      );
    }

    setMessages((current) => [...current, ...nextMessages]);
    setActiveView('chat');
  };

  const handleRequestHandoff = (message: ChatMessage) => {
    const channel = botConfig.handoff
      ? botConfig.contactChannels.find((entry) => entry.id === botConfig.handoff?.channelId)
      : undefined;

    if (channel) {
      const href = channel.type === 'tel' ? `tel:${channel.value}` : channel.type === 'mailto' ? `mailto:${channel.value}` : channel.value;
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }

    const messageIndex = messages.findIndex((item) => item.id === message.id);
    const previousUserMessage = messageIndex > 0
      ? [...messages.slice(0, messageIndex)].reverse().find((item) => item.role === 'user')
      : undefined;
    const source: TicketSource = message.confidence === 'low' ? 'fallback' : 'handoffRecommended';
    openContactRequest(source, previousUserMessage?.text, message.matchedKnowledgeIds, message.id);
  };

  const handleTicketCreated = (ticket: Ticket) => {
    onTicketCreated?.(ticket);
    setContactRequest(null);
    setMessages((current) => [
      ...current,
      createMessage('system', `상담 요청이 접수되었습니다. 티켓 번호는 ${ticket.id}입니다.`, { ticketId: ticket.id }),
    ]);
  };

  const resetConversation = () => {
    setMessages([createMessage('bot', botConfig.bot.greeting)]);
    setUnknownQuestions([]);
    setContactRequest(null);
    setActiveView('chat');
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
        <div className="widget-topbar__brand">
          <span className="bot-mark">
            <Bot size={19} aria-hidden="true" />
          </span>
          <div>
            <strong>{botConfig.bot.name}</strong>
            <span>{botConfig.operation.botHours}</span>
          </div>
        </div>
        <button className="icon-button" type="button" aria-label="대화 초기화" onClick={resetConversation}>
          <RotateCcw size={18} aria-hidden="true" />
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
            onTicketCreated={handleTicketCreated}
            onClarificationSelect={handleClarificationSelect}
          />
        ) : null}
        {activeView === 'conversations' ? (
          <ConversationsView botConfig={botConfig} messages={messages} onOpenChat={() => setActiveView('chat')} />
        ) : null}
        {activeView === 'settings' ? (
          <SettingsView
            botConfig={botConfig}
            unknownQuestions={unknownQuestions}
            onReset={resetConversation}
          />
        ) : null}
        {activeView === 'notice' && selectedNotice ? (
          <NoticeDetailView notice={selectedNotice} onBack={() => setActiveView('home')} onAction={handleAction} />
        ) : null}
      </div>

      <BottomNavigation activeView={activeView} onChange={setActiveView} />
    </section>
  );
}

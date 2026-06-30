import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bot, RotateCcw, X } from 'lucide-react';
import { getFallbackSuggestions } from '../../engine/getFallbackSuggestions';
import { findKnowledgeById, searchKnowledge } from '../../engine/searchKnowledge';
import { appendConversationEvent, createConversationEvent, updateConversationEventFeedback } from '../../utils/conversationEvents';
import type { BotConfig, ChatMessage, KnowledgeItem, Notice, SearchResult, Ticket, TicketSource, WidgetView } from '../../types/chatbot';
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
}: ChatbotWidgetProps) {
  const [activeView, setActiveView] = useState<WidgetView>('home');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [unknownQuestions, setUnknownQuestions] = useState<string[]>([]);
  const [contactRequest, setContactRequest] = useState<ContactRequestContext | null>(null);
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
    const result = searchKnowledge(query, botConfig);
    const nextMessages: ChatMessage[] = [createMessage('user', query)];
    const event = createConversationEvent(botConfig.bot.id, query, result);
    appendConversationEvent(event);
    onSearchResult?.(query, result);

    if (result.status === 'answer' && result.item) {
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
      className={isOpen ? 'chatplate-widget is-open' : 'chatplate-widget'}
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
        <button className="icon-button" type="button" aria-label="챗봇 닫기" onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="widget-body">
        {activeView === 'home' ? (
          <HomeView
            botConfig={botConfig}
            unreadCount={unreadCount}
            onStartChat={() => setActiveView('chat')}
            onOpenNotice={handleNoticeOpen}
            onQuestionSelect={handleQuestionSelect}
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

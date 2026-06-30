import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Bot, RotateCcw, X } from 'lucide-react';
import { getFallbackSuggestions } from '../../engine/getFallbackSuggestions';
import { findKnowledgeById, searchKnowledge } from '../../engine/searchKnowledge';
import type { BotConfig, ChatMessage, KnowledgeItem, Notice, WidgetView } from '../../types/chatbot';
import { BottomNavigation } from './BottomNavigation';
import { HomeView } from '../home/HomeView';
import { ChatView } from '../chat/ChatView';
import { ConversationsView } from '../conversations/ConversationsView';
import { SettingsView } from '../settings/SettingsView';
import { NoticeDetailView } from '../notice/NoticeDetailView';

interface ChatbotWidgetProps {
  botConfig: BotConfig;
  isOpen: boolean;
  onClose: () => void;
  onUnknownQuestion?: (question: string) => void;
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

export function ChatbotWidget({
  botConfig,
  isOpen,
  onClose,
  onUnknownQuestion,
}: ChatbotWidgetProps) {
  const [activeView, setActiveView] = useState<WidgetView>('home');
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [unknownQuestions, setUnknownQuestions] = useState<string[]>([]);
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
      createMessage('bot', item.answer, { buttons: item.buttons }),
    ]);
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

    if (result.status === 'answer' && result.item) {
      nextMessages.push(createMessage('bot', result.item.answer, { buttons: result.item.buttons }));
    } else if (result.status === 'suggestions') {
      nextMessages.push(createMessage('bot', '혹시 이 질문을 찾으셨나요?', { suggestions: result.suggestions }));
    } else {
      setUnknownQuestions((current) => [...current, query]);
      onUnknownQuestion?.(query);
      nextMessages.push(
        createMessage('bot', botConfig.bot.fallbackMessage, { suggestions: getFallbackSuggestions(botConfig) }),
      );
    }

    setMessages((current) => [...current, ...nextMessages]);
    setActiveView('chat');
  };

  const resetConversation = () => {
    setMessages([createMessage('bot', botConfig.bot.greeting)]);
    setUnknownQuestions([]);
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
            onSubmit={handleSubmit}
            onQuestionSelect={handleQuestionSelect}
            onAction={handleAction}
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

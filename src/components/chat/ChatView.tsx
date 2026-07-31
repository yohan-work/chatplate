import type {
  BotConfig,
  ChatMessage,
  ClarificationOption,
  ConversationContact,
  ConversationStatus,
  KnowledgeItem,
  TicketSource,
} from '../../types/chatbot';
import { findKnowledgeById } from '../../engine/searchKnowledge';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ContactRequestForm } from './ContactRequestForm';
import { ThinkingIndicator } from './ThinkingIndicator';

export interface ContactRequestContext {
  source: TicketSource;
  originalQuestion?: string;
  matchedKnowledgeIds?: string[];
  conversationEventId?: string;
}

interface ChatViewProps {
  botConfig: BotConfig;
  messages: ChatMessage[];
  contactRequest: ContactRequestContext | null;
  onSubmit: (query: string) => void;
  onQuestionSelect: (item: KnowledgeItem) => void;
  onAction: (value: string) => void;
  onFeedback: (messageId: string, feedback: 'helpful' | 'not-helpful') => void;
  onRequestHandoff: (message: ChatMessage) => void;
  onCancelContactRequest: () => void;
  onHandoffSubmit: (contact: ConversationContact, message: string) => Promise<void>;
  onClarificationSelect: (option: ClarificationOption) => void;
  conversationStatus?: ConversationStatus;
  isSyncing?: boolean;
  isThinking?: boolean;
  syncError?: string;
  onRetryMessage: (message: ChatMessage) => void;
}

export function ChatView({
  botConfig,
  messages,
  contactRequest,
  onSubmit,
  onQuestionSelect,
  onAction,
  onFeedback,
  onRequestHandoff,
  onCancelContactRequest,
  onHandoffSubmit,
  onClarificationSelect,
  conversationStatus = 'bot_active',
  isSyncing = false,
  isThinking = false,
  syncError,
  onRetryMessage,
}: ChatViewProps) {
  const statusText = conversationStatus === 'waiting'
    ? '상담원 연결을 기다리고 있어요.'
    : conversationStatus === 'human_active'
      ? '상담원이 대화에 참여 중이에요.'
      : conversationStatus === 'resolved'
        ? '상담이 완료됐어요. 메시지를 보내면 다시 연결됩니다.'
        : '';

  return (
    <div className="chat-view">
      {statusText ? <div className={`conversation-state conversation-state--${conversationStatus}`}>{statusText}</div> : null}
      {syncError ? <div className="conversation-sync-error" role="alert">{syncError}</div> : null}
      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onQuestionSelect={onQuestionSelect}
            onAction={onAction}
            onFeedback={onFeedback}
            onRequestHandoff={onRequestHandoff}
            handoffLabel="상담원 연결"
            onClarificationSelect={onClarificationSelect}
            automationEnabled={conversationStatus === 'bot_active'}
            onRetry={onRetryMessage}
          />
        ))}
        {isThinking ? <ThinkingIndicator /> : null}
        {contactRequest ? (
          <ContactRequestForm
            botConfig={botConfig}
            originalQuestion={contactRequest.originalQuestion}
            onCancel={onCancelContactRequest}
            onSubmit={onHandoffSubmit}
          />
        ) : null}
      </div>

      {messages.length <= 1 ? (
        <div className="quick-replies" aria-label="추천 질문">
          {botConfig.quickReplies.slice(0, 3).map((reply) => {
            const item = findKnowledgeById(botConfig, reply.knowledgeId);
            return item ? (
              <button key={reply.knowledgeId} type="button" onClick={() => onQuestionSelect(item)}>
                {reply.label}
              </button>
            ) : null;
          })}
        </div>
      ) : null}

      <ChatInput
        placeholder={conversationStatus === 'bot_active' ? '궁금한 점을 입력해 주세요.' : '상담원에게 메시지를 남겨 주세요.'}
        onSubmit={onSubmit}
        disabled={isSyncing}
      />
      <p className="disclaimer">{botConfig.bot.disclaimer}</p>
    </div>
  );
}

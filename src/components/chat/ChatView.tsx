import { Clock } from 'lucide-react';
import type { BotConfig, ChatMessage, KnowledgeItem, Ticket, TicketSource } from '../../types/chatbot';
import { findKnowledgeById } from '../../engine/searchKnowledge';
import { Avatar } from '../common/Avatar';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { ContactRequestForm } from './ContactRequestForm';

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
  onTicketCreated: (ticket: Ticket) => void;
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
  onTicketCreated,
}: ChatViewProps) {
  return (
    <div className="chat-view">
      <div className="chat-header">
        <Avatar name={botConfig.bot.name} src={botConfig.bot.avatarUrl} />
        <div>
          <strong>{botConfig.bot.name}</strong>
          <span>
            <Clock size={13} aria-hidden="true" /> {botConfig.operation.csHours}
          </span>
        </div>
      </div>

      <div className="quick-replies" aria-label="추천 질문">
        {botConfig.quickReplies.map((reply) => {
          const item = findKnowledgeById(botConfig, reply.knowledgeId);
          return item ? (
            <button key={reply.knowledgeId} type="button" onClick={() => onQuestionSelect(item)}>
              {reply.label}
            </button>
          ) : null;
        })}
      </div>

      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onQuestionSelect={onQuestionSelect}
            onAction={onAction}
            onFeedback={onFeedback}
            onRequestHandoff={onRequestHandoff}
          />
        ))}
        {contactRequest ? (
          <ContactRequestForm
            botConfig={botConfig}
            source={contactRequest.source}
            originalQuestion={contactRequest.originalQuestion}
            matchedKnowledgeIds={contactRequest.matchedKnowledgeIds}
            conversationEventId={contactRequest.conversationEventId}
            onCancel={onCancelContactRequest}
            onCreated={onTicketCreated}
          />
        ) : null}
      </div>

      <p className="disclaimer">{botConfig.bot.disclaimer}</p>
      <ChatInput placeholder="AI에게 질문해 주세요." onSubmit={onSubmit} />
    </div>
  );
}

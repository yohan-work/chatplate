import type { BotConfig, ChatMessage, ClarificationOption, KnowledgeItem, Ticket, TicketSource } from '../../types/chatbot';
import { findKnowledgeById } from '../../engine/searchKnowledge';
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
  onClarificationSelect: (option: ClarificationOption) => void;
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
  onClarificationSelect,
}: ChatViewProps) {
  return (
    <div className="chat-view">
      <div className="message-list" aria-live="polite">
        {messages.map((message) => (
          <ChatBubble
            key={message.id}
            message={message}
            onQuestionSelect={onQuestionSelect}
            onAction={onAction}
            onFeedback={onFeedback}
            onRequestHandoff={onRequestHandoff}
            handoffLabel={botConfig.handoff?.label}
            onClarificationSelect={onClarificationSelect}
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

      <ChatInput placeholder="궁금한 점을 입력해 주세요." onSubmit={onSubmit} />
      <p className="disclaimer">{botConfig.bot.disclaimer}</p>
    </div>
  );
}

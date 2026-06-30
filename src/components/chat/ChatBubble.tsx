import type { ChatMessage, KnowledgeItem } from '../../types/chatbot';
import { ActionButton } from '../common/ActionButton';

interface ChatBubbleProps {
  message: ChatMessage;
  onQuestionSelect: (item: KnowledgeItem) => void;
  onAction: (value: string) => void;
  onFeedback: (messageId: string, feedback: 'helpful' | 'not-helpful') => void;
}

export function ChatBubble({ message, onQuestionSelect, onAction, onFeedback }: ChatBubbleProps) {
  const canGiveFeedback = message.role === 'bot' && Boolean(message.confidence);

  return (
    <article className={`chat-bubble chat-bubble--${message.role}`}>
      <p>{message.text}</p>
      {message.buttons?.length ? (
        <div className="bubble-actions">
          {message.buttons.map((button) => (
            <ActionButton key={`${button.label}-${button.value}`} button={button} onAction={onAction} />
          ))}
        </div>
      ) : null}
      {message.suggestions?.length ? (
        <div className="suggestion-list">
          {message.suggestions.map((item) => (
            <button key={item.id} type="button" onClick={() => onQuestionSelect(item)}>
              {item.question}
            </button>
          ))}
        </div>
      ) : null}
      {message.relatedQuestions?.length ? (
        <div className="related-list">
          {message.relatedQuestions.map((item) => (
            <button key={item.id} type="button" onClick={() => onQuestionSelect(item)}>
              {item.question}
            </button>
          ))}
        </div>
      ) : null}
      {canGiveFeedback ? (
        <div className="feedback-row" aria-label="답변 피드백">
          <button
            className={message.feedback === 'helpful' ? 'is-selected' : ''}
            type="button"
            disabled={Boolean(message.feedback)}
            onClick={() => onFeedback(message.id, 'helpful')}
          >
            도움 됐어요
          </button>
          <button
            className={message.feedback === 'not-helpful' ? 'is-selected' : ''}
            type="button"
            disabled={Boolean(message.feedback)}
            onClick={() => onFeedback(message.id, 'not-helpful')}
          >
            아니요
          </button>
        </div>
      ) : null}
      <time>{message.createdAt}</time>
    </article>
  );
}

import type { ChatMessage, KnowledgeItem } from '../../types/chatbot';
import { ActionButton } from '../common/ActionButton';

interface ChatBubbleProps {
  message: ChatMessage;
  onQuestionSelect: (item: KnowledgeItem) => void;
  onAction: (value: string) => void;
}

export function ChatBubble({ message, onQuestionSelect, onAction }: ChatBubbleProps) {
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
      <time>{message.createdAt}</time>
    </article>
  );
}

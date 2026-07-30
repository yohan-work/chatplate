import type { ChatMessage, ClarificationOption, KnowledgeItem } from '../../types/chatbot';
import { ActionButton } from '../common/ActionButton';

interface ChatBubbleProps {
  message: ChatMessage;
  onQuestionSelect: (item: KnowledgeItem) => void;
  onAction: (value: string) => void;
  onFeedback: (messageId: string, feedback: 'helpful' | 'not-helpful') => void;
  onRequestHandoff: (message: ChatMessage) => void;
  handoffLabel?: string;
  onClarificationSelect: (option: ClarificationOption) => void;
  automationEnabled?: boolean;
}

export function ChatBubble({
  message,
  onQuestionSelect,
  onAction,
  onFeedback,
  onRequestHandoff,
  handoffLabel,
  onClarificationSelect,
  automationEnabled = true,
}: ChatBubbleProps) {
  const canGiveFeedback = automationEnabled && message.role === 'bot' && Boolean(message.confidence);

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
      {automationEnabled && message.suggestions?.length ? (
        <div className="suggestion-list">
          {message.suggestions.map((item) => (
            <button key={item.id} type="button" onClick={() => onQuestionSelect(item)}>
              {item.question}
            </button>
          ))}
        </div>
      ) : null}
      {automationEnabled && message.clarificationOptions?.length ? (
        <div className="suggestion-list">
          {message.clarificationOptions.map((option) => (
            <button key={option.label} type="button" onClick={() => onClarificationSelect(option)}>
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      {automationEnabled && message.relatedQuestions?.length ? (
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
      {automationEnabled && message.handoffCta ? (
        <button className="handoff-button" type="button" onClick={() => onRequestHandoff(message)}>
          {handoffLabel ?? '상담 요청 남기기'}
        </button>
      ) : null}
      <time>{message.createdAt}</time>
    </article>
  );
}

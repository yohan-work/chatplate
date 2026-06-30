import { MessageSquareText } from 'lucide-react';
import type { BotConfig, ChatMessage } from '../../types/chatbot';
import { Avatar } from '../common/Avatar';

interface ConversationsViewProps {
  botConfig: BotConfig;
  messages: ChatMessage[];
  onOpenChat: () => void;
}

export function ConversationsView({ botConfig, messages, onOpenChat }: ConversationsViewProps) {
  const lastMessage = messages[messages.length - 1];

  return (
    <div className="view-stack">
      <section className="panel-section">
        <div className="section-title">
          <h3>대화</h3>
          <span>최근 문의 1개</span>
        </div>
        <button className="conversation-card" type="button" onClick={onOpenChat}>
          <Avatar name={botConfig.bot.name} src={botConfig.bot.avatarUrl} />
          <span>
            <strong>{botConfig.bot.name} 상담</strong>
            <small>{lastMessage?.text ?? botConfig.bot.greeting}</small>
          </span>
          <MessageSquareText size={20} aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
